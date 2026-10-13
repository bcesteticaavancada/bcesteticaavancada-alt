-- BC Gestão Fase 6C — prontuário formal por sessão, gates e correções versionadas.
-- Não antecipa fotos/produtos/equipamentos da 6D nem escreve financeiro da 6E.

-- Acesso clínico é governança operacional do procedimento estável, não conteúdo histórico da versão publicada.
alter table public.procedimentos add column if not exists access_mode text not null default 'general';
alter table public.procedimentos drop constraint if exists procedimentos_access_mode_check;
alter table public.procedimentos add constraint procedimentos_access_mode_check check (access_mode in ('general','restricted'));
update public.procedimentos set access_mode='restricted'
 where lower(nome) in (lower('Botox terço superior'),lower('Botox full face'),lower('Botox Nefertiti'));

-- Corrige publicação de protocolos compostos dinâmicos: relação publicada OU opções de sessão.
create or replace function private.bc_procedure_publish_impl(p_procedure_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_draft public.procedure_versions%rowtype; v_old_current uuid;
begin
  if v_user is null or not private.bc_can_manage_procedures() then raise exception 'Sem permissão para publicar procedimentos.' using errcode='42501'; end if;
  select current_version_id into v_old_current from public.procedimentos where id=p_procedure_id for update;
  if not found then raise exception 'Procedimento não encontrado.' using errcode='P0002'; end if;
  select * into v_draft from public.procedure_versions where procedimento_id=p_procedure_id and status='draft' for update;
  if not found then raise exception 'Nenhuma versão em rascunho.' using errcode='55000'; end if;
  if v_draft.protocol_mode='compound'
     and not exists(select 1 from public.procedure_version_components where parent_version_id=v_draft.id)
     and not (jsonb_typeof(coalesce(v_draft.specific_schema->'component_options','[]'::jsonb))='array'
              and jsonb_array_length(coalesce(v_draft.specific_schema->'component_options','[]'::jsonb))>0)
  then raise exception 'Protocolo composto exige componentes publicados ou opções de sessão.' using errcode='22023'; end if;
  if v_old_current is not null then update public.procedure_versions set status='superseded',updated_at=now() where id=v_old_current and status='published'; end if;
  update public.procedure_versions set status='published',published_by=v_user,published_at=now(),updated_at=now() where id=v_draft.id;
  update public.procedimentos set nome=v_draft.nome,ativo=true,duracao_padrao=v_draft.suggested_duration,current_version_id=v_draft.id,archived_at=null,updated_at=now() where id=p_procedure_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_published','procedimentos',p_procedure_id,jsonb_build_object('version_id',v_draft.id,'version',v_draft.version));
  return v_draft.id;
end;$$;
revoke all on function private.bc_procedure_publish_impl(uuid) from public;
revoke execute on function private.bc_procedure_publish_impl(uuid) from anon;
grant execute on function private.bc_procedure_publish_impl(uuid) to authenticated;

-- Leitura da Biblioteca passa a refletir acesso geral/restrito sem confundir com capacidade editorial.
create or replace function private.bc_procedure_get_impl(p_procedure_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if;
 select jsonb_build_object(
   'id',p.id,'nome',p.nome,'ativo',p.ativo,'duracao_padrao',p.duracao_padrao,'current_version_id',p.current_version_id,
   'archived_at',p.archived_at,'access_mode',p.access_mode,
   'current_version',case when current_v.id is null then null else to_jsonb(current_v) end,
   'draft_version',case when private.bc_can_manage_procedures() and draft_v.id is not null then to_jsonb(draft_v) else null end,
   'components',coalesce((select jsonb_agg(jsonb_build_object('component_version_id',c.component_version_id,'required',c.required,'sort_order',c.sort_order) order by c.sort_order,c.component_version_id) from public.procedure_version_components c where c.parent_version_id=coalesce(draft_v.id,current_v.id)),'[]'::jsonb),
   'execution_permissions',case when private.is_bc_admin() then coalesce((select jsonb_agg(jsonb_build_object('professional_user_id',perm.professional_user_id,'allowed',perm.allowed,'granted_at',perm.granted_at,'revoked_at',perm.revoked_at)) from public.procedure_professional_permissions perm where perm.procedimento_id=p.id),'[]'::jsonb) else '[]'::jsonb end,
   'can_execute',exists(select 1 from public.staff_profiles sp where sp.user_id=v_user and sp.active and sp.atende_clientes)
      and (p.access_mode='general' or (p.access_mode='restricted' and coalesce(my_perm.allowed,false) and my_perm.revoked_at is null)),
   'can_manage',private.bc_can_manage_procedures()
 ) into v_result
 from public.procedimentos p
 left join public.procedure_versions current_v on current_v.id=p.current_version_id
 left join public.procedure_versions draft_v on draft_v.procedimento_id=p.id and draft_v.status='draft'
 left join public.procedure_professional_permissions my_perm on my_perm.procedimento_id=p.id and my_perm.professional_user_id=v_user
 where p.id=p_procedure_id;
 if v_result is null then raise exception 'Procedimento não encontrado.' using errcode='P0002'; end if;
 return v_result;
end;$$;
revoke all on function private.bc_procedure_get_impl(uuid) from public;
grant execute on function private.bc_procedure_get_impl(uuid) to authenticated;

create table if not exists public.clinical_treatments (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  procedimento_id uuid not null references public.procedimentos(id) on delete restrict,
  procedure_version_id uuid not null references public.procedure_versions(id) on delete restrict,
  profissional_user_id uuid not null references auth.users(id) on delete restrict,
  agendamento_id uuid references public.agendamentos(id) on delete restrict,
  status text not null default 'rascunho' check (status in ('rascunho','pronto_para_iniciar','em_atendimento','finalizado')),
  treatment_date date not null,
  price_mode_snapshot text not null check (price_mode_snapshot in ('fixed','starting_at')),
  base_price_snapshot numeric(12,2) not null check (base_price_snapshot>0),
  final_price numeric(12,2) check (final_price is null or final_price>0),
  queixa_dia text,
  objetivo text,
  avaliacao_profissional text,
  regiao text,
  specific_data jsonb not null default '{}'::jsonb,
  technical_data jsonb not null default '{}'::jsonb,
  resposta_imediata text,
  intercorrencias_ato text,
  orientacoes text,
  retorno text,
  evolucao text,
  feedback text,
  observacoes text,
  cycle_key text,
  anamnese_id uuid references public.anamneses_gerais(id) on delete restrict,
  consent_document_id uuid references public.clinical_documents(id) on delete restrict,
  current_version_id uuid,
  pending_version_id uuid,
  pending_document_id uuid references public.clinical_documents(id) on delete restrict,
  correction_mode text check (correction_mode is null or correction_mode in ('same_day','reopened')),
  correction_reason text,
  started_at timestamptz,
  finalized_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clinical_treatments_agendamento_uq on public.clinical_treatments(agendamento_id) where agendamento_id is not null;
create index if not exists clinical_treatments_cliente_idx on public.clinical_treatments(cliente_id,treatment_date desc,created_at desc);
create index if not exists clinical_treatments_profissional_idx on public.clinical_treatments(profissional_user_id,treatment_date desc);
create index if not exists clinical_treatments_procedure_version_idx on public.clinical_treatments(procedure_version_id);

create table if not exists public.clinical_treatment_components (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.clinical_treatments(id) on delete cascade,
  component_version_id uuid references public.procedure_versions(id) on delete restrict,
  component_key text,
  component_name_snapshot text not null,
  classe_documental_snapshot text not null check (classe_documental_snapshot in ('injetavel','nao_injetavel')),
  created_at timestamptz not null default now(),
  check ((component_version_id is not null) <> (component_key is not null))
);
create unique index if not exists clinical_treatment_component_version_uq on public.clinical_treatment_components(treatment_id,component_version_id) where component_version_id is not null;
create unique index if not exists clinical_treatment_component_key_uq on public.clinical_treatment_components(treatment_id,component_key) where component_key is not null;

create table if not exists public.clinical_treatment_health_confirmations (
  id uuid primary key default gen_random_uuid(), treatment_id uuid not null references public.clinical_treatments(id) on delete cascade,
  changed boolean not null, details text, confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(), check (not changed or nullif(trim(details),'') is not null)
);
create index if not exists clinical_treatment_health_treatment_idx on public.clinical_treatment_health_confirmations(treatment_id,confirmed_at desc);

create table if not exists public.clinical_treatment_alert_reviews (
  id uuid primary key default gen_random_uuid(), treatment_id uuid not null references public.clinical_treatments(id) on delete cascade,
  alert_ids uuid[] not null default '{}'::uuid[], alert_snapshot jsonb not null default '[]'::jsonb,
  reviewed_by uuid not null references auth.users(id) on delete restrict, reviewed_at timestamptz not null default now()
);
create index if not exists clinical_treatment_alert_reviews_idx on public.clinical_treatment_alert_reviews(treatment_id,reviewed_at desc);

create table if not exists public.clinical_treatment_versions (
  id uuid primary key default gen_random_uuid(), treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  version integer not null check(version>0), prior_version_id uuid references public.clinical_treatment_versions(id) on delete restrict,
  correction_mode text not null default 'initial' check(correction_mode in ('initial','same_day','reopened')),
  snapshot jsonb not null, document_id uuid references public.clinical_documents(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), unique(treatment_id,version)
);
create index if not exists clinical_treatment_versions_treatment_idx on public.clinical_treatment_versions(treatment_id,version desc);

create table if not exists public.clinical_treatment_reopen_grants (
  id uuid primary key default gen_random_uuid(), treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete restrict, granted_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check(nullif(trim(reason),'') is not null), expires_at timestamptz not null, used_at timestamptz,
  created_at timestamptz not null default now(), check(expires_at>created_at)
);
create index if not exists clinical_treatment_reopen_grants_idx on public.clinical_treatment_reopen_grants(treatment_id,expires_at desc);

alter table public.clinical_treatments
  add constraint clinical_treatments_current_version_fk foreign key(current_version_id) references public.clinical_treatment_versions(id) on delete restrict,
  add constraint clinical_treatments_pending_version_fk foreign key(pending_version_id) references public.clinical_treatment_versions(id) on delete restrict;

alter table public.clinical_documents drop constraint if exists clinical_documents_document_type_check;
alter table public.clinical_documents add constraint clinical_documents_document_type_check
  check(document_type in ('anamnese_geral','consentimento_procedimento','treatment_record'));

alter table public.clinical_treatments enable row level security;
alter table public.clinical_treatment_components enable row level security;
alter table public.clinical_treatment_health_confirmations enable row level security;
alter table public.clinical_treatment_alert_reviews enable row level security;
alter table public.clinical_treatment_versions enable row level security;
alter table public.clinical_treatment_reopen_grants enable row level security;
revoke all on public.clinical_treatments from anon,authenticated;
revoke all on public.clinical_treatment_components from anon,authenticated;
revoke all on public.clinical_treatment_health_confirmations from anon,authenticated;
revoke all on public.clinical_treatment_alert_reviews from anon,authenticated;
revoke all on public.clinical_treatment_versions from anon,authenticated;
revoke all on public.clinical_treatment_reopen_grants from anon,authenticated;
create policy clinical_treatments_staff_read on public.clinical_treatments for select to authenticated using(private.is_bc_active_staff());
create policy clinical_treatment_components_staff_read on public.clinical_treatment_components for select to authenticated using(private.is_bc_active_staff());
create policy clinical_treatment_health_staff_read on public.clinical_treatment_health_confirmations for select to authenticated using(private.is_bc_active_staff());
create policy clinical_treatment_alert_reviews_staff_read on public.clinical_treatment_alert_reviews for select to authenticated using(private.is_bc_active_staff());
create policy clinical_treatment_versions_staff_read on public.clinical_treatment_versions for select to authenticated using(private.is_bc_active_staff());
create policy clinical_treatment_reopen_staff_read on public.clinical_treatment_reopen_grants for select to authenticated using(private.is_bc_active_staff());

create or replace function private.bc_treatment_version_immutable()
returns trigger language plpgsql set search_path=''
as $$begin
 if tg_op='DELETE' then raise exception 'Versão final de atendimento é imutável.' using errcode='55000'; end if;
 if old.document_id is null and new.document_id is not null and (to_jsonb(new)-'document_id')=(to_jsonb(old)-'document_id') then return new; end if;
 raise exception 'Versão final de atendimento é imutável.' using errcode='55000';
end;$$;
revoke all on function private.bc_treatment_version_immutable() from public;
drop trigger if exists clinical_treatment_versions_immutable on public.clinical_treatment_versions;
create trigger clinical_treatment_versions_immutable before update or delete on public.clinical_treatment_versions for each row execute function private.bc_treatment_version_immutable();

create or replace function private.bc_treatment_can_execute_version(p_version_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.staff_profiles s where s.user_id=p_user_id and s.active and s.atende_clientes)
 and exists(select 1 from public.procedure_versions v join public.procedimentos p on p.id=v.procedimento_id
   where v.id=p_version_id and v.status in ('published','superseded') and (p.access_mode='general' or (p.access_mode='restricted' and exists(select 1 from public.procedure_professional_permissions pp where pp.procedimento_id=p.id and pp.professional_user_id=p_user_id and pp.allowed=true and pp.revoked_at is null))));$$;
revoke all on function private.bc_treatment_can_execute_version(uuid,uuid) from public;

create or replace function private.bc_treatment_expected_consent_class(p_treatment_id uuid)
returns text language plpgsql stable security definer set search_path=''
as $$declare v_class text; begin
 select pv.classe_documental into v_class from public.clinical_treatments t join public.procedure_versions pv on pv.id=t.procedure_version_id where t.id=p_treatment_id;
 if v_class is null then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
 if v_class<>'injetavel' and exists(select 1 from public.clinical_treatment_components c where c.treatment_id=p_treatment_id and c.classe_documental_snapshot='injetavel') then v_class:='injetavel'; end if;
 return v_class; end;$$;
revoke all on function private.bc_treatment_expected_consent_class(uuid) from public;

create or replace function private.bc_treatment_specific_complete(p_treatment_id uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_schema jsonb; f jsonb; k text; v jsonb; begin
 select * into t from public.clinical_treatments where id=p_treatment_id; if not found then return false; end if;
 select specific_schema into v_schema from public.procedure_versions where id=t.procedure_version_id;
 for f in select value from jsonb_array_elements(coalesce(v_schema->'fields','[]'::jsonb)) loop
  if coalesce((f->>'required')::boolean,false) then k:=f->>'key';
   if k='objetivo_sessao' then if nullif(trim(t.objetivo),'') is null then return false; end if;
   elsif k='area_regiao' then if nullif(trim(t.regiao),'') is null then return false; end if;
   elsif k='componentes_sessao' then if not exists(select 1 from public.clinical_treatment_components where treatment_id=t.id) then return false; end if;
   else v:=t.specific_data->k; if v is null or v='null'::jsonb or (jsonb_typeof(v)='string' and nullif(trim(v#>>'{}'),'') is null) or (jsonb_typeof(v)='array' and jsonb_array_length(v)=0) then return false; end if; end if;
  end if;
 end loop; return true; end;$$;
revoke all on function private.bc_treatment_specific_complete(uuid) from public;

create or replace function private.bc_treatment_gate(p_treatment_id uuid)
returns text[] language plpgsql stable security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; pv public.procedure_versions%rowtype; reasons text[]:='{}'::text[]; v_review public.clinical_treatment_alert_reviews%rowtype; current_alerts uuid[]; comp_ids uuid[]; comp_keys text[]; pc public.procedure_consents%rowtype; d public.clinical_documents%rowtype; begin
 select * into t from public.clinical_treatments where id=p_treatment_id; if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
 select * into pv from public.procedure_versions where id=t.procedure_version_id;
 if pv.requires_general_anamnesis and not exists(select 1 from public.anamneses_gerais a where a.cliente_id=t.cliente_id and a.status='finalizada' and a.valid_until>=now()) then reasons:=array_append(reasons,'anamnese_invalida'); end if;
 if not exists(select 1 from public.clinical_treatment_health_confirmations h where h.treatment_id=t.id) then reasons:=array_append(reasons,'saude_nao_confirmada'); end if;
 select * into v_review from public.clinical_treatment_alert_reviews r where r.treatment_id=t.id order by r.reviewed_at desc limit 1;
 select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]) into current_alerts from public.clinical_alerts a where a.cliente_id=t.cliente_id and a.active=true;
 if v_review.id is null or coalesce(v_review.alert_ids,'{}'::uuid[])<>current_alerts then reasons:=array_append(reasons,'alertas_nao_revisados'); end if;
 if not private.bc_treatment_can_execute_version(t.procedure_version_id,t.profissional_user_id) then reasons:=array_append(reasons,'profissional_nao_autorizada'); end if;
 select coalesce(array_agg(c.component_version_id order by c.component_version_id) filter(where c.component_version_id is not null),'{}'::uuid[]),coalesce(array_agg(c.component_key order by c.component_key) filter(where c.component_key is not null),'{}'::text[]) into comp_ids,comp_keys from public.clinical_treatment_components c where c.treatment_id=t.id;
 if t.consent_document_id is null then reasons:=array_append(reasons,'consentimento_pendente'); else
  select * into d from public.clinical_documents where id=t.consent_document_id and document_type='consentimento_procedimento';
  if d.id is null then reasons:=array_append(reasons,'consentimento_pendente'); else select * into pc from public.procedure_consents where id=d.source_id;
   if pc.id is null or pc.status<>'finalizado' or pc.procedure_version_id<>t.procedure_version_id or pc.consent_class<>private.bc_treatment_expected_consent_class(t.id) or pc.component_version_ids<>comp_ids or pc.component_keys<>comp_keys then reasons:=array_append(reasons,'consentimento_pendente'); end if; end if;
 end if;
 if not private.bc_treatment_specific_complete(t.id) then reasons:=array_append(reasons,'modulo_especifico_incompleto'); end if;
 return reasons; end;$$;
revoke all on function private.bc_treatment_gate(uuid) from public;

create or replace function private.bc_treatment_apply_patch(p_treatment_id uuid,p_patch jsonb)
returns void language plpgsql security definer set search_path=''
as $$declare v_price numeric; begin
 if jsonb_typeof(coalesce(p_patch,'{}'::jsonb))<>'object' then raise exception 'Patch inválido.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb)) as k where k not in ('queixa_dia','objetivo','avaliacao_profissional','regiao','specific_data','technical_data','resposta_imediata','intercorrencias_ato','orientacoes','retorno','evolucao','feedback','observacoes','final_price','cycle_key')) then raise exception 'Campo de atendimento não permitido.' using errcode='22023'; end if;
 if p_patch?'final_price' then begin v_price:=nullif(trim(p_patch->>'final_price'),'')::numeric; exception when others then raise exception 'Preço final inválido.' using errcode='22023'; end; if v_price is not null and v_price<=0 then raise exception 'Preço final inválido.' using errcode='22023'; end if; end if;
 if p_patch?'specific_data' and jsonb_typeof(coalesce(p_patch->'specific_data','{}'::jsonb))<>'object' then raise exception 'Módulo específico inválido.' using errcode='22023'; end if;
 if p_patch?'technical_data' and jsonb_typeof(coalesce(p_patch->'technical_data','{}'::jsonb))<>'object' then raise exception 'Dados técnicos inválidos.' using errcode='22023'; end if;
 update public.clinical_treatments set
  queixa_dia=case when p_patch?'queixa_dia' then nullif(trim(p_patch->>'queixa_dia'),'') else queixa_dia end,
  objetivo=case when p_patch?'objetivo' then nullif(trim(p_patch->>'objetivo'),'') else objetivo end,
  avaliacao_profissional=case when p_patch?'avaliacao_profissional' then nullif(trim(p_patch->>'avaliacao_profissional'),'') else avaliacao_profissional end,
  regiao=case when p_patch?'regiao' then nullif(trim(p_patch->>'regiao'),'') else regiao end,
  specific_data=case when p_patch?'specific_data' then coalesce(p_patch->'specific_data','{}'::jsonb) else specific_data end,
  technical_data=case when p_patch?'technical_data' then coalesce(p_patch->'technical_data','{}'::jsonb) else technical_data end,
  resposta_imediata=case when p_patch?'resposta_imediata' then nullif(trim(p_patch->>'resposta_imediata'),'') else resposta_imediata end,
  intercorrencias_ato=case when p_patch?'intercorrencias_ato' then nullif(trim(p_patch->>'intercorrencias_ato'),'') else intercorrencias_ato end,
  orientacoes=case when p_patch?'orientacoes' then nullif(trim(p_patch->>'orientacoes'),'') else orientacoes end,
  retorno=case when p_patch?'retorno' then nullif(trim(p_patch->>'retorno'),'') else retorno end,
  evolucao=case when p_patch?'evolucao' then nullif(trim(p_patch->>'evolucao'),'') else evolucao end,
  feedback=case when p_patch?'feedback' then nullif(trim(p_patch->>'feedback'),'') else feedback end,
  observacoes=case when p_patch?'observacoes' then nullif(trim(p_patch->>'observacoes'),'') else observacoes end,
  final_price=case when p_patch?'final_price' then v_price else final_price end,
  cycle_key=case when p_patch?'cycle_key' then nullif(trim(p_patch->>'cycle_key'),'') else cycle_key end, updated_at=now()
 where id=p_treatment_id; end;$$;
revoke all on function private.bc_treatment_apply_patch(uuid,jsonb) from public;

create or replace function private.bc_treatment_create_impl(p_cliente_id uuid,p_procedure_id uuid,p_agendamento_id uuid,p_component_version_ids uuid[],p_component_keys text[])
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); p public.procedimentos%rowtype; pv public.procedure_versions%rowtype; a public.agendamentos%rowtype; v_id uuid; v_date date; ids uuid[]:=coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_component_version_ids,'{}'::uuid[])) x),'{}'::uuid[]); keys text[]:=coalesce((select array_agg(distinct trim(x) order by trim(x)) from unnest(coalesce(p_component_keys,'{}'::text[])) x where nullif(trim(x),'') is not null),'{}'::text[]); x uuid; k text; cv public.procedure_versions%rowtype; opt jsonb; begin
 if v_user is null or not exists(select 1 from public.staff_profiles where user_id=v_user and active and atende_clientes) then raise exception 'Profissional ativa não encontrada.' using errcode='42501'; end if;
 if not exists(select 1 from public.clientes where id=p_cliente_id and ativo=true) then raise exception 'Cliente ativa não encontrada.' using errcode='P0002'; end if;
 select * into p from public.procedimentos where id=p_procedure_id; if not found or p.current_version_id is null then raise exception 'Procedimento publicado não encontrado.' using errcode='P0002'; end if;
 select * into pv from public.procedure_versions where id=p.current_version_id and status='published'; if not found then raise exception 'Versão publicada não encontrada.' using errcode='P0002'; end if;
 if not private.bc_treatment_can_execute_version(pv.id,v_user) then raise exception 'Profissional não autorizada para este procedimento.' using errcode='42501'; end if;
 if p_agendamento_id is not null then select * into a from public.agendamentos where id=p_agendamento_id; if not found then raise exception 'Agendamento não encontrado.' using errcode='P0002'; end if; select id into v_id from public.clinical_treatments where agendamento_id=p_agendamento_id; if v_id is not null then return v_id; end if; if a.cliente_id<>p_cliente_id or a.procedimento_id<>p_procedure_id or a.colaboradora_user_id<>v_user then raise exception 'Agendamento não corresponde à cliente, procedimento e profissional autenticada.' using errcode='42501'; end if; if a.status not in ('agendado','atendido') then raise exception 'Agendamento não pode iniciar atendimento clínico.' using errcode='55000'; end if; v_date:=(a.inicio at time zone 'America/Sao_Paulo')::date;
 else if not p.ativo or p.archived_at is not null then raise exception 'Procedimento inativo para atendimento direto.' using errcode='55000'; end if; v_date:=(now() at time zone 'America/Sao_Paulo')::date; end if;
 if pv.protocol_mode='compound' and cardinality(ids)=0 and cardinality(keys)=0 then raise exception 'Protocolo composto exige componentes reais da sessão.' using errcode='22023'; end if;
 if exists(select 1 from public.procedure_version_components req where req.parent_version_id=pv.id and req.required and not(req.component_version_id=any(ids))) then raise exception 'Componente obrigatório não selecionado.' using errcode='22023'; end if;
 insert into public.clinical_treatments(cliente_id,procedimento_id,procedure_version_id,profissional_user_id,agendamento_id,treatment_date,price_mode_snapshot,base_price_snapshot,final_price,created_by) values(p_cliente_id,p.id,pv.id,v_user,p_agendamento_id,v_date,pv.price_mode,pv.base_price,case when pv.price_mode='fixed' then pv.base_price else null end,v_user) returning id into v_id;
 foreach x in array ids loop if not exists(select 1 from public.procedure_version_components where parent_version_id=pv.id and component_version_id=x) then raise exception 'Componente publicado inválido para este protocolo.' using errcode='22023'; end if; select * into cv from public.procedure_versions where id=x and status='published'; if not found then raise exception 'Componente publicado não encontrado.' using errcode='22023'; end if; insert into public.clinical_treatment_components(treatment_id,component_version_id,component_name_snapshot,classe_documental_snapshot) values(v_id,x,cv.nome,cv.classe_documental); end loop;
 foreach k in array keys loop select o into opt from jsonb_array_elements(coalesce(pv.specific_schema->'component_options','[]'::jsonb)) o where trim(o->>'key')=k limit 1; if opt is null then raise exception 'Componente dinâmico inválido para este protocolo.' using errcode='22023'; end if; if lower(trim(opt->>'classe_documental')) not in ('injetavel','nao_injetavel') then raise exception 'Classe do componente dinâmico inválida.' using errcode='22023'; end if; insert into public.clinical_treatment_components(treatment_id,component_key,component_name_snapshot,classe_documental_snapshot) values(v_id,k,coalesce(nullif(trim(opt->>'label'),''),k),lower(trim(opt->>'classe_documental'))); end loop;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_created','clinical_treatments',v_id,jsonb_build_object('procedure_version_id',pv.id,'agendamento_id',p_agendamento_id)); return v_id; end;$$;
