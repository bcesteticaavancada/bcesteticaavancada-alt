-- BC Gestão Fase 6C — compatibilidade com os nomes reais de clinical_documents da Fase 6B.

create or replace function private.bc_treatment_prepare_consent_impl(
  p_cliente_id uuid,
  p_procedure_version_id uuid,
  p_component_version_ids uuid[] default '{}'::uuid[],
  p_component_keys text[] default '{}'::text[],
  p_cycle_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','public','auth','private'
as $$
declare
  v_user uuid := auth.uid();
  v_staff public.staff_profiles%rowtype;
  v_proc public.procedure_versions%rowtype;
  v_template public.consent_template_versions%rowtype;
  v_class text;
  v_component_ids uuid[] := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_component_version_ids,'{}'::uuid[])) x),'{}'::uuid[]);
  v_component_keys text[] := coalesce((select array_agg(distinct trim(x) order by trim(x)) from unnest(coalesce(p_component_keys,'{}'::text[])) x where nullif(trim(x),'') is not null),'{}'::text[]);
  v_option jsonb;
  v_key text;
  v_document_id uuid;
  v_consent_id uuid;
  v_existing public.procedure_consents%rowtype;
  v_code text;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select * into v_staff from public.staff_profiles where user_id=v_user and active and atende_clientes;
  if not found or nullif(trim(v_staff.profissao),'') is null or nullif(trim(v_staff.conselho),'') is null or nullif(trim(v_staff.registro_conselho),'') is null then raise exception 'Identidade profissional incompleta.' using errcode='22023'; end if;
  if not exists(select 1 from public.clientes where id=p_cliente_id and ativo=true) then raise exception 'Cliente ativa não encontrada.' using errcode='P0002'; end if;
  select * into v_proc from public.procedure_versions where id=p_procedure_version_id and status='published';
  if not found then raise exception 'Versão publicada do procedimento não encontrada.' using errcode='P0002'; end if;
  if v_proc.protocol_mode='compound' and cardinality(v_component_ids)=0 and cardinality(v_component_keys)=0 then raise exception 'Protocolo composto exige componentes reais da sessão.' using errcode='22023'; end if;
  if exists(select 1 from unnest(v_component_ids) supplied(id) where not exists(select 1 from public.procedure_version_components pvc join public.procedure_versions cv on cv.id=pvc.component_version_id and cv.status='published' where pvc.parent_version_id=p_procedure_version_id and pvc.component_version_id=supplied.id)) then raise exception 'Componente publicado inválido para este protocolo.' using errcode='22023'; end if;
  foreach v_key in array v_component_keys loop
    select opt into v_option from jsonb_array_elements(coalesce(v_proc.specific_schema->'component_options','[]'::jsonb)) opt where trim(opt->>'key')=v_key limit 1;
    if v_option is null then raise exception 'Componente dinâmico inválido para este protocolo.' using errcode='22023'; end if;
  end loop;
  v_class := v_proc.classe_documental;
  if v_class <> 'injetavel' and exists(select 1 from public.procedure_version_components pvc join public.procedure_versions cv on cv.id=pvc.component_version_id where pvc.parent_version_id=p_procedure_version_id and cv.id=any(v_component_ids) and cv.classe_documental='injetavel') then v_class := 'injetavel'; end if;
  if v_class <> 'injetavel' and exists(select 1 from jsonb_array_elements(coalesce(v_proc.specific_schema->'component_options','[]'::jsonb)) opt where trim(opt->>'key')=any(v_component_keys) and lower(trim(opt->>'classe_documental'))='injetavel') then v_class := 'injetavel'; end if;
  select * into v_template from public.consent_template_versions where consent_class=v_class and status='published' order by version desc limit 1;
  if not found then raise exception 'Template de consentimento não encontrado.' using errcode='P0002'; end if;
  if v_class='nao_injetavel' and nullif(trim(p_cycle_key),'') is not null then
    select * into v_existing from public.procedure_consents pc where pc.cliente_id=p_cliente_id and pc.procedure_version_id=p_procedure_version_id and pc.consent_template_version_id=v_template.id and pc.cycle_key=nullif(trim(p_cycle_key),'') and pc.component_version_ids=v_component_ids and pc.component_keys=v_component_keys and pc.status='finalizado' order by pc.finalized_at desc limit 1;
    if found then
      select id into v_document_id from public.clinical_documents where document_type='consentimento_procedimento' and source_id=v_existing.id order by document_version desc limit 1;
      if v_document_id is not null then return jsonb_build_object('document_id',v_document_id,'consent_id',v_existing.id,'reused',true,'consent_class',v_existing.consent_class,'template_version',v_template.version,'title',v_template.title,'body',v_template.body,'procedure_name',v_existing.procedure_name_snapshot,'supplement',v_existing.supplement_snapshot); end if;
    end if;
  end if;
  insert into public.procedure_consents(cliente_id,procedure_version_id,consent_template_version_id,consent_class,component_version_ids,component_keys,procedure_name_snapshot,supplement_snapshot,cycle_key,profissional_user_id)
  values(p_cliente_id,p_procedure_version_id,v_template.id,v_class,v_component_ids,v_component_keys,v_proc.nome,nullif(trim(v_proc.consent_supplement),''),nullif(trim(p_cycle_key),''),v_user)
  returning id into v_consent_id;
  v_code := 'BC-TCLE-' || to_char((now() at time zone 'America/Sao_Paulo')::date,'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.clinical_documents(cliente_id,document_type,source_id,source_version,document_version,document_code,status,profissional_user_id,profissional_nome,profissional_profissao,profissional_conselho,profissional_registro)
  values(p_cliente_id,'consentimento_procedimento',v_consent_id,1,1,v_code,'aguardando_assinaturas',v_user,v_staff.display_name,v_staff.profissao,v_staff.conselho,v_staff.registro_conselho)
  returning id into v_document_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'procedure_consent_prepared','procedure_consents',v_consent_id,jsonb_build_object('document_id',v_document_id,'procedure_version_id',p_procedure_version_id,'consent_class',v_class,'template_version',v_template.version));
  return jsonb_build_object('document_id',v_document_id,'consent_id',v_consent_id,'reused',false,'consent_class',v_class,'template_version',v_template.version,'title',v_template.title,'body',v_template.body,'procedure_name',v_proc.nome,'supplement',nullif(trim(v_proc.consent_supplement),''));
