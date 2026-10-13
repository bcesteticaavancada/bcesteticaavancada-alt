-- BC Gestão Fase 6C — consentimentos clínicos versionados por procedimento.
-- Camada aditiva: preserva a Anamnese Geral 6B e reutiliza clinical_documents/clinical_signatures.

create table if not exists public.consent_template_versions (
  id uuid primary key default gen_random_uuid(),
  consent_class text not null check (consent_class in ('injetavel','nao_injetavel')),
  version integer not null check (version > 0),
  title text not null,
  body text not null,
  status text not null default 'published' check (status in ('published','retired')),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (consent_class, version)
);

create table if not exists public.procedure_consents (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  procedure_version_id uuid not null references public.procedure_versions(id) on delete restrict,
  consent_template_version_id uuid not null references public.consent_template_versions(id) on delete restrict,
  consent_class text not null check (consent_class in ('injetavel','nao_injetavel')),
  component_version_ids uuid[] not null default '{}'::uuid[],
  component_keys text[] not null default '{}'::text[],
  procedure_name_snapshot text not null,
  supplement_snapshot text,
  cycle_key text,
  profissional_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'aguardando_assinaturas' check (status in ('aguardando_assinaturas','finalizado')),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists procedure_consents_cliente_idx on public.procedure_consents(cliente_id, created_at desc);
create index if not exists procedure_consents_procedure_version_idx on public.procedure_consents(procedure_version_id);
create index if not exists procedure_consents_template_idx on public.procedure_consents(consent_template_version_id);
create index if not exists procedure_consents_profissional_idx on public.procedure_consents(profissional_user_id);
create unique index if not exists procedure_consents_noninjectable_cycle_uq
  on public.procedure_consents(
    cliente_id, procedure_version_id, consent_template_version_id, cycle_key,
    component_version_ids, component_keys
  )
  where consent_class='nao_injetavel' and cycle_key is not null;

alter table public.consent_template_versions enable row level security;
alter table public.procedure_consents enable row level security;

revoke all on public.consent_template_versions from anon, authenticated;
revoke all on public.procedure_consents from anon, authenticated;

alter table public.clinical_documents drop constraint if exists clinical_documents_document_type_check;
alter table public.clinical_documents add constraint clinical_documents_document_type_check
  check (document_type in ('anamnese_geral','consentimento_procedimento'));

insert into public.consent_template_versions(consent_class,version,title,body,status)
values
('nao_injetavel',1,'Termo de Consentimento Livre e Esclarecido — Procedimento Estético Não Injetável',
'Eu declaro que recebi explicações claras sobre o procedimento estético identificado neste documento, seu objetivo, natureza, etapas previstas e alternativas possíveis, inclusive a opção de não realizá-lo. Compreendo que respostas individuais variam e que o resultado não é garantido. Fui informada(o) de que podem ocorrer riscos e reações transitórias, como desconforto, sensibilidade, vermelhidão, edema ou alterações locais, além de eventos inesperados que podem exigir reavaliação profissional. Comprometo-me a informar alterações de saúde, medicamentos, alergias ou outras condições relevantes antes da sessão e a seguir as orientações pré e pós-procedimento fornecidas pela profissional. Quando houver produto ou equipamento associado, compreendo que deve ser utilizado produto regularizado e equipamento aplicável conforme instruções, avaliação individual e plano profissional. Sei que qualquer intercorrência deve ser comunicada à BC Estética Avançada e que pode haver necessidade de suspensão, reavaliação ou encaminhamento. Tive oportunidade de fazer perguntas, compreendi as informações apresentadas e consinto voluntariamente com a realização do procedimento descrito, podendo retirar meu consentimento antes do início da sessão.',
'published'),
('injetavel',1,'Termo de Consentimento Livre e Esclarecido — Procedimento Estético Injetável ou Invasivo',
'Eu declaro que recebi explicações claras sobre o procedimento estético injetável ou invasivo identificado neste documento, seu objetivo, natureza, áreas planejadas e alternativas possíveis, inclusive a opção de não realizá-lo. Compreendo que respostas individuais variam e que o resultado não é garantido. Fui informada(o) sobre riscos e reações possíveis relacionados à técnica e à via de aplicação, incluindo dor, sensibilidade, hematoma, edema, assimetria ou alterações transitórias, infecção, reações inflamatórias ou alérgicas, nódulos e outros eventos inesperados que podem exigir avaliação ou atendimento adicional. Comprometo-me a informar alterações de saúde, medicamentos, alergias e antecedentes relevantes antes da sessão e a seguir integralmente as orientações pré e pós-procedimento. Quando houver produto, compreendo que será utilizado produto regularizado, selecionado pela profissional responsável conforme indicação, instruções aplicáveis e planejamento individual; lote, validade e demais dados técnicos serão registrados quando o módulo correspondente estiver disponível. Reconheço que intercorrências podem demandar interrupção, reavaliação, medidas adicionais ou encaminhamento. Tive oportunidade de fazer perguntas, compreendi as informações apresentadas e consinto voluntariamente com a realização do procedimento descrito, podendo retirar meu consentimento antes do início da sessão.',
'published')
on conflict (consent_class,version) do nothing;

create or replace function private.bc_consent_template_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status='published' then
    raise exception 'Template publicado é imutável; publique uma nova versão.' using errcode='55000';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.bc_consent_template_immutable() from public;

drop trigger if exists consent_template_versions_immutable on public.consent_template_versions;
create trigger consent_template_versions_immutable
before update or delete on public.consent_template_versions
for each row execute function private.bc_consent_template_immutable();

create policy consent_template_versions_staff_read on public.consent_template_versions
for select to authenticated using (private.is_bc_active_staff());
create policy procedure_consents_staff_read on public.procedure_consents
for select to authenticated using (private.is_bc_active_staff());

create or replace function private.bc_treatment_prepare_consent_impl(
  p_cliente_id uuid,
  p_procedure_version_id uuid,
  p_component_version_ids uuid[] default '{}'::uuid[],
  p_component_keys text[] default '{}'::text[],
  p_cycle_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','public','auth','private'
as $$
declare
  v_user uuid := auth.uid();
  v_staff public.staff_profiles%rowtype;
  v_proc public.procedure_versions%rowtype;
  v_template public.consent_template_versions%rowtype;
  v_class text;
  v_component_ids uuid[] := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_component_version_ids,'{}'::uuid[])) x),'{}'::uuid[]);
  v_component_keys text[] := coalesce((select array_agg(distinct trim(x) order by trim(x)) from unnest(coalesce(p_component_keys,'{}'::text[])) x where nullif(trim(x),'') is not null),'{}'::text[]);
  v_option jsonb;
  v_key text;
  v_document_id uuid;
  v_consent_id uuid;
  v_existing public.procedure_consents%rowtype;
  v_code text;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select * into v_staff from public.staff_profiles
   where user_id=v_user and active and atende_clientes;
  if not found or nullif(trim(v_staff.profissao),'') is null
     or nullif(trim(v_staff.conselho),'') is null
     or nullif(trim(v_staff.registro_conselho),'') is null then
    raise exception 'Identidade profissional incompleta.' using errcode='22023';
  end if;

  if not exists(select 1 from public.clientes where id=p_cliente_id and ativo=true) then
    raise exception 'Cliente ativa não encontrada.' using errcode='P0002';
  end if;

  select * into v_proc from public.procedure_versions
   where id=p_procedure_version_id and status='published';
  if not found then
    raise exception 'Versão publicada do procedimento não encontrada.' using errcode='P0002';
  end if;

  if v_proc.protocol_mode='compound' and cardinality(v_component_ids)=0 and cardinality(v_component_keys)=0 then
    raise exception 'Protocolo composto exige componentes reais da sessão.' using errcode='22023';
  end if;

  if exists(
    select 1 from unnest(v_component_ids) supplied(id)
    where not exists(
      select 1 from public.procedure_version_components pvc
      join public.procedure_versions cv on cv.id=pvc.component_version_id and cv.status='published'
      where pvc.parent_version_id=p_procedure_version_id and pvc.component_version_id=supplied.id
    )
  ) then
    raise exception 'Componente publicado inválido para este protocolo.' using errcode='22023';
  end if;

  foreach v_key in array v_component_keys loop
    select opt into v_option
      from jsonb_array_elements(coalesce(v_proc.specific_schema->'component_options','[]'::jsonb)) opt
     where trim(opt->>'key')=v_key
     limit 1;
    if v_option is null then
      raise exception 'Componente dinâmico inválido para este protocolo.' using errcode='22023';
    end if;
  end loop;

  v_class := v_proc.classe_documental;
  if v_class <> 'injetavel' and exists(
    select 1 from public.procedure_version_components pvc
    join public.procedure_versions cv on cv.id=pvc.component_version_id
    where pvc.parent_version_id=p_procedure_version_id
      and cv.id=any(v_component_ids)
      and cv.classe_documental='injetavel'
  ) then
    v_class := 'injetavel';
  end if;
  if v_class <> 'injetavel' and exists(
    select 1
    from jsonb_array_elements(coalesce(v_proc.specific_schema->'component_options','[]'::jsonb)) opt
    where trim(opt->>'key')=any(v_component_keys)
      and lower(trim(opt->>'classe_documental'))='injetavel'
  ) then
    v_class := 'injetavel';
  end if;

  select * into v_template from public.consent_template_versions
   where consent_class=v_class and status='published'
   order by version desc limit 1;
  if not found then
    raise exception 'Template de consentimento não encontrado.' using errcode='P0002';
  end if;

  if v_class='nao_injetavel' and nullif(trim(p_cycle_key),'') is not null then
    select * into v_existing from public.procedure_consents pc
     where pc.cliente_id=p_cliente_id
       and pc.procedure_version_id = p_procedure_version_id
       and pc.consent_template_version_id = v_template.id
       and pc.cycle_key = nullif(trim(p_cycle_key),'')
       and pc.component_version_ids=v_component_ids
       and pc.component_keys=v_component_keys
       and pc.status='finalizado'
     order by pc.finalized_at desc limit 1;
    if found then
      select id into v_document_id from public.clinical_documents
       where document_type='consentimento_procedimento' and source_id=v_existing.id
       order by document_version desc limit 1;
      if v_document_id is not null then
        return jsonb_build_object('document_id',v_document_id,'consent_id',v_existing.id,'reused',true,
          'consent_class',v_existing.consent_class,'template_version',v_template.version,
          'title',v_template.title,'body',v_template.body,'procedure_name',v_existing.procedure_name_snapshot,
          'supplement',v_existing.supplement_snapshot);
      end if;
    end if;
  end if;

  insert into public.procedure_consents(
    cliente_id,procedure_version_id,consent_template_version_id,consent_class,
    component_version_ids,component_keys,procedure_name_snapshot,supplement_snapshot,
    cycle_key,profissional_user_id
  ) values (
    p_cliente_id,p_procedure_version_id,v_template.id,v_class,
    v_component_ids,v_component_keys,v_proc.nome,nullif(trim(v_proc.consent_supplement),''),
    nullif(trim(p_cycle_key),''),v_user
  ) returning id into v_consent_id;

  v_code := 'BC-TCLE-' || to_char((now() at time zone 'America/Sao_Paulo')::date,'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into public.clinical_documents(
    cliente_id,document_type,source_id,source_version,document_version,document_code,status,
    profissional_user_id,profissional_nome_snapshot,profissao_snapshot,conselho_snapshot,registro_snapshot
  ) values (
    p_cliente_id,'consentimento_procedimento',v_consent_id,1,1,v_code,'aguardando_assinaturas',
    v_user,v_staff.display_name,v_staff.profissao,v_staff.conselho,v_staff.registro_conselho
  ) returning id into v_document_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_consent_prepared','procedure_consents',v_consent_id,
    jsonb_build_object('document_id',v_document_id,'procedure_version_id',p_procedure_version_id,
      'consent_class',v_class,'template_version',v_template.version));

  return jsonb_build_object('document_id',v_document_id,'consent_id',v_consent_id,'reused',false,
    'consent_class',v_class,'template_version',v_template.version,'title',v_template.title,'body',v_template.body,
    'procedure_name',v_proc.nome,'supplement',nullif(trim(v_proc.consent_supplement),''));
