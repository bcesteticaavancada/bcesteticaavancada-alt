-- BC Gestão Fase 6D — gates de FINALIZAÇÃO, freeze do snapshot e leitura integrada.
-- Importante: bc_treatment_gate() da 6C continua sendo exclusivamente pré-início.

create or replace function private.bc_treatment_finalization_gate(p_treatment_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  t public.clinical_treatments%rowtype;
  pv public.procedure_versions%rowtype;
  reasons text[]:='{}'::text[];
  v_open_ids uuid[]:='{}'::uuid[];
  v_confirmed_ids uuid[];
begin
  select * into t from public.clinical_treatments where id=p_treatment_id;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  select * into pv from public.procedure_versions where id=t.procedure_version_id;
  if not found then raise exception 'Versão do procedimento não encontrada.' using errcode='P0002'; end if;

  if pv.requires_photo and (
    not exists(select 1 from public.clinical_treatment_photos p where p.treatment_id=t.id and p.kind='antes' and p.voided_at is null)
    or not exists(select 1 from public.clinical_treatment_photos p where p.treatment_id=t.id and p.kind='depois' and p.voided_at is null)
  ) then
    reasons:=array_append(reasons,'fotos_pendentes');
  end if;

  if pv.requires_product_lot and not exists(
    select 1 from public.clinical_treatment_product_usages u
    where u.treatment_id=t.id
      and u.lot_id is not null
      and u.lot_code_snapshot is not null
      and u.expires_on_snapshot is not null
      and u.quantity>0
      and nullif(trim(u.unit),'') is not null
  ) then
    reasons:=array_append(reasons,'produto_lote_pendente');
  end if;

  if pv.requires_equipment and not exists(
    select 1 from public.clinical_treatment_equipment_usages e where e.treatment_id=t.id
  ) then
    reasons:=array_append(reasons,'equipamento_pendente');
  end if;

  select coalesce(array_agg(i.id order by i.id),'{}'::uuid[])
    into v_open_ids
    from public.clinical_intercurrences i
   where i.treatment_id=t.id and i.status in ('aberta','acompanhamento');

  if cardinality(v_open_ids)>0 then
    select c.open_intercurrence_ids into v_confirmed_ids
      from public.clinical_treatment_intercurrence_confirmations c
     where c.treatment_id=t.id
     order by c.confirmed_at desc,c.id desc
     limit 1;
    if v_confirmed_ids is null or not (v_confirmed_ids=v_open_ids) then
      reasons:=array_append(reasons,'intercorrencia_aberta_nao_confirmada');
    end if;
  end if;

  return reasons;
end;
$$;
revoke all on function private.bc_treatment_finalization_gate(uuid) from public;

-- Depois de criado o documento pendente, o snapshot já foi congelado: metadados 6D
-- de foto/produto/equipamento não podem mudar até conclusão ou reabertura controlada.
create or replace function private.bc_phase6d_frozen_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_treatment_id uuid;
  v_pending uuid;
  v_status text;
begin
  v_treatment_id:=case when tg_op='DELETE' then old.treatment_id else new.treatment_id end;
  select t.pending_document_id,t.status into v_pending,v_status
    from public.clinical_treatments t where t.id=v_treatment_id;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_pending is not null or v_status='finalizado' then
    raise exception 'Dados clínicos 6D já estão congelados nesta versão do atendimento.' using errcode='55000';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.bc_phase6d_frozen_mutation_guard() from public;

drop trigger if exists phase6d_photo_frozen_guard on public.clinical_treatment_photos;
create trigger phase6d_photo_frozen_guard
before insert or update or delete on public.clinical_treatment_photos
for each row execute function private.bc_phase6d_frozen_mutation_guard();

drop trigger if exists phase6d_product_usage_frozen_guard on public.clinical_treatment_product_usages;
create trigger phase6d_product_usage_frozen_guard
before insert or update or delete on public.clinical_treatment_product_usages
for each row execute function private.bc_phase6d_frozen_mutation_guard();

drop trigger if exists phase6d_equipment_usage_frozen_guard on public.clinical_treatment_equipment_usages;
create trigger phase6d_equipment_usage_frozen_guard
before insert or update or delete on public.clinical_treatment_equipment_usages
for each row execute function private.bc_phase6d_frozen_mutation_guard();

-- Leitura integrada: mantém gate_reasons 6C e adiciona gate de finalização separado.
create or replace function private.bc_treatment_get_impl(p_treatment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare r jsonb;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select to_jsonb(t) || jsonb_build_object(
    'procedure_version',to_jsonb(pv),
    'access_mode',p.access_mode,
    'components',coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from public.clinical_treatment_components c where c.treatment_id=t.id
    ),'[]'::jsonb),
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
$$;
revoke all on function private.bc_treatment_get_impl(uuid) from public;
revoke execute on function private.bc_treatment_get_impl(uuid) from anon;
grant execute on function private.bc_treatment_get_impl(uuid) to authenticated;

-- Finalização 6D: preserva semântica 6C e congela os quatro subsistemas no snapshot.
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
  v_phase6d_reasons text[];
  v_photos jsonb;
  v_products jsonb;
  v_equipment jsonb;
  v_intercurrences jsonb;
begin
  select * into t from public.clinical_treatments where id=p_treatment_id for update;
  if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if;
  if t.status<>'em_atendimento' or t.pending_version_id is not null then raise exception 'Atendimento não está disponível para preparar finalização.' using errcode='55000'; end if;
  if nullif(trim(t.objetivo),'') is null or nullif(trim(t.regiao),'') is null or not private.bc_treatment_specific_complete(t.id) then raise exception 'Ficha técnica obrigatória incompleta.' using errcode='22023'; end if;

  v_phase6d_reasons:=private.bc_treatment_finalization_gate(t.id);
  if cardinality(v_phase6d_reasons)>0 then
    raise exception 'Finalização possui pendências 6D: %',array_to_string(v_phase6d_reasons,', ') using errcode='55000';
  end if;

  select * into pv from public.procedure_versions where id=t.procedure_version_id;
  if t.price_mode_snapshot='fixed' then
    update public.clinical_treatments set final_price=base_price_snapshot where id=t.id;
    t.final_price:=t.base_price_snapshot;
  elsif t.price_mode_snapshot='starting_at' and (t.final_price is null or t.final_price<=0) then
    raise exception 'Preço final positivo é obrigatório para procedimento a partir de.' using errcode='22023';
  end if;

  select * into s from public.staff_profiles where user_id=v_user and active and atende_clientes;
  if not found or nullif(trim(s.profissao),'') is null or nullif(trim(s.conselho),'') is null or nullif(trim(s.registro_conselho),'') is null then
    raise exception 'Identidade profissional incompleta.' using errcode='22023';
  end if;

  select coalesce(max(version),0)+1 into v_number from public.clinical_treatment_versions where treatment_id=t.id;
  correction:=case when t.current_version_id is null then 'initial' else coalesce(t.correction_mode,'same_day') end;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) into comp
    from public.clinical_treatment_components c where c.treatment_id=t.id;

  -- Foto clínica no snapshot: SOMENTE metadados. Caminho/URL privada não entra no documento congelado.
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
    jsonb_build_object('treatment_id',t.id,'document_id',v_doc,'version',v_number,'phase6d_frozen',true));
  return jsonb_build_object('treatment_version_id',v_version,'document_id',v_doc,'version',v_number);
end;
$$;
revoke all on function private.bc_treatment_finalize_impl(uuid) from public;
revoke execute on function private.bc_treatment_finalize_impl(uuid) from anon;
grant execute on function private.bc_treatment_finalize_impl(uuid) to authenticated;
