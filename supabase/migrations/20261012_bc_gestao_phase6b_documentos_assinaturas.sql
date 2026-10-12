-- BC Gestão Fase 6B — documentos clínicos, dupla assinatura e Storage privado.

create table if not exists public.clinical_documents (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  document_type text not null check (document_type in ('anamnese_geral')),
  source_id uuid not null,
  source_version integer not null check (source_version > 0),
  document_version integer not null default 1 check (document_version > 0),
  document_code text not null unique,
  status text not null default 'aguardando_assinaturas'
    check (status in ('aguardando_assinaturas','pronto_para_pdf','gerando_pdf','emitido','erro_pdf')),
  profissional_user_id uuid references auth.users(id) on delete restrict,
  profissional_nome text,
  profissional_profissao text,
  profissional_conselho text,
  profissional_registro text,
  storage_path text,
  sha256 text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique(document_type, source_id, document_version)
);

create index if not exists clinical_documents_cliente_idx
  on public.clinical_documents(cliente_id, created_at desc);

create table if not exists public.clinical_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.clinical_documents(id) on delete restrict,
  signer_kind text not null check (signer_kind in ('paciente','responsavel','profissional')),
  signer_user_id uuid references auth.users(id) on delete restrict,
  signer_name text not null,
  signer_profissao text,
  signer_conselho text,
  signer_registro text,
  storage_path text not null,
  sha256 text not null,
  signed_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  unique(document_id, signer_kind)
);

create index if not exists clinical_signatures_document_idx
  on public.clinical_signatures(document_id, signed_at);

alter table public.clinical_documents enable row level security;
alter table public.clinical_signatures enable row level security;

drop policy if exists clinical_documents_staff_read on public.clinical_documents;
create policy clinical_documents_staff_read
on public.clinical_documents
for select to authenticated
using (private.is_bc_active_staff());

drop policy if exists clinical_signatures_staff_read on public.clinical_signatures;
create policy clinical_signatures_staff_read
on public.clinical_signatures
for select to authenticated
using (private.is_bc_active_staff());

revoke all on public.clinical_documents from anon, authenticated;
revoke all on public.clinical_signatures from anon, authenticated;
grant select on public.clinical_documents to authenticated;
grant select on public.clinical_signatures to authenticated;

insert into storage.buckets(id,name,public)
values('bc-prontuario-private','bc-prontuario-private',false)
on conflict(id) do update set public=false;

drop policy if exists bc_prontuario_6b_staff_read on storage.objects;
create policy bc_prontuario_6b_staff_read
on storage.objects
for select to authenticated
using (
  bucket_id='bc-prontuario-private'
  and private.is_bc_active_staff()
  and (storage.foldername(name))[1] in ('assinaturas','documentos')
);

drop policy if exists bc_prontuario_6b_signature_insert on storage.objects;
create policy bc_prontuario_6b_signature_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id='bc-prontuario-private'
  and private.is_bc_active_staff()
  and (storage.foldername(name))[1] = 'assinaturas'
);

