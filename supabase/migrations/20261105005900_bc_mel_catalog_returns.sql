-- Mel: cadastros, equipamentos por texto e lembretes de retorno.
-- Aplicação específica; histórico de migrations anterior permanece intacto.

-- Dependência explícita do despachante HTTP, inclusive no replay descartável do CI.
create extension if not exists pg_net with schema extensions;

alter table public.clinical_treatment_equipment_usages add column if not exists usage_notes text;

CREATE OR REPLACE FUNCTION private.bc_treatment_update_draft_impl(p_treatment_id uuid, p_patch jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';
  end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if; if (v_user<>t.profissional_user_id and not private.is_bc_admin()) then raise exception 'Somente a profissional do atendimento pode editar.' using errcode='42501'; end if; if t.status='finalizado' or t.pending_version_id is not null then raise exception 'Atendimento finalizado ou aguardando assinatura não pode ser editado por este fluxo.' using errcode='55000'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_draft_updated','clinical_treatments',t.id,jsonb_build_object('field_count',(select count(*) from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb))))); return t.id; end;$function$
;

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
  if (v_treatment.profissional_user_id<>v_user and not private.is_bc_admin()) or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null or v_treatment.pending_version_id is not null then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
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
  if (v_treatment.profissional_user_id<>v_user and not private.is_bc_admin()) or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null or v_treatment.pending_version_id is not null then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
  delete from public.clinical_treatment_equipment_usages where id=p_usage_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data)
  values(v_user,'clinical_treatment_equipment_usage_removed','clinical_treatment_equipment_usages',p_usage_id,jsonb_build_object('treatment_id',v_usage.treatment_id,'equipment_id',v_usage.equipment_id));
  return p_usage_id;
end;$function$
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
  if v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null or v_treatment.pending_version_id is not null then raise exception 'Atendimento não está editável.' using errcode='42501'; end if;
  if (v_treatment.profissional_user_id<>v_user and not private.is_bc_admin()) then raise exception 'Somente a profissional responsável pode alterar produtos da sessão.' using errcode='42501'; end if;
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
  if (v_treatment.profissional_user_id<>v_user and not private.is_bc_admin()) or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null or v_treatment.pending_version_id is not null then raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501'; end if;
  delete from public.clinical_treatment_product_usages where id=p_usage_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data)
  values(v_user,'clinical_treatment_product_usage_removed','clinical_treatment_product_usages',p_usage_id,jsonb_build_object('treatment_id',v_usage.treatment_id,'product_id',v_usage.product_id,'lot_id',v_usage.lot_id));
  return p_usage_id;
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
  if (v_treatment.profissional_user_id is distinct from v_user and not private.is_bc_admin())
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bc_product_lot_manual'),pg_catalog.hashtext(v_product_id::text||':'||lower(v_lot_code)));
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
  if v_user<>t.profissional_user_id and not private.is_bc_admin() then raise exception 'Somente a profissional responsável pode registrar o parecer.' using errcode='42501'; end if;
  if t.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or t.pending_document_id is not null or t.pending_version_id is not null then raise exception 'O parecer não pode ser alterado neste estado do atendimento.' using errcode='55000'; end if;
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
  return r || jsonb_build_object('can_admin_edit',private.is_bc_admin());
end;
$function$
;



