-- Reversão funcional sem apagar dados ou versões clínicas.
-- Aplicar somente em uma decisão operacional de reversão desta entrega.
begin;
CREATE OR REPLACE FUNCTION private.bc_treatment_equipment_usage_add_impl(p_treatment_id uuid, p_equipment_id uuid, p_parameter_values jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_user uuid:=auth.uid(); v_treatment public.clinical_treatments%rowtype; v_equipment public.clinical_equipment%rowtype; v_id uuid;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos equipamentos do atendimento.' using errcode='42501'; end if;
  select * into v_treatment from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
  select * into v_equipment from public.clinical_equipment where id=p_equipment_id;
  if not found or not v_equipment.active then raise exception 'Equipamento ativo não encontrado.' using errcode='P0002'; end if;
  perform private.bc_validate_equipment_parameters(v_equipment.parameter_schema,coalesce(p_parameter_values,'{}'::jsonb));
  insert into public.clinical_treatment_equipment_usages(treatment_id,equipment_id,equipment_name_snapshot,manufacturer_snapshot,model_snapshot,internal_code_snapshot,parameter_schema_snapshot,parameter_values,created_by)
  values(p_treatment_id,p_equipment_id,v_equipment.name,v_equipment.manufacturer,v_equipment.model,v_equipment.internal_code,v_equipment.parameter_schema,coalesce(p_parameter_values,'{}'::jsonb),v_user)
  returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_treatment_equipment_usage_added','clinical_treatment_equipment_usages',v_id,jsonb_build_object('treatment_id',p_treatment_id,'equipment_id',p_equipment_id));
  return v_id;
end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_treatment_equipment_usage_remove_impl(p_usage_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_user uuid:=auth.uid(); v_usage public.clinical_treatment_equipment_usages%rowtype; v_treatment public.clinical_treatments%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos equipamentos do atendimento.' using errcode='42501'; end if;
  select * into v_usage from public.clinical_treatment_equipment_usages where id=p_usage_id for update;
  if not found then raise exception 'Uso de equipamento não encontrado.' using errcode='P0002'; end if;
  select * into v_treatment from public.clinical_treatments where id=v_usage.treatment_id for update;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
  delete from public.clinical_treatment_equipment_usages where id=p_usage_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data)
  values(v_user,'clinical_treatment_equipment_usage_removed','clinical_treatment_equipment_usages',p_usage_id,jsonb_build_object('treatment_id',v_usage.treatment_id,'equipment_id',v_usage.equipment_id));
  return p_usage_id;
end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_treatment_get_impl(p_treatment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare r jsonb;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select to_jsonb(t) || jsonb_build_object(
    'procedure_version',to_jsonb(pv),'access_mode',p.access_mode,
    'components',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.clinical_treatment_components c where c.treatment_id=t.id),'[]'::jsonb),
    'gate_reasons',private.bc_treatment_gate(t.id),
    'finalization_gate_reasons',private.bc_treatment_finalization_gate(t.id),
    'phase6d_summary',jsonb_build_object(
      'photos_before',(select count(*) from public.clinical_treatment_photos x where x.treatment_id=t.id and x.kind='antes' and x.voided_at is null),
      'photos_after',(select count(*) from public.clinical_treatment_photos x where x.treatment_id=t.id and x.kind='depois' and x.voided_at is null),
      'photos_additional',(select count(*) from public.clinical_treatment_photos x where x.treatment_id=t.id and x.kind='adicional' and x.voided_at is null),
      'product_usages',(select count(*) from public.clinical_treatment_product_usages x where x.treatment_id=t.id),
      'equipment_usages',(select count(*) from public.clinical_treatment_equipment_usages x where x.treatment_id=t.id),
      'intercurrences',(select count(*) from public.clinical_intercurrences x where x.treatment_id=t.id),
      'open_intercurrences',(select count(*) from public.clinical_intercurrences x where x.treatment_id=t.id and x.status in ('aberta','acompanhamento'))
    ),
    'consent',case when t.consent_document_id is null then null else (
      select jsonb_build_object(
        'document_id',d.id,'document_code',d.document_code,'document_status',d.status,
        'consent_id',pc.id,'consent_class',pc.consent_class,'procedure_name',pc.procedure_name_snapshot,
        'supplement',pc.supplement_snapshot,'status',pc.status,'title',ct.title,'body',ct.body,
        'template_version',ct.version,'reused',pc.status='finalizado'
      )
      from public.clinical_documents d
      join public.procedure_consents pc on pc.id=d.source_id
      join public.consent_template_versions ct on ct.id=pc.consent_template_version_id
      where d.id=t.consent_document_id and d.document_type='consentimento_procedimento'
    ) end
  ) into r
  from public.clinical_treatments t
  join public.procedure_versions pv on pv.id=t.procedure_version_id
  join public.procedimentos p on p.id=t.procedimento_id
  where t.id=p_treatment_id;
  if r is null then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  return r;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.bc_treatment_product_usage_add_impl(p_treatment_id uuid, p_product_id uuid, p_lot_id uuid, p_quantity numeric, p_unit text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare
  v_user uuid:=auth.uid(); v_treatment public.clinical_treatments%rowtype; v_product public.clinical_products%rowtype; v_lot public.clinical_product_lots%rowtype;
  v_requires_product_lot boolean:=false; v_id uuid; v_unit text;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos produtos do atendimento.' using errcode='42501'; end if;
  select * into v_treatment from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_treatment.profissional_user_id=v_user and v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then raise exception 'Atendimento não está editável.' using errcode='42501'; end if;
  if v_treatment.profissional_user_id<>v_user then raise exception 'Somente a profissional responsável pode alterar produtos da sessão.' using errcode='42501'; end if;
  select * into v_product from public.clinical_products where id=p_product_id;
  if not found or not v_product.active then raise exception 'Produto ativo não encontrado.' using errcode='P0002'; end if;
  select pv.requires_product_lot into v_requires_product_lot from public.procedure_versions pv where pv.id=v_treatment.procedure_version_id;
  if p_quantity is null or p_quantity<=0 then raise exception 'Quantidade deve ser maior que zero.' using errcode='22023'; end if;
  v_unit:=nullif(trim(p_unit),''); if v_unit is null then raise exception 'Unidade é obrigatória.' using errcode='22023'; end if;
  if p_lot_id is not null then
    select * into v_lot from public.clinical_product_lots where id=p_lot_id;
    if not found or not v_lot.active then raise exception 'Lote ativo não encontrado.' using errcode='P0002'; end if;
    if v_lot.product_id<>p_product_id then raise exception 'Lote não pertence ao produto selecionado.' using errcode='22023'; end if;
    if v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Lote vencido não pode ser usado em novo atendimento.' using errcode='22023'; end if;
  elsif v_product.tracks_lot or coalesce(v_requires_product_lot,false) then
    raise exception 'Lote é obrigatório para este uso clínico.' using errcode='22023';
  end if;
  insert into public.clinical_treatment_product_usages(
    treatment_id,product_id,lot_id,quantity,unit,product_name_snapshot,manufacturer_snapshot,lot_code_snapshot,expires_on_snapshot,created_by
  ) values(
    p_treatment_id,p_product_id,p_lot_id,p_quantity,v_unit,v_product.name,v_product.manufacturer,
    case when p_lot_id is null then null else v_lot.lot_code end,case when p_lot_id is null then null else v_lot.expires_on end,v_user
  ) returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_treatment_product_usage_added','clinical_treatment_product_usages',v_id,jsonb_build_object('treatment_id',p_treatment_id,'product_id',p_product_id,'lot_id',p_lot_id));
  return v_id;
end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_treatment_product_usage_add_text_impl(p_treatment_id uuid, p_product_name text, p_lot_code text, p_expires_on date, p_quantity numeric, p_unit text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_treatment public.clinical_treatments%rowtype;
  v_product_name text := nullif(pg_catalog.regexp_replace(p_product_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_lot_code text := nullif(pg_catalog.regexp_replace(p_lot_code, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_unit text := nullif(pg_catalog.regexp_replace(p_unit, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_product_id uuid;
  v_lot_id uuid;
  v_usage_id uuid;
  v_matches integer;
  v_product public.clinical_products%rowtype;
  v_lot public.clinical_product_lots%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado aos produtos do atendimento.' using errcode = '42501';
  end if;

  -- Autorizar antes de criar qualquer item na biblioteca.
  select * into v_treatment
    from public.clinical_treatments
    where id = p_treatment_id for update;
  if not found then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0002';
  end if;
  if v_treatment.profissional_user_id is distinct from v_user
    or v_treatment.status not in ('rascunho', 'pronto_para_iniciar', 'em_atendimento')
    or v_treatment.pending_version_id is not null
    or v_treatment.pending_document_id is not null then
    raise exception 'Somente a profissional responsável pode registrar produtos enquanto a sessão está editável.' using errcode = '42501';
  end if;

  if v_product_name is null or char_length(v_product_name) > 160 then
    raise exception 'Informe o produto (até 160 caracteres).' using errcode = '22023';
  end if;
  if v_lot_code is null or char_length(v_lot_code) > 100 then
    raise exception 'Informe o lote (até 100 caracteres).' using errcode = '22023';
  end if;
  if v_unit is null or char_length(v_unit) > 30 then
    raise exception 'Informe a unidade (até 30 caracteres).' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Quantidade deve ser maior que zero.' using errcode = '22023';
  end if;
  if p_expires_on is null or not pg_catalog.isfinite(p_expires_on) then
    raise exception 'Informe a validade do lote.' using errcode = '22023';
  end if;
  if p_expires_on < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Lote vencido não pode ser usado em novo atendimento.' using errcode = '22023';
  end if;

  -- Serializa registros simultâneos do mesmo nome digitado.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('bc_product_manual'),
    pg_catalog.hashtext(lower(v_product_name))
  );

  -- PostgreSQL não oferece min(uuid). O ID só é usado com um único resultado.
  select count(*), (array_agg(id order by id))[1] into v_matches, v_product_id
    from public.clinical_products
    where lower(pg_catalog.regexp_replace(name, '^[[:space:]]+|[[:space:]]+$', '', 'g')) = lower(v_product_name);
  if v_matches > 1 then
    raise exception 'Há produtos diferentes com esse nome. Identifique o produto na biblioteca antes do registro.' using errcode = '22023';
  end if;
  if v_matches = 1 then
    select * into v_product from public.clinical_products where id = v_product_id for share;
    if not v_product.active then
      raise exception 'Este produto está inativo. Solicite revisão da biblioteca.' using errcode = '22023';
    end if;
    if lower(pg_catalog.regexp_replace(v_product.name, '^[[:space:]]+|[[:space:]]+$', '', 'g')) <> lower(v_product_name) then
      raise exception 'O produto foi atualizado durante o registro. Confira o nome e tente novamente.' using errcode = '22023';
    end if;
  else
    insert into public.clinical_products(name, default_unit, tracks_lot, active, created_by)
      values (v_product_name, v_unit, true, true, v_user)
      returning id into v_product_id;
    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
      values (v_user, 'clinical_product_created', 'clinical_products', v_product_id,
        pg_catalog.jsonb_build_object('active', true, 'origin', 'clinical_treatment_manual'));
  end if;

  select count(*), (array_agg(id order by id))[1] into v_matches, v_lot_id
    from public.clinical_product_lots
    where product_id = v_product_id
      and lower(pg_catalog.regexp_replace(lot_code, '^[[:space:]]+|[[:space:]]+$', '', 'g')) = lower(v_lot_code);
  if v_matches > 1 then
    raise exception 'Há mais de um lote com esse código. Solicite revisão da biblioteca.' using errcode = '22023';
  end if;
  if v_matches = 1 then
    select * into v_lot from public.clinical_product_lots where id = v_lot_id for share;
    if not v_lot.active then
      raise exception 'Este lote está inativo. Solicite revisão da biblioteca.' using errcode = '22023';
    end if;
    if v_lot.product_id <> v_product_id
      or lower(pg_catalog.regexp_replace(v_lot.lot_code, '^[[:space:]]+|[[:space:]]+$', '', 'g')) <> lower(v_lot_code) then
      raise exception 'O lote foi atualizado durante o registro. Confira a identificação e tente novamente.' using errcode = '22023';
    end if;
    if v_lot.expires_on <> p_expires_on then
      raise exception 'Validade diferente do lote já cadastrado. Confira a embalagem antes de registrar.' using errcode = '22023';
    end if;
  else
    insert into public.clinical_product_lots(product_id, lot_code, expires_on, active, created_by)
      values (v_product_id, v_lot_code, p_expires_on, true, v_user)
      returning id into v_lot_id;
    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
      values (v_user, 'clinical_product_lot_created', 'clinical_product_lots', v_lot_id,
        pg_catalog.jsonb_build_object('product_id', v_product_id, 'active', true, 'origin', 'clinical_treatment_manual'));
  end if;

  -- Reutiliza a função já homologada: valida lotes, profissional, quantidade,
  -- cria o snapshot imutável e registra a auditoria do uso.
  v_usage_id := private.bc_treatment_product_usage_add_impl(
    p_treatment_id, v_product_id, v_lot_id, p_quantity, v_unit
  );
  return v_usage_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.bc_treatment_product_usage_remove_impl(p_usage_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_user uuid:=auth.uid(); v_usage public.clinical_treatment_product_usages%rowtype; v_treatment public.clinical_treatments%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos produtos do atendimento.' using errcode='42501'; end if;
  select * into v_usage from public.clinical_treatment_product_usages where id=p_usage_id for update;
  if not found then raise exception 'Uso de produto não encontrado.' using errcode='P0002'; end if;
  select * into v_treatment from public.clinical_treatments where id=v_usage.treatment_id for update;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
  delete from public.clinical_treatment_product_usages where id=p_usage_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data)
  values(v_user,'clinical_treatment_product_usage_removed','clinical_treatment_product_usages',p_usage_id,jsonb_build_object('treatment_id',v_usage.treatment_id,'product_id',v_usage.product_id,'lot_id',v_usage.lot_id));
  return p_usage_id;
end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_treatment_update_draft_impl(p_treatment_id uuid, p_patch jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if; if v_user<>t.profissional_user_id then raise exception 'Somente a profissional do atendimento pode editar.' using errcode='42501'; end if; if t.status='finalizado' or t.pending_version_id is not null then raise exception 'Atendimento finalizado ou aguardando assinatura não pode ser editado por este fluxo.' using errcode='55000'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_draft_updated','clinical_treatments',t.id,jsonb_build_object('field_count',(select count(*) from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb))))); return t.id; end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_treatment_report_upsert_impl(p_treatment_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare
  t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); v_id uuid; v_descricao text; v_resposta text; v_orientacoes text; v_observacoes text; v_retorno boolean; v_retorno_data date;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select * into t from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_user<>t.profissional_user_id then raise exception 'Somente a profissional responsável pode registrar o parecer.' using errcode='42501'; end if;
  if t.status<>'em_atendimento' or t.pending_document_id is not null then raise exception 'O parecer não pode ser alterado neste estado do atendimento.' using errcode='55000'; end if;
  v_descricao:=nullif(trim(p_payload->>'descricao_sessao'),'');
  v_resposta:=nullif(trim(p_payload->>'resposta_observada'),'');
  v_orientacoes:=nullif(trim(p_payload->>'orientacoes'),'');
  v_observacoes:=nullif(trim(p_payload->>'observacoes'),'');
  if v_descricao is null then raise exception 'Descrição da sessão é obrigatória.' using errcode='22023'; end if;
  if v_resposta is null then raise exception 'Resposta observada é obrigatória.' using errcode='22023'; end if;
  if v_orientacoes is null then raise exception 'Orientações são obrigatórias.' using errcode='22023'; end if;
  if not (p_payload ? 'retorno_necessario') or jsonb_typeof(p_payload->'retorno_necessario')<>'boolean' then raise exception 'Informe se há necessidade de retorno.' using errcode='22023'; end if;
  v_retorno:=(p_payload->>'retorno_necessario')::boolean;
  begin v_retorno_data:=nullif(trim(p_payload->>'retorno_sugerido_em'),'')::date; exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Data sugerida para retorno é inválida.' using errcode='22023'; end;
  if not v_retorno then v_retorno_data:=null; end if;
  insert into public.clinical_treatment_reports(treatment_id,descricao_sessao,resposta_observada,orientacoes,retorno_necessario,retorno_sugerido_em,observacoes,created_by)
  values(t.id,v_descricao,v_resposta,v_orientacoes,v_retorno,v_retorno_data,v_observacoes,v_user)
  on conflict(treatment_id) do update set descricao_sessao=excluded.descricao_sessao,resposta_observada=excluded.resposta_observada,orientacoes=excluded.orientacoes,retorno_necessario=excluded.retorno_necessario,retorno_sugerido_em=excluded.retorno_sugerido_em,observacoes=excluded.observacoes,updated_at=now()
  returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_report_saved','clinical_treatment_reports',v_id,jsonb_build_object('treatment_id',t.id,'retorno_necessario',v_retorno,'retorno_sugerido_em',v_retorno_data));
  return v_id;
end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_clinical_equipment_upsert_impl(p_equipment_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_user uuid:=auth.uid(); v_id uuid; v_name text; v_schema jsonb; v_active boolean;
begin
  if v_user is null or not private.bc_can_manage_procedures() then raise exception 'Sem permissão para gerenciar equipamentos.' using errcode='42501'; end if;
  v_name:=nullif(trim(p_payload->>'name'),''); if v_name is null then raise exception 'Nome do equipamento é obrigatório.' using errcode='22023'; end if;
  v_schema:=coalesce(p_payload->'parameter_schema','{"fields":[]}'::jsonb);
  perform private.bc_validate_equipment_schema(v_schema);
  v_active:=coalesce((p_payload->>'active')::boolean,true);
  if p_equipment_id is null then
    insert into public.clinical_equipment(name,manufacturer,model,internal_code,serial_number,parameter_schema,active,created_by)
    values(v_name,nullif(trim(p_payload->>'manufacturer'),''),nullif(trim(p_payload->>'model'),''),nullif(trim(p_payload->>'internal_code'),''),nullif(trim(p_payload->>'serial_number'),''),v_schema,v_active,v_user)
    returning id into v_id;
  else
    update public.clinical_equipment set name=v_name,manufacturer=nullif(trim(p_payload->>'manufacturer'),''),model=nullif(trim(p_payload->>'model'),''),internal_code=nullif(trim(p_payload->>'internal_code'),''),serial_number=nullif(trim(p_payload->>'serial_number'),''),parameter_schema=v_schema,active=v_active,updated_at=now()
    where id=p_equipment_id returning id into v_id;
    if v_id is null then raise exception 'Equipamento não encontrado.' using errcode='P0002'; end if;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,case when p_equipment_id is null then 'clinical_equipment_created' else 'clinical_equipment_updated' end,'clinical_equipment',v_id,jsonb_build_object('active',v_active));
  return v_id;
end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_clinical_product_lot_upsert_impl(p_product_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_user uuid:=auth.uid(); v_id uuid; v_requested_id uuid; v_code text; v_expires date; v_active boolean;
begin
  if v_user is null or not private.bc_can_manage_procedures() then raise exception 'Sem permissão para gerenciar lotes.' using errcode='42501'; end if;
  if not exists(select 1 from public.clinical_products p where p.id=p_product_id) then raise exception 'Produto não encontrado.' using errcode='P0002'; end if;
  v_code:=nullif(trim(p_payload->>'lot_code'),'');
  if v_code is null then raise exception 'Lote é obrigatório.' using errcode='22023'; end if;
  begin v_expires:=(p_payload->>'expires_on')::date; exception when others then raise exception 'Validade do lote é obrigatória e deve ser uma data válida.' using errcode='22023'; end;
  v_active:=coalesce((p_payload->>'active')::boolean,true);
  if nullif(p_payload->>'id','') is not null then v_requested_id:=(p_payload->>'id')::uuid; end if;
  if v_requested_id is null then
    insert into public.clinical_product_lots(product_id,lot_code,expires_on,notes,active,created_by)
    values(p_product_id,v_code,v_expires,nullif(trim(p_payload->>'notes'),''),v_active,v_user) returning id into v_id;
  else
    update public.clinical_product_lots set lot_code=v_code,expires_on=v_expires,notes=nullif(trim(p_payload->>'notes'),''),active=v_active,updated_at=now()
      where id=v_requested_id and product_id=p_product_id returning id into v_id;
    if v_id is null then raise exception 'Lote não encontrado para este produto.' using errcode='P0002'; end if;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,case when v_requested_id is null then 'clinical_product_lot_created' else 'clinical_product_lot_updated' end,'clinical_product_lots',v_id,jsonb_build_object('product_id',p_product_id,'active',v_active));
  return v_id;
end;$function$
;

CREATE OR REPLACE FUNCTION private.bc_clinical_product_upsert_impl(p_product_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_user uuid:=auth.uid(); v_id uuid; v_name text; v_active boolean;
begin
  if v_user is null or not private.bc_can_manage_procedures() then raise exception 'Sem permissão para gerenciar produtos.' using errcode='42501'; end if;
  v_name:=nullif(trim(p_payload->>'name'),'');
  if v_name is null then raise exception 'Nome do produto é obrigatório.' using errcode='22023'; end if;
  v_active:=coalesce((p_payload->>'active')::boolean,true);
  if p_product_id is null then
    insert into public.clinical_products(name,manufacturer,category,default_unit,tracks_lot,active,created_by)
    values(v_name,nullif(trim(p_payload->>'manufacturer'),''),nullif(trim(p_payload->>'category'),''),nullif(trim(p_payload->>'default_unit'),''),coalesce((p_payload->>'tracks_lot')::boolean,true),v_active,v_user)
    returning id into v_id;
  else
    update public.clinical_products set
      name=v_name,
      manufacturer=nullif(trim(p_payload->>'manufacturer'),''),
      category=nullif(trim(p_payload->>'category'),''),
      default_unit=nullif(trim(p_payload->>'default_unit'),''),
      tracks_lot=coalesce((p_payload->>'tracks_lot')::boolean,tracks_lot),
      active=v_active,
      updated_at=now()
    where id=p_product_id returning id into v_id;
    if v_id is null then raise exception 'Produto não encontrado.' using errcode='P0002'; end if;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,case when p_product_id is null then 'clinical_product_created' else 'clinical_product_updated' end,'clinical_products',v_id,jsonb_build_object('active',v_active));
  return v_id;
end;$function$
;

do $fn$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  if exists(select 1 from cron.job where jobname='bc-return-reminders-minute') then
   perform cron.unschedule('bc-return-reminders-minute');
  end if;
 end if;
end;$fn$;

-- Desativa os pontos de entrada novos sem remover os dados já salvos.
do $acl$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and (p.proname like 'bc_return_%' or p.proname in ('bc_treatment_equipment_usage_add_text','bc_treatment_equipment_usage_add_text_impl','bc_treatment_admin_reopen','bc_treatment_admin_reopen_impl')) loop
  execute 'revoke execute on function '||f.signature||' from public,anon,authenticated';
 end loop;
end;$acl$;

commit;