create or replace function private.bc_anamnese_validate_required(p_anamnese_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from (values
    ('queixa_principal'),
    ('objetivos_esteticos'),
    ('historico_estetico_realizou'),
    ('pele_tipo'),
    ('exposicao_solar_recente'),
    ('usa_fotoprotecao'),
    ('condicao_saude_importante'),
    ('acompanhamento_medico'),
    ('medicamentos_continuos'),
    ('alergias_conhecidas'),
    ('reacao_alergica_procedimento'),
    ('cirurgias_procedimentos_recentes'),
    ('tabagismo_nicotina'),
    ('alcool'),
    ('gestacao_possibilidade'),
    ('amamentacao'),
    ('expectativas'),
    ('declaracao_veracidade'),
    ('declaracao_dados')
  ) required(question_key)
  where not exists (
    select 1 from public.anamnese_respostas r
    where r.anamnese_id=p_anamnese_id
      and r.question_key=required.question_key
      and r.answer_json not in ('null'::jsonb,'""'::jsonb,'false'::jsonb,'[]'::jsonb)
  );

  if v_missing > 0 then return false; end if;

  if exists (
    select 1 from public.anamnese_respostas r
    where r.anamnese_id=p_anamnese_id and r.question_key='condicao_saude_importante'
      and lower(r.answer_json #>> '{}')='sim'
  ) and not exists (
    select 1 from public.anamnese_respostas r
    where r.anamnese_id=p_anamnese_id and r.question_key='condicao_saude_detalhes'
      and nullif(trim(r.answer_json #>> '{}'),'') is not null
  ) then return false; end if;

  if exists (
    select 1 from public.anamnese_respostas r
    where r.anamnese_id=p_anamnese_id and r.question_key='alergias_conhecidas'
      and lower(r.answer_json #>> '{}')='sim'
  ) and not exists (
    select 1 from public.anamnese_respostas r
    where r.anamnese_id=p_anamnese_id and r.question_key='alergias_detalhes'
      and nullif(trim(r.answer_json #>> '{}'),'') is not null
  ) then return false; end if;

  return true;
end;
$$;

create or replace function private.bc_anamnese_mark_reviewed_impl(p_anamnese_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_anamnese public.anamneses_gerais%rowtype;
  v_staff public.staff_profiles%rowtype;
  v_cliente public.clientes%rowtype;
  v_document_id uuid;
  v_code text;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select * into v_anamnese from public.anamneses_gerais
  where id=p_anamnese_id for update;
  if not found or v_anamnese.status <> 'aguardando_revisao_profissional' then
    raise exception 'Anamnese não está aguardando revisão profissional.' using errcode='55000';
  end if;

  if not private.bc_anamnese_validate_required(p_anamnese_id) then
    raise exception 'Existem respostas obrigatórias pendentes.' using errcode='22023';
  end if;

  select * into v_staff from public.staff_profiles
  where user_id=v_user_id and active and atende_clientes;
  if not found
     or nullif(trim(v_staff.profissao),'') is null
     or nullif(trim(v_staff.conselho),'') is null
     or nullif(trim(v_staff.registro_conselho),'') is null then
    raise exception 'Complete profissão, conselho e registro profissional antes de assinar.' using errcode='22023';
  end if;

  select * into v_cliente from public.clientes where id=v_anamnese.cliente_id;
  if not found then raise exception 'Cliente não encontrada.' using errcode='P0002'; end if;

  v_code := 'BC-ANM-' || to_char(now() at time zone 'America/Sao_Paulo','YYYYMMDD') || '-' ||
            upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));

  update public.anamneses_gerais
     set status='aguardando_assinaturas', reviewed_by=v_user_id, reviewed_at=now(), updated_at=now()
   where id=p_anamnese_id;

  insert into public.clinical_documents(
    cliente_id,document_type,source_id,source_version,document_version,document_code,status,
    profissional_user_id,profissional_nome,profissional_profissao,profissional_conselho,profissional_registro
  ) values (
    v_anamnese.cliente_id,'anamnese_geral',p_anamnese_id,v_anamnese.version,1,v_code,'aguardando_assinaturas',
    v_user_id,v_staff.display_name,v_staff.profissao,v_staff.conselho,v_staff.registro_conselho
  )
  returning id into v_document_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user_id,'anamnese_reviewed','anamneses_gerais',p_anamnese_id,
         jsonb_build_object('document_id',v_document_id,'version',v_anamnese.version));

  return v_document_id;
end;
$$;

create or replace function public.bc_anamnese_mark_reviewed(p_anamnese_id uuid)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_mark_reviewed_impl(p_anamnese_id); $$;

create or replace function private.bc_clinical_signature_register_impl(
  p_document_id uuid,p_signer_kind text,p_storage_path text,p_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_doc public.clinical_documents%rowtype;
  v_client public.clientes%rowtype;
  v_staff public.staff_profiles%rowtype;
  v_name text;
  v_profissao text;
  v_conselho text;
  v_registro text;
  v_signer_user uuid;
  v_id uuid;
  v_minor boolean;
  v_clinic_date date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if p_signer_kind not in ('paciente','responsavel','profissional') then
    raise exception 'Tipo de assinatura inválido.' using errcode='22023';
  end if;

  select * into v_doc from public.clinical_documents where id=p_document_id for update;
  if not found or v_doc.status <> 'aguardando_assinaturas' then
    raise exception 'Documento não está aguardando assinaturas.' using errcode='55000';
  end if;
  if p_storage_path not like ('assinaturas/'||p_document_id::text||'/%') then
    raise exception 'Caminho de assinatura inválido.' using errcode='22023';
  end if;
  if nullif(trim(p_sha256),'') is null then
    raise exception 'Hash da assinatura é obrigatório.' using errcode='22023';
  end if;

  select * into v_client from public.clientes where id=v_doc.cliente_id;
  if not found then raise exception 'Cliente não encontrada.' using errcode='P0002'; end if;
  v_minor := v_client.data_nascimento > (v_clinic_date - interval '18 years')::date;

  if p_signer_kind='profissional' then
    if v_doc.profissional_user_id <> v_user_id then
      raise exception 'Somente a profissional revisora pode assinar este documento.' using errcode='42501';
    end if;
    select * into v_staff from public.staff_profiles where user_id=v_user_id and active and atende_clientes;
    if not found or nullif(trim(v_staff.profissao),'') is null
       or nullif(trim(v_staff.conselho),'') is null or nullif(trim(v_staff.registro_conselho),'') is null then
      raise exception 'Identidade profissional incompleta.' using errcode='22023';
    end if;
    v_name := v_staff.display_name;
    v_profissao := v_staff.profissao;
    v_conselho := v_staff.conselho;
    v_registro := v_staff.registro_conselho;
    v_signer_user := v_user_id;
  elsif p_signer_kind='responsavel' then
    if not v_minor then
      raise exception 'Assinatura de responsável é usada para cliente menor de 18 anos.' using errcode='22023';
    end if;
    if nullif(trim(v_client.responsavel_nome),'') is null then
      raise exception 'Responsável legal não cadastrado.' using errcode='22023';
    end if;
    v_name := v_client.responsavel_nome;
  else
    if v_minor then
      raise exception 'Cliente menor de 18 anos exige assinatura do responsável legal.' using errcode='22023';
    end if;
    v_name := v_client.nome;
  end if;

  insert into public.clinical_signatures(
    document_id,signer_kind,signer_user_id,signer_name,signer_profissao,signer_conselho,signer_registro,
    storage_path,sha256,recorded_by
  ) values (
    p_document_id,p_signer_kind,v_signer_user,v_name,v_profissao,v_conselho,v_registro,
    p_storage_path,lower(trim(p_sha256)),v_user_id
  )
  returning id into v_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user_id,'clinical_document_signed','clinical_signatures',v_id,
         jsonb_build_object('document_id',p_document_id,'signer_kind',p_signer_kind));

  return v_id;
exception when unique_violation then
  raise exception 'Esta assinatura já foi registrada para o documento.' using errcode='23505';
end;
$$;

create or replace function public.bc_clinical_signature_register(
  p_document_id uuid,p_signer_kind text,p_storage_path text,p_sha256 text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_clinical_signature_register_impl(p_document_id,p_signer_kind,p_storage_path,p_sha256); $$;

create or replace function private.bc_clinical_document_finalize_impl(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_doc public.clinical_documents%rowtype;
  v_anamnese public.anamneses_gerais%rowtype;
  v_client public.clientes%rowtype;
  v_expected_kind text;
  v_now timestamptz := now();
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select * into v_doc from public.clinical_documents where id=p_document_id for update;
  if not found or v_doc.status <> 'aguardando_assinaturas' then
    raise exception 'Documento não está aguardando assinaturas.' using errcode='55000';
  end if;
  if v_doc.profissional_user_id <> v_user_id then
    raise exception 'Somente a profissional revisora pode finalizar.' using errcode='42501';
  end if;

  select * into v_anamnese from public.anamneses_gerais
  where id=v_doc.source_id and v_doc.document_type='anamnese_geral' for update;
  if not found or v_anamnese.status <> 'aguardando_assinaturas' then
    raise exception 'Anamnese não está aguardando assinaturas.' using errcode='55000';
  end if;

  select * into v_client from public.clientes where id=v_doc.cliente_id;
  v_expected_kind := case when v_client.data_nascimento > (((now() at time zone 'America/Sao_Paulo')::date) - interval '18 years')::date
                          then 'responsavel' else 'paciente' end;

  if not exists(select 1 from public.clinical_signatures where document_id=p_document_id and signer_kind=v_expected_kind)
     or not exists(select 1 from public.clinical_signatures where document_id=p_document_id and signer_kind='profissional') then
    raise exception 'Assinaturas obrigatórias ainda não foram registradas.' using errcode='22023';
  end if;

  update public.anamneses_gerais
     set status='substituida',updated_at=v_now
   where cliente_id=v_doc.cliente_id and id<>v_anamnese.id and status='finalizada';

  update public.anamneses_gerais
     set status='finalizada',finalized_by=v_user_id,finalized_at=v_now,
         valid_until=private.bc_anamnese_annual_valid_until(v_now),updated_at=v_now
   where id=v_anamnese.id;

  update public.clinical_documents
     set status='pronto_para_pdf'
   where id=p_document_id;

  perform private.bc_sync_anamnese_alerts(v_anamnese.id);

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user_id,'anamnese_finalized','anamneses_gerais',v_anamnese.id,
         jsonb_build_object('document_id',p_document_id,'version',v_anamnese.version,'valid_until',
           private.bc_anamnese_annual_valid_until(v_now)));

  return p_document_id;
end;
$$;

create or replace function public.bc_clinical_document_finalize(p_document_id uuid)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_clinical_document_finalize_impl(p_document_id); $$;

create or replace function public.bc_clinical_document_list(p_cliente_id uuid)
returns table(
  id uuid, document_type text, source_id uuid, source_version integer, document_version integer,
  document_code text, status text, profissional_nome text, profissional_profissao text,
  profissional_conselho text, profissional_registro text, storage_path text, sha256 text,
  generated_at timestamptz, created_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select d.id,d.document_type,d.source_id,d.source_version,d.document_version,d.document_code,d.status,
         d.profissional_nome,d.profissional_profissao,d.profissional_conselho,d.profissional_registro,
         d.storage_path,d.sha256,d.generated_at,d.created_at
  from public.clinical_documents d
  where private.is_bc_active_staff() and d.cliente_id=p_cliente_id
  order by d.created_at desc;
$$;

revoke all on function public.bc_anamnese_mark_reviewed(uuid) from public;
revoke all on function public.bc_clinical_signature_register(uuid,text,text,text) from public;
revoke all on function public.bc_clinical_document_finalize(uuid) from public;
revoke all on function public.bc_clinical_document_list(uuid) from public;
grant execute on function public.bc_anamnese_mark_reviewed(uuid) to authenticated;
grant execute on function public.bc_clinical_signature_register(uuid,text,text,text) to authenticated;
grant execute on function public.bc_clinical_document_finalize(uuid) to authenticated;
grant execute on function public.bc_clinical_document_list(uuid) to authenticated;

revoke all on function private.bc_anamnese_validate_required(uuid) from public;
revoke all on function private.bc_anamnese_mark_reviewed_impl(uuid) from public;
revoke all on function private.bc_clinical_signature_register_impl(uuid,text,text,text) from public;
revoke all on function private.bc_clinical_document_finalize_impl(uuid) from public;
revoke execute on function private.bc_anamnese_mark_reviewed_impl(uuid) from anon;
revoke execute on function private.bc_clinical_signature_register_impl(uuid,text,text,text) from anon;
revoke execute on function private.bc_clinical_document_finalize_impl(uuid) from anon;
grant execute on function private.bc_anamnese_mark_reviewed_impl(uuid) to authenticated;
grant execute on function private.bc_clinical_signature_register_impl(uuid,text,text,text) to authenticated;
grant execute on function private.bc_clinical_document_finalize_impl(uuid) to authenticated;
