-- BC Gestão Fase 6C — Biblioteca Clínica versionada, capacidades e permissões.
-- Additive migration. Target project: bc-estetica-gestao only.

alter table public.staff_profiles
  add column if not exists pode_gerenciar_procedimentos boolean not null default false;

alter table public.procedimentos
  add column if not exists current_version_id uuid,
  add column if not exists archived_at timestamptz;

create table if not exists public.procedure_versions (
  id uuid primary key default gen_random_uuid(),
  procedimento_id uuid not null references public.procedimentos(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','superseded')),
  classe_documental text not null check (classe_documental in ('injetavel','nao_injetavel')),
  categoria text,
  descricao text,
  price_mode text not null check (price_mode in ('fixed','starting_at')),
  base_price numeric(12,2) not null check (base_price > 0),
  suggested_duration integer check (suggested_duration is null or suggested_duration > 0),
  requires_general_anamnesis boolean not null default true,
  requires_return boolean not null default false,
  return_interval_days integer check (return_interval_days is null or return_interval_days > 0),
  pre_guidance text,
  post_guidance text,
  consent_supplement text,
  specific_schema jsonb not null default '{}'::jsonb,
  technical_schema jsonb not null default '{}'::jsonb,
  protocol_mode text not null default 'simple' check (protocol_mode in ('simple','compound')),
  requires_photo boolean not null default false,
  requires_product_lot boolean not null default false,
  requires_equipment boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (procedimento_id, version)
);

create unique index if not exists procedure_versions_one_draft_idx
  on public.procedure_versions(procedimento_id)
  where status='draft';
create index if not exists procedure_versions_procedure_status_idx
  on public.procedure_versions(procedimento_id,status,version desc);

create table if not exists public.procedure_version_components (
  parent_version_id uuid not null references public.procedure_versions(id) on delete cascade,
  component_version_id uuid not null references public.procedure_versions(id) on delete restrict,
  required boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key(parent_version_id, component_version_id),
  check (parent_version_id <> component_version_id)
);

create table if not exists public.procedure_aliases (
  id uuid primary key default gen_random_uuid(),
  procedimento_id uuid not null references public.procedimentos(id) on delete restrict,
  alias text not null check (char_length(trim(alias)) > 0),
  historical boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists procedure_aliases_lower_unique_idx
  on public.procedure_aliases(lower(trim(alias)));

create table if not exists public.procedure_professional_permissions (
  procedimento_id uuid not null references public.procedimentos(id) on delete restrict,
  professional_user_id uuid not null references auth.users(id) on delete restrict,
  allowed boolean not null default true,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(procedimento_id, professional_user_id)
);
create index if not exists procedure_professional_permissions_user_idx
  on public.procedure_professional_permissions(professional_user_id,allowed);

alter table public.procedure_versions enable row level security;
alter table public.procedure_version_components enable row level security;
alter table public.procedure_aliases enable row level security;
alter table public.procedure_professional_permissions enable row level security;

revoke all on table public.procedure_versions from anon, authenticated;
revoke all on table public.procedure_version_components from anon, authenticated;
revoke all on table public.procedure_aliases from anon, authenticated;
revoke all on table public.procedure_professional_permissions from anon, authenticated;

grant select on table public.procedure_versions to authenticated;
grant select on table public.procedure_version_components to authenticated;
grant select on table public.procedure_aliases to authenticated;
grant select on table public.procedure_professional_permissions to authenticated;

drop policy if exists procedure_versions_staff_read on public.procedure_versions;
create policy procedure_versions_staff_read
on public.procedure_versions for select to authenticated
using (private.is_bc_active_staff());

drop policy if exists procedure_version_components_staff_read on public.procedure_version_components;
create policy procedure_version_components_staff_read
on public.procedure_version_components for select to authenticated
using (private.is_bc_active_staff());

drop policy if exists procedure_aliases_staff_read on public.procedure_aliases;
create policy procedure_aliases_staff_read
on public.procedure_aliases for select to authenticated
using (private.is_bc_active_staff());

drop policy if exists procedure_permissions_scoped_read on public.procedure_professional_permissions;
create policy procedure_permissions_scoped_read
on public.procedure_professional_permissions for select to authenticated
using (
  private.is_bc_admin()
  or (private.is_bc_active_staff() and professional_user_id = auth.uid())
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='procedimentos_current_version_fk'
      and conrelid='public.procedimentos'::regclass
  ) then
    alter table public.procedimentos
      add constraint procedimentos_current_version_fk
      foreign key(current_version_id) references public.procedure_versions(id) on delete restrict;
  end if;
end;
$$;

create or replace function private.bc_can_manage_procedures()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_profiles sp
     where sp.user_id = auth.uid()
       and sp.active = true
       and (sp.role='admin' or sp.pode_gerenciar_procedimentos=true)
  );
$$;
revoke all on function private.bc_can_manage_procedures() from public;
revoke execute on function private.bc_can_manage_procedures() from anon;
grant execute on function private.bc_can_manage_procedures() to authenticated;

create or replace function private.bc_procedure_version_immutable_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published and superseded procedure versions are immutable.' using errcode='55000';
    end if;
    return old;
  end if;

  if old.status='superseded' then
    raise exception 'Superseded procedure versions are immutable.' using errcode='55000';
  end if;

  if old.status='published' then
    if new.status='superseded'
       and row(
         new.id,new.procedimento_id,new.version,new.classe_documental,new.categoria,new.descricao,
         new.price_mode,new.base_price,new.suggested_duration,new.requires_general_anamnesis,
         new.requires_return,new.return_interval_days,new.pre_guidance,new.post_guidance,
         new.consent_supplement,new.specific_schema,new.technical_schema,new.protocol_mode,
         new.requires_photo,new.requires_product_lot,new.requires_equipment,new.created_by,
         new.published_by,new.published_at,new.created_at
       ) is not distinct from row(
         old.id,old.procedimento_id,old.version,old.classe_documental,old.categoria,old.descricao,
         old.price_mode,old.base_price,old.suggested_duration,old.requires_general_anamnesis,
         old.requires_return,old.return_interval_days,old.pre_guidance,old.post_guidance,
         old.consent_supplement,old.specific_schema,old.technical_schema,old.protocol_mode,
         old.requires_photo,old.requires_product_lot,old.requires_equipment,old.created_by,
         old.published_by,old.published_at,old.created_at
       ) then
      return new;
    end if;
    raise exception 'Published procedure versions are immutable.' using errcode='55000';
  end if;

  return new;
end;
$$;
revoke all on function private.bc_procedure_version_immutable_guard() from public;

drop trigger if exists procedure_versions_immutable_guard on public.procedure_versions;
create trigger procedure_versions_immutable_guard
before update or delete on public.procedure_versions
for each row execute function private.bc_procedure_version_immutable_guard();

create or replace function private.bc_procedure_list_impl(p_include_archived boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by item->>'nome'),'[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id',p.id,
        'nome',p.nome,
        'ativo',p.ativo,
        'duracao_padrao',p.duracao_padrao,
        'current_version_id',p.current_version_id,
        'archived_at',p.archived_at,
        'current_version',case when v.id is null then null else to_jsonb(v) end,
        'can_execute',coalesce(pp.allowed,false) and pp.revoked_at is null,
        'can_manage',private.bc_can_manage_procedures()
      ) as item
      from public.procedimentos p
      left join public.procedure_versions v on v.id=p.current_version_id
      left join public.procedure_professional_permissions pp
        on pp.procedimento_id=p.id and pp.professional_user_id=v_user
      where p_include_archived or p.archived_at is null
    ) q;

  return v_result;
