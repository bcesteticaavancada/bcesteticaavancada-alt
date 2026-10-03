begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'admin' check (role in ('admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pre_anamneses (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'recebida' check (status in ('recebida','em_avaliacao','avaliada')),
  patient_name text not null,
  patient_email text,
  patient_phone text not null,
  procedure text not null,
  answers jsonb not null default '{}'::jsonb,
  consents jsonb not null default '{}'::jsonb,
  signature_path text,
  pdf_path text,
  source_version text not null
);

create index if not exists pre_anamneses_created_at_idx on public.pre_anamneses (created_at desc);
create index if not exists pre_anamneses_patient_name_idx on public.pre_anamneses (lower(patient_name));
create index if not exists pre_anamneses_public_code_idx on public.pre_anamneses (public_code);
create index if not exists pre_anamneses_status_idx on public.pre_anamneses (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

drop trigger if exists pre_anamneses_set_updated_at on public.pre_anamneses;
create trigger pre_anamneses_set_updated_at
before update on public.pre_anamneses
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.pre_anamneses enable row level security;

revoke all on table public.admin_users from anon;
revoke all on table public.pre_anamneses from anon;
revoke insert, delete on table public.pre_anamneses from authenticated;

drop policy if exists "admin_users_read_self" on public.admin_users;
create policy "admin_users_read_self"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid() and active = true);

drop policy if exists "admins_read_pre_anamneses" on public.pre_anamneses;
create policy "admins_read_pre_anamneses"
on public.pre_anamneses
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.active = true
  )
);

drop policy if exists "admins_update_pre_anamneses" on public.pre_anamneses;
create policy "admins_update_pre_anamneses"
on public.pre_anamneses
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.active = true
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pre-anamnese-signatures', 'pre-anamnese-signatures', false, 2097152, array['image/png']),
  ('pre-anamnese-pdfs', 'pre-anamnese-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins_read_private_pre_anamnese_files" on storage.objects;
create policy "admins_read_private_pre_anamnese_files"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('pre-anamnese-signatures','pre-anamnese-pdfs')
  and exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.active = true
  )
);

commit;
