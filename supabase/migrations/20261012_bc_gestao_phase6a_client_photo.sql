-- BC Gestão Fase 6A — foto de identificação privada da cliente.
-- Objetos são imutáveis no fluxo da aplicação: sem UPDATE/DELETE para authenticated.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'bc-prontuario-private',
  'bc-prontuario-private',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
   set name = excluded.name,
       public = false,
       file_size_limit = 8388608,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

create table if not exists public.cliente_identificacao_fotos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 8388608),
  atual boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  substituida_at timestamptz
);

alter table public.cliente_identificacao_fotos enable row level security;

create unique index if not exists cliente_identificacao_fotos_uma_atual_idx
  on public.cliente_identificacao_fotos (cliente_id)
  where atual = true;

create index if not exists cliente_identificacao_fotos_cliente_created_idx
  on public.cliente_identificacao_fotos (cliente_id, created_at desc);

revoke all on table public.cliente_identificacao_fotos from anon;
revoke all on table public.cliente_identificacao_fotos from authenticated;
grant select on table public.cliente_identificacao_fotos to authenticated;

drop policy if exists "cliente_identificacao_fotos_equipe_select" on public.cliente_identificacao_fotos;
create policy "cliente_identificacao_fotos_equipe_select"
  on public.cliente_identificacao_fotos
  for select
  to authenticated
  using (private.is_bc_active_staff());

-- Storage: leitura e INSERT somente para equipe BC ativa no bucket privado.
-- Não existe policy UPDATE/DELETE para authenticated neste bucket.
drop policy if exists "bc_prontuario_private_select" on storage.objects;
create policy "bc_prontuario_private_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bc-prontuario-private'
    and private.is_bc_active_staff()
  );

drop policy if exists "bc_prontuario_private_insert" on storage.objects;
create policy "bc_prontuario_private_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bc-prontuario-private'
    and private.is_bc_active_staff()
    and (storage.foldername(name))[1] = 'identificacao'
    and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp')
    and exists (
      select 1
        from public.clientes c
       where c.id::text = (storage.foldername(name))[2]
         and c.ativo = true
    )
  );

create or replace function private.bc_cliente_register_id_photo_impl(
  p_cliente_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_tamanho_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente_ativo boolean;
  v_foto_id uuid;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à foto de identificação.' using errcode = '42501';
  end if;

  select c.ativo into v_cliente_ativo
    from public.clientes c
   where c.id = p_cliente_id;

  if not found then
    raise exception 'Cliente não encontrada.' using errcode = 'P0002';
  end if;

  if not v_cliente_ativo then
    raise exception 'Cliente arquivada não pode receber nova foto.' using errcode = '42501';
  end if;

  if p_storage_path is null
     or p_storage_path not like ('identificacao/' || p_cliente_id::text || '/%')
     or lower(coalesce(storage.extension(p_storage_path), '')) not in ('jpg', 'jpeg', 'png', 'webp') then
    raise exception 'Caminho da foto inválido.' using errcode = '22023';
  end if;

  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Formato de imagem inválido.' using errcode = '22023';
  end if;

  if p_tamanho_bytes is null or p_tamanho_bytes <= 0 or p_tamanho_bytes > 8388608 then
    raise exception 'A foto deve ter no máximo 8 MB.' using errcode = '22023';
  end if;

  insert into public.cliente_identificacao_fotos (
    cliente_id,
    storage_path,
    mime_type,
    tamanho_bytes,
    atual,
    created_by
  ) values (
    p_cliente_id,
    p_storage_path,
    p_mime_type,
    p_tamanho_bytes,
    false,
    v_user_id
  )
  returning id into v_foto_id;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  ) values (
    v_user_id,
    'cliente_id_photo_registered',
    'cliente_identificacao_fotos',
    v_foto_id,
    jsonb_build_object('cliente_id', p_cliente_id)
  );

  return v_foto_id;
end;
$$;

create or replace function public.bc_cliente_register_id_photo(
  p_cliente_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_tamanho_bytes bigint
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_cliente_register_id_photo_impl(
    p_cliente_id,
    p_storage_path,
    p_mime_type,
    p_tamanho_bytes
  );
$$;

create or replace function private.bc_cliente_set_current_id_photo_impl(
  p_cliente_id uuid,
  p_foto_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente_ativo boolean;
  v_foto public.cliente_identificacao_fotos%rowtype;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à foto de identificação.' using errcode = '42501';
  end if;

  select c.ativo into v_cliente_ativo
    from public.clientes c
   where c.id = p_cliente_id;

  if not found then
    raise exception 'Cliente não encontrada.' using errcode = 'P0002';
  end if;

  if not v_cliente_ativo then
    raise exception 'Cliente arquivada não pode ter a foto atual alterada.' using errcode = '42501';
  end if;

  select * into v_foto
    from public.cliente_identificacao_fotos f
   where f.id = p_foto_id
     and f.cliente_id = p_cliente_id
   for update;

  if not found then
    raise exception 'Foto de identificação não encontrada para esta cliente.' using errcode = 'P0002';
  end if;

  update public.cliente_identificacao_fotos
     set atual = false,
         substituida_at = coalesce(substituida_at, now())
   where cliente_id = p_cliente_id
     and atual = true
     and id <> p_foto_id;

  update public.cliente_identificacao_fotos
     set atual = true,
         substituida_at = null
   where id = p_foto_id;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  ) values (
    v_user_id,
    'cliente_id_photo_current_changed',
    'cliente_identificacao_fotos',
    p_foto_id,
    jsonb_build_object('cliente_id', p_cliente_id)
  );

  return p_foto_id;
end;
$$;

create or replace function public.bc_cliente_set_current_id_photo(
  p_cliente_id uuid,
  p_foto_id uuid
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_cliente_set_current_id_photo_impl(p_cliente_id, p_foto_id);
$$;

revoke all on function public.bc_cliente_register_id_photo(uuid, text, text, bigint) from public;
revoke execute on function public.bc_cliente_register_id_photo(uuid, text, text, bigint) from anon;
grant execute on function public.bc_cliente_register_id_photo(uuid, text, text, bigint) to authenticated;

revoke all on function public.bc_cliente_set_current_id_photo(uuid, uuid) from public;
revoke execute on function public.bc_cliente_set_current_id_photo(uuid, uuid) from anon;
grant execute on function public.bc_cliente_set_current_id_photo(uuid, uuid) to authenticated;

revoke all on function private.bc_cliente_register_id_photo_impl(uuid, text, text, bigint) from public;
revoke execute on function private.bc_cliente_register_id_photo_impl(uuid, text, text, bigint) from anon;
grant execute on function private.bc_cliente_register_id_photo_impl(uuid, text, text, bigint) to authenticated;

revoke all on function private.bc_cliente_set_current_id_photo_impl(uuid, uuid) from public;
revoke execute on function private.bc_cliente_set_current_id_photo_impl(uuid, uuid) from anon;
grant execute on function private.bc_cliente_set_current_id_photo_impl(uuid, uuid) to authenticated;
