-- BC Gestão — arquivos externos privados vinculados à Pasta da Cliente.
-- RPC-only para metadata; bytes permanecem no bucket privado bc-prontuario-private.

create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  title text not null check (nullif(trim(title),'') is not null),
  category text not null check (category in (
    'tcle_externo','exame_documento_apresentado','documento_digitalizado','relatorio_externo','outro_clinico'
  )),
  origin text not null check (origin in ('gov_br','digitalizado','upload_manual','outro')),
  document_date date,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  void_reason text,
  check (
    (voided_at is null and voided_by is null and void_reason is null)
    or
    (voided_at is not null and voided_by is not null and nullif(trim(void_reason),'') is not null)
  )
);

create index if not exists client_files_cliente_idx
  on public.client_files(cliente_id, created_at desc);
create index if not exists client_files_uploaded_by_idx
  on public.client_files(uploaded_by);
create index if not exists client_files_voided_by_idx
  on public.client_files(voided_by)
  where voided_by is not null;

alter table public.client_files enable row level security;
revoke all on public.client_files from anon, authenticated;

-- Storage: upload permitido somente à equipe ativa no namespace da cliente.
-- A leitura só é concedida quando a metadata já foi registrada em client_files;
-- portanto um upload órfão após falha de registro permanece privado/inacessível.
drop policy if exists bc_client_files_insert on storage.objects;
create policy bc_client_files_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bc-prontuario-private'
    and private.is_bc_active_staff()
    and (storage.foldername(name))[1] = 'arquivos-clientes'
    and (storage.foldername(name))[2] is not null
    and storage.extension(name) in ('pdf','jpg','jpeg','png','webp')
    and exists (
      select 1
      from public.clientes c
      where c.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists bc_client_files_read on storage.objects;
create policy bc_client_files_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bc-prontuario-private'
    and private.is_bc_active_staff()
    and (storage.foldername(name))[1] = 'arquivos-clientes'
    and exists (
      select 1
      from public.client_files f
      where f.storage_path = name
    )
  );

