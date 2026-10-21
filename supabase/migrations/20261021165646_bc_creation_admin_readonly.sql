-- Isolated read-only technical role. Existing admin/clinical/financial helpers stay unchanged.
begin;
alter table public.staff_profiles drop constraint staff_profiles_role_check;
alter table public.staff_profiles add constraint staff_profiles_role_check
  check (role in ('admin','colaborador','admin_criacao'));
alter table public.staff_profiles add constraint staff_profiles_creation_not_clinical
  check (role <> 'admin_criacao' or (not atende_clientes and not pode_gerenciar_agendas
    and not pode_gerenciar_procedimentos and procedure_scope='explicit'));

create or replace function private.is_bc_creation_identity()
returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth as $$
  select exists(select 1 from public.staff_profiles where user_id=auth.uid() and role='admin_criacao');
$$;
revoke all on function private.is_bc_creation_identity() from public,anon;
grant execute on function private.is_bc_creation_identity() to authenticated;

-- Deny raw data even if an older permissive policy allows authenticated users.
-- The guarded RPC below uses explicit projections and cannot mutate data.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' and tablename<>'staff_profiles' loop
    execute format('create policy bc_creation_no_raw_access on public.%I as restrictive for all to authenticated using (not (select private.is_bc_creation_identity())) with check (not (select private.is_bc_creation_identity()))',t.tablename);
  end loop;
end $$;

create or replace function private.bc_creation_list_impl(
  p_section text,p_offset integer default 0,p_search text default '',p_cliente_id uuid default null)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,auth,private as $$
