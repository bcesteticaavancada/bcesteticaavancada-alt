-- Recepção pública na base ativa. Nenhum cliente é criado/vinculado automaticamente.
create table if not exists public.bc_pre_anamneses (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  created_at timestamptz not null default now(),
  status text not null default 'recebida' check(status in ('recebida','vinculada')),
  patient_name text not null,
  patient_cpf text,
  patient_phone text not null,
  patient_email text,
  procedure text not null,
  answers jsonb not null,
  consents jsonb not null,
  source_version text not null,
  submission_token text not null unique,
  submission_hash text not null,
  signature_path text,
  rubric_sha256 text,
  rubric_confirmed_at timestamptz,
  payload_sha256 text,
  data_authorization_accepted_at timestamptz,
  pdf_path text unique,
  pdf_sha256 text,
  pdf_size_bytes bigint,
  cliente_id uuid references public.clientes(id) on delete restrict,
  client_file_id uuid references public.client_files(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  check ((status='recebida' and cliente_id is null and client_file_id is null and reviewed_by is null and reviewed_at is null)
    or (status='vinculada' and cliente_id is not null and client_file_id is not null and reviewed_by is not null and reviewed_at is not null))
);
create index if not exists bc_pre_anamneses_created_idx on public.bc_pre_anamneses(created_at desc);
create index if not exists bc_pre_anamneses_cliente_idx on public.bc_pre_anamneses(cliente_id);
create index if not exists bc_pre_anamneses_file_idx on public.bc_pre_anamneses(client_file_id);
create index if not exists bc_pre_anamneses_reviewer_idx on public.bc_pre_anamneses(reviewed_by);
alter table public.bc_pre_anamneses enable row level security;
revoke all on public.bc_pre_anamneses from public,anon,authenticated;
grant all on public.bc_pre_anamneses to service_role;

create table if not exists private.pre_anamnese_rate_limits (
  origin_hash text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists pre_anamnese_rate_origin_idx on private.pre_anamnese_rate_limits(origin_hash,attempted_at);
revoke all on private.pre_anamnese_rate_limits from public,anon,authenticated;

create or replace function private.bc_pre_anamnese_rate_limit_impl(p_origin_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_origin_hash is null or length(p_origin_hash)<>64 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('bc-intake:'||p_origin_hash,49));
  if (select count(*) from private.pre_anamnese_rate_limits where origin_hash=p_origin_hash and attempted_at>now()-interval '10 minutes')>=10 then return false; end if;
  insert into private.pre_anamnese_rate_limits(origin_hash) values(p_origin_hash);
  delete from private.pre_anamnese_rate_limits where attempted_at<now()-interval '1 day';
  return true;
end; $$;
revoke all on function private.bc_pre_anamnese_rate_limit_impl(text) from public,anon,authenticated;
grant execute on function private.bc_pre_anamnese_rate_limit_impl(text) to service_role;

create or replace function private.bc_pre_anamnese_inbox_impl(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_bc_admin() then raise exception 'Acesso restrito à administração clínica.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
    select id,public_code,patient_name,patient_phone,procedure,created_at,status,pdf_path,cliente_id
    from public.bc_pre_anamneses order by created_at desc limit greatest(1,least(coalesce(p_limit,100),200))
  ) r;
  return result;
end; $$;

create or replace function private.bc_pre_anamnese_link_impl(p_intake_id uuid,p_cliente_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.bc_pre_anamneses%rowtype; file_id uuid; actor uuid:=auth.uid();
begin
  if actor is null or not private.is_bc_admin() then raise exception 'Acesso restrito à administração clínica.' using errcode='42501'; end if;
  select * into r from public.bc_pre_anamneses where id=p_intake_id for update;
  if not found then raise exception 'Ficha não encontrada.' using errcode='P0002'; end if;
  if r.cliente_id is not null then
    if r.cliente_id<>p_cliente_id then raise exception 'Ficha já vinculada a outro cadastro.' using errcode='22023'; end if;
    return jsonb_build_object('linked',true,'client_file_id',r.client_file_id);
  end if;
  if not exists(select 1 from public.clientes where id=p_cliente_id and ativo) then raise exception 'Cadastro inexistente ou arquivado.' using errcode='22023'; end if;
  if r.pdf_path is null or r.pdf_sha256 is null or r.pdf_size_bytes is null
     or not exists(select 1 from storage.objects where bucket_id='bc-prontuario-private' and name=r.pdf_path) then
    raise exception 'Aguarde a geração do PDF antes de vincular.' using errcode='55000';
  end if;
  insert into public.client_files(cliente_id,title,category,origin,document_date,storage_path,mime_type,size_bytes,sha256,uploaded_by)
  values(p_cliente_id,'Pré-anamnese pública • '||r.public_code,'outro_clinico','outro',(r.created_at at time zone 'America/Sao_Paulo')::date,r.pdf_path,'application/pdf',r.pdf_size_bytes,r.pdf_sha256,actor)
  returning id into file_id;
  update public.bc_pre_anamneses set status='vinculada',cliente_id=p_cliente_id,client_file_id=file_id,reviewed_by=actor,reviewed_at=now() where id=r.id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(actor,'pre_anamnese_linked','bc_pre_anamneses',r.id,jsonb_build_object('cliente_id',p_cliente_id,'client_file_id',file_id));
  return jsonb_build_object('linked',true,'client_file_id',file_id);
end; $$;
revoke all on function private.bc_pre_anamnese_inbox_impl(integer) from public,anon;
revoke all on function private.bc_pre_anamnese_link_impl(uuid,uuid) from public,anon;
grant execute on function private.bc_pre_anamnese_inbox_impl(integer),private.bc_pre_anamnese_link_impl(uuid,uuid) to authenticated;

-- Leitura da recepção é administrativa; após vínculo, o PDF passa a integrar a pasta clínica.
create or replace function private.bc_pre_anamnese_storage_read(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_bc_active_staff() and exists(select 1 from public.bc_pre_anamneses r
    where r.pdf_path=p_path and (private.is_bc_admin() or r.cliente_id is not null));
$$;
revoke all on function private.bc_pre_anamnese_storage_read(text) from public,anon;
grant execute on function private.bc_pre_anamnese_storage_read(text) to authenticated;
create policy bc_pre_anamnese_pdf_read on storage.objects for select to authenticated
using(bucket_id='bc-prontuario-private' and private.bc_pre_anamnese_storage_read(name));

-- Não permitir que a política ampla legada abra a recepção ainda não vinculada.
alter policy bc_prontuario_private_select on storage.objects using (bucket_id='bc-prontuario-private' and private.is_bc_active_staff() and coalesce((storage.foldername(name))[1],'')<>'pre-anamneses');

-- A tabela documental é RPC-only. Consultá-la diretamente dentro da policy
-- faz qualquer SELECT do Storage falhar por falta de privilégio nessa tabela.
create or replace function private.bc_client_file_storage_read(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_bc_active_staff() and exists(select 1 from public.client_files f
    where f.storage_path=p_path and f.voided_at is null);
$$;
revoke all on function private.bc_client_file_storage_read(text) from public,anon;
grant execute on function private.bc_client_file_storage_read(text) to authenticated;
alter policy bc_client_files_read on storage.objects using (
  bucket_id='bc-prontuario-private' and private.bc_client_file_storage_read(name)
);

create or replace function public.bc_pre_anamnese_rate_limit(p_origin_hash text) returns boolean
language sql security invoker set search_path='' as $$ select private.bc_pre_anamnese_rate_limit_impl($1); $$;
create or replace function public.bc_pre_anamnese_inbox(p_limit integer default 100) returns jsonb
language sql security invoker set search_path='' as $$ select private.bc_pre_anamnese_inbox_impl($1); $$;
create or replace function public.bc_pre_anamnese_link(p_intake_id uuid,p_cliente_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.bc_pre_anamnese_link_impl($1,$2); $$;
revoke all on function public.bc_pre_anamnese_rate_limit(text) from public,anon,authenticated;
grant execute on function public.bc_pre_anamnese_rate_limit(text) to service_role;
revoke all on function public.bc_pre_anamnese_inbox(integer),public.bc_pre_anamnese_link(uuid,uuid) from public,anon;
grant execute on function public.bc_pre_anamnese_inbox(integer),public.bc_pre_anamnese_link(uuid,uuid) to authenticated;
