-- Agenda é a referência operacional; IDs de agenda e atendimento são distintos.
create or replace function private.bc_recebimento_registrar_agendamento_impl(
  p_agendamento_id uuid,p_valor numeric,p_forma_pagamento text,
  p_recebido_at timestamptz default now(),p_observacao text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare appointment public.agendamentos%rowtype; attendance_id uuid;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao recebimento.' using errcode='42501'; end if;
  select * into appointment from public.agendamentos where id=p_agendamento_id for update;
  if not found or (not private.is_bc_admin() and appointment.colaboradora_user_id is distinct from auth.uid()) then
    raise exception 'Acesso negado ao recebimento.' using errcode='42501';
  end if;
  select id into attendance_id from public.atendimentos where agendamento_id=appointment.id;
  if attendance_id is null then raise exception 'Conclua o atendimento antes de registrar o recebimento.' using errcode='55000'; end if;
  return private.bc_recebimento_registrar_impl(attendance_id,p_valor,p_forma_pagamento,p_recebido_at,p_observacao);
end; $$;
create or replace function public.bc_recebimento_registrar_agendamento(
  p_agendamento_id uuid,p_valor numeric,p_forma_pagamento text,
  p_recebido_at timestamptz default now(),p_observacao text default null
) returns uuid language sql security invoker set search_path='' as $$
  select private.bc_recebimento_registrar_agendamento_impl($1,$2,$3,$4,$5);
$$;
revoke all on function private.bc_recebimento_registrar_agendamento_impl(uuid,numeric,text,timestamptz,text),public.bc_recebimento_registrar_agendamento(uuid,numeric,text,timestamptz,text) from public,anon;
grant execute on function private.bc_recebimento_registrar_agendamento_impl(uuid,numeric,text,timestamptz,text),public.bc_recebimento_registrar_agendamento(uuid,numeric,text,timestamptz,text) to authenticated;

alter table public.clinical_treatments add column if not exists operational_attendance_id uuid references public.atendimentos(id) on delete restrict;
create unique index if not exists clinical_treatments_attendance_uq on public.clinical_treatments(operational_attendance_id) where operational_attendance_id is not null;

-- Atendimento direto também reserva seu intervalo na agenda antes de começar.
create or replace function private.bc_treatment_create_booked_impl(
  p_cliente_id uuid,p_procedure_id uuid,p_agendamento_id uuid,
  p_component_version_ids uuid[],p_component_keys text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare appointment_id uuid:=p_agendamento_id;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao atendimento.' using errcode='42501'; end if;
  if appointment_id is null then
    appointment_id:=private.bc_agendamento_create_impl(p_cliente_id,auth.uid(),p_procedure_id,date_trunc('minute',now()),null,'Atendimento direto no prontuário');
    update public.agendamentos set origem='encaixe' where id=appointment_id;
  end if;
  return private.bc_treatment_create_impl(p_cliente_id,p_procedure_id,appointment_id,p_component_version_ids,p_component_keys);
end; $$;
create or replace function public.bc_treatment_create(
  p_cliente_id uuid,p_procedure_id uuid,p_agendamento_id uuid default null,
  p_component_version_ids uuid[] default '{}'::uuid[],p_component_keys text[] default '{}'::text[]
) returns uuid language sql security invoker set search_path='' as $$
  select private.bc_treatment_create_booked_impl($1,$2,$3,$4,$5);
$$;
revoke all on function private.bc_treatment_create_booked_impl(uuid,uuid,uuid,uuid[],text[]) from public,anon;
grant execute on function private.bc_treatment_create_booked_impl(uuid,uuid,uuid,uuid[],text[]) to authenticated;

create or replace function private.bc_treatment_sync_operational_completion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status<>'finalizado' or old.status='finalizado' then return new; end if;
  if auth.uid() is null or not private.is_bc_active_staff() or auth.uid() is distinct from new.profissional_user_id then
    raise exception 'Acesso negado à finalização clínica.' using errcode='42501';
  end if;
  if new.agendamento_id is null then raise exception 'Vincule o atendimento à agenda antes de concluir.' using errcode='55000'; end if;
  new.operational_attendance_id:=private.bc_registrar_atendimento_impl(new.agendamento_id,
    coalesce(new.objetivo,new.queixa_dia),new.observacoes,new.resposta_imediata,new.intercorrencias_ato,
    new.feedback,new.orientacoes,new.retorno);
  return new;
end; $$;
revoke all on function private.bc_treatment_sync_operational_completion() from public,anon,authenticated;
create trigger bc_treatment_operational_completion before update of status on public.clinical_treatments
for each row execute function private.bc_treatment_sync_operational_completion();

-- Revalida o vínculo ativo antes de tocar documentos e estado clínico.
CREATE OR REPLACE FUNCTION private.bc_treatment_complete_finalize_impl(p_treatment_id uuid, p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; d public.clinical_documents%rowtype; v_user uuid:=auth.uid(); v_version integer; begin if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado à finalização clínica.' using errcode='42501'; end if; select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user is distinct from t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if; if t.status<>'em_atendimento' or t.pending_version_id is null or t.pending_document_id<>p_document_id then raise exception 'Finalização pendente não corresponde ao documento.' using errcode='55000'; end if; select * into d from public.clinical_documents where id=p_document_id and document_type='treatment_record' and source_id=t.pending_version_id for update; if not found or d.status<>'aguardando_assinaturas' then raise exception 'Ficha final não está aguardando assinatura.' using errcode='55000'; end if; if not exists(select 1 from public.clinical_signatures where document_id=p_document_id and signer_kind='profissional') then raise exception 'Assinatura profissional obrigatória ainda não foi registrada.' using errcode='22023'; end if; update public.clinical_documents set status='pronto_para_pdf' where id=p_document_id; select version into v_version from public.clinical_treatment_versions where id=t.pending_version_id; update public.clinical_treatments set status='finalizado',current_version_id=pending_version_id,pending_version_id=null,pending_document_id=null,finalized_at=now(),correction_mode=null,correction_reason=null,updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_finalized','clinical_treatments',t.id,jsonb_build_object('document_id',p_document_id,'version',v_version)); return jsonb_build_object('treatment_id',t.id,'document_id',p_document_id,'version',v_version,'status','finalizado'); end;$function$
;

-- Fichas anteriores à integração continuam recuperáveis por revisão explícita.
create or replace function private.bc_treatment_appointment_options_impl(p_treatment_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.clinical_treatments%rowtype; result jsonb;
begin
  select * into t from public.clinical_treatments where id=p_treatment_id;
  if auth.uid() is null or not private.is_bc_active_staff() or not found or t.profissional_user_id is distinct from auth.uid() then
    raise exception 'Atendimento indisponível.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
    select a.id,a.inicio,a.fim,a.status from public.agendamentos a
    where a.cliente_id=t.cliente_id and a.colaboradora_user_id=t.profissional_user_id and a.procedimento_id=t.procedimento_id
      and a.status in ('agendado','atendido') and (a.inicio at time zone 'America/Sao_Paulo')::date=t.treatment_date
      and not exists(select 1 from public.clinical_treatments other where other.agendamento_id=a.id and other.id<>t.id)
    order by a.inicio
  ) r;
  return result;
end; $$;
create or replace function private.bc_treatment_resolve_appointment_impl(p_treatment_id uuid,p_agendamento_id uuid,p_inicio timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.clinical_treatments%rowtype; a public.agendamentos%rowtype; appointment_id uuid:=p_agendamento_id; attendance_id uuid;
begin
  select * into t from public.clinical_treatments where id=p_treatment_id for update;
  if auth.uid() is null or not private.is_bc_active_staff() or not found or t.profissional_user_id is distinct from auth.uid() then
    raise exception 'Atendimento indisponível.' using errcode='42501';
  end if;
  if t.agendamento_id is not null then
    if p_agendamento_id=t.agendamento_id then return t.agendamento_id; end if;
    raise exception 'Atendimento já vinculado à agenda.' using errcode='55000';
  end if;
  if appointment_id is null then
    if p_inicio is null or (p_inicio at time zone 'America/Sao_Paulo')::date<>t.treatment_date then
      raise exception 'Informe o horário real na data desta sessão.' using errcode='22023';
    end if;
    appointment_id:=private.bc_agendamento_create_impl(t.cliente_id,t.profissional_user_id,t.procedimento_id,p_inicio,null,'Vínculo revisado de ficha clínica anterior à integração');
    update public.agendamentos set origem='encaixe' where id=appointment_id;
  end if;
  select * into a from public.agendamentos where id=appointment_id for update;
  if not found or a.cliente_id is distinct from t.cliente_id or a.colaboradora_user_id is distinct from t.profissional_user_id
    or a.procedimento_id is distinct from t.procedimento_id or a.status not in ('agendado','atendido')
    or (a.inicio at time zone 'America/Sao_Paulo')::date<>t.treatment_date
    or exists(select 1 from public.clinical_treatments other where other.agendamento_id=a.id and other.id<>t.id) then
    raise exception 'Agendamento não corresponde à sessão ou já está vinculado.' using errcode='22023';
  end if;
  if t.status='finalizado' then
    attendance_id:=private.bc_registrar_atendimento_impl(a.id,coalesce(t.objetivo,t.queixa_dia),t.observacoes,t.resposta_imediata,t.intercorrencias_ato,t.feedback,t.orientacoes,t.retorno);
  end if;
  update public.clinical_treatments set agendamento_id=a.id,operational_attendance_id=attendance_id,updated_at=now() where id=t.id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'clinical_treatment_appointment_linked','clinical_treatments',t.id,jsonb_build_object('agendamento_id',a.id));
  return a.id;
end; $$;
create or replace function public.bc_treatment_appointment_options(p_treatment_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.bc_treatment_appointment_options_impl($1); $$;
create or replace function public.bc_treatment_resolve_appointment(p_treatment_id uuid,p_agendamento_id uuid default null,p_inicio timestamptz default null) returns uuid
language sql security invoker set search_path='' as $$ select private.bc_treatment_resolve_appointment_impl($1,$2,$3); $$;
revoke all on function private.bc_treatment_appointment_options_impl(uuid),private.bc_treatment_resolve_appointment_impl(uuid,uuid,timestamptz),public.bc_treatment_appointment_options(uuid),public.bc_treatment_resolve_appointment(uuid,uuid,timestamptz) from public,anon;
grant execute on function private.bc_treatment_appointment_options_impl(uuid),private.bc_treatment_resolve_appointment_impl(uuid,uuid,timestamptz),public.bc_treatment_appointment_options(uuid),public.bc_treatment_resolve_appointment(uuid,uuid,timestamptz) to authenticated;
