-- BC Gestão — TCLE externo revisado e vinculado a um atendimento específico.
-- O arquivo isolado nunca satisfaz o gate: somente o vínculo profissional compatível.

create table if not exists public.treatment_external_consents (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null unique references public.clinical_treatments(id) on delete restrict,
  client_file_id uuid not null references public.client_files(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  procedure_version_id uuid not null references public.procedure_versions(id) on delete restrict,
  consent_template_version_id uuid not null references public.consent_template_versions(id) on delete restrict,
  consent_class text not null check (consent_class in ('injetavel','nao_injetavel')),
  component_version_ids uuid[] not null default '{}'::uuid[],
  component_keys text[] not null default '{}'::text[],
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now()
);
create index if not exists treatment_external_consents_file_idx on public.treatment_external_consents(client_file_id);
create index if not exists treatment_external_consents_reviewed_by_idx on public.treatment_external_consents(reviewed_by);
alter table public.treatment_external_consents enable row level security;
revoke all on public.treatment_external_consents from anon, authenticated;

create or replace function private.bc_treatment_external_consent_link_impl(p_treatment_id uuid,p_client_file_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  t public.clinical_treatments%rowtype; f public.client_files%rowtype; v_user uuid:=auth.uid();
  v_class text; v_template uuid; v_id uuid; v_ids uuid[]; v_keys text[];
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select * into t from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_user<>t.profissional_user_id then raise exception 'Somente a profissional responsável pode revisar o TCLE externo.' using errcode='42501'; end if;
  if t.status not in ('rascunho','pronto_para_iniciar') or t.pending_version_id is not null then raise exception 'TCLE externo fora da etapa permitida.' using errcode='55000'; end if;
  if not private.bc_treatment_can_execute_version(t.procedure_version_id,v_user) then raise exception 'Profissional não autorizada para este procedimento.' using errcode='42501'; end if;
  select * into f from public.client_files where id=p_client_file_id;
  if not found then raise exception 'Documento externo não encontrado.' using errcode='P0002'; end if;
  if f.cliente_id<>t.cliente_id then raise exception 'Documento pertence a outra cliente.' using errcode='42501'; end if;
  if f.category<>'tcle_externo' then raise exception 'Documento não está classificado como TCLE externo.' using errcode='22023'; end if;
  if f.mime_type<>'application/pdf' then raise exception 'TCLE externo deve ser um arquivo PDF.' using errcode='22023'; end if;
  if f.voided_at is not null then raise exception 'Documento externo está anulado.' using errcode='55000'; end if;

  v_class:=private.bc_treatment_expected_consent_class(t.id);
  select ct.id into v_template from public.consent_template_versions ct
   where ct.status='published' and ct.consent_class=v_class order by ct.version desc,ct.created_at desc limit 1;
  if v_template is null then raise exception 'Template de consentimento vigente não encontrado.' using errcode='P0002'; end if;
  select coalesce(array_agg(c.component_version_id order by c.component_version_id) filter(where c.component_version_id is not null),'{}'::uuid[]),
         coalesce(array_agg(c.component_key order by c.component_key) filter(where c.component_key is not null),'{}'::text[])
    into v_ids,v_keys from public.clinical_treatment_components c where c.treatment_id=t.id;

  insert into public.treatment_external_consents(treatment_id,client_file_id,cliente_id,procedure_version_id,consent_template_version_id,consent_class,component_version_ids,component_keys,reviewed_by)
  values(t.id,f.id,t.cliente_id,t.procedure_version_id,v_template,v_class,v_ids,v_keys,v_user)
  returning id into v_id;
  if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'treatment_external_consent_linked','treatment_external_consents',v_id,jsonb_build_object('treatment_id',t.id,'client_file_id',f.id,'procedure_version_id',t.procedure_version_id,'consent_class',v_class));
  return v_id;
exception when unique_violation then raise exception 'Este atendimento já possui TCLE externo revisado.' using errcode='23505';
end;$$;
revoke all on function private.bc_treatment_external_consent_link_impl(uuid,uuid) from public;
revoke execute on function private.bc_treatment_external_consent_link_impl(uuid,uuid) from anon;
grant execute on function private.bc_treatment_external_consent_link_impl(uuid,uuid) to authenticated;

create or replace function private.bc_treatment_external_consent_get_impl(p_treatment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$begin
  if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  return (select to_jsonb(e)||jsonb_build_object('file_title',f.title,'file_document_date',f.document_date,'file_origin',f.origin)
    from public.treatment_external_consents e join public.client_files f on f.id=e.client_file_id where e.treatment_id=p_treatment_id);
end;$$;
revoke all on function private.bc_treatment_external_consent_get_impl(uuid) from public;
revoke execute on function private.bc_treatment_external_consent_get_impl(uuid) from anon;
grant execute on function private.bc_treatment_external_consent_get_impl(uuid) to authenticated;

create or replace function public.bc_treatment_external_consent_link(p_treatment_id uuid,p_client_file_id uuid)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_external_consent_link_impl(p_treatment_id,p_client_file_id);$$;
create or replace function public.bc_treatment_external_consent_get(p_treatment_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select private.bc_treatment_external_consent_get_impl(p_treatment_id);$$;
revoke all on function public.bc_treatment_external_consent_link(uuid,uuid) from public;
revoke execute on function public.bc_treatment_external_consent_link(uuid,uuid) from anon;
grant execute on function public.bc_treatment_external_consent_link(uuid,uuid) to authenticated;
revoke all on function public.bc_treatment_external_consent_get(uuid) from public;
revoke execute on function public.bc_treatment_external_consent_get(uuid) from anon;
grant execute on function public.bc_treatment_external_consent_get(uuid) to authenticated;

-- A versão final revalida o consentimento no instante do congelamento. Para TCLE externo,
-- congela apenas metadados de referência e integridade; nunca caminho, URL ou bytes do arquivo.
create or replace function private.bc_external_consent_snapshot_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_ref jsonb;
begin
  if not private.bc_treatment_consent_satisfied(new.treatment_id) then
    raise exception 'Consentimento do atendimento não está mais válido.' using errcode='55000';
  end if;

  select jsonb_build_object(
    'id',e.id,
    'client_file_id',e.client_file_id,
    'procedure_version_id',e.procedure_version_id,
    'consent_template_version_id',e.consent_template_version_id,
    'consent_class',e.consent_class,
    'component_version_ids',e.component_version_ids,
    'component_keys',e.component_keys,
    'reviewed_by',e.reviewed_by,
    'reviewed_at',e.reviewed_at,
    'file_title',f.title,
    'file_origin',f.origin,
    'file_document_date',f.document_date,
    'mime_type',f.mime_type,
    'sha256',f.sha256
  ) into v_ref
    from public.treatment_external_consents e
    join public.client_files f on f.id=e.client_file_id
   where e.treatment_id=new.treatment_id
     and f.voided_at is null
     and f.mime_type='application/pdf';

  if v_ref is not null then
    new.snapshot:=jsonb_set(coalesce(new.snapshot,'{}'::jsonb),'{external_consent}',v_ref,true);
  end if;
  return new;
end;
$$;
revoke all on function private.bc_external_consent_snapshot_trigger() from public,anon,authenticated;

drop trigger if exists bc_external_consent_snapshot_before_version_insert on public.clinical_treatment_versions;
create trigger bc_external_consent_snapshot_before_version_insert
before insert on public.clinical_treatment_versions
for each row execute function private.bc_external_consent_snapshot_trigger();

create or replace function private.bc_treatment_consent_satisfied(p_treatment_id uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare t public.clinical_treatments%rowtype; d public.clinical_documents%rowtype; pc public.procedure_consents%rowtype; e public.treatment_external_consents%rowtype; f public.client_files%rowtype; v_ids uuid[]; v_keys text[]; v_class text;
begin
  select * into t from public.clinical_treatments where id=p_treatment_id; if not found then return false; end if;
  v_class:=private.bc_treatment_expected_consent_class(t.id);
  select coalesce(array_agg(c.component_version_id order by c.component_version_id) filter(where c.component_version_id is not null),'{}'::uuid[]),coalesce(array_agg(c.component_key order by c.component_key) filter(where c.component_key is not null),'{}'::text[]) into v_ids,v_keys from public.clinical_treatment_components c where c.treatment_id=t.id;
  if t.consent_document_id is not null then
    select * into d from public.clinical_documents where id=t.consent_document_id and document_type='consentimento_procedimento';
    if found then select * into pc from public.procedure_consents where id=d.source_id;
      if found and pc.status='finalizado' and pc.procedure_version_id=t.procedure_version_id and pc.consent_class=v_class and pc.component_version_ids=v_ids and pc.component_keys=v_keys then return true; end if;
    end if;
  end if;
  select * into e from public.treatment_external_consents where treatment_id=t.id;
  if found then
    select * into f from public.client_files where id=e.client_file_id;
    if found and f.cliente_id=t.cliente_id and f.category='tcle_externo' and f.mime_type='application/pdf' and f.voided_at is null and e.cliente_id=t.cliente_id and e.procedure_version_id=t.procedure_version_id and e.consent_class=private.bc_treatment_expected_consent_class(t.id) and e.component_version_ids=v_ids and e.component_keys=v_keys then return true; end if;
  end if;
  return false;
end;$$;
revoke all on function private.bc_treatment_consent_satisfied(uuid) from public,anon,authenticated;

create or replace function private.bc_treatment_gate(p_treatment_id uuid)
returns text[] language plpgsql stable security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; pv public.procedure_versions%rowtype; reasons text[]:='{}'::text[]; v_review public.clinical_treatment_alert_reviews%rowtype; current_alerts uuid[];
begin
  select * into t from public.clinical_treatments where id=p_treatment_id; if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  select * into pv from public.procedure_versions where id=t.procedure_version_id;
  if pv.requires_general_anamnesis and not exists(select 1 from public.anamneses_gerais a where a.cliente_id=t.cliente_id and a.status='finalizada' and a.valid_until>=now()) then reasons:=array_append(reasons,'anamnese_invalida'); end if;
  if not exists(select 1 from public.clinical_treatment_health_confirmations h where h.treatment_id=t.id) then reasons:=array_append(reasons,'saude_nao_confirmada'); end if;
  select * into v_review from public.clinical_treatment_alert_reviews r where r.treatment_id=t.id order by r.reviewed_at desc limit 1;
  select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]) into current_alerts from public.clinical_alerts a where a.cliente_id=t.cliente_id and a.active=true;
  if v_review.id is null or coalesce(v_review.alert_ids,'{}'::uuid[])<>current_alerts then reasons:=array_append(reasons,'alertas_nao_revisados'); end if;
  if not private.bc_treatment_can_execute_version(t.procedure_version_id,t.profissional_user_id) then reasons:=array_append(reasons,'profissional_nao_autorizada'); end if;
  if not private.bc_treatment_consent_satisfied(t.id) then reasons:=array_append(reasons,'consentimento_pendente'); end if;
  if not private.bc_treatment_specific_complete(t.id) then reasons:=array_append(reasons,'modulo_especifico_incompleto'); end if;
  return reasons;
end;$$;
revoke all on function private.bc_treatment_gate(uuid) from public,anon,authenticated;
