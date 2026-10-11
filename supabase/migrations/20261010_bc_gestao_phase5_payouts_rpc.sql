-- BC Gestão Fase 5 — ciclos e lotes de repasse.

create or replace function private.bc_config_repasse_set_impl(
  p_profissional_user_id uuid,
  p_ciclo_dias integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode configurar ciclo de repasse.' using errcode = '42501';
  end if;
  if p_ciclo_dias is null or p_ciclo_dias not in (7, 15, 30) then
    raise exception 'Ciclo de repasse deve ser 7, 15 ou 30 dias.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff_profiles sp where sp.user_id = p_profissional_user_id and sp.active = true and sp.atende_clientes = true) then
    raise exception 'Profissional inválida ou inativa.' using errcode = '22023';
  end if;

  insert into public.config_repasses(profissional_user_id, ciclo_dias, updated_by, updated_at)
  values (p_profissional_user_id, p_ciclo_dias, v_user_id, now())
  on conflict (profissional_user_id) do update
    set ciclo_dias = excluded.ciclo_dias,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values (v_user_id, 'repasse_cycle_updated', 'config_repasses', p_profissional_user_id,
    jsonb_build_object('ciclo_dias', p_ciclo_dias));

  return p_profissional_user_id;
end;
$$;

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
  perform 1 from public.livros_financeiros lf where lf.id = any(v_livro_ids) for update;

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

create or replace function private.bc_repasse_estornar_impl(
  p_repasse_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_repasse public.repasses%rowtype;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode estornar repasse.' using errcode = '42501';
  end if;
  if nullif(trim(p_motivo),'') is null then
    raise exception 'Motivo do estorno é obrigatório.' using errcode = '22023';
  end if;
  select * into v_repasse from public.repasses where id = p_repasse_id for update;
  if not found then raise exception 'Repasse não encontrado.' using errcode = 'P0002'; end if;
  if v_repasse.status = 'estornado' then
    raise exception 'Repasse já está estornado.' using errcode = '22023';
  end if;

  update public.repasses
     set status = 'estornado', estornado_at = now(), estornado_by = v_user_id,
         estorno_motivo = trim(p_motivo), updated_at = now()
   where id = p_repasse_id;

  update public.livros_financeiros lf
     set status = 'em_revisao', reaberto_at = now(), reaberto_by = v_user_id,
         revisao_motivo = 'Repasse estornado: ' || trim(p_motivo), updated_at = now()
   where lf.id in (
     select rl.livro_id from public.repasse_livros rl
      where rl.repasse_id = p_repasse_id and rl.ativo = true
   );

  update public.repasse_livros
     set ativo = false
   where repasse_id = p_repasse_id
     and ativo = true;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (v_user_id, 'repasse_reversed', 'repasses', p_repasse_id,
    jsonb_build_object('status', v_repasse.status, 'valor_total', v_repasse.valor_total),
    jsonb_build_object('status', 'estornado', 'motivo', trim(p_motivo)));
  return p_repasse_id;
end;
$$;

create or replace function private.bc_meus_repasses_impl(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table(
  id uuid,
  periodo_inicio date,
  periodo_fim date,
  valor_total numeric,
  status text,
  pago_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not (private.is_bc_admin() or private.is_bc_active_colaborador()) then
    raise exception 'Acesso negado ao financeiro.' using errcode = '42501';
  end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim < p_periodo_inicio then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  return query
  select r.id, r.periodo_inicio, r.periodo_fim, r.valor_total, r.status, r.pago_at, r.created_at
    from public.repasses r
   where r.profissional_user_id = v_user_id
     and r.periodo_fim >= p_periodo_inicio
     and r.periodo_inicio <= p_periodo_fim
   order by r.periodo_inicio desc, r.created_at desc;
end;
$$;

create or replace function private.bc_financeiro_repasses_admin_impl(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table(
  id uuid,
  profissional_user_id uuid,
  periodo_inicio date,
  periodo_fim date,
  valor_total numeric,
  status text,
  pago_at timestamptz,
  estornado_at timestamptz,
  observacao text,
  created_at timestamptz
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
  select r.id, r.profissional_user_id, r.periodo_inicio, r.periodo_fim, r.valor_total,
         r.status, r.pago_at, r.estornado_at, r.observacao, r.created_at
    from public.repasses r
   where (p_profissional_user_id is null or r.profissional_user_id = p_profissional_user_id)
     and (p_periodo_inicio is null or r.periodo_fim >= p_periodo_inicio)
     and (p_periodo_fim is null or r.periodo_inicio <= p_periodo_fim)
   order by r.periodo_inicio desc, r.created_at desc;
end;
$$;

revoke all on function private.bc_config_repasse_set_impl(uuid, integer) from public, anon;
revoke all on function private.bc_repasse_criar_impl(uuid, uuid[], text) from public, anon;
revoke all on function private.bc_repasse_baixar_impl(uuid, timestamptz) from public, anon;
revoke all on function private.bc_repasse_estornar_impl(uuid, text) from public, anon;
revoke all on function private.bc_meus_repasses_impl(date, date) from public, anon;
revoke all on function private.bc_financeiro_repasses_admin_impl(uuid, date, date) from public, anon;
grant execute on function private.bc_config_repasse_set_impl(uuid, integer) to authenticated;
grant execute on function private.bc_repasse_criar_impl(uuid, uuid[], text) to authenticated;
grant execute on function private.bc_repasse_baixar_impl(uuid, timestamptz) to authenticated;
grant execute on function private.bc_repasse_estornar_impl(uuid, text) to authenticated;
grant execute on function private.bc_meus_repasses_impl(date, date) to authenticated;
grant execute on function private.bc_financeiro_repasses_admin_impl(uuid, date, date) to authenticated;

create or replace function public.bc_config_repasse_set(p_profissional_user_id uuid, p_ciclo_dias integer)
returns uuid language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_config_repasse_set_impl(p_profissional_user_id, p_ciclo_dias); $$;

create or replace function public.bc_repasse_criar(p_profissional_user_id uuid, p_livro_ids uuid[], p_observacao text default null)
returns uuid language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_repasse_criar_impl(p_profissional_user_id, p_livro_ids, p_observacao); $$;

create or replace function public.bc_repasse_baixar(p_repasse_id uuid, p_pago_at timestamptz default now())
returns uuid language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_repasse_baixar_impl(p_repasse_id, p_pago_at); $$;

create or replace function public.bc_repasse_estornar(p_repasse_id uuid, p_motivo text)
returns uuid language sql security invoker set search_path = pg_catalog, public, auth, private
as $$ select private.bc_repasse_estornar_impl(p_repasse_id, p_motivo); $$;

create or replace function public.bc_meus_repasses(p_periodo_inicio date, p_periodo_fim date)
returns table(id uuid, periodo_inicio date, periodo_fim date, valor_total numeric, status text, pago_at timestamptz, created_at timestamptz)
language sql stable security invoker set search_path = pg_catalog, public, auth, private
as $$ select * from private.bc_meus_repasses_impl(p_periodo_inicio, p_periodo_fim); $$;

create or replace function public.bc_financeiro_repasses_admin(
  p_profissional_user_id uuid default null, p_periodo_inicio date default null, p_periodo_fim date default null
)
returns table(id uuid, profissional_user_id uuid, periodo_inicio date, periodo_fim date, valor_total numeric, status text, pago_at timestamptz, estornado_at timestamptz, observacao text, created_at timestamptz)
language sql stable security invoker set search_path = pg_catalog, public, auth, private
as $$ select * from private.bc_financeiro_repasses_admin_impl(p_profissional_user_id, p_periodo_inicio, p_periodo_fim); $$;

revoke all on function public.bc_config_repasse_set(uuid, integer) from public, anon;
revoke all on function public.bc_repasse_criar(uuid, uuid[], text) from public, anon;
revoke all on function public.bc_repasse_baixar(uuid, timestamptz) from public, anon;
revoke all on function public.bc_repasse_estornar(uuid, text) from public, anon;
revoke all on function public.bc_meus_repasses(date, date) from public, anon;
revoke all on function public.bc_financeiro_repasses_admin(uuid, date, date) from public, anon;
grant execute on function public.bc_config_repasse_set(uuid, integer) to authenticated;
grant execute on function public.bc_repasse_criar(uuid, uuid[], text) to authenticated;
grant execute on function public.bc_repasse_baixar(uuid, timestamptz) to authenticated;
grant execute on function public.bc_repasse_estornar(uuid, text) to authenticated;
grant execute on function public.bc_meus_repasses(date, date) to authenticated;
grant execute on function public.bc_financeiro_repasses_admin(uuid, date, date) to authenticated;