revoke all on function private.bc_treatment_create_impl(uuid,uuid,uuid,uuid[],text[]) from public; revoke execute on function private.bc_treatment_create_impl(uuid,uuid,uuid,uuid[],text[]) from anon; grant execute on function private.bc_treatment_create_impl(uuid,uuid,uuid,uuid[],text[]) to authenticated;

create or replace function private.bc_treatment_get_impl(p_treatment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare r jsonb; begin if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if; select to_jsonb(t)||jsonb_build_object('procedure_version',to_jsonb(pv),'access_mode',p.access_mode,'components',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.clinical_treatment_components c where c.treatment_id=t.id),'[]'::jsonb),'gate_reasons',private.bc_treatment_gate(t.id)) into r from public.clinical_treatments t join public.procedure_versions pv on pv.id=t.procedure_version_id join public.procedimentos p on p.id=t.procedimento_id where t.id=p_treatment_id; if r is null then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if; return r; end;$$;
revoke all on function private.bc_treatment_get_impl(uuid) from public; grant execute on function private.bc_treatment_get_impl(uuid) to authenticated;

create or replace function private.bc_treatment_list_client_impl(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$begin if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado.' using errcode='42501'; end if; return coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('procedure_name',pv.nome) order by t.treatment_date desc,t.created_at desc) from public.clinical_treatments t join public.procedure_versions pv on pv.id=t.procedure_version_id where t.cliente_id=p_cliente_id),'[]'::jsonb); end;$$;
revoke all on function private.bc_treatment_list_client_impl(uuid) from public; grant execute on function private.bc_treatment_list_client_impl(uuid) to authenticated;

create or replace function private.bc_treatment_update_draft_impl(p_treatment_id uuid,p_patch jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if; if v_user<>t.profissional_user_id then raise exception 'Somente a profissional do atendimento pode editar.' using errcode='42501'; end if; if t.status='finalizado' or t.pending_version_id is not null then raise exception 'Atendimento finalizado ou aguardando assinatura não pode ser editado por este fluxo.' using errcode='55000'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_draft_updated','clinical_treatments',t.id,jsonb_build_object('field_count',(select count(*) from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb))))); return t.id; end;$$;
revoke all on function private.bc_treatment_update_draft_impl(uuid,jsonb) from public; grant execute on function private.bc_treatment_update_draft_impl(uuid,jsonb) to authenticated;

create or replace function private.bc_treatment_confirm_health_impl(p_treatment_id uuid,p_changed boolean,p_details text)
returns uuid language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); v_id uuid; begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível para confirmação.' using errcode='42501'; end if; if t.status not in ('rascunho','pronto_para_iniciar') or t.pending_version_id is not null then raise exception 'Confirmação de saúde fora da etapa permitida.' using errcode='55000'; end if; if p_changed and nullif(trim(p_details),'') is null then raise exception 'Descreva a mudança de saúde informada.' using errcode='22023'; end if; insert into public.clinical_treatment_health_confirmations(treatment_id,changed,details,confirmed_by) values(t.id,p_changed,nullif(trim(p_details),''),v_user) returning id into v_id; if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; return v_id; end;$$;
revoke all on function private.bc_treatment_confirm_health_impl(uuid,boolean,text) from public; grant execute on function private.bc_treatment_confirm_health_impl(uuid,boolean,text) to authenticated;

create or replace function private.bc_treatment_confirm_alerts_impl(p_treatment_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); ids uuid[]; snap jsonb; v_id uuid; begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível para revisão.' using errcode='42501'; end if; if t.status not in ('rascunho','pronto_para_iniciar') or t.pending_version_id is not null then raise exception 'Revisão de alertas fora da etapa permitida.' using errcode='55000'; end if; select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]),coalesce(jsonb_agg(jsonb_build_object('id',a.id,'level',a.level,'origin_type',a.origin_type,'description',a.description,'created_at',a.created_at) order by a.id),'[]'::jsonb) into ids,snap from public.clinical_alerts a where a.cliente_id=t.cliente_id and a.active=true; insert into public.clinical_treatment_alert_reviews(treatment_id,alert_ids,alert_snapshot,reviewed_by) values(t.id,ids,snap,v_user) returning id into v_id; if t.status='pronto_para_iniciar' then update public.clinical_treatments set status='rascunho',updated_at=now() where id=t.id; end if; return v_id; end;$$;
revoke all on function private.bc_treatment_confirm_alerts_impl(uuid) from public; grant execute on function private.bc_treatment_confirm_alerts_impl(uuid) to authenticated;

create or replace function private.bc_treatment_prepare_consent_impl(p_treatment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); ids uuid[]; keys text[]; r jsonb; d public.clinical_documents%rowtype; pc public.procedure_consents%rowtype; begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Somente a profissional do atendimento pode preparar o consentimento.' using errcode='42501'; end if; if t.status not in ('rascunho','pronto_para_iniciar') or t.pending_version_id is not null then raise exception 'Consentimento fora da etapa permitida.' using errcode='55000'; end if; if t.consent_document_id is not null then select * into d from public.clinical_documents where id=t.consent_document_id and document_type='consentimento_procedimento'; if d.id is not null then select * into pc from public.procedure_consents where id=d.source_id; if pc.id is not null then return jsonb_build_object('document_id',d.id,'consent_id',pc.id,'reused',pc.status='finalizado','consent_class',pc.consent_class,'procedure_name',pc.procedure_name_snapshot); end if; end if; end if; select coalesce(array_agg(c.component_version_id order by c.component_version_id) filter(where c.component_version_id is not null),'{}'::uuid[]),coalesce(array_agg(c.component_key order by c.component_key) filter(where c.component_key is not null),'{}'::text[]) into ids,keys from public.clinical_treatment_components c where c.treatment_id=t.id; r:=private.bc_treatment_prepare_consent_impl(t.cliente_id,t.procedure_version_id,ids,keys,t.cycle_key); update public.clinical_treatments set consent_document_id=(r->>'document_id')::uuid,updated_at=now(),status=case when status='pronto_para_iniciar' then 'rascunho' else status end where id=t.id; return r; end;$$;
revoke all on function private.bc_treatment_prepare_consent_impl(uuid) from public; grant execute on function private.bc_treatment_prepare_consent_impl(uuid) to authenticated;

create or replace function private.bc_treatment_mark_ready_impl(p_treatment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); reasons text[]; a_id uuid; begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if; if t.status<>'rascunho' or t.pending_version_id is not null then raise exception 'Atendimento não está em rascunho.' using errcode='55000'; end if; select a.id into a_id from public.anamneses_gerais a join public.procedure_versions pv on pv.id=t.procedure_version_id where a.cliente_id=t.cliente_id and pv.requires_general_anamnesis and a.status='finalizada' and a.valid_until>=now() order by a.finalized_at desc limit 1; update public.clinical_treatments set anamnese_id=a_id,updated_at=now() where id=t.id; reasons:=private.bc_treatment_gate(t.id); if cardinality(reasons)=0 then update public.clinical_treatments set status='pronto_para_iniciar',updated_at=now() where id=t.id; end if; return jsonb_build_object('ready',cardinality(reasons)=0,'reasons',to_jsonb(reasons),'status',case when cardinality(reasons)=0 then 'pronto_para_iniciar' else 'rascunho' end); end;$$;
revoke all on function private.bc_treatment_mark_ready_impl(uuid) from public; grant execute on function private.bc_treatment_mark_ready_impl(uuid) to authenticated;

create or replace function private.bc_treatment_start_impl(p_treatment_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); reasons text[]; begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if; if t.status<>'pronto_para_iniciar' then raise exception 'Atendimento ainda não está pronto para iniciar.' using errcode='55000'; end if; reasons:=private.bc_treatment_gate(t.id); if cardinality(reasons)>0 then raise exception 'Gates clínicos mudaram; revise antes de iniciar: %',array_to_string(reasons,', ') using errcode='55000'; end if; update public.clinical_treatments set status='em_atendimento',started_at=coalesce(started_at,now()),updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_started','clinical_treatments',t.id,'{}'::jsonb); return t.id; end;$$;
revoke all on function private.bc_treatment_start_impl(uuid) from public; grant execute on function private.bc_treatment_start_impl(uuid) to authenticated;

create or replace function private.bc_treatment_finalize_impl(p_treatment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; pv public.procedure_versions%rowtype; s public.staff_profiles%rowtype; v_user uuid:=auth.uid(); v_number integer; v_version uuid; v_doc uuid; v_code text; snap jsonb; correction text; comp jsonb; begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if; if t.status<>'em_atendimento' or t.pending_version_id is not null then raise exception 'Atendimento não está disponível para preparar finalização.' using errcode='55000'; end if; if nullif(trim(t.objetivo),'') is null or nullif(trim(t.regiao),'') is null or not private.bc_treatment_specific_complete(t.id) then raise exception 'Ficha técnica obrigatória incompleta.' using errcode='22023'; end if; select * into pv from public.procedure_versions where id=t.procedure_version_id; if t.price_mode_snapshot='fixed' then update public.clinical_treatments set final_price=base_price_snapshot where id=t.id; t.final_price:=t.base_price_snapshot; elsif t.price_mode_snapshot='starting_at' and (t.final_price is null or t.final_price<=0) then raise exception 'Preço final positivo é obrigatório para procedimento a partir de.' using errcode='22023'; end if; select * into s from public.staff_profiles where user_id=v_user and active and atende_clientes; if not found or nullif(trim(s.profissao),'') is null or nullif(trim(s.conselho),'') is null or nullif(trim(s.registro_conselho),'') is null then raise exception 'Identidade profissional incompleta.' using errcode='22023'; end if; select coalesce(max(version),0)+1 into v_number from public.clinical_treatment_versions where treatment_id=t.id; correction:=case when t.current_version_id is null then 'initial' else coalesce(t.correction_mode,'same_day') end; select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) into comp from public.clinical_treatment_components c where c.treatment_id=t.id; snap:=jsonb_build_object('treatment',to_jsonb(t),'procedure_version',to_jsonb(pv),'components',comp,'professional',jsonb_build_object('name',s.display_name,'profissao',s.profissao,'conselho',s.conselho,'registro',s.registro_conselho),'consent_document_id',t.consent_document_id,'anamnese_id',t.anamnese_id,'captured_at',now()); insert into public.clinical_treatment_versions(treatment_id,version,prior_version_id,correction_mode,snapshot,created_by) values(t.id,v_number,t.current_version_id,correction,snap,v_user) returning id into v_version; v_code:='BC-ATD-'||to_char((now() at time zone 'America/Sao_Paulo')::date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)); insert into public.clinical_documents(cliente_id,document_type,source_id,source_version,document_version,document_code,status,profissional_user_id,profissional_nome_snapshot,profissao_snapshot,conselho_snapshot,registro_snapshot) values(t.cliente_id,'treatment_record',v_version,v_number,v_number,v_code,'aguardando_assinaturas',v_user,s.display_name,s.profissao,s.conselho,s.registro_conselho) returning id into v_doc; update public.clinical_treatment_versions set document_id=v_doc where id=v_version; update public.clinical_treatments set pending_version_id=v_version,pending_document_id=v_doc,updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_finalization_prepared','clinical_treatment_versions',v_version,jsonb_build_object('treatment_id',t.id,'document_id',v_doc,'version',v_number)); return jsonb_build_object('treatment_version_id',v_version,'document_id',v_doc,'version',v_number); end;$$;
revoke all on function private.bc_treatment_finalize_impl(uuid) from public; grant execute on function private.bc_treatment_finalize_impl(uuid) to authenticated;

