-- BC Gestão Fase 6C — contexto clínico seguro para entrada pela Agenda.

create or replace function private.bc_appointment_clinical_context_impl(p_agendamento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select jsonb_build_object(
    'appointment_id', a.id,
    'cliente_id', a.cliente_id,
    'procedimento_id', a.procedimento_id,
    'procedure_name', p.nome,
    'professional_name', coalesce(sp.display_name,'Profissional'),
    'appointment_status', a.status,
    'can_start', a.colaboradora_user_id = v_user,
    'existing_treatment_id', (
      select t.id
      from public.clinical_treatments t
      where t.agendamento_id = a.id
      order by t.created_at desc
      limit 1
    )
  ) into v_result
  from public.agendamentos a
  join public.procedimentos p on p.id = a.procedimento_id
  left join public.staff_profiles sp on sp.user_id = a.colaboradora_user_id
  where a.id = p_agendamento_id;

  if v_result is null then
    raise exception 'Agendamento não encontrado.' using errcode='P0002';
  end if;

  return v_result;
end;
$$;
revoke all on function private.bc_appointment_clinical_context_impl(uuid) from public;
revoke execute on function private.bc_appointment_clinical_context_impl(uuid) from anon;
grant execute on function private.bc_appointment_clinical_context_impl(uuid) to authenticated;

create or replace function public.bc_appointment_clinical_context(p_agendamento_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.bc_appointment_clinical_context_impl(p_agendamento_id);
$$;
revoke all on function public.bc_appointment_clinical_context(uuid) from public;
revoke execute on function public.bc_appointment_clinical_context(uuid) from anon;
grant execute on function public.bc_appointment_clinical_context(uuid) to authenticated;
