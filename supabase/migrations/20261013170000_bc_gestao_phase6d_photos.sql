-- BC Gestão Fase 6D — fotos clínicas privadas por atendimento.

create table if not exists public.clinical_treatment_photos (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  kind text not null check (kind in ('antes','depois','adicional')),
  region text,
  view text,
  caption text,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  captured_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  void_reason text,
  check ((voided_at is null and voided_by is null and void_reason is null)
      or (voided_at is not null and voided_by is not null and nullif(trim(void_reason),'') is not null))
);

create index if not exists clinical_treatment_photos_treatment_idx
  on public.clinical_treatment_photos(treatment_id, created_at desc);
create index if not exists clinical_treatment_photos_cliente_idx
  on public.clinical_treatment_photos(cliente_id, created_at desc);

alter table public.clinical_treatment_photos enable row level security;
revoke all on public.clinical_treatment_photos from anon, authenticated;

-- Leitura e escrita clínica passam por RPC. A imagem em si usa URL assinada do bucket privado.
drop policy if exists bc_phase6d_photo_insert on storage.objects;
create policy bc_phase6d_photo_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bc-prontuario-private'
    and private.is_bc_active_staff()
    and (storage.foldername(name))[1] = 'fotos-clinicas'
    and storage.extension(name) in ('jpg','jpeg','png','webp')
    and exists (
      select 1
      from public.clinical_treatments t
      where t.id::text = (storage.foldername(name))[3]
        and t.cliente_id::text = (storage.foldername(name))[2]
        and t.profissional_user_id = auth.uid()
        and t.status in ('rascunho','pronto_para_iniciar','em_atendimento')
    )
  );

create or replace function private.bc_treatment_photo_list_impl(p_treatment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado às fotos clínicas.' using errcode='42501';
  end if;
  if not exists(select 1 from public.clinical_treatments t where t.id=p_treatment_id) then
    raise exception 'Atendimento não encontrado.' using errcode='P0002';
  end if;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.captured_at,p.created_at),'[]'::jsonb)
    into v_result
    from public.clinical_treatment_photos p
   where p.treatment_id=p_treatment_id;
  return v_result;
end;$$;

create or replace function private.bc_treatment_photo_register_impl(
  p_treatment_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_kind text,
  p_region text,
  p_view text,
  p_caption text,
  p_captured_at timestamptz
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_treatment public.clinical_treatments%rowtype;
  v_id uuid;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado às fotos clínicas.' using errcode='42501';
  end if;
  select * into v_treatment from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then
    raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501';
  end if;
  if p_kind not in ('antes','depois','adicional') then raise exception 'Classificação de foto inválida.' using errcode='22023'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception 'Formato de imagem inválido.' using errcode='22023'; end if;
  if p_size_bytes is null or p_size_bytes<=0 or p_size_bytes>8388608 then raise exception 'A foto deve ter no máximo 8 MB.' using errcode='22023'; end if;
  if p_storage_path is null
     or p_storage_path not like ('fotos-clinicas/'||v_treatment.cliente_id::text||'/'||p_treatment_id::text||'/%')
     or lower(coalesce(storage.extension(p_storage_path),'')) not in ('jpg','jpeg','png','webp') then
    raise exception 'Caminho da foto clínica inválido.' using errcode='22023';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='bc-prontuario-private' and o.name=p_storage_path) then
    raise exception 'Arquivo da foto clínica não encontrado.' using errcode='P0002';
  end if;
  insert into public.clinical_treatment_photos(
    treatment_id,cliente_id,kind,region,view,caption,storage_path,mime_type,size_bytes,captured_at,created_by
  ) values(
    p_treatment_id,v_treatment.cliente_id,p_kind,nullif(trim(p_region),''),nullif(trim(p_view),''),nullif(trim(p_caption),''),
    p_storage_path,p_mime_type,p_size_bytes,coalesce(p_captured_at,now()),v_user
  ) returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_treatment_photo_registered','clinical_treatment_photos',v_id,
    jsonb_build_object('treatment_id',p_treatment_id,'cliente_id',v_treatment.cliente_id,'kind',p_kind));
  return v_id;
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
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') then
    raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501';
  end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Motivo da anulação é obrigatório.' using errcode='22023'; end if;
  if v_photo.voided_at is null then
    update public.clinical_treatment_photos
       set voided_at=now(),voided_by=v_user,void_reason=trim(p_reason)
     where id=p_photo_id;
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
    values(v_user,'clinical_treatment_photo_voided','clinical_treatment_photos',p_photo_id,
      jsonb_build_object('treatment_id',v_photo.treatment_id));
  end if;
  return p_photo_id;
end;$$;

create or replace function public.bc_treatment_photo_list(p_treatment_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$select private.bc_treatment_photo_list_impl(p_treatment_id);$$;

create or replace function public.bc_treatment_photo_register(
  p_treatment_id uuid,p_storage_path text,p_mime_type text,p_size_bytes bigint,p_kind text,
  p_region text,p_view text,p_caption text,p_captured_at timestamptz
)
returns uuid language sql security invoker set search_path=''
as $$select private.bc_treatment_photo_register_impl(p_treatment_id,p_storage_path,p_mime_type,p_size_bytes,p_kind,p_region,p_view,p_caption,p_captured_at);$$;

create or replace function public.bc_treatment_photo_void(p_photo_id uuid,p_reason text)
returns uuid language sql security invoker set search_path=''
as $$select private.bc_treatment_photo_void_impl(p_photo_id,p_reason);$$;

revoke all on function public.bc_treatment_photo_list(uuid) from public;
revoke execute on function public.bc_treatment_photo_list(uuid) from anon;
grant execute on function public.bc_treatment_photo_list(uuid) to authenticated;
revoke all on function public.bc_treatment_photo_register(uuid,text,text,bigint,text,text,text,text,timestamptz) from public;
revoke execute on function public.bc_treatment_photo_register(uuid,text,text,bigint,text,text,text,text,timestamptz) from anon;
grant execute on function public.bc_treatment_photo_register(uuid,text,text,bigint,text,text,text,text,timestamptz) to authenticated;
revoke all on function public.bc_treatment_photo_void(uuid,text) from public;
revoke execute on function public.bc_treatment_photo_void(uuid,text) from anon;
grant execute on function public.bc_treatment_photo_void(uuid,text) to authenticated;

revoke all on function private.bc_treatment_photo_list_impl(uuid) from public;
revoke all on function private.bc_treatment_photo_register_impl(uuid,text,text,bigint,text,text,text,text,timestamptz) from public;
revoke all on function private.bc_treatment_photo_void_impl(uuid,text) from public;
