-- BC Gestão Fase 6D — equipamentos e parâmetros específicos por aparelho.

create table if not exists public.clinical_equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null check (nullif(trim(name),'') is not null),
  manufacturer text,
  model text,
  internal_code text,
  serial_number text,
  parameter_schema jsonb not null default '{"fields":[]}'::jsonb,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinical_equipment_active_name_idx on public.clinical_equipment(active,name);

create table if not exists public.clinical_treatment_equipment_usages (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  equipment_id uuid not null references public.clinical_equipment(id) on delete restrict,
  equipment_name_snapshot text not null,
  manufacturer_snapshot text,
  model_snapshot text,
  internal_code_snapshot text,
  parameter_schema_snapshot jsonb not null,
  parameter_values jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists clinical_treatment_equipment_usages_treatment_idx on public.clinical_treatment_equipment_usages(treatment_id,created_at);

alter table public.clinical_equipment enable row level security;
alter table public.clinical_treatment_equipment_usages enable row level security;
revoke all on public.clinical_equipment from anon,authenticated;
revoke all on public.clinical_treatment_equipment_usages from anon,authenticated;

create or replace function private.bc_validate_equipment_parameters(p_schema jsonb,p_values jsonb)
returns boolean language plpgsql immutable set search_path=''
as $$declare f jsonb; k text; t text; v jsonb; n numeric;
begin
  if jsonb_typeof(coalesce(p_schema,'{}'::jsonb))<>'object' then raise exception 'Schema de parâmetros inválido.' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_schema->'fields','[]'::jsonb))<>'array' then raise exception 'Campos do schema devem ser uma lista.' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_values,'{}'::jsonb))<>'object' then raise exception 'Valores de parâmetros devem ser um objeto.' using errcode='22023'; end if;
  for k in select jsonb_object_keys(coalesce(p_values,'{}'::jsonb)) loop
    if not exists(select 1 from jsonb_array_elements(coalesce(p_schema->'fields','[]'::jsonb)) x where x->>'key'=k) then
      raise exception 'Parâmetro não previsto no equipamento: %',k using errcode='22023';
    end if;
  end loop;
  for f in select value from jsonb_array_elements(coalesce(p_schema->'fields','[]'::jsonb)) loop
    k:=nullif(trim(f->>'key'),''); t:=f->>'type';
    if k is null then raise exception 'Campo do equipamento sem key.' using errcode='22023'; end if;
    if t not in ('number','text','select','boolean') then raise exception 'Tipo de parâmetro não suportado: %',t using errcode='22023'; end if;
    v:=p_values->k;
    if coalesce((f->>'required')::boolean,false) and (v is null or v='null'::jsonb or (t in ('text','select') and nullif(trim(p_values->>k),'') is null)) then
      raise exception 'Parâmetro obrigatório ausente: %',k using errcode='22023';
    end if;
    if v is null or v='null'::jsonb then continue; end if;
    if t='number' then
      if jsonb_typeof(v)<>'number' then raise exception 'Parâmetro % deve ser numérico.',k using errcode='22023'; end if;
      n:=(p_values->>k)::numeric;
      if f ? 'min' and n<(f->>'min')::numeric then raise exception 'Parâmetro % abaixo do mínimo.',k using errcode='22023'; end if;
      if f ? 'max' and n>(f->>'max')::numeric then raise exception 'Parâmetro % acima do máximo.',k using errcode='22023'; end if;
    elsif t='boolean' then
      if jsonb_typeof(v)<>'boolean' then raise exception 'Parâmetro % deve ser booleano.',k using errcode='22023'; end if;
    elsif t in ('text','select') then
      if jsonb_typeof(v)<>'string' then raise exception 'Parâmetro % deve ser texto.',k using errcode='22023'; end if;
      if t='select' then
        if jsonb_typeof(coalesce(f->'options','[]'::jsonb))<>'array' or not (coalesce(f->'options','[]'::jsonb) @> jsonb_build_array(p_values->>k)) then
          raise exception 'Opção inválida para parâmetro %.',k using errcode='22023';
        end if;
      end if;
    end if;
  end loop;
  return true;
end;$$;
revoke all on function private.bc_validate_equipment_parameters(jsonb,jsonb) from public;

create or replace function private.bc_clinical_equipment_list_impl(p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos equipamentos.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.active desc,e.name),'[]'::jsonb) into v_result from public.clinical_equipment e where coalesce(p_include_inactive,false) or e.active;
  return v_result;
