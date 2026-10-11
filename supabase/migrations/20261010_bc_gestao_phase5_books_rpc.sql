-- BC Gestão Fase 5 — comissão privada e livros financeiros semanais.

create or replace function private.bc_comissao_set_impl(
  p_profissional_user_id uuid,
  p_procedimento_id uuid,
  p_percentual numeric
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_old numeric;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode configurar comissão.' using errcode = '42501';
  end if;
  if p_percentual is null or p_percentual < 0 or p_percentual > 100 then
    raise exception 'Percentual de comissão inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff_profiles sp where sp.user_id = p_profissional_user_id and sp.active = true and sp.atende_clientes = true) then
    raise exception 'Profissional inválida ou inativa.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.procedimentos p where p.id = p_procedimento_id and p.ativo = true) then
    raise exception 'Procedimento inválido ou inativo.' using errcode = '22023';
  end if;

  select c.id, c.percentual into v_id, v_old
    from public.comissao_profissional_procedimento c
   where c.profissional_user_id = p_profissional_user_id
     and c.procedimento_id = p_procedimento_id
     and c.ativo = true
   for update;

  if v_id is null then
    insert into public.comissao_profissional_procedimento (
      profissional_user_id, procedimento_id, percentual, ativo, created_by, updated_by
    ) values (
      p_profissional_user_id, p_procedimento_id, p_percentual, true, v_user_id, v_user_id
    ) returning id into v_id;
  else
    update public.comissao_profissional_procedimento
       set percentual = p_percentual,
           updated_by = v_user_id,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_user_id,
    'comissao_updated',
    'comissao_profissional_procedimento',
    v_id,
    case when v_old is null then null else jsonb_build_object('percentual', v_old) end,
    jsonb_build_object('profissional_user_id', p_profissional_user_id, 'procedimento_id', p_procedimento_id, 'percentual', p_percentual)
  );
  return v_id;
end;
$$;