end;
$$;
revoke all on function private.bc_procedure_list_impl(boolean) from public;
revoke execute on function private.bc_procedure_list_impl(boolean) from anon;
grant execute on function private.bc_procedure_list_impl(boolean) to authenticated;

create or replace function public.bc_procedure_list(p_include_archived boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.bc_procedure_list_impl(p_include_archived); $$;
revoke all on function public.bc_procedure_list(boolean) from public;
revoke all on function public.bc_procedure_list(boolean) from anon;
grant execute on function public.bc_procedure_list(boolean) to authenticated;

create or replace function private.bc_procedure_get_impl(p_procedure_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select jsonb_build_object(
    'id',p.id,
    'nome',p.nome,
    'ativo',p.ativo,
    'duracao_padrao',p.duracao_padrao,
    'current_version_id',p.current_version_id,
    'archived_at',p.archived_at,
    'current_version',case when current_v.id is null then null else to_jsonb(current_v) end,
    'draft_version',case when private.bc_can_manage_procedures() and draft_v.id is not null then to_jsonb(draft_v) else null end,
    'components',coalesce((
      select jsonb_agg(jsonb_build_object('component_version_id',c.component_version_id,'required',c.required,'sort_order',c.sort_order) order by c.sort_order,c.component_version_id)
      from public.procedure_version_components c
      where c.parent_version_id=coalesce(draft_v.id,current_v.id)
    ),'[]'::jsonb),
    'execution_permissions',case when private.is_bc_admin() then coalesce((
      select jsonb_agg(jsonb_build_object('professional_user_id',perm.professional_user_id,'allowed',perm.allowed,'granted_at',perm.granted_at,'revoked_at',perm.revoked_at))
      from public.procedure_professional_permissions perm
      where perm.procedimento_id=p.id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'can_execute',coalesce(my_perm.allowed,false) and my_perm.revoked_at is null,
    'can_manage',private.bc_can_manage_procedures()
  ) into v_result
  from public.procedimentos p
  left join public.procedure_versions current_v on current_v.id=p.current_version_id
  left join public.procedure_versions draft_v on draft_v.procedimento_id=p.id and draft_v.status='draft'
  left join public.procedure_professional_permissions my_perm
    on my_perm.procedimento_id=p.id and my_perm.professional_user_id=v_user
  where p.id=p_procedure_id;

  if v_result is null then
    raise exception 'Procedimento não encontrado.' using errcode='P0002';
  end if;
  return v_result;
end;
$$;
revoke all on function private.bc_procedure_get_impl(uuid) from public;
revoke execute on function private.bc_procedure_get_impl(uuid) from anon;
grant execute on function private.bc_procedure_get_impl(uuid) to authenticated;

create or replace function public.bc_procedure_get(p_procedure_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.bc_procedure_get_impl(p_procedure_id); $$;
revoke all on function public.bc_procedure_get(uuid) from public;
revoke all on function public.bc_procedure_get(uuid) from anon;
grant execute on function public.bc_procedure_get(uuid) to authenticated;

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
  if v_base_price is null or v_base_price <= 0 then raise exception 'Preço-base inválido.' using errcode='22023'; end if;

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
      procedimento_id,version,status,classe_documental,categoria,descricao,price_mode,base_price,
      suggested_duration,requires_general_anamnesis,requires_return,return_interval_days,
      pre_guidance,post_guidance,consent_supplement,specific_schema,technical_schema,protocol_mode,
      requires_photo,requires_product_lot,requires_equipment,created_by
    ) values (
      v_procedure_id,v_next_version,'draft',v_class,nullif(trim(p_payload->>'categoria'),''),nullif(trim(p_payload->>'descricao'),''),
      v_price_mode,v_base_price,v_duration,coalesce((p_payload->>'requires_general_anamnesis')::boolean,true),
      coalesce((p_payload->>'requires_return')::boolean,false),nullif(trim(p_payload->>'return_interval_days'),'')::integer,
      nullif(trim(p_payload->>'pre_guidance'),''),nullif(trim(p_payload->>'post_guidance'),''),nullif(trim(p_payload->>'consent_supplement'),''),
      coalesce(p_payload->'specific_schema','{}'::jsonb),coalesce(p_payload->'technical_schema','{}'::jsonb),v_protocol_mode,
      coalesce((p_payload->>'requires_photo')::boolean,false),coalesce((p_payload->>'requires_product_lot')::boolean,false),
      coalesce((p_payload->>'requires_equipment')::boolean,false),v_user
    ) returning id into v_version_id;
  else
    update public.procedure_versions set
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

  if v_protocol_mode='compound' and not exists(select 1 from public.procedure_version_components where parent_version_id=v_version_id) then
    raise exception 'Protocolo composto exige ao menos um componente.' using errcode='22023';
  end if;

  update public.procedimentos set nome=v_name,duracao_padrao=v_duration,updated_at=now()
   where id=v_procedure_id and current_version_id is null;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_draft_saved','procedure_versions',v_version_id,jsonb_build_object('procedimento_id',v_procedure_id));
  return v_procedure_id;
end;
$$;
revoke all on function private.bc_procedure_save_draft_impl(uuid,jsonb) from public;
revoke execute on function private.bc_procedure_save_draft_impl(uuid,jsonb) from anon;
grant execute on function private.bc_procedure_save_draft_impl(uuid,jsonb) to authenticated;

create or replace function public.bc_procedure_save_draft(p_procedure_id uuid, p_payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.bc_procedure_save_draft_impl(p_procedure_id,p_payload); $$;
revoke all on function public.bc_procedure_save_draft(uuid,jsonb) from public;
revoke all on function public.bc_procedure_save_draft(uuid,jsonb) from anon;
grant execute on function public.bc_procedure_save_draft(uuid,jsonb) to authenticated;

create or replace function private.bc_procedure_publish_impl(p_procedure_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_draft public.procedure_versions%rowtype;
  v_old_current uuid;
  v_name text;
begin
  if v_user is null or not private.bc_can_manage_procedures() then
    raise exception 'Sem permissão para publicar procedimentos.' using errcode='42501';
  end if;

  select p.current_version_id,p.nome into v_old_current,v_name
    from public.procedimentos p where p.id=p_procedure_id for update;
  if not found then raise exception 'Procedimento não encontrado.' using errcode='P0002'; end if;

  select * into v_draft from public.procedure_versions
    where procedimento_id=p_procedure_id and status='draft' for update;
  if not found then raise exception 'Nenhuma versão em rascunho.' using errcode='55000'; end if;

  if v_draft.protocol_mode='compound' and not exists(select 1 from public.procedure_version_components where parent_version_id=v_draft.id) then
    raise exception 'Protocolo composto exige componentes publicados.' using errcode='22023';
  end if;

  if v_old_current is not null then
    update public.procedure_versions set status='superseded',updated_at=now()
     where id=v_old_current and status='published';
  end if;

  update public.procedure_versions set status='published',published_by=v_user,published_at=now(),updated_at=now()
   where id=v_draft.id;

  update public.procedimentos
     set nome=v_name,
         ativo=true,
         duracao_padrao=v_draft.suggested_duration,
         current_version_id=v_draft.id,
         archived_at=null,
         updated_at=now()
   where id=p_procedure_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_published','procedimentos',p_procedure_id,jsonb_build_object('version_id',v_draft.id,'version',v_draft.version));
  return v_draft.id;
end;
$$;
revoke all on function private.bc_procedure_publish_impl(uuid) from public;
revoke execute on function private.bc_procedure_publish_impl(uuid) from anon;
grant execute on function private.bc_procedure_publish_impl(uuid) to authenticated;

create or replace function public.bc_procedure_publish(p_procedure_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.bc_procedure_publish_impl(p_procedure_id); $$;
revoke all on function public.bc_procedure_publish(uuid) from public;
revoke all on function public.bc_procedure_publish(uuid) from anon;
grant execute on function public.bc_procedure_publish(uuid) to authenticated;

create or replace function private.bc_procedure_archive_impl(p_procedure_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode arquivar procedimentos.' using errcode='42501';
  end if;
  update public.procedimentos set ativo=false,archived_at=now(),updated_at=now() where id=p_procedure_id;
  if not found then raise exception 'Procedimento não encontrado.' using errcode='P0002'; end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_archived','procedimentos',p_procedure_id,jsonb_build_object('ativo',false));
  return true;
end;
$$;
revoke all on function private.bc_procedure_archive_impl(uuid) from public;
revoke execute on function private.bc_procedure_archive_impl(uuid) from anon;
grant execute on function private.bc_procedure_archive_impl(uuid) to authenticated;

create or replace function public.bc_procedure_archive(p_procedure_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.bc_procedure_archive_impl(p_procedure_id); $$;
revoke all on function public.bc_procedure_archive(uuid) from public;
revoke all on function public.bc_procedure_archive(uuid) from anon;
grant execute on function public.bc_procedure_archive(uuid) to authenticated;

create or replace function private.bc_procedure_set_execution_permission_impl(p_procedure_id uuid,p_professional_user_id uuid,p_allowed boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode definir autorização clínica.' using errcode='42501';
  end if;
  if not exists(select 1 from public.procedimentos where id=p_procedure_id) then
    raise exception 'Procedimento não encontrado.' using errcode='P0002';
  end if;
  if not exists(select 1 from public.staff_profiles where user_id=p_professional_user_id and active=true and atende_clientes=true) then
    raise exception 'Profissional ativa não encontrada.' using errcode='P0002';
  end if;

  insert into public.procedure_professional_permissions(procedimento_id,professional_user_id,allowed,granted_by,granted_at,revoked_at)
  values(p_procedure_id,p_professional_user_id,p_allowed,v_user,now(),case when p_allowed then null else now() end)
  on conflict(procedimento_id,professional_user_id) do update
    set allowed=excluded.allowed,granted_by=excluded.granted_by,granted_at=excluded.granted_at,revoked_at=excluded.revoked_at;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_execution_permission_changed','procedimentos',p_procedure_id,
         jsonb_build_object('professional_user_id',p_professional_user_id,'allowed',p_allowed));
  return true;
end;
$$;
revoke all on function private.bc_procedure_set_execution_permission_impl(uuid,uuid,boolean) from public;
revoke execute on function private.bc_procedure_set_execution_permission_impl(uuid,uuid,boolean) from anon;
grant execute on function private.bc_procedure_set_execution_permission_impl(uuid,uuid,boolean) to authenticated;

create or replace function public.bc_procedure_set_execution_permission(p_procedure_id uuid,p_professional_user_id uuid,p_allowed boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.bc_procedure_set_execution_permission_impl(p_procedure_id,p_professional_user_id,p_allowed); $$;
revoke all on function public.bc_procedure_set_execution_permission(uuid,uuid,boolean) from public;
revoke all on function public.bc_procedure_set_execution_permission(uuid,uuid,boolean) from anon;
grant execute on function public.bc_procedure_set_execution_permission(uuid,uuid,boolean) to authenticated;

create or replace function private.bc_staff_set_procedure_manager_impl(p_user_id uuid,p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode definir gestores de procedimentos.' using errcode='42501';
  end if;
  update public.staff_profiles
     set pode_gerenciar_procedimentos=p_enabled,updated_at=now()
   where user_id=p_user_id and active=true;
  if not found then raise exception 'Perfil ativo não encontrado.' using errcode='P0002'; end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_manager_capability_changed','staff_profiles',p_user_id,jsonb_build_object('enabled',p_enabled));
  return true;
end;
$$;
revoke all on function private.bc_staff_set_procedure_manager_impl(uuid,boolean) from public;
revoke execute on function private.bc_staff_set_procedure_manager_impl(uuid,boolean) from anon;
grant execute on function private.bc_staff_set_procedure_manager_impl(uuid,boolean) to authenticated;

create or replace function public.bc_staff_set_procedure_manager(p_user_id uuid,p_enabled boolean)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.bc_staff_set_procedure_manager_impl(p_user_id,p_enabled); $$;
revoke all on function public.bc_staff_set_procedure_manager(uuid,boolean) from public;
revoke all on function public.bc_staff_set_procedure_manager(uuid,boolean) from anon;
grant execute on function public.bc_staff_set_procedure_manager(uuid,boolean) to authenticated;
