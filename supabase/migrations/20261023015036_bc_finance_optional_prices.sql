-- Zero explícito é gratuito; null continua a definir sem bloquear o registro clínico.
create or replace function private.bc_clinical_price_valid(p_price numeric) returns boolean
language sql immutable security invoker set search_path='' as $$select p_price is null or (p_price::text not in ('NaN','Infinity','-Infinity') and p_price>=0 and p_price<10000000000 and p_price=round(p_price,2));$$;
revoke all on function private.bc_clinical_price_valid(numeric) from public,anon,authenticated;
alter table public.procedure_versions alter column base_price drop not null;
alter table public.procedure_versions drop constraint if exists procedure_versions_base_price_check;
alter table public.procedure_versions add constraint procedure_versions_base_price_check check(base_price is null or (base_price>=0 and base_price::text not in ('NaN','Infinity','-Infinity')));
alter table public.clinical_treatments alter column base_price_snapshot drop not null;
alter table public.clinical_treatments drop constraint if exists clinical_treatments_base_price_snapshot_check;
alter table public.clinical_treatments add constraint clinical_treatments_base_price_snapshot_check check(base_price_snapshot is null or (base_price_snapshot>=0 and base_price_snapshot::text not in ('NaN','Infinity','-Infinity')));
alter table public.clinical_treatments drop constraint if exists clinical_treatments_final_price_check;
alter table public.clinical_treatments add constraint clinical_treatments_final_price_check check(final_price is null or (final_price>=0 and final_price::text not in ('NaN','Infinity','-Infinity')));