create or replace function private.bc_client_file_register_impl(
  p_cliente_id uuid,
  p_title text,
  p_category text,
  p_origin text,
  p_document_date date,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_object record;
  v_ext text;
  v_object_mime text;
  v_object_size text;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado aos documentos da cliente.' using errcode='42501';
  end if;

  if not exists(select 1 from public.clientes c where c.id=p_cliente_id) then
    raise exception 'Cliente não encontrada.' using errcode='P0002';
  end if;

  if nullif(trim(p_title),'') is null then
    raise exception 'Título do documento é obrigatório.' using errcode='22023';
  end if;
  if p_category not in ('tcle_externo','exame_documento_apresentado','documento_digitalizado','relatorio_externo','outro_clinico') then
    raise exception 'Categoria de documento inválida.' using errcode='22023';
  end if;
  if p_origin not in ('gov_br','digitalizado','upload_manual','outro') then
    raise exception 'Origem do documento inválida.' using errcode='22023';
  end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'Formato de documento inválido.' using errcode='22023';
  end if;
  if p_size_bytes is null or p_size_bytes<=0 or p_size_bytes>8388608 then
    raise exception 'O documento deve ter no máximo 8 MB.' using errcode='22023';
  end if;
  if p_sha256 is null or lower(trim(p_sha256)) !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash SHA-256 inválido.' using errcode='22023';
  end if;

  if p_storage_path is null
     or p_storage_path not like ('arquivos-clientes/'||p_cliente_id::text||'/%') then
    raise exception 'Caminho do documento inválido.' using errcode='22023';
  end if;

  v_ext := lower(coalesce(storage.extension(p_storage_path),''));
  if (p_mime_type='application/pdf' and v_ext<>'pdf')
     or (p_mime_type='image/jpeg' and v_ext not in ('jpg','jpeg'))
     or (p_mime_type='image/png' and v_ext<>'png')
     or (p_mime_type='image/webp' and v_ext<>'webp') then
    raise exception 'Extensão incompatível com o formato informado.' using errcode='22023';
  end if;

  select o.metadata
    into v_object
    from storage.objects o
   where o.bucket_id='bc-prontuario-private'
     and o.name=p_storage_path;
  if not found then
    raise exception 'Arquivo enviado não encontrado no Storage.' using errcode='P0002';
  end if;

  v_object_mime := lower(coalesce(v_object.metadata->>'mimetype',''));
  v_object_size := coalesce(v_object.metadata->>'size','');
  if v_object_mime<>lower(p_mime_type) then
    raise exception 'Formato real do arquivo não corresponde ao informado.' using errcode='22023';
  end if;
  if v_object_size<>p_size_bytes::text then
    raise exception 'Tamanho real do arquivo não corresponde ao informado.' using errcode='22023';
  end if;

  insert into public.client_files(
    cliente_id,title,category,origin,document_date,storage_path,mime_type,size_bytes,sha256,uploaded_by
  ) values (
    p_cliente_id,trim(p_title),p_category,p_origin,p_document_date,p_storage_path,p_mime_type,p_size_bytes,
    lower(trim(p_sha256)),v_user
  )
  returning id into v_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(
    v_user,'client_file_registered','client_files',v_id,
    jsonb_build_object('cliente_id',p_cliente_id,'category',p_category,'origin',p_origin)
  );

  return v_id;
exception when unique_violation then
  raise exception 'Este arquivo já foi registrado.' using errcode='23505';
end;
$$;

create or replace function private.bc_client_file_void_impl(p_file_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_file public.client_files%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado aos documentos da cliente.' using errcode='42501';
  end if;

  select * into v_file
    from public.client_files
   where id=p_file_id
   for update;
  if not found then
    raise exception 'Documento não encontrado.' using errcode='P0002';
  end if;
  if nullif(trim(p_reason),'') is null then
    raise exception 'Motivo da anulação é obrigatório.' using errcode='22023';
  end if;

  if v_file.voided_at is null then
    update public.client_files
       set voided_at=now(), voided_by=v_user, void_reason=trim(p_reason)
     where id=p_file_id;

    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
    values(
      v_user,'client_file_voided','client_files',p_file_id,
      jsonb_build_object('cliente_id',v_file.cliente_id)
    );
  end if;

  return p_file_id;
end;
$$;

create or replace function public.bc_client_file_register(
  p_cliente_id uuid,
  p_title text,
  p_category text,
  p_origin text,
  p_document_date date,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.bc_client_file_register_impl(
    p_cliente_id,p_title,p_category,p_origin,p_document_date,p_storage_path,p_mime_type,p_size_bytes,p_sha256
  );
$$;

create or replace function public.bc_client_file_void(p_file_id uuid,p_reason text)
returns uuid
language sql
security invoker
set search_path=''
as $$ select private.bc_client_file_void_impl(p_file_id,p_reason); $$;

revoke all on function public.bc_client_file_register(uuid,text,text,text,date,text,text,bigint,text) from public;
revoke execute on function public.bc_client_file_register(uuid,text,text,text,date,text,text,bigint,text) from anon;
grant execute on function public.bc_client_file_register(uuid,text,text,text,date,text,text,bigint,text) to authenticated;

revoke all on function public.bc_client_file_void(uuid,text) from public;
revoke execute on function public.bc_client_file_void(uuid,text) from anon;
grant execute on function public.bc_client_file_void(uuid,text) to authenticated;

revoke all on function private.bc_client_file_register_impl(uuid,text,text,text,date,text,text,bigint,text) from public;
revoke execute on function private.bc_client_file_register_impl(uuid,text,text,text,date,text,text,bigint,text) from anon;
grant execute on function private.bc_client_file_register_impl(uuid,text,text,text,date,text,text,bigint,text) to authenticated;

revoke all on function private.bc_client_file_void_impl(uuid,text) from public;
revoke execute on function private.bc_client_file_void_impl(uuid,text) from anon;
grant execute on function private.bc_client_file_void_impl(uuid,text) to authenticated;
