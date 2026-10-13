-- BC Gestão Fase 6D — biblioteca de produtos/lotes e rastreabilidade por sessão.

create table if not exists public.clinical_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (nullif(trim(name),'') is not null),
  manufacturer text,
  category text,
  default_unit text,
  tracks_lot boolean not null default true,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_products_active_name_idx on public.clinical_products(active,name);

create table if not exists public.clinical_product_lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.clinical_products(id) on delete restrict,
  lot_code text not null check (nullif(trim(lot_code),'') is not null),
  expires_on date not null,
  notes text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,lot_code)
);

create index if not exists clinical_product_lots_product_idx on public.clinical_product_lots(product_id,active,expires_on);

create table if not exists public.clinical_treatment_product_usages (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  product_id uuid not null references public.clinical_products(id) on delete restrict,
  lot_id uuid references public.clinical_product_lots(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null check (nullif(trim(unit),'') is not null),
  product_name_snapshot text not null,
  manufacturer_snapshot text,
  lot_code_snapshot text,
  expires_on_snapshot date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists clinical_treatment_product_usages_treatment_idx
  on public.clinical_treatment_product_usages(treatment_id,created_at);

alter table public.clinical_products enable row level security;
alter table public.clinical_product_lots enable row level security;
alter table public.clinical_treatment_product_usages enable row level security;
revoke all on public.clinical_products from anon,authenticated;
revoke all on public.clinical_product_lots from anon,authenticated;
revoke all on public.clinical_treatment_product_usages from anon,authenticated;

create or replace function private.bc_clinical_product_list_impl(p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado à biblioteca de produtos.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.active desc,p.name),'[]'::jsonb) into v_result
    from public.clinical_products p where coalesce(p_include_inactive,false) or p.active;
  return v_result;
end;$$;

create or replace function private.bc_clinical_product_upsert_impl(p_product_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_id uuid; v_name text; v_active boolean;
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
end;$$;

create or replace function private.bc_clinical_product_lot_list_impl(p_product_id uuid,p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos lotes.' using errcode='42501'; end if;
  if not exists(select 1 from public.clinical_products p where p.id=p_product_id) then raise exception 'Produto não encontrado.' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.active desc,l.expires_on,l.lot_code),'[]'::jsonb) into v_result
    from public.clinical_product_lots l where l.product_id=p_product_id and (coalesce(p_include_inactive,false) or l.active);
  return v_result;
end;$$;

create or replace function private.bc_clinical_product_lot_upsert_impl(p_product_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_id uuid; v_requested_id uuid; v_code text; v_expires date; v_active boolean;
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
end;$$;

create or replace function private.bc_treatment_product_usage_list_impl(p_treatment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado aos produtos do atendimento.' using errcode='42501'; end if;
  if not exists(select 1 from public.clinical_treatments t where t.id=p_treatment_id) then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at),'[]'::jsonb) into v_result from public.clinical_treatment_product_usages u where u.treatment_id=p_treatment_id;
  return v_result;
end;$$;

create or replace function private.bc_treatment_product_usage_add_impl(p_treatment_id uuid,p_product_id uuid,p_lot_id uuid,p_quantity numeric,p_unit text)
returns uuid language plpgsql security definer set search_path=''
as $$declare
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
end;$$;

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
  values(v_user,'clinical_treatment_product_usage_removed','clinical_treatment_product_usages',p_usage_id,jsonb_build_object('treatment_id',v_usage.treatment_id,'product_id',v_usage.product_id,'lot_id',v_usage.lot_id));
  return p_usage_id;
end;$$;

create or replace function public.bc_clinical_product_list(p_include_inactive boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$select private.bc_clinical_product_list_impl(p_include_inactive);$$;
create or replace function public.bc_clinical_product_upsert(p_product_id uuid,p_payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.bc_clinical_product_upsert_impl(p_product_id,p_payload);$$;
create or replace function public.bc_clinical_product_lot_list(p_product_id uuid,p_include_inactive boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$select private.bc_clinical_product_lot_list_impl(p_product_id,p_include_inactive);$$;
create or replace function public.bc_clinical_product_lot_upsert(p_product_id uuid,p_payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.bc_clinical_product_lot_upsert_impl(p_product_id,p_payload);$$;
create or replace function public.bc_treatment_product_usage_list(p_treatment_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select private.bc_treatment_product_usage_list_impl(p_treatment_id);$$;
create or replace function public.bc_treatment_product_usage_add(p_treatment_id uuid,p_product_id uuid,p_lot_id uuid,p_quantity numeric,p_unit text)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_product_usage_add_impl(p_treatment_id,p_product_id,p_lot_id,p_quantity,p_unit);$$;
create or replace function public.bc_treatment_product_usage_remove(p_usage_id uuid)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_product_usage_remove_impl(p_usage_id);$$;

revoke all on function public.bc_clinical_product_list(boolean) from public; revoke execute on function public.bc_clinical_product_list(boolean) from anon; grant execute on function public.bc_clinical_product_list(boolean) to authenticated;
revoke all on function public.bc_clinical_product_upsert(uuid,jsonb) from public; revoke execute on function public.bc_clinical_product_upsert(uuid,jsonb) from anon; grant execute on function public.bc_clinical_product_upsert(uuid,jsonb) to authenticated;
revoke all on function public.bc_clinical_product_lot_list(uuid,boolean) from public; revoke execute on function public.bc_clinical_product_lot_list(uuid,boolean) from anon; grant execute on function public.bc_clinical_product_lot_list(uuid,boolean) to authenticated;
revoke all on function public.bc_clinical_product_lot_upsert(uuid,jsonb) from public; revoke execute on function public.bc_clinical_product_lot_upsert(uuid,jsonb) from anon; grant execute on function public.bc_clinical_product_lot_upsert(uuid,jsonb) to authenticated;
revoke all on function public.bc_treatment_product_usage_list(uuid) from public; revoke execute on function public.bc_treatment_product_usage_list(uuid) from anon; grant execute on function public.bc_treatment_product_usage_list(uuid) to authenticated;
revoke all on function public.bc_treatment_product_usage_add(uuid,uuid,uuid,numeric,text) from public; revoke execute on function public.bc_treatment_product_usage_add(uuid,uuid,uuid,numeric,text) from anon; grant execute on function public.bc_treatment_product_usage_add(uuid,uuid,uuid,numeric,text) to authenticated;
revoke all on function public.bc_treatment_product_usage_remove(uuid) from public; revoke execute on function public.bc_treatment_product_usage_remove(uuid) from anon; grant execute on function public.bc_treatment_product_usage_remove(uuid) to authenticated;

revoke all on function private.bc_clinical_product_list_impl(boolean) from public;
revoke all on function private.bc_clinical_product_upsert_impl(uuid,jsonb) from public;
revoke all on function private.bc_clinical_product_lot_list_impl(uuid,boolean) from public;
revoke all on function private.bc_clinical_product_lot_upsert_impl(uuid,jsonb) from public;
revoke all on function private.bc_treatment_product_usage_list_impl(uuid) from public;
revoke all on function private.bc_treatment_product_usage_add_impl(uuid,uuid,uuid,numeric,text) from public;
revoke all on function private.bc_treatment_product_usage_remove_impl(uuid) from public;