declare q text; data jsonb; n bigint; term text:=coalesce(trim(p_search),'');
begin
  if auth.uid() is null or not exists(select 1 from public.staff_profiles
    where user_id=auth.uid() and active and role='admin_criacao') then
    raise exception 'Acesso restrito ao Admin de Criação.' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_offset>100000 or char_length(term)>80 then
    raise exception 'Consulta inválida.' using errcode='22023';
  end if;
  case p_section
    when 'agenda' then q:='select jsonb_build_object(''id'',t.id,''cliente_id'',t.cliente_id,''colaboradora_user_id'',t.colaboradora_user_id,''procedimento_id'',t.procedimento_id,''inicio'',t.inicio,''fim'',t.fim,''status'',t.status,''origem'',t.origem,''public_booking_name'',t.public_booking_name,''public_booking_phone'',t.public_booking_phone,''cliente'',coalesce(c.nome,t.public_booking_name),''profissional'',s.display_name,''procedimento'',p.nome) as row from public.agendamentos t left join public.clientes c on c.id=t.cliente_id left join public.staff_profiles s on s.user_id=t.colaboradora_user_id left join public.procedimentos p on p.id=t.procedimento_id';
    when 'clientes' then q:='select jsonb_build_object(''id'',t.id,''nome'',t.nome,''telefone'',t.telefone,''email'',t.email,''ativo'',t.ativo,''cpf'',t.cpf,''data_nascimento'',t.data_nascimento,''cep'',t.cep,''logradouro'',t.logradouro,''numero'',t.numero,''complemento'',t.complemento,''bairro'',t.bairro,''cidade'',t.cidade,''uf'',t.uf,''responsavel_nome'',t.responsavel_nome,''responsavel_cpf'',t.responsavel_cpf,''responsavel_parentesco'',t.responsavel_parentesco,''responsavel_telefone'',t.responsavel_telefone) as row from public.clientes t';
    when 'equipe' then q:='select jsonb_build_object(''user_id'',t.user_id,''display_name'',t.display_name,''role'',t.role,''active'',t.active,''atende_clientes'',t.atende_clientes,''profissao'',t.profissao,''conselho'',t.conselho,''registro_conselho'',t.registro_conselho,''pode_gerenciar_agendas'',t.pode_gerenciar_agendas,''pode_gerenciar_procedimentos'',t.pode_gerenciar_procedimentos,''procedure_scope'',t.procedure_scope) as row from public.staff_profiles t';
    when 'procedimentos' then q:='select jsonb_build_object(''id'',t.id,''nome'',t.nome,''ativo'',t.ativo,''duracao_padrao'',t.duracao_padrao,''access_mode'',t.access_mode,''versao'',v.version,''categoria'',v.categoria,''descricao'',v.descricao,''orientacoes_antes'',v.pre_guidance,''orientacoes_depois'',v.post_guidance,''exige_anamnese'',v.requires_general_anamnesis,''exige_foto'',v.requires_photo,''exige_lote'',v.requires_product_lot,''exige_equipamento'',v.requires_equipment) as row from public.procedimentos t left join public.procedure_versions v on v.id=t.current_version_id';
    when 'atendimentos' then q:='select jsonb_build_object(''id'',t.id,''cliente_id'',t.cliente_id,''profissional_user_id'',t.profissional_user_id,''agendamento_id'',t.agendamento_id,''status'',t.status,''treatment_date'',t.treatment_date,''queixa_dia'',t.queixa_dia,''objetivo'',t.objetivo,''avaliacao_profissional'',t.avaliacao_profissional,''regiao'',t.regiao,''resposta_imediata'',t.resposta_imediata,''intercorrencias_ato'',t.intercorrencias_ato,''orientacoes'',t.orientacoes,''retorno'',t.retorno,''evolucao'',t.evolucao,''feedback'',t.feedback,''observacoes'',t.observacoes,''started_at'',t.started_at,''finalized_at'',t.finalized_at,''cliente'',c.nome,''profissional'',s.display_name,''procedimento'',p.nome) as row from public.clinical_treatments t left join public.clientes c on c.id=t.cliente_id left join public.staff_profiles s on s.user_id=t.profissional_user_id left join public.procedimentos p on p.id=t.procedimento_id';
    when 'anamneses' then q:='select jsonb_build_object(''id'',t.id,''cliente_id'',t.cliente_id,''version'',t.version,''status'',t.status,''source'',t.source,''reviewed_at'',t.reviewed_at,''finalized_at'',t.finalized_at,''valid_until'',t.valid_until,''created_at'',t.created_at,''cliente'',c.nome) as row from public.anamneses_gerais t left join public.clientes c on c.id=t.cliente_id';
    when 'preanamneses' then q:='select jsonb_build_object(''id'',t.id,''cliente_id'',t.cliente_id,''created_at'',t.created_at,''status'',t.status,''patient_name'',t.patient_name,''patient_phone'',t.patient_phone,''procedure'',t.procedure,''reviewed_at'',t.reviewed_at) as row from public.bc_pre_anamneses t';
    when 'documentos' then q:='select jsonb_build_object(''id'',t.id,''cliente_id'',t.cliente_id,''document_type'',t.document_type,''document_code'',t.document_code,''document_version'',t.document_version,''status'',t.status,''profissional_nome'',t.profissional_nome,''generated_at'',t.generated_at,''created_at'',t.created_at,''cliente'',c.nome) as row from public.clinical_documents t left join public.clientes c on c.id=t.cliente_id';
    when 'alertas' then q:='select jsonb_build_object(''id'',t.id,''cliente_id'',t.cliente_id,''level'',t.level,''origin_type'',t.origin_type,''description'',t.description,''active'',t.active,''created_at'',t.created_at,''cliente'',c.nome) as row from public.clinical_alerts t left join public.clientes c on c.id=t.cliente_id';
    when 'produtos' then q:='select jsonb_build_object(''id'',t.id,''name'',t.name,''manufacturer'',t.manufacturer,''category'',t.category,''default_unit'',t.default_unit,''tracks_lot'',t.tracks_lot,''active'',t.active) as row from public.clinical_products t';
    when 'lotes' then q:='select jsonb_build_object(''id'',t.id,''product_id'',t.product_id,''lot_code'',t.lot_code,''expires_on'',t.expires_on,''active'',t.active,''produto'',p.name) as row from public.clinical_product_lots t left join public.clinical_products p on p.id=t.product_id';
    when 'equipamentos' then q:='select jsonb_build_object(''id'',t.id,''name'',t.name,''manufacturer'',t.manufacturer,''model'',t.model,''internal_code'',t.internal_code,''serial_number'',t.serial_number,''active'',t.active) as row from public.clinical_equipment t';
    when 'disponibilidade' then q:='select jsonb_build_object(''id'',t.id,''professional_user_id'',t.professional_user_id,''local_date'',t.local_date,''enabled'',t.enabled,''start_time'',t.start_time,''end_time'',t.end_time,''profissional'',s.display_name) as row from public.professional_availability_days t left join public.staff_profiles s on s.user_id=t.professional_user_id';
    when 'bloqueios' then q:='select jsonb_build_object(''id'',t.id,''professional_user_id'',t.professional_user_id,''starts_at'',t.starts_at,''ends_at'',t.ends_at,''block_type'',t.block_type,''profissional'',s.display_name) as row from public.professional_schedule_blocks t left join public.staff_profiles s on s.user_id=t.professional_user_id';
    when 'intercorrencias' then q:='select jsonb_build_object(''id'',t.id,''cliente_id'',t.cliente_id,''treatment_id'',t.treatment_id,''moment'',t.moment,''severity'',t.severity,''description'',t.description,''action_taken'',t.action_taken,''status'',t.status,''occurred_at'',t.occurred_at,''closed_at'',t.closed_at,''cliente'',c.nome) as row from public.clinical_intercurrences t left join public.clientes c on c.id=t.cliente_id';
    when 'auditoria' then q:='select jsonb_build_object(''id'',t.id,''actor_user_id'',t.actor_user_id,''action'',t.action,''entity_type'',t.entity_type,''entity_id'',t.entity_id,''created_at'',t.created_at,''responsavel'',s.display_name) as row from public.audit_log t left join public.staff_profiles s on s.user_id=t.actor_user_id where t.action in (''cliente_created'',''cliente_updated'',''cliente_archived'',''cliente_reactivated'',''agendamento_created'',''agendamento_updated'',''agendamento_status_changed'',''clinical_treatment_finalized'',''clinical_treatment_started'',''staff_onboarding_configured'') and t.entity_type in (''clientes'',''agendamentos'',''clinical_treatments'',''staff_profiles'')';
    else raise exception 'Área de consulta inválida.' using errcode='22023';
  end case;
  -- Only the fixed query above is interpolated; all user filters stay bound parameters.
  execute 'select count(*) from ('||q||') r where ($1='''' or strpos(lower(r.row::text),lower($1))>0) and ($2 is null or r.row->>''cliente_id''=$2::text)'
    into n using term,p_cliente_id;
  execute 'select coalesce(jsonb_agg(row order by coalesce(row->>''inicio'',row->>''local_date'',row->>''starts_at'',row->>''treatment_date'',row->>''created_at'',row->>''nome'',row->>''name'',row->>''display_name''),row->>''id'',row->>''user_id''),''[]''::jsonb) from (select row from ('||q||') r where ($1='''' or strpos(lower(r.row::text),lower($1))>0) and ($2 is null or r.row->>''cliente_id''=$2::text) order by coalesce(row->>''inicio'',row->>''local_date'',row->>''starts_at'',row->>''treatment_date'',row->>''created_at'',row->>''nome'',row->>''name'',row->>''display_name''),row->>''id'',row->>''user_id'' limit 50 offset $3) page'
    into data using term,p_cliente_id,p_offset;
  return jsonb_build_object('rows',data,'total',n,'offset',p_offset,'limit',50,'has_more',p_offset+50<n);