-- Mesmo domínio de travas da entrada por texto; protege criações e renomeações.
create or replace function private.bc_catalog_name(p_value text) returns text language sql immutable security invoker set search_path='' as $fn$select nullif(pg_catalog.regexp_replace(p_value,'^[[:space:]]+|[[:space:]]+$','','g'),'');$fn$;
revoke all on function private.bc_catalog_name(text) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION private.bc_clinical_equipment_upsert_impl(p_equipment_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_user uuid:=auth.uid(); v_id uuid; v_name text; v_schema jsonb; v_active boolean;
begin
  if v_user is null or not private.bc_can_manage_procedures() then raise exception 'Sem permissão para gerenciar equipamentos.' using errcode='42501'; end if;
  v_name:=private.bc_catalog_name(p_payload->>'name'); if v_name is null then raise exception 'Nome do equipamento é obrigatório.' using errcode='22023'; end if;
  v_schema:=coalesce(p_payload->'parameter_schema','{"fields":[]}'::jsonb);
  perform private.bc_validate_equipment_schema(v_schema);
  if char_length(v_name)>160 then raise exception 'Nome deve ter até 160 caracteres.' using errcode='22023';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bc_equipment_manual'),pg_catalog.hashtext(lower(v_name)));
  if exists(select 1 from public.clinical_equipment x where lower(private.bc_catalog_name(x.name))=lower(v_name) and x.id is distinct from p_equipment_id) then raise exception 'Este equipamento já está cadastrado. Selecione o cadastro existente para editar.' using errcode='22023';end if;
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
  v_code:=private.bc_catalog_name(p_payload->>'lot_code');
  if v_code is null then raise exception 'Lote é obrigatório.' using errcode='22023'; end if;
  if char_length(v_code)>100 then raise exception 'Lote deve ter até 100 caracteres.' using errcode='22023';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bc_product_lot_manual'),pg_catalog.hashtext(p_product_id::text||':'||lower(v_code)));
  if exists(select 1 from public.clinical_product_lots x where x.product_id=p_product_id and lower(private.bc_catalog_name(x.lot_code))=lower(v_code) and x.id is distinct from nullif(p_payload->>'id','')::uuid) then raise exception 'Este lote já está cadastrado para o produto. Selecione o lote existente para editar.' using errcode='22023';end if;
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
  v_name:=private.bc_catalog_name(p_payload->>'name');
  if v_name is null then raise exception 'Nome do produto é obrigatório.' using errcode='22023'; end if;
  if char_length(v_name)>160 then raise exception 'Nome deve ter até 160 caracteres.' using errcode='22023';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bc_product_manual'),pg_catalog.hashtext(lower(v_name)));
  if exists(select 1 from public.clinical_products x where lower(private.bc_catalog_name(x.name))=lower(v_name) and x.id is distinct from p_product_id) then raise exception 'Este produto já está cadastrado. Selecione o cadastro existente para editar.' using errcode='22023';end if;
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



create or replace function private.bc_treatment_equipment_usage_add_text_impl(p_treatment_id uuid,p_equipment_name text,p_parameter_values jsonb,p_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_user uuid:=auth.uid(); t public.clinical_treatments%rowtype; e public.clinical_equipment%rowtype; v_name text:=private.bc_catalog_name(p_equipment_name); v_id uuid; v_count integer;
begin
 if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501';end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update;
 if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002';end if;
 if (t.profissional_user_id is distinct from v_user and not private.is_bc_admin()) or t.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or t.pending_document_id is not null or t.pending_version_id is not null then raise exception 'Atendimento não está editável.' using errcode='42501';end if;
 if v_name is null or char_length(v_name)>160 or char_length(coalesce(p_notes,''))>4000 then raise exception 'Informe o equipamento (até 160 caracteres) e observações de até 4000 caracteres.' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bc_equipment_manual'),pg_catalog.hashtext(lower(v_name)));
 select count(*) into v_count from public.clinical_equipment where lower(private.bc_catalog_name(name))=lower(v_name);
 if v_count>1 then raise exception 'Há equipamentos duplicados com este nome. A administradora pode diferenciar os nomes no cadastro.' using errcode='22023';end if;
 select * into e from public.clinical_equipment where lower(private.bc_catalog_name(name))=lower(v_name) for update;
 if found then
  if not e.active then raise exception 'Equipamento inativo. Reative no cadastro antes de usar.' using errcode='22023';end if;
 else
  insert into public.clinical_equipment(name,parameter_schema,created_by) values(v_name,'{"fields":[]}'::jsonb,v_user) returning * into e;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_equipment_created','clinical_equipment',e.id,jsonb_build_object('source','treatment_manual'));
 end if;
 perform private.bc_validate_equipment_parameters(e.parameter_schema,coalesce(p_parameter_values,'{}'::jsonb));
 insert into public.clinical_treatment_equipment_usages(treatment_id,equipment_id,equipment_name_snapshot,manufacturer_snapshot,model_snapshot,internal_code_snapshot,parameter_schema_snapshot,parameter_values,usage_notes,created_by)
 values(t.id,e.id,e.name,e.manufacturer,e.model,e.internal_code,e.parameter_schema,coalesce(p_parameter_values,'{}'::jsonb),nullif(trim(p_notes),''),v_user) returning id into v_id;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_equipment_usage_added','clinical_treatment_equipment_usages',v_id,jsonb_build_object('treatment_id',t.id,'equipment_id',e.id));
 return v_id;
end;$fn$;
create or replace function public.bc_treatment_equipment_usage_add_text(p_treatment_id uuid,p_equipment_name text,p_parameter_values jsonb,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $fn$select private.bc_treatment_equipment_usage_add_text_impl($1,$2,$3,$4);$fn$;
revoke all on function private.bc_treatment_equipment_usage_add_text_impl(uuid,text,jsonb,text) from public,anon;
revoke all on function public.bc_treatment_equipment_usage_add_text(uuid,text,jsonb,text) from public,anon;
grant execute on function private.bc_treatment_equipment_usage_add_text_impl(uuid,text,jsonb,text),public.bc_treatment_equipment_usage_add_text(uuid,text,jsonb,text) to authenticated;

create or replace function private.bc_treatment_admin_reopen_impl(p_treatment_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $fn$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid();begin
 if v_user is null or not private.is_bc_admin() then raise exception 'Somente a administradora pode iniciar esta correção.' using errcode='42501';end if;
 if nullif(trim(p_reason),'') is null or char_length(p_reason)>2000 then raise exception 'Informe o motivo da correção (até 2000 caracteres).' using errcode='22023';end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update;
 if not found or t.status<>'finalizado' or t.current_version_id is null then raise exception 'Ficha finalizada não encontrada.' using errcode='55000';end if;
 update public.clinical_treatments set status='em_atendimento',correction_mode='reopened',correction_reason=trim(p_reason),finalized_at=null,pending_version_id=null,pending_document_id=null,updated_at=now() where id=t.id;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_admin_correction_started','clinical_treatments',t.id,jsonb_build_object('prior_version_id',t.current_version_id,'reason',trim(p_reason),'original_author',t.profissional_user_id));
 return t.id;
end;$fn$;
create or replace function public.bc_treatment_admin_reopen(p_treatment_id uuid,p_reason text)
returns uuid language sql security invoker set search_path='' as $fn$select private.bc_treatment_admin_reopen_impl($1,$2);$fn$;
revoke all on function private.bc_treatment_admin_reopen_impl(uuid,text),public.bc_treatment_admin_reopen(uuid,text) from public,anon;
grant execute on function private.bc_treatment_admin_reopen_impl(uuid,text),public.bc_treatment_admin_reopen(uuid,text) to authenticated;

create table if not exists public.bc_return_reminders(
 id uuid primary key default gen_random_uuid(),
 treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
 recipient_user_id uuid not null references auth.users(id) on delete restrict,
 return_on date not null,remind_at timestamptz not null,note text check(char_length(note)<=4000),
 revision integer not null default 1,active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,
 unique(treatment_id,recipient_user_id)
);
create index if not exists bc_return_reminders_due_idx on public.bc_return_reminders(remind_at) where active;
create index if not exists bc_return_reminders_recipient_idx on public.bc_return_reminders(recipient_user_id,remind_at);
create index if not exists bc_return_reminders_treatment_idx on public.bc_return_reminders(treatment_id);
create table if not exists public.bc_return_notifications(
 id uuid primary key default gen_random_uuid(),reminder_id uuid not null references public.bc_return_reminders(id) on delete restrict,
 revision integer not null,recipient_user_id uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now(),
 unique(reminder_id,revision)
);
create index if not exists bc_return_notifications_recipient_idx on public.bc_return_notifications(recipient_user_id,created_at);
create table if not exists private.bc_return_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete restrict,
 endpoint text not null unique,subscription jsonb not null,active boolean not null default true,updated_at timestamptz not null default now()
);
create index if not exists bc_return_push_subscriptions_user_idx on private.bc_return_push_subscriptions(user_id) where active;
create table if not exists private.bc_return_push_deliveries(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.bc_return_notifications(id) on delete restrict,
 subscription_id uuid not null references private.bc_return_push_subscriptions(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','processing','delivered','failed','expired','cancelled')),
 attempts integer not null default 0,claim_token uuid,lease_until timestamptz,next_attempt_at timestamptz not null default now(),delivered_at timestamptz,
 unique(notification_id,subscription_id)
);
create index if not exists bc_return_push_deliveries_ready_idx on private.bc_return_push_deliveries(next_attempt_at) where status in ('pending','processing');
create index if not exists bc_return_push_deliveries_subscription_idx on private.bc_return_push_deliveries(subscription_id);
create table if not exists private.bc_return_push_settings(
 singleton boolean primary key default true check(singleton),public_key text not null,private_key_secret_id uuid not null,cron_secret_id uuid not null
);
alter table public.bc_return_reminders enable row level security;
alter table public.bc_return_notifications enable row level security;
alter table private.bc_return_push_subscriptions enable row level security;
alter table private.bc_return_push_deliveries enable row level security;
alter table private.bc_return_push_settings enable row level security;
revoke all on public.bc_return_reminders,public.bc_return_notifications from public,anon,authenticated;
revoke all on private.bc_return_push_subscriptions,private.bc_return_push_deliveries,private.bc_return_push_settings from public,anon,authenticated;

create or replace function private.bc_return_reminder_save_impl(p_treatment_id uuid,p_return_on date,p_remind_at timestamptz,p_note text)
returns uuid language plpgsql security definer set search_path=''
as $fn$declare t public.clinical_treatments%rowtype;v_id uuid;v_user uuid:=auth.uid();begin
 if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501';end if;
 select * into t from public.clinical_treatments where id=p_treatment_id for update;
 if not found or (t.profissional_user_id is distinct from v_user and not private.is_bc_admin()) then raise exception 'Acesso negado ao retorno desta sessão.' using errcode='42501';end if;
 if p_return_on is null or not pg_catalog.isfinite(p_return_on) or p_return_on<(now() at time zone 'America/Sao_Paulo')::date or p_remind_at is null or not pg_catalog.isfinite(p_remind_at) or p_remind_at<now()-interval '1 minute' or p_remind_at>=((p_return_on+1)::timestamp at time zone 'America/Sao_Paulo') or char_length(coalesce(p_note,''))>4000 then raise exception 'Informe a data de retorno e um aviso futuro até o dia do retorno (horário de Brasília).' using errcode='22023';end if;
 insert into public.bc_return_reminders(treatment_id,recipient_user_id,return_on,remind_at,note)
 values(t.id,v_user,p_return_on,p_remind_at,nullif(trim(p_note),''))
 on conflict(treatment_id,recipient_user_id) do update set return_on=excluded.return_on,remind_at=excluded.remind_at,note=excluded.note,revision=bc_return_reminders.revision+1,active=true,completed_at=null,updated_at=now() returning id into v_id;
 update private.bc_return_push_deliveries d set status='cancelled',claim_token=null,lease_until=null from public.bc_return_notifications n where d.notification_id=n.id and n.reminder_id=v_id and d.status in ('pending','processing');
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'return_reminder_saved','bc_return_reminders',v_id,jsonb_build_object('treatment_id',t.id,'remind_at',p_remind_at));
 return v_id;
end;$fn$;
create or replace function private.bc_return_reminder_get_impl(p_treatment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$declare r jsonb;begin
 if auth.uid() is null or not private.is_bc_active_staff() or not exists(select 1 from public.clinical_treatments t where t.id=p_treatment_id and (t.profissional_user_id=auth.uid() or private.is_bc_admin())) then raise exception 'Lembrete disponível somente à profissional responsável ou administradora.' using errcode='42501';end if;
 select to_jsonb(x) into r from public.bc_return_reminders x where x.treatment_id=p_treatment_id and x.recipient_user_id=auth.uid();return r;
end;$fn$;
create or replace function private.bc_return_materialize()
returns void language sql security definer set search_path='' as $fn$
 insert into public.bc_return_notifications(reminder_id,revision,recipient_user_id)
 select r.id,r.revision,r.recipient_user_id from public.bc_return_reminders r join public.staff_profiles s on s.user_id=r.recipient_user_id
 where r.active and r.remind_at<=now() and s.active and s.role in ('admin','colaborador')
 on conflict(reminder_id,revision) do nothing;
 insert into private.bc_return_push_deliveries(notification_id,subscription_id)
 select n.id,s.id from public.bc_return_notifications n join public.bc_return_reminders r on r.id=n.reminder_id and r.revision=n.revision and r.active
 join private.bc_return_push_subscriptions s on s.user_id=n.recipient_user_id and s.active
 join public.staff_profiles p on p.user_id=n.recipient_user_id and p.active and p.role in ('admin','colaborador')
 on conflict(notification_id,subscription_id) do nothing;
$fn$;
revoke all on function private.bc_return_materialize() from public,anon,authenticated;
create or replace function private.bc_return_reminder_list_impl()
returns jsonb language plpgsql security definer set search_path=''
as $fn$declare v_result jsonb;begin
 if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501';end if;
 perform private.bc_return_materialize();
 select coalesce(jsonb_agg(x.data order by x.active desc,x.remind_at),'[]'::jsonb) into v_result from (
  select to_jsonb(r)||jsonb_build_object('client_name',c.nome,'notified_at',n.created_at,'push_failed',exists(select 1 from private.bc_return_push_deliveries d where d.notification_id=n.id and d.status='failed')) data,r.active,r.remind_at
  from public.bc_return_reminders r join public.clinical_treatments t on t.id=r.treatment_id join public.clientes c on c.id=t.cliente_id
  left join public.bc_return_notifications n on n.reminder_id=r.id and n.revision=r.revision
  where r.recipient_user_id=auth.uid() order by r.active desc,r.remind_at limit 300
 ) x;return v_result;
end;$fn$;
create or replace function private.bc_return_reminder_complete_impl(p_reminder_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $fn$declare v_user uuid:=auth.uid();begin
 if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501';end if;
 update public.bc_return_reminders set active=false,completed_at=now(),revision=revision+1,updated_at=now() where id=p_reminder_id and (recipient_user_id=v_user or private.is_bc_admin());
 if not found then raise exception 'Lembrete não encontrado.' using errcode='42501';end if;
 update private.bc_return_push_deliveries d set status='cancelled',claim_token=null,lease_until=null from public.bc_return_notifications n where d.notification_id=n.id and n.reminder_id=p_reminder_id and d.status in ('pending','processing');
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(v_user,'return_reminder_completed','bc_return_reminders',p_reminder_id);return p_reminder_id;
end;$fn$;
create or replace function private.bc_return_push_public_key_impl()
returns text language plpgsql stable security definer set search_path=''
as $fn$begin if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501';end if;return(select public_key from private.bc_return_push_settings where singleton);end;$fn$;
create or replace function private.bc_return_push_subscribe_impl(p_subscription jsonb)
returns uuid language plpgsql security definer set search_path=''
as $fn$declare v_user uuid:=auth.uid();v_id uuid;v_endpoint text:=p_subscription->>'endpoint';begin
 if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501';end if;
 if jsonb_typeof(p_subscription)<>'object' or v_endpoint is null or char_length(v_endpoint)>2048 or v_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)?push\.apple\.com|([a-z0-9-]+\.)?notify\.windows\.com)/' or coalesce(p_subscription->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}={0,1}$' or coalesce(p_subscription->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception 'Inscrição de notificações inválida.' using errcode='22023';end if;
 insert into private.bc_return_push_subscriptions(user_id,endpoint,subscription) values(v_user,v_endpoint,jsonb_build_object('endpoint',v_endpoint,'keys',p_subscription->'keys'))
 on conflict(endpoint) do update set user_id=excluded.user_id,subscription=excluded.subscription,active=true,updated_at=now() returning id into v_id;
 -- A shared browser can only belong to the account that explicitly enabled it.
 update private.bc_return_push_deliveries d set status='cancelled',claim_token=null from public.bc_return_notifications n where d.subscription_id=v_id and d.notification_id=n.id and n.recipient_user_id<>v_user and d.status in ('pending','processing');
 return v_id;
end;$fn$;
create or replace function private.bc_return_push_unsubscribe_impl(p_endpoint text)
returns boolean language plpgsql security definer set search_path=''
as $fn$begin
 if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501';end if;
 update private.bc_return_push_subscriptions set active=false,updated_at=now() where endpoint=p_endpoint and user_id=auth.uid();return true;
end;$fn$;

create or replace function public.bc_return_reminder_save(p_treatment_id uuid,p_return_on date,p_remind_at timestamptz,p_note text default null) returns uuid language sql security invoker set search_path='' as $fn$select private.bc_return_reminder_save_impl($1,$2,$3,$4);$fn$;
create or replace function public.bc_return_reminder_get(p_treatment_id uuid) returns jsonb language sql stable security invoker set search_path='' as $fn$select private.bc_return_reminder_get_impl($1);$fn$;
create or replace function public.bc_return_reminder_list() returns jsonb language sql security invoker set search_path='' as $fn$select private.bc_return_reminder_list_impl();$fn$;
create or replace function public.bc_return_reminder_complete(p_reminder_id uuid) returns uuid language sql security invoker set search_path='' as $fn$select private.bc_return_reminder_complete_impl($1);$fn$;
create or replace function public.bc_return_push_public_key() returns text language sql stable security invoker set search_path='' as $fn$select private.bc_return_push_public_key_impl();$fn$;
create or replace function public.bc_return_push_subscribe(p_subscription jsonb) returns uuid language sql security invoker set search_path='' as $fn$select private.bc_return_push_subscribe_impl($1);$fn$;
create or replace function public.bc_return_push_unsubscribe(p_endpoint text) returns boolean language sql security invoker set search_path='' as $fn$select private.bc_return_push_unsubscribe_impl($1);$fn$;

alter table private.bc_return_push_settings add column if not exists function_url text;
create or replace function public.bc_return_push_worker_config(p_secret text)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$declare c private.bc_return_push_settings%rowtype;v_secret text;v_private text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acesso negado.' using errcode='42501';end if;
 select * into c from private.bc_return_push_settings where singleton;
 if not found or nullif(p_secret,'') is null then return null;end if;
 select decrypted_secret into v_secret from vault.decrypted_secrets where id=c.cron_secret_id;
 if v_secret is distinct from p_secret then return null;end if;
 select decrypted_secret into v_private from vault.decrypted_secrets where id=c.private_key_secret_id;
 if v_private is null then return null;end if;
 return jsonb_build_object('public_key',c.public_key,'private_key',v_private);
end;$fn$;
create or replace function public.bc_return_push_claim()
returns jsonb language plpgsql security definer set search_path=''
as $fn$declare v_id uuid;v_token uuid;v_result jsonb:='[]'::jsonb;v_job jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acesso negado.' using errcode='42501';end if;
 update private.bc_return_push_deliveries set status='failed',claim_token=null where status='processing' and lease_until<now() and attempts>=5;
 for v_id in select d.id from private.bc_return_push_deliveries d
 join public.bc_return_notifications n on n.id=d.notification_id
 join public.bc_return_reminders r on r.id=n.reminder_id and r.revision=n.revision and r.active
 join private.bc_return_push_subscriptions s on s.id=d.subscription_id and s.active and s.user_id=n.recipient_user_id
 join public.staff_profiles p on p.user_id=n.recipient_user_id and p.active and p.role in ('admin','colaborador')
 where d.status in ('pending','processing') and d.attempts<5 and d.next_attempt_at<=now() and (d.lease_until is null or d.lease_until<now())
 order by d.next_attempt_at limit 10 for update of d skip locked loop
  v_token:=gen_random_uuid();
  update private.bc_return_push_deliveries set status='processing',attempts=attempts+1,claim_token=v_token,lease_until=now()+interval '3 minutes' where id=v_id;
  select jsonb_build_object('id',d.id,'claim_token',v_token,'subscription',s.subscription) into v_job from private.bc_return_push_deliveries d join private.bc_return_push_subscriptions s on s.id=d.subscription_id where d.id=v_id;
  v_result:=v_result||jsonb_build_array(v_job);
 end loop;return v_result;
end;$fn$;
create or replace function public.bc_return_push_is_current(p_delivery_id uuid,p_claim_token uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $fn$begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acesso negado.' using errcode='42501';end if;
 return exists(select 1 from private.bc_return_push_deliveries d join public.bc_return_notifications n on n.id=d.notification_id
 join public.bc_return_reminders r on r.id=n.reminder_id and r.revision=n.revision and r.active
 join private.bc_return_push_subscriptions s on s.id=d.subscription_id and s.active and s.user_id=n.recipient_user_id
 join public.staff_profiles p on p.user_id=n.recipient_user_id and p.active and p.role in ('admin','colaborador')
 where d.id=p_delivery_id and d.claim_token=p_claim_token and d.status='processing' and d.lease_until>now());
end;$fn$;
create or replace function public.bc_return_push_finish(p_delivery_id uuid,p_claim_token uuid,p_outcome text)
returns boolean language plpgsql security definer set search_path=''
as $fn$declare d private.bc_return_push_deliveries%rowtype;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acesso negado.' using errcode='42501';end if;
 if p_outcome not in ('delivered','expired','retry','cancelled') then raise exception 'Resultado inválido.' using errcode='22023';end if;
 select * into d from private.bc_return_push_deliveries where id=p_delivery_id and claim_token=p_claim_token and status='processing' for update;
 if not found then return false;end if;
 if p_outcome='expired' then update private.bc_return_push_subscriptions set active=false,updated_at=now() where id=d.subscription_id;end if;
 update private.bc_return_push_deliveries set
 status=case when p_outcome='retry' then case when attempts>=5 then 'failed' else 'pending' end else p_outcome end,
 delivered_at=case when p_outcome='delivered' then now() else delivered_at end,
 lease_until=null,claim_token=null,next_attempt_at=now()+make_interval(mins=>least(60,attempts*attempts))
 where id=d.id;return true;
end;$fn$;
create or replace function private.bc_return_push_tick()
returns bigint language plpgsql security definer set search_path=''
as $fn$declare c private.bc_return_push_settings%rowtype;v_secret text;v_request bigint;begin
 -- Finaliza a última tentativa abandonada mesmo quando não há outro envio para chamar o worker.
 update private.bc_return_push_deliveries set status='failed',claim_token=null,lease_until=null where status='processing' and lease_until<now() and attempts>=5;
 perform private.bc_return_materialize();
 if not exists(select 1 from private.bc_return_push_deliveries d join public.bc_return_notifications n on n.id=d.notification_id
 join public.bc_return_reminders r on r.id=n.reminder_id and r.revision=n.revision and r.active
 join private.bc_return_push_subscriptions s on s.id=d.subscription_id and s.active and s.user_id=n.recipient_user_id
 where d.status in ('pending','processing') and d.attempts<5 and d.next_attempt_at<=now() and (d.lease_until is null or d.lease_until<now())) then return null;end if;
 select * into c from private.bc_return_push_settings where singleton;
 if not found or c.function_url is null then return null;end if;
 select decrypted_secret into v_secret from vault.decrypted_secrets where id=c.cron_secret_id;
 if v_secret is null then return null;end if;
 select net.http_post(url:=c.function_url,headers:=jsonb_build_object('Content-Type','application/json','x-bc-reminder-key',v_secret),body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request;return v_request;
end;$fn$;
revoke all on function private.bc_return_push_tick() from public,anon,authenticated;

-- RPCs da equipe: wrappers invoker e impls com auth.uid + papel clínico.
do $acl$declare sig text;begin
 foreach sig in array array[
 'bc_return_reminder_save(uuid,date,timestamp with time zone,text)',
 'bc_return_reminder_get(uuid)','bc_return_reminder_list()','bc_return_reminder_complete(uuid)',
 'bc_return_push_public_key()','bc_return_push_subscribe(jsonb)','bc_return_push_unsubscribe(text)'
 ] loop
  execute 'revoke all on function public.'||sig||' from public,anon';
  execute 'grant execute on function public.'||sig||' to authenticated';
  execute 'revoke all on function private.'||replace(sig,'(', '_impl(')||' from public,anon';
  execute 'grant execute on function private.'||replace(sig,'(', '_impl(')||' to authenticated';
 end loop;
 foreach sig in array array['bc_return_push_worker_config(text)','bc_return_push_claim()','bc_return_push_is_current(uuid,uuid)','bc_return_push_finish(uuid,uuid,text)'] loop
  execute 'revoke all on function public.'||sig||' from public,anon,authenticated';
  execute 'grant execute on function public.'||sig||' to service_role';
 end loop;
end;$acl$;

-- Em CI e produção, a extensão já existente fornece o agendamento. Não instala serviços novos.
do $cron$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('bc-return-reminders-minute','* * * * *','select private.bc_return_push_tick();');
 end if;
end;$cron$;