exception when unique_violation then
  if v_class='nao_injetavel' and nullif(trim(p_cycle_key),'') is not null then
    select * into v_existing from public.procedure_consents pc
     where pc.cliente_id=p_cliente_id
       and pc.procedure_version_id = p_procedure_version_id
       and pc.consent_template_version_id = v_template.id
       and pc.cycle_key = nullif(trim(p_cycle_key),'')
       and pc.component_version_ids=v_component_ids and pc.component_keys=v_component_keys
     order by pc.created_at desc limit 1;
    select id into v_document_id from public.clinical_documents
     where document_type='consentimento_procedimento' and source_id=v_existing.id
     order by document_version desc limit 1;
    return jsonb_build_object('document_id',v_document_id,'consent_id',v_existing.id,
      'reused',v_existing.status='finalizado','consent_class',v_existing.consent_class,
      'template_version',v_template.version,'title',v_template.title,'body',v_template.body,
      'procedure_name',v_existing.procedure_name_snapshot,'supplement',v_existing.supplement_snapshot);
  end if;
  raise;
end;
$$;
revoke all on function private.bc_treatment_prepare_consent_impl(uuid,uuid,uuid[],text[],text) from public;
revoke execute on function private.bc_treatment_prepare_consent_impl(uuid,uuid,uuid[],text[],text) from anon;