end $$;
revoke all on function private.bc_creation_list_impl(text,integer,text,uuid) from public,anon;
grant execute on function private.bc_creation_list_impl(text,integer,text,uuid) to authenticated;
create or replace function public.bc_creation_list(
  p_section text,p_offset integer default 0,p_search text default '',p_cliente_id uuid default null)
returns jsonb language sql stable security invoker
set search_path=pg_catalog,public,private as $$
  select private.bc_creation_list_impl(p_section,p_offset,p_search,p_cliente_id);
$$;
revoke all on function public.bc_creation_list(text,integer,text,uuid) from public,anon;
grant execute on function public.bc_creation_list(text,integer,text,uuid) to authenticated;
-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_update_draft_impl(p_treatment_id uuid, p_patch jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if; if v_user<>t.profissional_user_id then raise exception 'Somente a profissional do atendimento pode editar.' using errcode='42501'; end if; if t.status='finalizado' or t.pending_version_id is not null then raise exception 'Atendimento finalizado ou aguardando assinatura não pode ser editado por este fluxo.' using errcode='55000'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_draft_updated','clinical_treatments',t.id,jsonb_build_object('field_count',(select count(*) from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb))))); return t.id; end;$function$;

-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_confirm_health_impl(p_treatment_id uuid, p_changed boolean, p_details text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); v_id uuid; begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível para confirmação.' using errcode='42501'; end if; if t.status not in ('rascunho','pronto_para_iniciar') or t.pending_version_id is not null then raise exception 'Confirmação de saúde fora da etapa permitida.' using errcode='55000'; end if; if p_changed and nullif(trim(p_details),'') is null then raise exception 'Descreva a mudança de saúde informada.' using errcode='22023'; end if; insert into public.clinical_treatment_health_confirmations(treatment_id,changed,details,confirmed_by) values(t.id,p_changed,nullif(trim(p_details),''),v_user) returning id into v_id; if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; return v_id; end;$function$;

-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_confirm_alerts_impl(p_treatment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); ids uuid[]; snap jsonb; v_id uuid; begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível para revisão.' using errcode='42501'; end if; if t.status not in ('rascunho','pronto_para_iniciar') or t.pending_version_id is not null then raise exception 'Revisão de alertas fora da etapa permitida.' using errcode='55000'; end if; select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]),coalesce(jsonb_agg(jsonb_build_object('id',a.id,'level',a.level,'origin_type',a.origin_type,'description',a.description,'created_at',a.created_at) order by a.id),'[]'::jsonb) into ids,snap from public.clinical_alerts a where a.cliente_id=t.cliente_id and a.active=true; insert into public.clinical_treatment_alert_reviews(treatment_id,alert_ids,alert_snapshot,reviewed_by) values(t.id,ids,snap,v_user) returning id into v_id; if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; return v_id; end;$function$;

-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_prepare_consent_impl(p_treatment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); ids uuid[]; keys text[]; r jsonb; d public.clinical_documents%rowtype; pc public.procedure_consents%rowtype; begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Somente a profissional do atendimento pode preparar o consentimento.' using errcode='42501'; end if; if t.status not in ('rascunho','pronto_para_iniciar') or t.pending_version_id is not null then raise exception 'Consentimento fora da etapa permitida.' using errcode='55000'; end if; if t.consent_document_id is not null then select * into d from public.clinical_documents where id=t.consent_document_id and document_type='consentimento_procedimento'; if d.id is not null then select * into pc from public.procedure_consents where id=d.source_id; if pc.id is not null then return jsonb_build_object('document_id',d.id,'consent_id',pc.id,'reused',pc.status='finalizado','consent_class',pc.consent_class,'procedure_name',pc.procedure_name_snapshot); end if; end if; end if; select coalesce(array_agg(c.component_version_id order by c.component_version_id) filter(where c.component_version_id is not null),'{}'::uuid[]),coalesce(array_agg(c.component_key order by c.component_key) filter(where c.component_key is not null),'{}'::text[]) into ids,keys from public.clinical_treatment_components c where c.treatment_id=t.id; r:=private.bc_treatment_prepare_consent_impl(t.cliente_id,t.procedure_version_id,ids,keys,t.cycle_key); update public.clinical_treatments set consent_document_id=(r->>'document_id')::uuid,updated_at=now(),status=case when status='pronto_para_iniciar' then 'rascunho' else status end where id=t.id; return r; end;$function$;

-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_mark_ready_impl(p_treatment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); reasons text[]; a_id uuid; begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if; if t.status<>'rascunho' or t.pending_version_id is not null then raise exception 'Atendimento não está em rascunho.' using errcode='55000'; end if; select a.id into a_id from public.anamneses_gerais a join public.procedure_versions pv on pv.id=t.procedure_version_id where a.cliente_id=t.cliente_id and pv.requires_general_anamnesis and a.status='finalizada' and a.valid_until>=now() order by a.finalized_at desc limit 1; update public.clinical_treatments set anamnese_id=a_id,updated_at=now() where id=t.id; reasons:=private.bc_treatment_gate(t.id); if cardinality(reasons)=0 then update public.clinical_treatments set status='pronto_para_iniciar',updated_at=now() where id=t.id; end if; return jsonb_build_object('ready',cardinality(reasons)=0,'reasons',to_jsonb(reasons),'status',case when cardinality(reasons)=0 then 'pronto_para_iniciar' else 'rascunho' end); end;$function$;

-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_start_impl(p_treatment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); reasons text[]; begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if; if t.status<>'pronto_para_iniciar' then raise exception 'Atendimento ainda não está pronto para iniciar.' using errcode='55000'; end if; reasons:=private.bc_treatment_gate(t.id); if cardinality(reasons)>0 then raise exception 'Gates clínicos mudaram; revise antes de iniciar: %',array_to_string(reasons,', ') using errcode='55000'; end if; update public.clinical_treatments set status='em_atendimento',started_at=coalesce(started_at,now()),updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_started','clinical_treatments',t.id,'{}'::jsonb); return t.id; end;$function$;

-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_correct_same_day_impl(p_treatment_id uuid, p_patch jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Somente a autora original pode retificar.' using errcode='42501'; end if; if t.status<>'finalizado' or t.current_version_id is null then raise exception 'Atendimento não está finalizado.' using errcode='55000'; end if; if t.treatment_date<>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Após a virada do dia é necessária reabertura administrativa.' using errcode='55000'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); update public.clinical_treatments set status='em_atendimento',correction_mode='same_day',correction_reason='Retificação no mesmo dia',finalized_at=null,pending_version_id=null,pending_document_id=null,updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_same_day_correction_opened','clinical_treatments',t.id,jsonb_build_object('prior_version_id',t.current_version_id)); return t.id; end;$function$;

-- Legacy ownership does not substitute the current staff authorization.
CREATE OR REPLACE FUNCTION private.bc_treatment_correct_reopened_impl(p_treatment_id uuid, p_patch jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; g public.clinical_treatment_reopen_grants%rowtype; v_user uuid:=auth.uid(); begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Somente a autora original pode corrigir após reabertura.' using errcode='42501'; end if; if t.status<>'finalizado' then raise exception 'Atendimento não está finalizado.' using errcode='55000'; end if; select * into g from public.clinical_treatment_reopen_grants where treatment_id=t.id and author_user_id=v_user and used_at is null and expires_at>now() order by created_at desc limit 1 for update; if not found then raise exception 'Reabertura temporária válida não encontrada.' using errcode='42501'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); update public.clinical_treatment_reopen_grants set used_at=now() where id=g.id; update public.clinical_treatments set status='em_atendimento',correction_mode='reopened',correction_reason=g.reason,finalized_at=null,pending_version_id=null,pending_document_id=null,updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_reopened_correction_started','clinical_treatments',t.id,jsonb_build_object('grant_id',g.id,'prior_version_id',t.current_version_id)); return t.id; end;$function$;

commit;