create or replace function private.bc_procedure_save_draft_impl(p_procedure_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_procedure_id uuid := p_procedure_id;
  v_version_id uuid;
  v_name text := nullif(trim(p_payload->>'nome'),'');
  v_class text := lower(trim(coalesce(p_payload->>'classe_documental','')));
  v_price_mode text := lower(trim(coalesce(p_payload->>'price_mode','')));
  v_protocol_mode text := lower(trim(coalesce(p_payload->>'protocol_mode','simple')));
  v_base_price numeric;
  v_duration integer;
  v_next_version integer;
  v_component text;
  v_order integer := 0;
begin
  if v_user is null or not private.bc_can_manage_procedures() then
    raise exception 'Sem permissão para gerenciar procedimentos.' using errcode='42501';
  end if;
  if v_name is null then raise exception 'Nome obrigatório.' using errcode='22023'; end if;
  if v_class not in ('injetavel','nao_injetavel') then raise exception 'Classe documental inválida.' using errcode='22023'; end if;
  if v_price_mode not in ('fixed','starting_at') then raise exception 'Modo de preço inválido.' using errcode='22023'; end if;
  if v_protocol_mode not in ('simple','compound') then raise exception 'Modo de protocolo inválido.' using errcode='22023'; end if;

  begin
    v_base_price := nullif(trim(p_payload->>'base_price'),'')::numeric;
  exception when others then
    raise exception 'Preço-base inválido.' using errcode='22023';
  end;
  if not private.bc_clinical_price_valid(v_base_price) then raise exception 'Preço-base inválido.' using errcode='22023'; end if;

  begin
    v_duration := nullif(trim(p_payload->>'suggested_duration'),'')::integer;
  exception when others then
    raise exception 'Duração sugerida inválida.' using errcode='22023';
  end;
  if v_duration is not null and v_duration <= 0 then raise exception 'Duração sugerida inválida.' using errcode='22023'; end if;

  if v_procedure_id is null then
    select p.id into v_procedure_id from public.procedimentos p
     where lower(trim(p.nome))=lower(v_name) limit 1;
    if v_procedure_id is null then
      insert into public.procedimentos(nome,ativo,duracao_padrao,created_by)
      values(v_name,false,v_duration,v_user)
      returning id into v_procedure_id;
    end if;
  end if;

  perform 1 from public.procedimentos where id=v_procedure_id for update;
  if not found then raise exception 'Procedimento não encontrado.' using errcode='P0002'; end if;

  select id into v_version_id from public.procedure_versions
   where procedimento_id=v_procedure_id and status='draft' for update;

  if v_version_id is null then
    select coalesce(max(version),0)+1 into v_next_version
      from public.procedure_versions where procedimento_id=v_procedure_id;
    insert into public.procedure_versions(
      procedimento_id,version,status,nome,classe_documental,categoria,descricao,price_mode,base_price,
      suggested_duration,requires_general_anamnesis,requires_return,return_interval_days,
      pre_guidance,post_guidance,consent_supplement,specific_schema,technical_schema,protocol_mode,
      requires_photo,requires_product_lot,requires_equipment,created_by
    ) values (
      v_procedure_id,v_next_version,'draft',v_name,v_class,nullif(trim(p_payload->>'categoria'),''),nullif(trim(p_payload->>'descricao'),''),
      v_price_mode,v_base_price,v_duration,coalesce((p_payload->>'requires_general_anamnesis')::boolean,true),
      coalesce((p_payload->>'requires_return')::boolean,false),nullif(trim(p_payload->>'return_interval_days'),'')::integer,
      nullif(trim(p_payload->>'pre_guidance'),''),nullif(trim(p_payload->>'post_guidance'),''),nullif(trim(p_payload->>'consent_supplement'),''),
      coalesce(p_payload->'specific_schema','{}'::jsonb),coalesce(p_payload->'technical_schema','{}'::jsonb),v_protocol_mode,
      coalesce((p_payload->>'requires_photo')::boolean,false),coalesce((p_payload->>'requires_product_lot')::boolean,false),
      coalesce((p_payload->>'requires_equipment')::boolean,false),v_user
    ) returning id into v_version_id;
  else
    update public.procedure_versions set
      nome=v_name,
      classe_documental=v_class,
      categoria=nullif(trim(p_payload->>'categoria'),''),
      descricao=nullif(trim(p_payload->>'descricao'),''),
      price_mode=v_price_mode,
      base_price=v_base_price,
      suggested_duration=v_duration,
      requires_general_anamnesis=coalesce((p_payload->>'requires_general_anamnesis')::boolean,true),
      requires_return=coalesce((p_payload->>'requires_return')::boolean,false),
      return_interval_days=nullif(trim(p_payload->>'return_interval_days'),'')::integer,
      pre_guidance=nullif(trim(p_payload->>'pre_guidance'),''),
      post_guidance=nullif(trim(p_payload->>'post_guidance'),''),
      consent_supplement=nullif(trim(p_payload->>'consent_supplement'),''),
      specific_schema=coalesce(p_payload->'specific_schema','{}'::jsonb),
      technical_schema=coalesce(p_payload->'technical_schema','{}'::jsonb),
      protocol_mode=v_protocol_mode,
      requires_photo=coalesce((p_payload->>'requires_photo')::boolean,false),
      requires_product_lot=coalesce((p_payload->>'requires_product_lot')::boolean,false),
      requires_equipment=coalesce((p_payload->>'requires_equipment')::boolean,false),
      updated_at=now()
    where id=v_version_id;
  end if;

  delete from public.procedure_version_components where parent_version_id=v_version_id;
  if jsonb_typeof(coalesce(p_payload->'component_version_ids','[]'::jsonb)) <> 'array' then
    raise exception 'Componentes inválidos.' using errcode='22023';
  end if;
  for v_component in select jsonb_array_elements_text(coalesce(p_payload->'component_version_ids','[]'::jsonb))
  loop
    v_order := v_order + 1;
    if not exists(select 1 from public.procedure_versions cv where cv.id=v_component::uuid and cv.status='published') then
      raise exception 'Componente publicado não encontrado.' using errcode='22023';
    end if;
    if v_component::uuid=v_version_id then raise exception 'Procedimento não pode compor a si mesmo.' using errcode='22023'; end if;
    insert into public.procedure_version_components(parent_version_id,component_version_id,required,sort_order)
    values(v_version_id,v_component::uuid,true,v_order)
    on conflict(parent_version_id,component_version_id) do update set sort_order=excluded.sort_order;
  end loop;

  if v_protocol_mode='compound'
     and not exists(select 1 from public.procedure_version_components where parent_version_id=v_version_id)
     and not (
       jsonb_typeof(coalesce(p_payload->'specific_schema'->'component_options','[]'::jsonb))='array'
       and jsonb_array_length(coalesce(p_payload->'specific_schema'->'component_options','[]'::jsonb)) > 0
     ) then
    raise exception 'Protocolo composto exige ao menos um componente.' using errcode='22023';
  end if;

  update public.procedimentos set nome=v_name,duracao_padrao=v_duration,updated_at=now()
   where id=v_procedure_id and current_version_id is null;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_draft_saved','procedure_versions',v_version_id,jsonb_build_object('procedimento_id',v_procedure_id));
  return v_procedure_id;
end;
$$;

create or replace function private.bc_treatment_apply_patch(p_treatment_id uuid,p_patch jsonb)
returns void language plpgsql security definer set search_path=''
as $$declare v_price numeric; begin
 if jsonb_typeof(coalesce(p_patch,'{}'::jsonb))<>'object' then raise exception 'Patch inválido.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb)) as k where k not in ('queixa_dia','objetivo','avaliacao_profissional','regiao','specific_data','technical_data','resposta_imediata','intercorrencias_ato','orientacoes','retorno','evolucao','feedback','observacoes','final_price','cycle_key')) then raise exception 'Campo de atendimento não permitido.' using errcode='22023'; end if;
 if p_patch?'final_price' then begin v_price:=nullif(trim(p_patch->>'final_price'),'')::numeric; exception when others then raise exception 'Preço final inválido.' using errcode='22023'; end; if not private.bc_clinical_price_valid(v_price) then raise exception 'Preço final inválido.' using errcode='22023'; end if; end if;
 if p_patch?'specific_data' and jsonb_typeof(coalesce(p_patch->'specific_data','{}'::jsonb))<>'object' then raise exception 'Módulo específico inválido.' using errcode='22023'; end if;
 if p_patch?'technical_data' and jsonb_typeof(coalesce(p_patch->'technical_data','{}'::jsonb))<>'object' then raise exception 'Dados técnicos inválidos.' using errcode='22023'; end if;
 update public.clinical_treatments set
  queixa_dia=case when p_patch?'queixa_dia' then nullif(trim(p_patch->>'queixa_dia'),'') else queixa_dia end,
  objetivo=case when p_patch?'objetivo' then nullif(trim(p_patch->>'objetivo'),'') else objetivo end,
  avaliacao_profissional=case when p_patch?'avaliacao_profissional' then nullif(trim(p_patch->>'avaliacao_profissional'),'') else avaliacao_profissional end,
  regiao=case when p_patch?'regiao' then nullif(trim(p_patch->>'regiao'),'') else regiao end,
  specific_data=case when p_patch?'specific_data' then coalesce(p_patch->'specific_data','{}'::jsonb) else specific_data end,
  technical_data=case when p_patch?'technical_data' then coalesce(p_patch->'technical_data','{}'::jsonb) else technical_data end,
  resposta_imediata=case when p_patch?'resposta_imediata' then nullif(trim(p_patch->>'resposta_imediata'),'') else resposta_imediata end,
  intercorrencias_ato=case when p_patch?'intercorrencias_ato' then nullif(trim(p_patch->>'intercorrencias_ato'),'') else intercorrencias_ato end,
  orientacoes=case when p_patch?'orientacoes' then nullif(trim(p_patch->>'orientacoes'),'') else orientacoes end,
  retorno=case when p_patch?'retorno' then nullif(trim(p_patch->>'retorno'),'') else retorno end,
  evolucao=case when p_patch?'evolucao' then nullif(trim(p_patch->>'evolucao'),'') else evolucao end,
  feedback=case when p_patch?'feedback' then nullif(trim(p_patch->>'feedback'),'') else feedback end,
  observacoes=case when p_patch?'observacoes' then nullif(trim(p_patch->>'observacoes'),'') else observacoes end,
  final_price=case when p_patch?'final_price' then v_price else final_price end,
  cycle_key=case when p_patch?'cycle_key' then nullif(trim(p_patch->>'cycle_key'),'') else cycle_key end, updated_at=now()
 where id=p_treatment_id; end;$$;

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
  v_report public.clinical_treatment_reports%rowtype;
  v_user uuid:=auth.uid();
  v_number integer;
  v_version uuid;
  v_doc uuid;
  v_code text;
  snap jsonb;
  correction text;
  comp jsonb;
  v_phase6d_reasons text[];
  v_photos jsonb;
  v_products jsonb;
  v_equipment jsonb;
  v_intercurrences jsonb;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso restrito à equipe clínica ativa.' using errcode='42501';end if;
  select * into t from public.clinical_treatments where id=p_treatment_id for update;
  if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if;
  if t.status<>'em_atendimento' or t.pending_version_id is not null then raise exception 'Atendimento não está disponível para preparar finalização.' using errcode='55000'; end if;
  if nullif(trim(t.objetivo),'') is null or nullif(trim(t.regiao),'') is null or not private.bc_treatment_specific_complete(t.id) then raise exception 'Ficha técnica obrigatória incompleta.' using errcode='22023'; end if;

  v_phase6d_reasons:=private.bc_treatment_finalization_gate(t.id);
  if cardinality(v_phase6d_reasons)>0 then
    raise exception 'Finalização possui pendências: %',array_to_string(v_phase6d_reasons,', ') using errcode='55000';
  end if;

  select * into v_report from public.clinical_treatment_reports where treatment_id=t.id;
  if not found then
    raise exception 'Parecer clínico obrigatório não encontrado.' using errcode='55000';
  end if;

  select * into pv from public.procedure_versions where id=t.procedure_version_id;
  if t.price_mode_snapshot='fixed' and t.base_price_snapshot is not null then
    update public.clinical_treatments set final_price=base_price_snapshot where id=t.id;
    t.final_price:=t.base_price_snapshot;
  end if;

  if not private.bc_clinical_price_valid(t.final_price) then raise exception 'Valor da sessão inválido.' using errcode='22023';end if;
  select * into s from public.staff_profiles where user_id=v_user and active and atende_clientes;
  if not found or nullif(trim(s.profissao),'') is null or nullif(trim(s.conselho),'') is null or nullif(trim(s.registro_conselho),'') is null then
    raise exception 'Identidade profissional incompleta.' using errcode='22023';
  end if;

  select coalesce(max(version),0)+1 into v_number from public.clinical_treatment_versions where treatment_id=t.id;
  correction:=case when t.current_version_id is null then 'initial' else coalesce(t.correction_mode,'same_day') end;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) into comp
    from public.clinical_treatment_components c where c.treatment_id=t.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'kind',x.kind,'region',x.region,'view',x.view,'caption',x.caption,
    'captured_at',x.captured_at,'created_at',x.created_at
  ) order by x.captured_at,x.created_at,x.id),'[]'::jsonb) into v_photos
  from public.clinical_treatment_photos x where x.treatment_id=t.id and x.voided_at is null;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]'::jsonb) into v_products
    from public.clinical_treatment_product_usages x where x.treatment_id=t.id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]'::jsonb) into v_equipment
    from public.clinical_treatment_equipment_usages x where x.treatment_id=t.id;

  select coalesce(jsonb_agg(
    to_jsonb(i) || jsonb_build_object('updates',coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at,u.id)
      from public.clinical_intercurrence_updates u where u.intercurrence_id=i.id
    ),'[]'::jsonb))
    order by i.occurred_at,i.created_at,i.id
  ),'[]'::jsonb) into v_intercurrences
  from public.clinical_intercurrences i where i.treatment_id=t.id;

  snap:=jsonb_build_object(
    'treatment',to_jsonb(t),
    'procedure_version',to_jsonb(pv),
    'components',comp,
    'professional',jsonb_build_object('name',s.display_name,'profissao',s.profissao,'conselho',s.conselho,'registro',s.registro_conselho),
    'consent_document_id',t.consent_document_id,
    'anamnese_id',t.anamnese_id,
    'photos',v_photos,
    'product_usages',v_products,
    'equipment_usages',v_equipment,
    'intercurrences',v_intercurrences,
    'report',to_jsonb(v_report),
    'captured_at',now()
  );

  insert into public.clinical_treatment_versions(treatment_id,version,prior_version_id,correction_mode,snapshot,created_by)
  values(t.id,v_number,t.current_version_id,correction,snap,v_user) returning id into v_version;
  v_code:='BC-ATD-'||to_char((now() at time zone 'America/Sao_Paulo')::date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.clinical_documents(
    cliente_id,document_type,source_id,source_version,document_version,document_code,status,
    profissional_user_id,profissional_nome,profissional_profissao,profissional_conselho,profissional_registro
  ) values(
    t.cliente_id,'treatment_record',v_version,v_number,v_number,v_code,'aguardando_assinaturas',
    v_user,s.display_name,s.profissao,s.conselho,s.registro_conselho
  ) returning id into v_doc;
  update public.clinical_treatment_versions set document_id=v_doc where id=v_version;
  update public.clinical_treatments set pending_version_id=v_version,pending_document_id=v_doc,updated_at=now() where id=t.id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_treatment_finalization_prepared','clinical_treatment_versions',v_version,
    jsonb_build_object('treatment_id',t.id,'document_id',v_doc,'version',v_number,'phase6d_frozen',true,'report_id',v_report.id));
  return jsonb_build_object('treatment_version_id',v_version,'document_id',v_doc,'version',v_number);
end;
$$;
