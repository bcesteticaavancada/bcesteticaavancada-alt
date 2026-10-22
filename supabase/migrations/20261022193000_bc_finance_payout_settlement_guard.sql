-- FIN04: baixa confere livros e valores novamente sob bloqueio.
create or replace function private.bc_repasse_criar_impl(
  p_profissional_user_id uuid,
  p_livro_ids uuid[],
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro_ids uuid[];
  v_count integer;
  v_ciclo integer;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_valor_total numeric(12,2);
  v_repasse_id uuid;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode criar repasse.' using errcode = '42501';
  end if;
  if p_livro_ids is null or cardinality(p_livro_ids) = 0 then
    raise exception 'Selecione ao menos um livro financeiro.' using errcode = '22023';
  end if;

  select array_agg(distinct x) into v_livro_ids from unnest(p_livro_ids) as x;
  perform 1 from public.livros_financeiros lf where lf.id = any(v_livro_ids) order by lf.id for update;

  select count(*), min(lf.periodo_inicio), max(lf.periodo_fim), coalesce(sum(lf.repasse_total),0)
    into v_count, v_periodo_inicio, v_periodo_fim, v_valor_total
    from public.livros_financeiros lf
   where lf.id = any(v_livro_ids);

  if v_count <> cardinality(v_livro_ids) then
    raise exception 'Um ou mais livros não foram encontrados.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.livros_financeiros lf where lf.id = any(v_livro_ids) and lf.status <> 'fechado') then
    raise exception 'Somente livros fechados podem compor um repasse.' using errcode = '22023';
  end if;
  if exists (select 1 from public.livros_financeiros lf where lf.id = any(v_livro_ids) and lf.profissional_user_id <> p_profissional_user_id) then
    raise exception 'Todos os livros devem pertencer à mesma profissional.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.repasse_livros rl
     where rl.livro_id = any(v_livro_ids)
       and rl.ativo = true
  ) then
    raise exception 'Um dos livros já pertence a um repasse ativo.' using errcode = '23505';
  end if;

  select cr.ciclo_dias into v_ciclo
    from public.config_repasses cr
   where cr.profissional_user_id = p_profissional_user_id;
  v_ciclo := coalesce(v_ciclo, 7);

  if (v_periodo_fim - v_periodo_inicio + 1) <> v_count * 7 then
    raise exception 'Os livros selecionados precisam formar períodos semanais contínuos.' using errcode = '22023';
  end if;
  if (v_periodo_fim - v_periodo_inicio + 1) > v_ciclo then
    raise exception 'Livros excedem o ciclo de repasse configurado.' using errcode = '22023';
  end if;

  insert into public.repasses(
    profissional_user_id, periodo_inicio, periodo_fim, valor_total, status, observacao, created_by
  ) values (
    p_profissional_user_id, v_periodo_inicio, v_periodo_fim, v_valor_total, 'aberto', nullif(trim(p_observacao),''), v_user_id
  ) returning id into v_repasse_id;

  insert into public.repasse_livros(repasse_id, livro_id, ativo)
  select v_repasse_id, x, true from unnest(v_livro_ids) as x;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values (v_user_id, 'repasse_created', 'repasses', v_repasse_id,
    jsonb_build_object('profissional_user_id', p_profissional_user_id, 'periodo_inicio', v_periodo_inicio, 'periodo_fim', v_periodo_fim, 'valor_total', v_valor_total, 'livro_ids', v_livro_ids, 'ciclo_dias', v_ciclo));

  return v_repasse_id;
end;
$$;

create or replace function private.bc_repasse_baixar_impl(
  p_repasse_id uuid,
  p_pago_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_repasse public.repasses%rowtype;
  v_count integer;
  v_total numeric(12,2);
  v_pago_at timestamptz := coalesce(p_pago_at, now());
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode baixar repasse.' using errcode = '42501';
  end if;
  select * into v_repasse from public.repasses where id = p_repasse_id for update;
  if not found then raise exception 'Repasse não encontrado.' using errcode = 'P0002'; end if;
  if v_repasse.status <> 'aberto' then
    raise exception 'Somente repasse aberto pode ser baixado.' using errcode = '22023';
  end if;

  perform 1 from public.livros_financeiros lf join public.repasse_livros rl on rl.livro_id=lf.id
   where rl.repasse_id=p_repasse_id and rl.ativo order by lf.id for update of lf;
  select count(*),coalesce(sum(lf.repasse_total),0) into v_count,v_total
    from public.livros_financeiros lf join public.repasse_livros rl on rl.livro_id=lf.id
   where rl.repasse_id=p_repasse_id and rl.ativo;
  if v_count=0 or exists(select 1 from public.livros_financeiros lf join public.repasse_livros rl on rl.livro_id=lf.id
     where rl.repasse_id=p_repasse_id and rl.ativo and (lf.status<>'fechado' or lf.profissional_user_id<>v_repasse.profissional_user_id)) then
    raise exception 'Repasse exige livros ativos fechados da mesma profissional.' using errcode='55000';
  end if;
  if v_total::text in ('NaN','Infinity','-Infinity') or v_repasse.valor_total::text in ('NaN','Infinity','-Infinity') or v_total<>v_repasse.valor_total then
    raise exception 'Valor do repasse diverge dos livros; estorne e monte um novo lote.' using errcode='55000';
  end if;

  update public.repasses
     set status = 'pago', pago_at = v_pago_at, pago_by = v_user_id, updated_at = now()
   where id = p_repasse_id;

  update public.livros_financeiros lf
     set status = 'pago', updated_at = now()
   where lf.id in (
     select rl.livro_id from public.repasse_livros rl
      where rl.repasse_id = p_repasse_id and rl.ativo = true
   );

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (v_user_id, 'repasse_paid', 'repasses', p_repasse_id,
    jsonb_build_object('status', v_repasse.status),
    jsonb_build_object('status', 'pago', 'pago_at', v_pago_at, 'valor_total', v_repasse.valor_total));
  return p_repasse_id;
end;
$$;

