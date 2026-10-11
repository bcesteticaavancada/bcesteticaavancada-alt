-- BC Gestão — Fase 5: ciclos, lotes de repasse, baixa e estorno.

alter table public.repasse_livros
  add column if not exists ativo boolean not null default true;

alter table public.repasse_livros
  drop constraint if exists repasse_livros_livro_id_key;

create unique index if not exists uq_repasse_livros_livro_ativo
  on public.repasse_livros(livro_id)
  where ativo = true;

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
  v_old integer;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode alterar ciclos de repasse.' using errcode = '42501';
  end if;

  if p_ciclo_dias not in (7, 15, 30) then
    raise exception 'Ciclo de repasse inválido.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = p_profissional_user_id
      and sp.active = true
      and sp.atende_clientes = true
  ) then
    raise exception 'Profissional inválida ou inativa.' using errcode = '22023';
  end if;

  select ciclo_dias into v_old
  from public.config_repasses
  where profissional_user_id = p_profissional_user_id;

  insert into public.config_repasses (profissional_user_id, ciclo_dias, updated_by, updated_at)
  values (p_profissional_user_id, p_ciclo_dias, v_user_id, now())
  on conflict (profissional_user_id)
  do update set ciclo_dias = excluded.ciclo_dias,
                updated_by = excluded.updated_by,
                updated_at = excluded.updated_at;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_user_id,
    'repasse_cycle_updated',
    'config_repasses',
    p_profissional_user_id,
    case when v_old is null then null else jsonb_build_object('ciclo_dias', v_old) end,
    jsonb_build_object('ciclo_dias', p_ciclo_dias)
  );

  return p_profissional_user_id;
end;
$$;

create or replace function public.bc_config_repasse_set(
  p_profissional_user_id uuid,
  p_ciclo_dias integer
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_config_repasse_set_impl(p_profissional_user_id, p_ciclo_dias);
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
  v_expected integer;
  v_found integer;
  v_repasse_id uuid;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_valor_total numeric(12,2);
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode criar repasses.' using errcode = '42501';
  end if;

  v_expected := coalesce(array_length(p_livro_ids, 1), 0);
  if v_expected = 0 then
    raise exception 'Selecione ao menos um livro financeiro.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profissional_user_id::text || ':repasse', 0));

  select count(*)::integer, min(periodo_inicio), max(periodo_fim), coalesce(sum(repasse_total), 0)
    into v_found, v_periodo_inicio, v_periodo_fim, v_valor_total
    from public.livros_financeiros
   where id = any(p_livro_ids)
     and profissional_user_id = p_profissional_user_id
     and status = 'fechado';

  if v_found <> v_expected then
    raise exception 'Todos os livros devem estar fechados, sem duplicidade e pertencer à mesma profissional.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.livros_financeiros lf
    where lf.id = any(p_livro_ids)
      and lf.profissional_user_id <> p_profissional_user_id
  ) then
    raise exception 'Livro pertence a outra profissional.' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.repasse_livros rl
     where rl.livro_id = any(p_livro_ids)
       and rl.ativo = true
  ) then
    raise exception 'Um dos livros já pertence a repasse ativo.' using errcode = '23505';
  end if;

  insert into public.repasses (
    profissional_user_id,
    periodo_inicio,
    periodo_fim,
    valor_total,
    status,
    observacao
  ) values (
    p_profissional_user_id,
    v_periodo_inicio,
    v_periodo_fim,
    v_valor_total,
    'aberto',
    nullif(trim(p_observacao), '')
  ) returning id into v_repasse_id;

  insert into public.repasse_livros (repasse_id, livro_id, ativo)
  select v_repasse_id, livro_id, true
  from unnest(p_livro_ids) as livro_id;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_user_id,
    'repasse_created',
    'repasses',
    v_repasse_id,
    null,
    jsonb_build_object(
      'profissional_user_id', p_profissional_user_id,
      'livro_ids', to_jsonb(p_livro_ids),
      'valor_total', v_valor_total,
      'status', 'aberto'
    )
  );

  return v_repasse_id;
end;
$$;

