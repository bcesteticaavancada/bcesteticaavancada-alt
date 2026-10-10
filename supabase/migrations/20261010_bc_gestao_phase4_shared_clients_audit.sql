-- BC Gestão Fase 4 — clientes compartilhados, agenda individual e auditoria.
-- Mudança aditiva/forward-safe. Financeiro permanece admin-only.

alter table public.staff_profiles
  add column if not exists atende_clientes boolean not null default false;

alter table public.clientes
  add column if not exists ativo boolean not null default true,
  add column if not exists arquivado_at timestamptz,
  add column if not exists arquivado_by uuid;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create or replace function private.is_bc_active_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
      from public.staff_profiles sp
     where sp.user_id = auth.uid()
       and sp.active = true
       and sp.role in ('admin', 'colaborador')
  );
$$;

revoke all on function private.is_bc_active_staff() from public;
grant execute on function private.is_bc_active_staff() to authenticated;

update public.staff_profiles
   set atende_clientes = true,
       updated_at = now()
 where active = true
   and role in ('admin', 'colaborador')
   and atende_clientes = false;

-- Clientes e histórico passam a ser recursos compartilhados da equipe ativa.
drop policy if exists "clientes_colaborador_select_por_vinculo" on public.clientes;
drop policy if exists "clientes_equipe_select" on public.clientes;
create policy "clientes_equipe_select"
  on public.clientes
  for select
  to authenticated
  using (private.is_bc_active_staff());

drop policy if exists "atendimentos_colaborador_select_historico_por_vinculo" on public.atendimentos;
drop policy if exists "atendimentos_equipe_select" on public.atendimentos;
create policy "atendimentos_equipe_select"
  on public.atendimentos
  for select
  to authenticated
  using (private.is_bc_active_staff());

-- Audit log: leitura global apenas admin; escrita exclusivamente por triggers.
drop policy if exists "audit_log_admin_select" on public.audit_log;
create policy "audit_log_admin_select"
  on public.audit_log
  for select
  to authenticated
  using (private.is_bc_admin());

revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function private.bc_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_entity_id uuid;
begin
  if tg_table_name = 'clientes' then
    v_entity_id := coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      v_action := 'cliente_created';
      v_new := jsonb_build_object(
        'nome', new.nome,
        'telefone', new.telefone,
        'email', new.email,
        'ativo', new.ativo
      );
    elsif old.ativo is distinct from new.ativo and new.ativo = false then
      v_action := 'cliente_archived';
      v_old := jsonb_build_object('ativo', old.ativo, 'arquivado_at', old.arquivado_at, 'arquivado_by', old.arquivado_by);
      v_new := jsonb_build_object('ativo', new.ativo, 'arquivado_at', new.arquivado_at, 'arquivado_by', new.arquivado_by);
    elsif old.ativo is distinct from new.ativo and new.ativo = true then
      v_action := 'cliente_reactivated';
      v_old := jsonb_build_object('ativo', old.ativo, 'arquivado_at', old.arquivado_at, 'arquivado_by', old.arquivado_by);
      v_new := jsonb_build_object('ativo', new.ativo, 'arquivado_at', new.arquivado_at, 'arquivado_by', new.arquivado_by);
    else
      v_action := 'cliente_updated';
      v_old := jsonb_build_object('nome', old.nome, 'telefone', old.telefone, 'email', old.email);
      v_new := jsonb_build_object('nome', new.nome, 'telefone', new.telefone, 'email', new.email);
    end if;
  elsif tg_table_name = 'agendamentos' then
    v_entity_id := coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      v_action := 'agendamento_created';
      v_new := jsonb_build_object(
        'cliente_id', new.cliente_id,
        'colaboradora_user_id', new.colaboradora_user_id,
        'procedimento_id', new.procedimento_id,
        'inicio', new.inicio,
        'fim', new.fim,
        'status', new.status
      );
    elsif old.status is distinct from new.status then
      v_action := 'agendamento_status_changed';
      v_old := jsonb_build_object('status', old.status);
      v_new := jsonb_build_object('status', new.status);
    else
      v_action := 'agendamento_updated';
      v_old := jsonb_build_object(
        'procedimento_id', old.procedimento_id,
        'inicio', old.inicio,
        'fim', old.fim,
        'observacao_administrativa', old.observacao_administrativa
      );
      v_new := jsonb_build_object(
        'procedimento_id', new.procedimento_id,
        'inicio', new.inicio,
        'fim', new.fim,
        'observacao_administrativa', new.observacao_administrativa
      );
    end if;
  elsif tg_table_name = 'atendimentos' and tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_action := 'atendimento_created';
    v_new := jsonb_build_object(
      'agendamento_id', new.agendamento_id,
      'cliente_id', new.cliente_id,
      'colaboradora_user_id', new.colaboradora_user_id,
      'procedimento_id', new.procedimento_id,
      'data_atendimento', new.data_atendimento
    );
  else
    return coalesce(new, old);
  end if;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) values (
    auth.uid(),
    v_action,
    tg_table_name,
    v_entity_id,
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.bc_audit_row_change() from public;

drop trigger if exists bc_audit_clientes on public.clientes;
create trigger bc_audit_clientes
  after insert or update on public.clientes
  for each row execute function private.bc_audit_row_change();

drop trigger if exists bc_audit_agendamentos on public.agendamentos;
create trigger bc_audit_agendamentos
  after insert or update on public.agendamentos
  for each row execute function private.bc_audit_row_change();

drop trigger if exists bc_audit_atendimentos on public.atendimentos;
create trigger bc_audit_atendimentos
  after insert on public.atendimentos
  for each row execute function private.bc_audit_row_change();

create or replace function private.bc_cliente_create_impl(
  p_nome text,
  p_telefone text,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente_id uuid;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao cadastro de clientes.' using errcode = '42501';
  end if;

  if nullif(trim(p_nome), '') is null or nullif(trim(p_telefone), '') is null then
    raise exception 'Nome e telefone são obrigatórios.' using errcode = '22023';
  end if;

  insert into public.clientes (nome, telefone, email, created_by)
  values (
    trim(p_nome),
    trim(p_telefone),
    nullif(trim(p_email), ''),
    v_user_id
  )
  returning id into v_cliente_id;

  return v_cliente_id;
end;
$$;

create or replace function public.bc_cliente_create(
  p_nome text,
  p_telefone text,
  p_email text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_cliente_create_impl(p_nome, p_telefone, p_email);
$$;

create or replace function private.bc_cliente_update_impl(
  p_cliente_id uuid,
  p_nome text,
  p_telefone text,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente public.clientes%rowtype;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao cadastro de clientes.' using errcode = '42501';
  end if;

  if nullif(trim(p_nome), '') is null or nullif(trim(p_telefone), '') is null then
    raise exception 'Nome e telefone são obrigatórios.' using errcode = '22023';
  end if;

  select * into v_cliente
    from public.clientes
   where id = p_cliente_id
   for update;

  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  if not private.is_bc_admin() and not v_cliente.ativo then
    raise exception 'Cliente arquivado não pode ser editado pela colaboradora.' using errcode = '42501';
  end if;

  update public.clientes
     set nome = trim(p_nome),
         telefone = trim(p_telefone),
         email = nullif(trim(p_email), ''),
         updated_at = now()
   where id = p_cliente_id;

  return p_cliente_id;
end;
$$;

create or replace function public.bc_cliente_update(
  p_cliente_id uuid,
  p_nome text,
  p_telefone text,
  p_email text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_cliente_update_impl(p_cliente_id, p_nome, p_telefone, p_email);
$$;

create or replace function private.bc_cliente_set_active_impl(
  p_cliente_id uuid,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente public.clientes%rowtype;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode arquivar ou reativar clientes.' using errcode = '42501';
  end if;

  if p_active is null then
    raise exception 'Estado do cliente inválido.' using errcode = '22023';
  end if;

  select * into v_cliente
    from public.clientes
   where id = p_cliente_id
   for update;

  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  update public.clientes
     set ativo = p_active,
         arquivado_at = case when p_active then null else now() end,
         arquivado_by = case when p_active then null else v_user_id end,
         updated_at = now()
   where id = p_cliente_id;

  return p_cliente_id;
end;
$$;

create or replace function public.bc_cliente_set_active(
  p_cliente_id uuid,
  p_active boolean
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_cliente_set_active_impl(p_cliente_id, p_active);
$$;

create or replace function private.bc_agendamento_create_impl(
  p_cliente_id uuid,
  p_colaboradora_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente_ativo boolean;
  v_profissional_valida boolean;
  v_procedimento_ativo boolean;
  v_agendamento_id uuid;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à agenda.' using errcode = '42501';
  end if;

  if not private.is_bc_admin() and p_colaboradora_user_id <> v_user_id then
    raise exception 'Colaboradora só pode criar agendamento para a própria agenda.' using errcode = '42501';
  end if;

  select c.ativo into v_cliente_ativo
    from public.clientes c
   where c.id = p_cliente_id;

  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  if not v_cliente_ativo then
    raise exception 'Cliente arquivado não pode receber novo agendamento.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.staff_profiles sp
     where sp.user_id = p_colaboradora_user_id
       and sp.active = true
       and sp.atende_clientes = true
  ) into v_profissional_valida;

  if not v_profissional_valida then
    raise exception 'Profissional indisponível para agenda.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.procedimentos pr
     where pr.id = p_procedimento_id
       and pr.ativo = true
  ) into v_procedimento_ativo;

  if not v_procedimento_ativo then
    raise exception 'Procedimento inválido ou inativo.' using errcode = '22023';
  end if;

  if p_inicio is null or (p_fim is not null and p_fim <= p_inicio) then
    raise exception 'Horário do agendamento inválido.' using errcode = '22023';
  end if;

  insert into public.agendamentos (
    cliente_id,
    colaboradora_user_id,
    procedimento_id,
    inicio,
    fim,
    observacao_administrativa,
    created_by
  ) values (
    p_cliente_id,
    p_colaboradora_user_id,
    p_procedimento_id,
    p_inicio,
    p_fim,
    nullif(trim(p_observacao), ''),
    v_user_id
  )
  returning id into v_agendamento_id;

  return v_agendamento_id;
end;
$$;

create or replace function public.bc_agendamento_create(
  p_cliente_id uuid,
  p_colaboradora_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_agendamento_create_impl(
    p_cliente_id,
    p_colaboradora_user_id,
    p_procedimento_id,
    p_inicio,
    p_fim,
    p_observacao
  );
$$;

create or replace function private.bc_agendamento_update_impl(
  p_agendamento_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_agendamento public.agendamentos%rowtype;
  v_cliente_ativo boolean;
  v_procedimento_ativo boolean;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à agenda.' using errcode = '42501';
  end if;

  select * into v_agendamento
    from public.agendamentos
   where id = p_agendamento_id
   for update;

  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;

  if not private.is_bc_admin() then
    if not private.is_bc_active_colaborador()
       or v_agendamento.colaboradora_user_id <> v_user_id then
      raise exception 'Acesso negado ao agendamento.' using errcode = '42501';
    end if;
  end if;

  select c.ativo into v_cliente_ativo
    from public.clientes c
   where c.id = v_agendamento.cliente_id;

  if not v_cliente_ativo then
    raise exception 'Cliente arquivado não pode ter agendamento remarcado.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.procedimentos pr
     where pr.id = p_procedimento_id
       and pr.ativo = true
  ) into v_procedimento_ativo;

  if not v_procedimento_ativo then
    raise exception 'Procedimento inválido ou inativo.' using errcode = '22023';
  end if;

  if p_inicio is null or (p_fim is not null and p_fim <= p_inicio) then
    raise exception 'Horário do agendamento inválido.' using errcode = '22023';
  end if;

  update public.agendamentos
     set procedimento_id = p_procedimento_id,
         inicio = p_inicio,
         fim = p_fim,
         observacao_administrativa = nullif(trim(p_observacao), ''),
         updated_at = now()
   where id = p_agendamento_id;

  return p_agendamento_id;
end;
$$;

create or replace function public.bc_agendamento_update(
  p_agendamento_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_agendamento_update_impl(
    p_agendamento_id,
    p_procedimento_id,
    p_inicio,
    p_fim,
    p_observacao
  );
$$;

create or replace function private.bc_staff_directory_impl()
returns table (
  user_id uuid,
  display_name text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao diretório.' using errcode = '42501';
  end if;

  return query
  select sp.user_id, sp.display_name
    from public.staff_profiles sp
   where sp.active = true
     and sp.atende_clientes = true
   order by sp.display_name;
end;
$$;

create or replace function public.bc_staff_directory()
returns table (
  user_id uuid,
  display_name text
)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_staff_directory_impl();
$$;

revoke all on function private.bc_cliente_create_impl(text, text, text) from public;
revoke all on function private.bc_cliente_update_impl(uuid, text, text, text) from public;
revoke all on function private.bc_cliente_set_active_impl(uuid, boolean) from public;
revoke all on function private.bc_agendamento_create_impl(uuid, uuid, uuid, timestamptz, timestamptz, text) from public;
revoke all on function private.bc_agendamento_update_impl(uuid, uuid, timestamptz, timestamptz, text) from public;
revoke all on function private.bc_staff_directory_impl() from public;

revoke execute on function public.bc_cliente_create(text, text, text) from anon;
revoke execute on function public.bc_cliente_update(uuid, text, text, text) from anon;
revoke execute on function public.bc_cliente_set_active(uuid, boolean) from anon;
revoke execute on function public.bc_agendamento_create(uuid, uuid, uuid, timestamptz, timestamptz, text) from anon;
revoke execute on function public.bc_agendamento_update(uuid, uuid, timestamptz, timestamptz, text) from anon;
revoke execute on function public.bc_staff_directory() from anon;

grant execute on function public.bc_cliente_create(text, text, text) to authenticated;
grant execute on function public.bc_cliente_update(uuid, text, text, text) to authenticated;
grant execute on function public.bc_cliente_set_active(uuid, boolean) to authenticated;
grant execute on function public.bc_agendamento_create(uuid, uuid, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.bc_agendamento_update(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.bc_staff_directory() to authenticated;