end;$$;

create or replace function private.bc_clinical_equipment_upsert_impl(p_equipment_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_id uuid; v_name text; v_schema jsonb; v_active boolean;
begin
  if v_user is null or not private.bc_can_manage_procedures() then raise exception 'Sem permissão para gerenciar equipamentos.' using errcode='42501'; end if;
  v_name:=nullif(trim(p_payload->>'name'),''); if v_name is null then raise exception 'Nome do equipamento é obrigatório.' using errcode='22023'; end if;
  v_schema:=coalesce(p_payload->'parameter_schema','{"fields":[]}'::jsonb);
  perform private.bc_validate_equipment_parameters(v_schema,'{}'::jsonb);
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
end;$$;

create or replace function private.bc_treatment_equipment_usage_list_impl(p_treatment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos equipamentos do atendimento.' using errcode='42501'; end if;
  if not exists(select 1 from public.clinical_treatments t where t.id=p_treatment_id) then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at),'[]'::jsonb) into v_result from public.clinical_treatment_equipment_usages u where u.treatment_id=p_treatment_id;
  return v_result;
end;$$;

create or replace function private.bc_treatment_equipment_usage_add_impl(p_treatment_id uuid,p_equipment_id uuid,p_parameter_values jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_treatment public.clinical_treatments%rowtype; v_equipment public.clinical_equipment%rowtype; v_id uuid;
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
  values(v_user,'clinical_treatment_equipment_usage_removed','clinical_treatment_equipment_usages',p_usage_id,jsonb_build_object('treatment_id',v_usage.treatment_id,'equipment_id',v_usage.equipment_id));
  return p_usage_id;
end;$$;

create or replace function public.bc_clinical_equipment_list(p_include_inactive boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$select private.bc_clinical_equipment_list_impl(p_include_inactive);$$;
create or replace function public.bc_clinical_equipment_upsert(p_equipment_id uuid,p_payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.bc_clinical_equipment_upsert_impl(p_equipment_id,p_payload);$$;
create or replace function public.bc_treatment_equipment_usage_list(p_treatment_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select private.bc_treatment_equipment_usage_list_impl(p_treatment_id);$$;
create or replace function public.bc_treatment_equipment_usage_add(p_treatment_id uuid,p_equipment_id uuid,p_parameter_values jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_equipment_usage_add_impl(p_treatment_id,p_equipment_id,p_parameter_values);$$;
create or replace function public.bc_treatment_equipment_usage_remove(p_usage_id uuid)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_equipment_usage_remove_impl(p_usage_id);$$;

revoke all on function public.bc_clinical_equipment_list(boolean) from public; revoke execute on function public.bc_clinical_equipment_list(boolean) from anon; grant execute on function public.bc_clinical_equipment_list(boolean) to authenticated;
revoke all on function public.bc_clinical_equipment_upsert(uuid,jsonb) from public; revoke execute on function public.bc_clinical_equipment_upsert(uuid,jsonb) from anon; grant execute on function public.bc_clinical_equipment_upsert(uuid,jsonb) to authenticated;
revoke all on function public.bc_treatment_equipment_usage_list(uuid) from public; revoke execute on function public.bc_treatment_equipment_usage_list(uuid) from anon; grant execute on function public.bc_treatment_equipment_usage_list(uuid) to authenticated;
revoke all on function public.bc_treatment_equipment_usage_add(uuid,uuid,jsonb) from public; revoke execute on function public.bc_treatment_equipment_usage_add(uuid,uuid,jsonb) from anon; grant execute on function public.bc_treatment_equipment_usage_add(uuid,uuid,jsonb) to authenticated;
revoke all on function public.bc_treatment_equipment_usage_remove(uuid) from public; revoke execute on function public.bc_treatment_equipment_usage_remove(uuid) from anon; grant execute on function public.bc_treatment_equipment_usage_remove(uuid) to authenticated;

revoke all on function private.bc_clinical_equipment_list_impl(boolean) from public;
revoke all on function private.bc_clinical_equipment_upsert_impl(uuid,jsonb) from public;
revoke all on function private.bc_treatment_equipment_usage_list_impl(uuid) from public;
revoke all on function private.bc_treatment_equipment_usage_add_impl(uuid,uuid,jsonb) from public;
revoke all on function private.bc_treatment_equipment_usage_remove_impl(uuid) from public;
