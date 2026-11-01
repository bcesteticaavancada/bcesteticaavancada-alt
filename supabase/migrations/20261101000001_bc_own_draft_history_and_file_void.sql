-- RASCUNHO NÃO APLICADO — correções de fichas próprias com trilha antes/depois.
-- Preserva links de anamnese criados por qualquer profissional ativa; o formulário
-- remoto da cliente usa endpoint distinto, sem mudar permissões nesta migração.
-- Dados clínicos de auditoria ficam no audit_log com RLS privativo existente.

-- A profissional autora pode corrigir respostas da sua anamnese ainda aberta.
create or replace function private.bc_anamnese_save_answers_impl(
  p_anamnese_id uuid,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_creator uuid;
  v_old_answer jsonb;
  v_had_answer boolean;
  v_key text;
  v_value jsonb;
  v_allowed text[] := array[
    'queixa_principal','objetivos_esteticos','objetivo_detalhes',
    'historico_estetico_realizou','historico_estetico_detalhes','historico_estetico_reacao',
    'pele_tipo','pele_condicoes_atuais','pele_condicoes_detalhes','hiperpigmentacao_pos_inflamatoria',
    'exposicao_solar_recente','exposicao_solar_faixa','usa_fotoprotecao',
    'condicao_saude_importante','condicao_saude_detalhes','acompanhamento_medico','acompanhamento_medico_detalhes',
    'condicoes_relevantes','condicoes_relevantes_detalhes','medicamentos_continuos','medicamentos_detalhes',
    'suplementos','suplementos_detalhes','tratamento_dermatologico_recente','tratamento_dermatologico_detalhes',
    'alergias_conhecidas','alergias_detalhes','reacao_alergica_procedimento','reacao_alergica_detalhes',
    'herpes_historico','herpes_regiao','herpes_ultimo_episodio','cicatrizacao_alterada_queloide','cicatrizacao_detalhes',
    'cirurgias_procedimentos_recentes','cirurgias_recentes_detalhes','tabagismo_nicotina','tabagismo_detalhes',
    'alcool','alcool_frequencia','alcool_observacao','gestacao_possibilidade','amamentacao',
    'expectativas','resultado_especifico','observacoes_finais','declaracao_veracidade','declaracao_dados'
  ];
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Respostas inválidas.' using errcode = '22023';
  end if;

  select status,created_by into v_status,v_creator from public.anamneses_gerais where id = p_anamnese_id for update;
  if v_status is null then raise exception 'Anamnese não encontrada.' using errcode = 'P0002'; end if;
  if v_creator is distinct from v_user_id then
    raise exception 'Somente a autora do rascunho pode corrigir respostas.' using errcode='42501';
  end if;
  if v_status not in ('em_preenchimento','aguardando_revisao_profissional') then
    raise exception 'Anamnese não está aberta para edição.' using errcode = '55000';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_answers)
  loop
    if not (v_key = any(v_allowed)) then
      raise exception 'Campo de anamnese inválido: %', v_key using errcode = '22023';
    end if;
    select r.answer_json into v_old_answer
    from public.anamnese_respostas r
    where r.anamnese_id=p_anamnese_id and r.question_key=v_key;
    v_had_answer := found;

    insert into public.anamnese_respostas(anamnese_id,question_key,answer_json,updated_at)
    values (p_anamnese_id,v_key,v_value,now())
    on conflict (anamnese_id,question_key)
    do update set answer_json=excluded.answer_json, updated_at=now();

    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
    values (v_user_id,'anamnese_draft_answer_corrected','anamneses_gerais',p_anamnese_id,
      case when v_had_answer then jsonb_build_object('question_key',v_key,'answer',v_old_answer) else null end,
      jsonb_build_object('question_key',v_key,'answer',v_value));
  end loop;

  update public.anamneses_gerais set updated_at=now() where id=p_anamnese_id;
  return p_anamnese_id;
end;
$$;

-- A autora de sessão clínica pode corrigir o rascunho antes de assinatura.
create or replace function private.bc_treatment_update_draft_impl(p_treatment_id uuid,p_patch jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_before public.clinical_treatments%rowtype;
  v_after public.clinical_treatments%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Profissional inativa ou não autenticada.' using errcode='42501';
  end if;
  select * into v_before from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_user <> v_before.profissional_user_id then
    raise exception 'Somente a autora do rascunho pode corrigir.' using errcode='42501';
  end if;
  if v_before.status not in ('rascunho','pronto_para_iniciar','em_atendimento')
     or v_before.pending_version_id is not null
     or v_before.pending_document_id is not null then
    raise exception 'Atendimento finalizado ou com assinatura pendente não aceita edição de rascunho.' using errcode='55000';
  end if;

  perform private.bc_treatment_apply_patch(v_before.id,p_patch);
  if v_before.status='pronto_para_iniciar' then
    update public.clinical_treatments set status='rascunho',updated_at=now() where id=v_before.id;
  end if;
  select * into v_after from public.clinical_treatments where id=v_before.id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(v_user,'clinical_treatment_draft_updated','clinical_treatments',v_before.id,
    to_jsonb(v_before),to_jsonb(v_after));
  return v_before.id;
end;
$$;

-- Retificações de intercorrências e anulação de foto mantêm antes/depois.
create or replace function private.bc_treatment_intercurrence_update_draft_impl(p_intercurrence_id uuid,p_patch jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_item public.clinical_intercurrences%rowtype; v_treatment public.clinical_treatments%rowtype; v_moment text; v_severity text; v_description text; v_action text; v_occurred timestamptz;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado às intercorrências.' using errcode='42501'; end if;
  select * into v_item from public.clinical_intercurrences where id=p_intercurrence_id for update;
  if not found then raise exception 'Intercorrência não encontrada.' using errcode='P0002'; end if;
  select * into v_treatment from public.clinical_treatments where id=v_item.treatment_id for update;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null then
    raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501';
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb)) k where k not in ('moment','severity','description','action_taken','occurred_at')) then
    raise exception 'Campo de correção não permitido.' using errcode='22023';
  end if;
  v_moment:=coalesce(nullif(trim(p_patch->>'moment'),''),v_item.moment);
  v_severity:=coalesce(nullif(trim(p_patch->>'severity'),''),v_item.severity);
  v_description:=coalesce(nullif(trim(p_patch->>'description'),''),v_item.description);
  v_action:=coalesce(nullif(trim(p_patch->>'action_taken'),''),v_item.action_taken);
  v_occurred:=v_item.occurred_at;
  if p_patch ? 'occurred_at' and nullif(trim(p_patch->>'occurred_at'),'') is not null then v_occurred:=(p_patch->>'occurred_at')::timestamptz; end if;
  if v_moment not in ('antes','durante','apos') then raise exception 'Momento da intercorrência inválido.' using errcode='22023'; end if;
  if v_severity not in ('leve','moderada','grave','critica') then raise exception 'Gravidade da intercorrência inválida.' using errcode='22023'; end if;
  update public.clinical_intercurrences set moment=v_moment,severity=v_severity,description=v_description,action_taken=v_action,occurred_at=v_occurred,updated_at=now() where id=p_intercurrence_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(v_user,'clinical_intercurrence_draft_updated','clinical_intercurrences',p_intercurrence_id,
    to_jsonb(v_item),(select to_jsonb(i) from public.clinical_intercurrences i where i.id=p_intercurrence_id));
  return p_intercurrence_id;
