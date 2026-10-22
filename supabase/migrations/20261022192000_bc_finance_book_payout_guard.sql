-- FIN03: revisar livro exige estornar primeiro o lote ativo.
create or replace function private.bc_livro_reabrir_impl(
  p_livro_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro public.livros_financeiros%rowtype;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode reabrir livro.' using errcode = '42501';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Motivo da revisão é obrigatório.' using errcode = '22023';
  end if;
  select * into v_livro from public.livros_financeiros where id = p_livro_id for update;
  if not found then raise exception 'Livro não encontrado.' using errcode = 'P0002'; end if;
  if v_livro.status = 'pago' then
    raise exception 'Livro pago exige estorno do repasse antes da revisão.' using errcode = '55000';
  end if;
  if exists(select 1 from public.repasse_livros rl where rl.livro_id=p_livro_id and rl.ativo) then
    raise exception 'Estorne o repasse ativo antes de revisar ou recalcular o livro.' using errcode='55000';
  end if;
  if v_livro.status = 'em_revisao' then return p_livro_id; end if;
  if v_livro.status <> 'fechado' then
    raise exception 'Somente livro fechado pode ser reaberto.' using errcode = '22023';
  end if;

  update public.livros_financeiros
     set status = 'em_revisao', reaberto_at = now(), reaberto_by = v_user_id,
         revisao_motivo = trim(p_motivo), updated_at = now()
   where id = p_livro_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (v_user_id, 'livro_reopened', 'livros_financeiros', p_livro_id,
    jsonb_build_object('status', v_livro.status, 'repasse_total', v_livro.repasse_total),
    jsonb_build_object('status', 'em_revisao', 'motivo', trim(p_motivo)));
  return p_livro_id;
end;
$$;

create or replace function private.bc_livros_recalcular_impl(
  p_profissional_user_id uuid,
  p_procedimento_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro record;
  v_count integer := 0;
  v_old_producao numeric;
  v_old_repasse numeric;
  v_new_producao numeric;
  v_new_repasse numeric;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode recalcular livros.' using errcode = '42501';
  end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim < p_periodo_inicio then
    raise exception 'Período de recálculo inválido.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.livros_financeiros lf
     where lf.profissional_user_id = p_profissional_user_id
       and lf.periodo_fim >= p_periodo_inicio
       and lf.periodo_inicio <= p_periodo_fim
       and lf.status <> 'em_revisao'
  ) then
    raise exception 'Todos os livros atingidos devem estar em revisão; livro fechado ou pago não pode ser recalculado silenciosamente.' using errcode = '55000';
  end if;

  for v_livro in
    select * from public.livros_financeiros lf
     where lf.profissional_user_id = p_profissional_user_id
       and lf.periodo_fim >= p_periodo_inicio
       and lf.periodo_inicio <= p_periodo_fim
       and lf.status = 'em_revisao'
     order by lf.periodo_inicio
     for update
  loop
    if exists(select 1 from public.repasse_livros rl where rl.livro_id=v_livro.id and rl.ativo) then
      raise exception 'Estorne o repasse ativo antes de revisar ou recalcular o livro.' using errcode='55000';
    end if;
    v_old_producao := v_livro.producao_recebida;
    v_old_repasse := v_livro.repasse_total;

    if exists (
      select 1
        from public.recebimentos r
        left join public.comissao_profissional_procedimento c
          on c.profissional_user_id = r.profissional_user_id
         and c.procedimento_id = r.procedimento_id
         and c.ativo = true
       where r.profissional_user_id = p_profissional_user_id
         and r.status = 'ativo'
         and (r.recebido_at at time zone 'America/Sao_Paulo')::date between greatest(v_livro.periodo_inicio, p_periodo_inicio) and least(v_livro.periodo_fim, p_periodo_fim)
         and (p_procedimento_id is null or r.procedimento_id = p_procedimento_id)
         and c.id is null
    ) then
      raise exception 'Comissão não configurada para o recálculo solicitado.' using errcode = '23514';
    end if;

    delete from public.livro_financeiro_itens li
     using public.recebimentos r
     where li.livro_id = v_livro.id
       and r.id = li.movimento_recebimento_id
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
       and (p_procedimento_id is null or li.procedimento_id = p_procedimento_id);

    insert into public.livro_financeiro_itens (
      livro_id, movimento_recebimento_id, pagamento_id, atendimento_id, procedimento_id,
      valor_recebido_base, percentual_aplicado, valor_repasse
    )
    select v_livro.id, r.id, r.pagamento_id, r.atendimento_id, r.procedimento_id,
           r.valor, c.percentual, round((r.valor * c.percentual / 100.0)::numeric, 2)
      from public.recebimentos r
      join public.comissao_profissional_procedimento c
        on c.profissional_user_id = r.profissional_user_id
       and c.procedimento_id = r.procedimento_id
       and c.ativo = true
     where r.profissional_user_id = p_profissional_user_id
       and r.status = 'ativo'
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between greatest(v_livro.periodo_inicio, p_periodo_inicio) and least(v_livro.periodo_fim, p_periodo_fim)
       and (p_procedimento_id is null or r.procedimento_id = p_procedimento_id)
       and not exists (
         select 1 from public.livro_financeiro_itens existing
          where existing.movimento_recebimento_id = r.id
       );

    select coalesce(sum(li.valor_recebido_base),0), coalesce(sum(li.valor_repasse),0)
      into v_new_producao, v_new_repasse
      from public.livro_financeiro_itens li
     where li.livro_id = v_livro.id;

    update public.livros_financeiros
       set producao_recebida = v_new_producao,
           repasse_total = v_new_repasse,
           status = 'fechado',
           fechado_at = now(),
           fechado_by = v_user_id,
           updated_at = now()
     where id = v_livro.id;

    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
    values (v_user_id, 'livro_recalculated', 'livros_financeiros', v_livro.id,
      jsonb_build_object('producao_recebida', v_old_producao, 'repasse_total', v_old_repasse),
      jsonb_build_object('producao_recebida', v_new_producao, 'repasse_total', v_new_repasse, 'procedimento_id', p_procedimento_id, 'periodo_inicio', p_periodo_inicio, 'periodo_fim', p_periodo_fim));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