create or replace function private.bc_treatment_complete_finalize_impl(p_treatment_id uuid,p_document_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; d public.clinical_documents%rowtype; v_user uuid:=auth.uid(); v_version integer; begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if; if t.status<>'em_atendimento' or t.pending_version_id is null or t.pending_document_id<>p_document_id then raise exception 'Finalização pendente não corresponde ao documento.' using errcode='55000'; end if; select * into d from public.clinical_documents where id=p_document_id and document_type='treatment_record' and source_id=t.pending_version_id for update; if not found or d.status<>'aguardando_assinaturas' then raise exception 'Ficha final não está aguardando assinatura.' using errcode='55000'; end if; if not exists(select 1 from public.clinical_signatures where document_id=p_document_id and signer_kind='profissional') then raise exception 'Assinatura profissional obrigatória ainda não foi registrada.' using errcode='22023'; end if; update public.clinical_documents set status='pronto_para_pdf' where id=p_document_id; select version into v_version from public.clinical_treatment_versions where id=t.pending_version_id; update public.clinical_treatments set status='finalizado',current_version_id=pending_version_id,pending_version_id=null,pending_document_id=null,finalized_at=now(),correction_mode=null,correction_reason=null,updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_finalized','clinical_treatments',t.id,jsonb_build_object('document_id',p_document_id,'version',v_version)); return jsonb_build_object('treatment_id',t.id,'document_id',p_document_id,'version',v_version,'status','finalizado'); end;$$;
revoke all on function private.bc_treatment_complete_finalize_impl(uuid,uuid) from public; grant execute on function private.bc_treatment_complete_finalize_impl(uuid,uuid) to authenticated;

create or replace function private.bc_treatment_correct_same_day_impl(p_treatment_id uuid,p_patch jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Somente a autora original pode retificar.' using errcode='42501'; end if; if t.status<>'finalizado' or t.current_version_id is null then raise exception 'Atendimento não está finalizado.' using errcode='55000'; end if; if t.treatment_date<>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Após a virada do dia é necessária reabertura administrativa.' using errcode='55000'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); update public.clinical_treatments set status='em_atendimento',correction_mode='same_day',correction_reason='Retificação no mesmo dia',finalized_at=null,pending_version_id=null,pending_document_id=null,updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_same_day_correction_opened','clinical_treatments',t.id,jsonb_build_object('prior_version_id',t.current_version_id)); return t.id; end;$$;
revoke all on function private.bc_treatment_correct_same_day_impl(uuid,jsonb) from public; grant execute on function private.bc_treatment_correct_same_day_impl(uuid,jsonb) to authenticated;

create or replace function private.bc_treatment_create_reopen_grant_impl(p_treatment_id uuid,p_reason text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; v_user uuid:=auth.uid(); v_id uuid; begin if v_user is null or not private.is_bc_admin() then raise exception 'Somente a administradora pode autorizar reabertura.' using errcode='42501'; end if; select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or t.status<>'finalizado' then raise exception 'Atendimento finalizado não encontrado.' using errcode='P0002'; end if; if t.treatment_date=(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Correção no mesmo dia não exige reabertura administrativa.' using errcode='22023'; end if; if nullif(trim(p_reason),'') is null or p_expires_at is null or p_expires_at<=now() then raise exception 'Motivo e expiração futura são obrigatórios.' using errcode='22023'; end if; insert into public.clinical_treatment_reopen_grants(treatment_id,author_user_id,granted_by,reason,expires_at) values(t.id,t.profissional_user_id,v_user,trim(p_reason),p_expires_at) returning id into v_id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_reopen_granted','clinical_treatment_reopen_grants',v_id,jsonb_build_object('treatment_id',t.id,'expires_at',p_expires_at)); return v_id; end;$$;
revoke all on function private.bc_treatment_create_reopen_grant_impl(uuid,text,timestamptz) from public; grant execute on function private.bc_treatment_create_reopen_grant_impl(uuid,text,timestamptz) to authenticated;

create or replace function private.bc_treatment_correct_reopened_impl(p_treatment_id uuid,p_patch jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare t public.clinical_treatments%rowtype; g public.clinical_treatment_reopen_grants%rowtype; v_user uuid:=auth.uid(); begin select * into t from public.clinical_treatments where id=p_treatment_id for update; if not found or v_user<>t.profissional_user_id then raise exception 'Somente a autora original pode corrigir após reabertura.' using errcode='42501'; end if; if t.status<>'finalizado' then raise exception 'Atendimento não está finalizado.' using errcode='55000'; end if; select * into g from public.clinical_treatment_reopen_grants where treatment_id=t.id and author_user_id=v_user and used_at is null and expires_at>now() order by created_at desc limit 1 for update; if not found then raise exception 'Reabertura temporária válida não encontrada.' using errcode='42501'; end if; perform private.bc_treatment_apply_patch(t.id,p_patch); update public.clinical_treatment_reopen_grants set used_at=now() where id=g.id; update public.clinical_treatments set status='em_atendimento',correction_mode='reopened',correction_reason=g.reason,finalized_at=null,pending_version_id=null,pending_document_id=null,updated_at=now() where id=t.id; insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'clinical_treatment_reopened_correction_started','clinical_treatments',t.id,jsonb_build_object('grant_id',g.id,'prior_version_id',t.current_version_id)); return t.id; end;$$;
revoke all on function private.bc_treatment_correct_reopened_impl(uuid,jsonb) from public; grant execute on function private.bc_treatment_correct_reopened_impl(uuid,jsonb) to authenticated;

-- Wrappers públicos: Data API vê apenas estas portas; autoridade permanece nas implementações private.
create or replace function public.bc_treatment_create(p_cliente_id uuid,p_procedure_id uuid,p_agendamento_id uuid default null,p_component_version_ids uuid[] default '{}'::uuid[],p_component_keys text[] default '{}'::text[]) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_create_impl($1,$2,$3,$4,$5);$$; revoke all on function public.bc_treatment_create(uuid,uuid,uuid,uuid[],text[]) from public,anon; grant execute on function public.bc_treatment_create(uuid,uuid,uuid,uuid[],text[]) to authenticated;
create or replace function public.bc_treatment_get(p_treatment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_treatment_get_impl($1);$$; revoke all on function public.bc_treatment_get(uuid) from public,anon; grant execute on function public.bc_treatment_get(uuid) to authenticated;
create or replace function public.bc_treatment_list_client(p_cliente_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_treatment_list_client_impl($1);$$; revoke all on function public.bc_treatment_list_client(uuid) from public,anon; grant execute on function public.bc_treatment_list_client(uuid) to authenticated;
create or replace function public.bc_treatment_update_draft(p_treatment_id uuid,p_patch jsonb) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_update_draft_impl($1,$2);$$; revoke all on function public.bc_treatment_update_draft(uuid,jsonb) from public,anon; grant execute on function public.bc_treatment_update_draft(uuid,jsonb) to authenticated;
create or replace function public.bc_treatment_confirm_health(p_treatment_id uuid,p_changed boolean,p_details text default null) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_confirm_health_impl($1,$2,$3);$$; revoke all on function public.bc_treatment_confirm_health(uuid,boolean,text) from public,anon; grant execute on function public.bc_treatment_confirm_health(uuid,boolean,text) to authenticated;
create or replace function public.bc_treatment_confirm_alerts(p_treatment_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_confirm_alerts_impl($1);$$; revoke all on function public.bc_treatment_confirm_alerts(uuid) from public,anon; grant execute on function public.bc_treatment_confirm_alerts(uuid) to authenticated;
create or replace function public.bc_treatment_prepare_consent(p_treatment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_treatment_prepare_consent_impl($1);$$; revoke all on function public.bc_treatment_prepare_consent(uuid) from public,anon; grant execute on function public.bc_treatment_prepare_consent(uuid) to authenticated;
create or replace function public.bc_treatment_mark_ready(p_treatment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_treatment_mark_ready_impl($1);$$; revoke all on function public.bc_treatment_mark_ready(uuid) from public,anon; grant execute on function public.bc_treatment_mark_ready(uuid) to authenticated;
create or replace function public.bc_treatment_start(p_treatment_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_start_impl($1);$$; revoke all on function public.bc_treatment_start(uuid) from public,anon; grant execute on function public.bc_treatment_start(uuid) to authenticated;
create or replace function public.bc_treatment_finalize(p_treatment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_treatment_finalize_impl($1);$$; revoke all on function public.bc_treatment_finalize(uuid) from public,anon; grant execute on function public.bc_treatment_finalize(uuid) to authenticated;
create or replace function public.bc_treatment_complete_finalize(p_treatment_id uuid,p_document_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_treatment_complete_finalize_impl($1,$2);$$; revoke all on function public.bc_treatment_complete_finalize(uuid,uuid) from public,anon; grant execute on function public.bc_treatment_complete_finalize(uuid,uuid) to authenticated;
create or replace function public.bc_treatment_correct_same_day(p_treatment_id uuid,p_patch jsonb) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_correct_same_day_impl($1,$2);$$; revoke all on function public.bc_treatment_correct_same_day(uuid,jsonb) from public,anon; grant execute on function public.bc_treatment_correct_same_day(uuid,jsonb) to authenticated;
create or replace function public.bc_treatment_create_reopen_grant(p_treatment_id uuid,p_reason text,p_expires_at timestamptz) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_create_reopen_grant_impl($1,$2,$3);$$; revoke all on function public.bc_treatment_create_reopen_grant(uuid,text,timestamptz) from public,anon; grant execute on function public.bc_treatment_create_reopen_grant(uuid,text,timestamptz) to authenticated;
create or replace function public.bc_treatment_correct_reopened(p_treatment_id uuid,p_patch jsonb) returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_correct_reopened_impl($1,$2);$$; revoke all on function public.bc_treatment_correct_reopened(uuid,jsonb) from public,anon; grant execute on function public.bc_treatment_correct_reopened(uuid,jsonb) to authenticated;