create or replace function private.bc_financeiro_comissoes_admin_impl(
  p_profissional_user_id uuid default null
)
returns table (
  id uuid,
  profissional_user_id uuid,
  procedimento_id uuid,
  percentual numeric,
  ativo boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if auth.uid() is null or not private.is_bc_admin() then
    raise exception 'Acesso administrativo obrigatório.' using errcode = '42501';
  end if;
  return query
  select c.id, c.profissional_user_id, c.procedimento_id, c.percentual, c.ativo, c.updated_at
    from public.comissao_profissional_procedimento c
   where (p_profissional_user_id is null or c.profissional_user_id = p_profissional_user_id)
   order by c.profissional_user_id, c.procedimento_id;
end;
$$;

create or replace function private.bc_livro_fechar_impl(
  p_profissional_user_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro_id uuid;
  v_status text;
  v_producao numeric(12,2) := 0;
  v_repasse numeric(12,2) := 0;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode fechar livro.' using errcode = '42501';
  end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim <> p_periodo_inicio + 6 then
    raise exception 'Livro financeiro deve conter exatamente 7 dias.' using errcode = '22023';
  end if;

  select lf.id, lf.status into v_livro_id, v_status
    from public.livros_financeiros lf
   where lf.profissional_user_id = p_profissional_user_id
     and lf.periodo_inicio = p_periodo_inicio
     and lf.periodo_fim = p_periodo_fim
   for update;

  if v_livro_id is not null and v_status in ('fechado', 'pago') then
    return v_livro_id;
  end if;
  if v_livro_id is not null and v_status = 'em_revisao' then
    raise exception 'Livro está em revisão; use o recálculo administrativo.' using errcode = '55000';
  end if;

  if exists (
    select 1
      from public.recebimentos r
      left join public.comissao_profissional_procedimento c
        on c.profissional_user_id = r.profissional_user_id
       and c.procedimento_id = r.procedimento_id
       and c.ativo = true
     where r.profissional_user_id = p_profissional_user_id
       and r.status = 'ativo'
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
       and not exists (
         select 1 from public.livro_financeiro_itens li
          where li.movimento_recebimento_id = r.id
       )
       and c.id is null
  ) then
    raise exception 'Comissão não configurada para todos os procedimentos recebidos no período.' using errcode = '23514';
  end if;

  if v_livro_id is null then
    insert into public.livros_financeiros (
      profissional_user_id, periodo_inicio, periodo_fim, status
    ) values (
      p_profissional_user_id, p_periodo_inicio, p_periodo_fim, 'aberto'
    ) returning id into v_livro_id;
  else
    delete from public.livro_financeiro_itens where livro_id = v_livro_id;
  end if;

  insert into public.livro_financeiro_itens (
    livro_id,
    movimento_recebimento_id,
    pagamento_id,
    atendimento_id,
    procedimento_id,
    valor_recebido_base,
    percentual_aplicado,
    valor_repasse
  )
  select v_livro_id,
         r.id,
         r.pagamento_id,
         r.atendimento_id,
         r.procedimento_id,
         r.valor,
         c.percentual,
         round((r.valor * c.percentual / 100.0)::numeric, 2)
    from public.recebimentos r
    join public.comissao_profissional_procedimento c
      on c.profissional_user_id = r.profissional_user_id
     and c.procedimento_id = r.procedimento_id
     and c.ativo = true
   where r.profissional_user_id = p_profissional_user_id
     and r.status = 'ativo'
     and (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
     and not exists (
       select 1
         from public.livro_financeiro_itens li
        where li.movimento_recebimento_id = r.id
     );

  select coalesce(sum(li.valor_recebido_base), 0), coalesce(sum(li.valor_repasse), 0)
    into v_producao, v_repasse
    from public.livro_financeiro_itens li
   where li.livro_id = v_livro_id;

  update public.livros_financeiros
     set status = 'fechado',
         producao_recebida = v_producao,
         repasse_total = v_repasse,
         fechado_at = now(),
         fechado_by = v_user_id,
         reaberto_at = null,
         reaberto_by = null,
         revisao_motivo = null,
         updated_at = now()
   where id = v_livro_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values (v_user_id, 'livro_closed', 'livros_financeiros', v_livro_id,
    jsonb_build_object('profissional_user_id', p_profissional_user_id, 'periodo_inicio', p_periodo_inicio, 'periodo_fim', p_periodo_fim, 'producao_recebida', v_producao, 'repasse_total', v_repasse));

  return v_livro_id;
end;
$$;

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

create or replace function private.bc_meus_livros_financeiros_impl(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table (
  id uuid,
  periodo_inicio date,
  periodo_fim date,
  status text,
  producao_recebida numeric,
  repasse_total numeric,
  fechado_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not (private.is_bc_admin() or private.is_bc_active_colaborador()) then
    raise exception 'Acesso negado ao financeiro.' using errcode = '42501';
  end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim < p_periodo_inicio then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  return query
  select lf.id, lf.periodo_inicio, lf.periodo_fim, lf.status,
         lf.producao_recebida, lf.repasse_total, lf.fechado_at
    from public.livros_financeiros lf
   where lf.profissional_user_id = v_user_id
     and lf.periodo_fim >= p_periodo_inicio
     and lf.periodo_inicio <= p_periodo_fim
   order by lf.periodo_inicio desc;
end;
$$;

create or replace function private.bc_financeiro_livros_admin_impl(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table (
  livro_id uuid,
  profissional_user_id uuid,
  periodo_inicio date,
  periodo_fim date,
  status text,
  producao_recebida numeric,
  repasse_total numeric,
  fechado_at timestamptz,
  item_id uuid,
  movimento_recebimento_id uuid,
  procedimento_id uuid,
  valor_recebido_base numeric,
  percentual_aplicado numeric,
  valor_repasse numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if auth.uid() is null or not private.is_bc_admin() then
    raise exception 'Acesso administrativo obrigatório.' using errcode = '42501';
  end if;
  return query
  select lf.id, lf.profissional_user_id, lf.periodo_inicio, lf.periodo_fim, lf.status,
         lf.producao_recebida, lf.repasse_total, lf.fechado_at,
         li.id, li.movimento_recebimento_id, li.procedimento_id,
         li.valor_recebido_base, li.percentual_aplicado, li.valor_repasse
    from public.livros_financeiros lf
    left join public.livro_financeiro_itens li on li.livro_id = lf.id
   where (p_profissional_user_id is null or lf.profissional_user_id = p_profissional_user_id)
     and (p_periodo_inicio is null or lf.periodo_fim >= p_periodo_inicio)
     and (p_periodo_fim is null or lf.periodo_inicio <= p_periodo_fim)
   order by lf.periodo_inicio desc, li.created_at;
end;
$$;

revoke all on function private.bc_comissao_set_impl(uuid, uuid, numeric) from public, anon;
revoke all on function private.bc_financeiro_comissoes_admin_impl(uuid) from public, anon;
revoke all on function private.bc_livro_fechar_impl(uuid, date, date) from public, anon;
revoke all on function private.bc_livro_reabrir_impl(uuid, text) from public, anon;
revoke all on function private.bc_livros_recalcular_impl(uuid, uuid, date, date) from public, anon;
revoke all on function private.bc_meus_livros_financeiros_impl(date, date) from public, anon;
revoke all on function private.bc_financeiro_livros_admin_impl(uuid, date, date) from public, anon;
grant execute on function private.bc_comissao_set_impl(uuid, uuid, numeric) to authenticated;
grant execute on function private.bc_financeiro_comissoes_admin_impl(uuid) to authenticated;
grant execute on function private.bc_livro_fechar_impl(uuid, date, date) to authenticated;
grant execute on function private.bc_livro_reabrir_impl(uuid, text) to authenticated;
grant execute on function private.bc_livros_recalcular_impl(uuid, uuid, date, date) to authenticated;
grant execute on function private.bc_meus_livros_financeiros_impl(date, date) to authenticated;
grant execute on function private.bc_financeiro_livros_admin_impl(uuid, date, date) to authenticated;

create or replace function public.bc_comissao_set(p_profissional_user_id uuid, p_procedimento_id uuid, p_percentual numeric)
returns uuid language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_comissao_set_impl(p_profissional_user_id, p_procedimento_id, p_percentual); $$;

create or replace function public.bc_financeiro_comissoes_admin(p_profissional_user_id uuid default null)
returns table(id uuid, profissional_user_id uuid, procedimento_id uuid, percentual numeric, ativo boolean, updated_at timestamptz)
language sql stable security invoker set search_path = pg_catalog, public, auth, private
as $$ select * from private.bc_financeiro_comissoes_admin_impl(p_profissional_user_id); $$;

create or replace function public.bc_livro_fechar(p_profissional_user_id uuid, p_periodo_inicio date, p_periodo_fim date)
returns uuid language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_livro_fechar_impl(p_profissional_user_id, p_periodo_inicio, p_periodo_fim); $$;

create or replace function public.bc_livro_reabrir(p_livro_id uuid, p_motivo text)
returns uuid language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_livro_reabrir_impl(p_livro_id, p_motivo); $$;

create or replace function public.bc_livros_recalcular(
  p_profissional_user_id uuid,
  p_procedimento_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns integer language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_livros_recalcular_impl(p_profissional_user_id, p_procedimento_id, p_periodo_inicio, p_periodo_fim); $$;

create or replace function public.bc_meus_livros_financeiros(p_periodo_inicio date, p_periodo_fim date)
returns table(id uuid, periodo_inicio date, periodo_fim date, status text, producao_recebida numeric, repasse_total numeric, fechado_at timestamptz)
language sql stable security invoker set search_path = pg_catalog, public, auth, private
as $$ select * from private.bc_meus_livros_financeiros_impl(p_periodo_inicio, p_periodo_fim); $$;

create or replace function public.bc_financeiro_livros_admin(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table(
  livro_id uuid, profissional_user_id uuid, periodo_inicio date, periodo_fim date, status text,
  producao_recebida numeric, repasse_total numeric, fechado_at timestamptz, item_id uuid,
  movimento_recebimento_id uuid, procedimento_id uuid, valor_recebido_base numeric,
  percentual_aplicado numeric, valor_repasse numeric
)
language sql stable security invoker set search_path = pg_catalog, public, auth, private
as $$ select * from private.bc_financeiro_livros_admin_impl(p_profissional_user_id, p_periodo_inicio, p_periodo_fim); $$;

revoke all on function public.bc_comissao_set(uuid, uuid, numeric) from public, anon;
revoke all on function public.bc_financeiro_comissoes_admin(uuid) from public, anon;
revoke all on function public.bc_livro_fechar(uuid, date, date) from public, anon;
revoke all on function public.bc_livro_reabrir(uuid, text) from public, anon;
revoke all on function public.bc_livros_recalcular(uuid, uuid, date, date) from public, anon;
revoke all on function public.bc_meus_livros_financeiros(date, date) from public, anon;
revoke all on function public.bc_financeiro_livros_admin(uuid, date, date) from public, anon;
grant execute on function public.bc_comissao_set(uuid, uuid, numeric) to authenticated;
grant execute on function public.bc_financeiro_comissoes_admin(uuid) to authenticated;
grant execute on function public.bc_livro_fechar(uuid, date, date) to authenticated;
grant execute on function public.bc_livro_reabrir(uuid, text) to authenticated;
grant execute on function public.bc_livros_recalcular(uuid, uuid, date, date) to authenticated;
grant execute on function public.bc_meus_livros_financeiros(date, date) to authenticated;
grant execute on function public.bc_financeiro_livros_admin(uuid, date, date) to authenticated;