create or replace function private.bc_treatment_consent_finalize_impl(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog','public','auth','private'
as $$
declare
  v_user uuid := auth.uid();
  v_doc public.clinical_documents%rowtype;
  v_consent public.procedure_consents%rowtype;
  v_client public.clientes%rowtype;
  v_expected_kind text;
  v_now timestamptz := now();
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select * into v_doc from public.clinical_documents
   where id=p_document_id and document_type='consentimento_procedimento' for update;
  if not found or v_doc.status <> 'aguardando_assinaturas' then
    raise exception 'Consentimento não está aguardando assinaturas.' using errcode='55000';
  end if;
  if v_doc.profissional_user_id <> v_user then
    raise exception 'Somente a profissional responsável pode finalizar.' using errcode='42501';
  end if;

  select * into v_consent from public.procedure_consents
   where id=v_doc.source_id for update;
  if not found or v_consent.status <> 'aguardando_assinaturas' then
    raise exception 'Consentimento clínico não está aguardando assinaturas.' using errcode='55000';
  end if;

  select * into v_client from public.clientes where id=v_doc.cliente_id;
  if not found then raise exception 'Cliente não encontrada.' using errcode='P0002'; end if;
  v_expected_kind := case
    when v_client.data_nascimento > (((now() at time zone 'America/Sao_Paulo')::date) - interval '18 years')::date
    then 'responsavel' else 'paciente' end;

  if not exists(select 1 from public.clinical_signatures where document_id=p_document_id and signer_kind=v_expected_kind)
     or not exists(select 1 from public.clinical_signatures where document_id=p_document_id and signer_kind='profissional') then
    raise exception 'Assinaturas obrigatórias ainda não foram registradas.' using errcode='22023';
  end if;

  update public.procedure_consents
     set status='finalizado',finalized_at=v_now,updated_at=v_now
   where id=v_consent.id;
  update public.clinical_documents
     set status='pronto_para_pdf'
   where id=p_document_id and document_type='consentimento_procedimento';

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_consent_finalized','procedure_consents',v_consent.id,
    jsonb_build_object('document_id',p_document_id,'consent_class',v_consent.consent_class));
  return p_document_id;
end;
$$;
revoke all on function private.bc_treatment_consent_finalize_impl(uuid) from public;
revoke execute on function private.bc_treatment_consent_finalize_impl(uuid) from anon;

create or replace function public.bc_treatment_prepare_consent(
  p_cliente_id uuid,
  p_procedure_version_id uuid,
  p_component_version_ids uuid[] default '{}'::uuid[],
  p_component_keys text[] default '{}'::text[],
  p_cycle_key text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.bc_treatment_prepare_consent_impl($1,$2,$3,$4,$5);
$$;
revoke all on function public.bc_treatment_prepare_consent(uuid,uuid,uuid[],text[],text) from public;
revoke execute on function public.bc_treatment_prepare_consent(uuid,uuid,uuid[],text[],text) from anon;
grant execute on function public.bc_treatment_prepare_consent(uuid,uuid,uuid[],text[],text) to authenticated;

create or replace function public.bc_treatment_consent_finalize(p_document_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.bc_treatment_consent_finalize_impl($1);
$$;
revoke all on function public.bc_treatment_consent_finalize(uuid) from public;
revoke execute on function public.bc_treatment_consent_finalize(uuid) from anon;
grant execute on function public.bc_treatment_consent_finalize(uuid) to authenticated;