create or replace function public.bc_repasse_criar(
  p_profissional_user_id uuid,
  p_livro_ids uuid[],
  p_observacao text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_repasse_criar_impl(p_profissional_user_id, p_livro_ids, p_observacao);
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
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode dar baixa em repasse.' using errcode = '42501';
  end if;

  select * into v_repasse
  from public.repasses
  where id = p_repasse_id
  for update;

  if not found then
    raise exception 'Repasse não encontrado.' using errcode = 'P0002';
  end if;

  if v_repasse.status = 'pago' then
    return v_repasse.id;
  end if;

  if v_repasse.status <> 'aberto' then
    raise exception 'Repasse não está aberto para baixa.' using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.repasse_livros rl
      join public.livros_financeiros lf on lf.id = rl.livro_id
     where rl.repasse_id = p_repasse_id
       and rl.ativo = true
       and lf.status <> 'fechado'
  ) then
    raise exception 'Todos os livros do repasse devem permanecer fechados para a baixa.' using errcode = '23514';
  end if;

  update public.repasses
     set status = 'pago',
         pago_at = coalesce(p_pago_at, now()),
         pago_by = v_user_id,
         updated_at = now()
   where id = p_repasse_id;

  update public.livros_financeiros lf
     set status = 'pago',
         updated_at = now()
    from public.repasse_livros rl
   where rl.repasse_id = p_repasse_id
     and rl.ativo = true
     and lf.id = rl.livro_id;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_user_id,
    'repasse_paid',
    'repasses',
    p_repasse_id,
    jsonb_build_object('status', v_repasse.status),
    jsonb_build_object('status', 'pago', 'pago_at', coalesce(p_pago_at, now()), 'valor_total', v_repasse.valor_total)
  );

  return p_repasse_id;
end;
$$;

create or replace function public.bc_repasse_baixar(
  p_repasse_id uuid,
  p_pago_at timestamptz default now()
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_repasse_baixar_impl(p_repasse_id, p_pago_at);
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
  v_livros jsonb;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode estornar repasse.' using errcode = '42501';
  end if;

  if nullif(trim(p_motivo), '') is null then
    raise exception 'Motivo do estorno é obrigatório.' using errcode = '22023';
  end if;

  select * into v_repasse
  from public.repasses
  where id = p_repasse_id
  for update;

  if not found then
    raise exception 'Repasse não encontrado.' using errcode = 'P0002';
  end if;

  if v_repasse.status = 'estornado' then
    return v_repasse.id;
  end if;

  select coalesce(jsonb_agg(rl.livro_id), '[]'::jsonb)
    into v_livros
    from public.repasse_livros rl
   where rl.repasse_id = p_repasse_id
     and rl.ativo = true;

  update public.repasses
     set status = 'estornado',
         estornado_at = now(),
         estornado_by = v_user_id,
         observacao = concat_ws(' | ', nullif(observacao, ''), 'Estorno: ' || trim(p_motivo)),
         updated_at = now()
   where id = p_repasse_id;

  update public.livros_financeiros lf
     set status = 'em_revisao',
         reaberto_at = now(),
         reaberto_by = v_user_id,
         updated_at = now()
    from public.repasse_livros rl
   where rl.repasse_id = p_repasse_id
     and rl.ativo = true
     and lf.id = rl.livro_id;

  update public.repasse_livros
     set ativo = false
   where repasse_id = p_repasse_id
     and ativo = true;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_user_id,
    'repasse_reversed',
    'repasses',
    p_repasse_id,
    jsonb_build_object('status', v_repasse.status, 'livro_ids', v_livros),
    jsonb_build_object('status', 'estornado', 'motivo', trim(p_motivo), 'livro_ids', v_livros)
  );

  return p_repasse_id;
end;
$$;

create or replace function public.bc_repasse_estornar(
  p_repasse_id uuid,
  p_motivo text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_repasse_estornar_impl(p_repasse_id, p_motivo);
$$;

create or replace function private.bc_meus_repasses_impl(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table (
  id uuid,
  periodo_inicio date,
  periodo_fim date,
  valor_total numeric,
  status text,
  pago_at timestamptz,
  observacao text,
  livros jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao financeiro.' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.periodo_inicio,
    r.periodo_fim,
    r.valor_total,
    r.status,
    r.pago_at,
    r.observacao,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'livro_id', lf.id,
        'periodo_inicio', lf.periodo_inicio,
        'periodo_fim', lf.periodo_fim,
        'producao_recebida', lf.producao_recebida,
        'repasse_total', lf.repasse_total,
        'status', lf.status
      ) order by lf.periodo_inicio)
      from public.repasse_livros rl
      join public.livros_financeiros lf on lf.id = rl.livro_id
      where rl.repasse_id = r.id
    ), '[]'::jsonb)
  from public.repasses r
  where r.profissional_user_id = v_user_id
    and r.periodo_fim >= p_periodo_inicio
    and r.periodo_inicio <= p_periodo_fim
  order by r.periodo_inicio desc;
end;
$$;

