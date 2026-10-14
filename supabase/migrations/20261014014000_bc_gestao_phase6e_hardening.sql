-- BC Gestão — hardening final da Central Clínica / atendimento rápido.
-- Forward-safe: corrige grants mínimos dos wrappers invoker e impede protocolos
-- compostos no encaixe curto, que exigem seleção explícita de componentes.

create or replace function private.bc_quick_visit_procedure_options_impl(
  p_profissional_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if p_profissional_user_id is null then
    raise exception 'Profissional inválida.' using errcode='22023';
  end if;
  if not private.is_bc_admin() and p_profissional_user_id<>v_user then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.staff_profiles sp
    where sp.user_id=p_profissional_user_id and sp.active is true and sp.atende_clientes is true
  ) then
    raise exception 'Profissional indisponível.' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'procedure_id',p.id,
    'can_execute',private.bc_treatment_can_execute_version(p.current_version_id,p_profissional_user_id)
  ) order by lower(p.nome),p.id),'[]'::jsonb)
    into v_result
    from public.procedimentos p
    join public.procedure_versions pv on pv.id=p.current_version_id
   where p.ativo is true
     and p.archived_at is null
     and p.current_version_id is not null
     and pv.status='published'
     and pv.protocol_mode='simple';

  return v_result;
end;
$$;

revoke all on function private.bc_quick_visit_procedure_options_impl(uuid) from public;
revoke execute on function private.bc_quick_visit_procedure_options_impl(uuid) from anon;
grant execute on function private.bc_quick_visit_procedure_options_impl(uuid) to authenticated;

create or replace function private.bc_quick_visit_simple_guard_impl(p_procedimento_id uuid)
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_mode text;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select pv.protocol_mode into v_mode
    from public.procedimentos p
    join public.procedure_versions pv on pv.id=p.current_version_id
   where p.id=p_procedimento_id
     and p.ativo is true
     and p.archived_at is null
     and pv.status='published';

  if not found then
    raise exception 'Procedimento inválido ou inativo.' using errcode='22023';
  end if;
  if v_mode='compound' then
    raise exception 'Protocolos compostos devem usar o fluxo clínico completo para selecionar os componentes da sessão.' using errcode='22023';
  end if;
end;
$$;

revoke all on function private.bc_quick_visit_simple_guard_impl(uuid) from public;
revoke execute on function private.bc_quick_visit_simple_guard_impl(uuid) from anon;
grant execute on function private.bc_quick_visit_simple_guard_impl(uuid) to authenticated;

create or replace function public.bc_quick_visit_create(
  p_request_key uuid,
  p_cliente_id uuid,
  p_profissional_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null,
  p_component_version_ids uuid[] default '{}'::uuid[],
  p_component_keys text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
begin
  perform private.bc_quick_visit_simple_guard_impl(p_procedimento_id);
  return private.bc_quick_visit_create_impl(
    p_request_key,p_cliente_id,p_profissional_user_id,p_procedimento_id,p_inicio,p_fim,p_observacao,
    p_component_version_ids,p_component_keys
  );
end;
$$;

revoke all on function public.bc_quick_visit_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) from public;
revoke execute on function public.bc_quick_visit_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) from anon;
grant execute on function public.bc_quick_visit_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) to authenticated;

-- Wrappers SECURITY INVOKER precisam EXECUTE nas implementações privadas que chamam diretamente.
revoke execute on function private.bc_treatment_report_get_impl(uuid) from anon;
grant execute on function private.bc_treatment_report_get_impl(uuid) to authenticated;

revoke execute on function private.bc_treatment_report_upsert_impl(uuid,jsonb) from anon;
grant execute on function private.bc_treatment_report_upsert_impl(uuid,jsonb) to authenticated;

revoke execute on function private.bc_treatment_finalize_impl(uuid) from anon;
grant execute on function private.bc_treatment_finalize_impl(uuid) to authenticated;