end;$$;
create or replace function private.bc_treatment_photo_void_impl(p_photo_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_photo public.clinical_treatment_photos%rowtype; v_treatment public.clinical_treatments%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado às fotos clínicas.' using errcode='42501'; end if;
  select * into v_photo from public.clinical_treatment_photos where id=p_photo_id for update;
  if not found then raise exception 'Foto clínica não encontrada.' using errcode='P0002'; end if;
  select * into v_treatment from public.clinical_treatments where id=v_photo.treatment_id for update;
  if v_treatment.profissional_user_id<>v_user or (v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null) then
    raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501';
  end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Motivo da anulação é obrigatório.' using errcode='22023'; end if;
  if v_photo.voided_at is null then
    update public.clinical_treatment_photos
       set voided_at=now(),voided_by=v_user,void_reason=trim(p_reason)
     where id=p_photo_id;
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
    values(v_user,'clinical_treatment_photo_voided','clinical_treatment_photos',p_photo_id,
      to_jsonb(v_photo),(select to_jsonb(p) from public.clinical_treatment_photos p where p.id=p_photo_id));
  end if;
  return p_photo_id;
end;$$;

-- Remoção de itens próprios de sessões em edição guarda a linha completa no histórico.
create or replace function private.bc_treatment_product_usage_remove_impl(p_usage_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_usage public.clinical_treatment_product_usages%rowtype; v_treatment public.clinical_treatments%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos produtos do atendimento.' using errcode='42501'; end if;
  select * into v_usage from public.clinical_treatment_product_usages where id=p_usage_id for update;
  if not found then raise exception 'Uso de produto não encontrado.' using errcode='P0002'; end if;
  select * into v_treatment from public.clinical_treatments where id=v_usage.treatment_id for update;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
  delete from public.clinical_treatment_product_usages where id=p_usage_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data)
  values(v_user,'clinical_treatment_product_usage_removed','clinical_treatment_product_usages',p_usage_id,to_jsonb(v_usage));
  return p_usage_id;
end;$$;
create or replace function private.bc_treatment_equipment_usage_remove_impl(p_usage_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_usage public.clinical_treatment_equipment_usages%rowtype; v_treatment public.clinical_treatments%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos equipamentos do atendimento.' using errcode='42501'; end if;
  select * into v_usage from public.clinical_treatment_equipment_usages where id=p_usage_id for update;
  if not found then raise exception 'Uso de equipamento não encontrado.' using errcode='P0002'; end if;
  select * into v_treatment from public.clinical_treatments where id=v_usage.treatment_id for update;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
  delete from public.clinical_treatment_equipment_usages where id=p_usage_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data)
  values(v_user,'clinical_treatment_equipment_usage_removed','clinical_treatment_equipment_usages',p_usage_id,to_jsonb(v_usage));
  return p_usage_id;
end;$$;

-- Arquivos da pasta já registrados são definitivos, portanto anulação apenas Mel.
create or replace function private.bc_client_file_void_impl(p_file_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_file public.client_files%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado aos documentos da cliente.' using errcode='42501';
  end if;

  if not private.bc_can_delete_finalized() then
    raise exception 'Somente Mel pode anular documentos definitivos.' using errcode='42501';
  end if;

  select * into v_file
    from public.client_files
   where id=p_file_id
   for update;
  if not found then
    raise exception 'Documento não encontrado.' using errcode='P0002';
  end if;
  if nullif(trim(p_reason),'') is null then
    raise exception 'Motivo da anulação é obrigatório.' using errcode='22023';
  end if;

  if v_file.voided_at is null then
    update public.client_files
       set voided_at=now(), voided_by=v_user, void_reason=trim(p_reason)
     where id=p_file_id;

    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
    values(
      v_user,'client_file_voided','client_files',p_file_id,
      to_jsonb(v_file),(select to_jsonb(f) from public.client_files f where f.id=p_file_id)
    );
  end if;

  return p_file_id;
end;
$$;