create or replace function public.bc_meus_repasses(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table (
  id uuid,
  periodo_inicio date,
  periodo_fim date,
  valor_total numeric,
  status text,
  pago_at timestamptz,
  observacao text,
  livros jsonb
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_meus_repasses_impl(p_periodo_inicio, p_periodo_fim);
$$;

create or replace function private.bc_financeiro_repasses_admin_impl(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table (
  id uuid,
  profissional_user_id uuid,
  periodo_inicio date,
  periodo_fim date,
  valor_total numeric,
  status text,
  pago_at timestamptz,
  observacao text,
  livros jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Somente a administradora pode consultar repasses globais.' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.profissional_user_id,
    r.periodo_inicio,
    r.periodo_fim,
    r.valor_total,
    r.status,
    r.pago_at,
    r.observacao,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'livro_id', lf.id,
        'periodo_inicio', lf.periodo_inicio,
        'periodo_fim', lf.periodo_fim,
        'repasse_total', lf.repasse_total,
        'status', lf.status,
        'ativo_no_repasse', rl.ativo
      ) order by lf.periodo_inicio)
      from public.repasse_livros rl
      join public.livros_financeiros lf on lf.id = rl.livro_id
      where rl.repasse_id = r.id
    ), '[]'::jsonb)
  from public.repasses r
  where (p_profissional_user_id is null or r.profissional_user_id = p_profissional_user_id)
    and (p_periodo_inicio is null or r.periodo_fim >= p_periodo_inicio)
    and (p_periodo_fim is null or r.periodo_inicio <= p_periodo_fim)
  order by r.periodo_inicio desc, r.profissional_user_id;
end;
$$;

create or replace function public.bc_financeiro_repasses_admin(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table (
  id uuid,
  profissional_user_id uuid,
  periodo_inicio date,
  periodo_fim date,
  valor_total numeric,
  status text,
  pago_at timestamptz,
  observacao text,
  livros jsonb
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_financeiro_repasses_admin_impl(
    p_profissional_user_id,
    p_periodo_inicio,
    p_periodo_fim
  );
$$;

create or replace function private.bc_financeiro_config_repasses_admin_impl()
returns table (
  profissional_user_id uuid,
  ciclo_dias integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Somente a administradora pode consultar ciclos de repasse.' using errcode = '42501';
  end if;
  return query
  select c.profissional_user_id, c.ciclo_dias, c.updated_at
  from public.config_repasses c
  order by c.profissional_user_id;
end;
$$;

create or replace function public.bc_financeiro_config_repasses_admin()
returns table (
  profissional_user_id uuid,
  ciclo_dias integer,
  updated_at timestamptz
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_financeiro_config_repasses_admin_impl();
$$;

revoke all on function private.bc_config_repasse_set_impl(uuid,integer) from public, anon;
revoke all on function private.bc_repasse_criar_impl(uuid,uuid[],text) from public, anon;
revoke all on function private.bc_repasse_baixar_impl(uuid,timestamptz) from public, anon;
revoke all on function private.bc_repasse_estornar_impl(uuid,text) from public, anon;
revoke all on function private.bc_meus_repasses_impl(date,date) from public, anon;
revoke all on function private.bc_financeiro_repasses_admin_impl(uuid,date,date) from public, anon;
revoke all on function private.bc_financeiro_config_repasses_admin_impl() from public, anon;

grant execute on function private.bc_config_repasse_set_impl(uuid,integer) to authenticated;
grant execute on function private.bc_repasse_criar_impl(uuid,uuid[],text) to authenticated;
grant execute on function private.bc_repasse_baixar_impl(uuid,timestamptz) to authenticated;
grant execute on function private.bc_repasse_estornar_impl(uuid,text) to authenticated;
grant execute on function private.bc_meus_repasses_impl(date,date) to authenticated;
grant execute on function private.bc_financeiro_repasses_admin_impl(uuid,date,date) to authenticated;
grant execute on function private.bc_financeiro_config_repasses_admin_impl() to authenticated;

revoke all on function public.bc_config_repasse_set(uuid,integer) from public, anon;
revoke all on function public.bc_repasse_criar(uuid,uuid[],text) from public, anon;
revoke all on function public.bc_repasse_baixar(uuid,timestamptz) from public, anon;
revoke all on function public.bc_repasse_estornar(uuid,text) from public, anon;
revoke all on function public.bc_meus_repasses(date,date) from public, anon;
revoke all on function public.bc_financeiro_repasses_admin(uuid,date,date) from public, anon;
revoke all on function public.bc_financeiro_config_repasses_admin() from public, anon;

grant execute on function public.bc_config_repasse_set(uuid,integer) to authenticated;
grant execute on function public.bc_repasse_criar(uuid,uuid[],text) to authenticated;
grant execute on function public.bc_repasse_baixar(uuid,timestamptz) to authenticated;
grant execute on function public.bc_repasse_estornar(uuid,text) to authenticated;
grant execute on function public.bc_meus_repasses(date,date) to authenticated;
grant execute on function public.bc_financeiro_repasses_admin(uuid,date,date) to authenticated;
grant execute on function public.bc_financeiro_config_repasses_admin() to authenticated;