exception when unique_violation then
  if v_class='nao_injetavel' and nullif(trim(p_cycle_key),'') is not null then
    select * into v_existing from public.procedure_consents pc where pc.cliente_id=p_cliente_id and pc.procedure_version_id=p_procedure_version_id and pc.consent_template_version_id=v_template.id and pc.cycle_key=nullif(trim(p_cycle_key),'') and pc.component_version_ids=v_component_ids and pc.component_keys=v_component_keys order by pc.created_at desc limit 1;
    select id into v_document_id from public.clinical_documents where document_type='consentimento_procedimento' and source_id=v_existing.id order by document_version desc limit 1;
    return jsonb_build_object('document_id',v_document_id,'consent_id',v_existing.id,'reused',v_existing.status='finalizado','consent_class',v_existing.consent_class,'template_version',v_template.version,'title',v_template.title,'body',v_template.body,'procedure_name',v_existing.procedure_name_snapshot,'supplement',v_existing.supplement_snapshot);
  end if;
  raise;
end;
$$;
revoke all on function private.bc_treatment_prepare_consent_impl(uuid,uuid,uuid[],text[],text) from public;
revoke execute on function private.bc_treatment_prepare_consent_impl(uuid,uuid,uuid[],text[],text) from anon;
grant execute on function private.bc_treatment_prepare_consent_impl(uuid,uuid,uuid[],text[],text) to authenticated;

create or replace function private.bc_treatment_finalize_impl(p_treatment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.clinical_treatments%rowtype;
  pv public.procedure_versions%rowtype;
  s public.staff_profiles%rowtype;
  v_user uuid:=auth.uid();
  v_number integer;
  v_version uuid;
  v_doc uuid;
  v_code text;
  snap jsonb;
  correction text;
  comp jsonb;
begin
  select * into t from public.clinical_treatments where id=p_treatment_id for update;
  if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if;
  if t.status<>'em_atendimento' or t.pending_version_id is not null then raise exception 'Atendimento não está disponível para preparar finalização.' using errcode='55000'; end if;
  if nullif(trim(t.objetivo),'') is null or nullif(trim(t.regiao),'') is null or not private.bc_treatment_specific_complete(t.id) then raise exception 'Ficha técnica obrigatória incompleta.' using errcode='22023'; end if;
  select * into pv from public.procedure_versions where id=t.procedure_version_id;
  if t.price_mode_snapshot='fixed' then update public.clinical_treatments set final_price=base_price_snapshot where id=t.id; t.final_price:=t.base_price_snapshot;
  elsif t.price_mode_snapshot='starting_at' and (t.final_price is null or t.final_price<=0) then raise exception 'Preço final positivo é obrigatório para procedimento a partir de.' using errcode='22023'; end if;
  select * into s from public.staff_profiles where user_id=v_user and active and atende_clientes;
  if not found or nullif(trim(s.profissao),'') is null or nullif(trim(s.conselho),'') is null or nullif(trim(s.registro_conselho),'') is null then raise exception 'Identidade profissional incompleta.' using errcode='22023'; end if;
  select coalesce(max(version),0)+1 into v_number from public.clinical_treatment_versions where treatment_id=t.id;
  correction:=case when t.current_version_id is null then 'initial' else coalesce(t.correction_mode,'same_day') end;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) into comp from public.clinical_treatment_components c where c.treatment_id=t.id;
  snap:=jsonb_build_object('treatment',to_jsonb(t),'procedure_version',to_jsonb(pv),'components',comp,'professional',jsonb_build_object('name',s.display_name,'profissao',s.profissao,'conselho',s.conselho,'registro',s.registro_conselho),'consent_document_id',t.consent_document_id,'anamnese_id',t.anamnese_id,'captured_at',now());
  insert into public.clinical_treatment_versions(treatment_id,version,prior_version_id,correction_mode,snapshot,created_by) values(t.id,v_number,t.current_version_id,correction,snap,v_user) returning id into v_version;
  v_code:='BC-ATD-'||to_char((now() at time zone 'America/Sao_Paulo')::date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.clinical_documents(cliente_id,document_type,source_id,source_version,document_version,document_code,status,profissional_user_id,profissional_nome,profissional_profissao,profissional_conselho,profissional_registro)
  values(t.cliente_id,'treatment_record',v_version,v_number,v_number,v_code,'aguardando_assinaturas',v_user,s.display_name,s.profissao,s.conselho,s.registro_conselho)
  returning id into v_doc;
  update public.clinical_treatment_versions set document_id=v_doc where id=v_version;
  update public.clinical_treatments set pending_version_id=v_version,pending_document_id=v_doc,updated_at=now() where id=t.id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_finalization_prepared','clinical_treatment_versions',v_version,jsonb_build_object('treatment_id',t.id,'document_id',v_doc,'version',v_number));
  return jsonb_build_object('treatment_version_id',v_version,'document_id',v_doc,'version',v_number);
end;
$$;
revoke all on function private.bc_treatment_finalize_impl(uuid) from public;
revoke execute on function private.bc_treatment_finalize_impl(uuid) from anon;
grant execute on function private.bc_treatment_finalize_impl(uuid) to authenticated;
