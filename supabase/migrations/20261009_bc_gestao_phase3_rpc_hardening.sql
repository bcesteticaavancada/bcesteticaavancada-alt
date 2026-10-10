-- BC Gestão Fase 3 — hardening das RPCs expostas.
-- Wrappers públicos ficam SECURITY INVOKER; lógica privilegiada vive em private.

create or replace function private.bc_set_agendamento_status_impl(
  p_agendamento_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_agendamento public.agendamentos%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('agendado', 'atendido', 'cancelado', 'faltou') then
    raise exception 'Status de agendamento inválido.' using errcode = '22023';
  end if;

  select *
    into v_agendamento
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

  update public.agendamentos
     set status = p_status
   where id = p_agendamento_id;

  return p_agendamento_id;
end;
$$;

create or replace function private.bc_registrar_atendimento_impl(
  p_agendamento_id uuid,
  p_queixa_objetivo text default null,
  p_observacoes text default null,
  p_reacoes text default null,
  p_intercorrencias text default null,
  p_feedback_cliente text default null,
  p_orientacoes text default null,
  p_recomendacao_proxima_sessao text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_agendamento public.agendamentos%rowtype;
  v_cliente_id uuid;
  v_procedimento_id uuid;
  v_colaboradora_user_id uuid;
  v_atendimento_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  select *
    into v_agendamento
    from public.agendamentos
   where id = p_agendamento_id
   for update;

  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_agendamento.status in ('cancelado', 'faltou') then
    raise exception 'Agendamento cancelado ou marcado como falta não pode gerar atendimento.' using errcode = '22023';
  end if;

  if not private.is_bc_admin() then
    if not private.is_bc_active_colaborador()
       or v_agendamento.colaboradora_user_id <> v_user_id then
      raise exception 'Acesso negado ao atendimento.' using errcode = '42501';
    end if;
  end if;

  v_cliente_id := v_agendamento.cliente_id;
  v_procedimento_id := v_agendamento.procedimento_id;
  v_colaboradora_user_id := v_agendamento.colaboradora_user_id;

  select id
    into v_atendimento_id
    from public.atendimentos
   where agendamento_id = p_agendamento_id;

  if v_atendimento_id is not null then
    update public.agendamentos
       set status = 'atendido'
     where id = p_agendamento_id;
    return v_atendimento_id;
  end if;

  insert into public.atendimentos (
    agendamento_id,
    cliente_id,
    colaboradora_user_id,
    procedimento_id,
    data_atendimento,
    queixa_objetivo,
    observacoes,
    reacoes,
    intercorrencias,
    feedback_cliente,
    orientacoes,
    recomendacao_proxima_sessao,
    created_by
  ) values (
    p_agendamento_id,
    v_cliente_id,
    v_colaboradora_user_id,
    v_procedimento_id,
    now(),
    nullif(trim(p_queixa_objetivo), ''),
    nullif(trim(p_observacoes), ''),
    nullif(trim(p_reacoes), ''),
    nullif(trim(p_intercorrencias), ''),
    nullif(trim(p_feedback_cliente), ''),
    nullif(trim(p_orientacoes), ''),
    nullif(trim(p_recomendacao_proxima_sessao), ''),
    v_user_id
  )
  returning id into v_atendimento_id;

  update public.agendamentos
     set status = 'atendido'
   where id = p_agendamento_id;

  return v_atendimento_id;
end;
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
  if auth.uid() is null
     or not (private.is_bc_admin() or private.is_bc_active_colaborador()) then
    raise exception 'Acesso negado ao diretório.' using errcode = '42501';
  end if;

  return query
  select sp.user_id, sp.display_name
    from public.staff_profiles sp
   where sp.active = true
     and sp.role = 'colaborador'
   order by sp.display_name;
end;
$$;

revoke all on function private.bc_set_agendamento_status_impl(uuid, text) from public;
revoke execute on function private.bc_set_agendamento_status_impl(uuid, text) from anon;
grant execute on function private.bc_set_agendamento_status_impl(uuid, text) to authenticated;

revoke all on function private.bc_registrar_atendimento_impl(uuid, text, text, text, text, text, text, text) from public;
revoke execute on function private.bc_registrar_atendimento_impl(uuid, text, text, text, text, text, text, text) from anon;
grant execute on function private.bc_registrar_atendimento_impl(uuid, text, text, text, text, text, text, text) to authenticated;

revoke all on function private.bc_staff_directory_impl() from public;
revoke execute on function private.bc_staff_directory_impl() from anon;
grant execute on function private.bc_staff_directory_impl() to authenticated;

create or replace function public.bc_set_agendamento_status(
  p_agendamento_id uuid,
  p_status text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_set_agendamento_status_impl(p_agendamento_id, p_status);
$$;

create or replace function public.bc_registrar_atendimento(
  p_agendamento_id uuid,
  p_queixa_objetivo text default null,
  p_observacoes text default null,
  p_reacoes text default null,
  p_intercorrencias text default null,
  p_feedback_cliente text default null,
  p_orientacoes text default null,
  p_recomendacao_proxima_sessao text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_registrar_atendimento_impl(
    p_agendamento_id,
    p_queixa_objetivo,
    p_observacoes,
    p_reacoes,
    p_intercorrencias,
    p_feedback_cliente,
    p_orientacoes,
    p_recomendacao_proxima_sessao
  );
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

revoke all on function public.bc_set_agendamento_status(uuid, text) from public;
revoke execute on function public.bc_set_agendamento_status(uuid, text) from anon;
grant execute on function public.bc_set_agendamento_status(uuid, text) to authenticated;

revoke all on function public.bc_registrar_atendimento(uuid, text, text, text, text, text, text, text) from public;
revoke execute on function public.bc_registrar_atendimento(uuid, text, text, text, text, text, text, text) from anon;
grant execute on function public.bc_registrar_atendimento(uuid, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.bc_staff_directory() from public;
revoke execute on function public.bc_staff_directory() from anon;
grant execute on function public.bc_staff_directory() to authenticated;
