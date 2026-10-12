-- BC Gestão Fase 6B — núcleo versionado da Anamnese Geral e identidade clínica profissional.

alter table public.staff_profiles
  add column if not exists profissao text,
  add column if not exists conselho text,
  add column if not exists registro_conselho text;

create table if not exists public.anamnese_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  version integer not null check (version > 0),
  schema_json jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (template_key, version)
);

create unique index if not exists anamnese_template_one_active_idx
  on public.anamnese_template_versions (template_key)
  where active;

create table if not exists public.anamneses_gerais (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  version integer not null check (version > 0),
  template_version_id uuid not null references public.anamnese_template_versions(id) on delete restrict,
  status text not null default 'em_preenchimento'
    check (status in ('em_preenchimento','aguardando_revisao_profissional','aguardando_assinaturas','finalizada','substituida')),
  source text not null default 'presencial' check (source in ('presencial','remota')),
  supersedes_id uuid references public.anamneses_gerais(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, version)
);

create unique index if not exists anamneses_gerais_one_open_per_client_idx
  on public.anamneses_gerais (cliente_id)
  where status in ('em_preenchimento','aguardando_revisao_profissional','aguardando_assinaturas');

create index if not exists anamneses_gerais_cliente_created_idx
  on public.anamneses_gerais (cliente_id, created_at desc);

create table if not exists public.anamnese_respostas (
  id uuid primary key default gen_random_uuid(),
  anamnese_id uuid not null references public.anamneses_gerais(id) on delete cascade,
  question_key text not null,
  answer_json jsonb not null,
  updated_at timestamptz not null default now(),
  unique (anamnese_id, question_key)
);

create table if not exists public.anamnese_confirmacoes_clinicas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  anamnese_id uuid not null references public.anamneses_gerais(id) on delete restrict,
  changed boolean not null,
  details text,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now()
);

create index if not exists anamnese_confirmacoes_cliente_idx
  on public.anamnese_confirmacoes_clinicas (cliente_id, confirmed_at desc);

alter table public.anamnese_template_versions enable row level security;
alter table public.anamneses_gerais enable row level security;
alter table public.anamnese_respostas enable row level security;
alter table public.anamnese_confirmacoes_clinicas enable row level security;

drop policy if exists anamnese_templates_staff_read on public.anamnese_template_versions;
create policy anamnese_templates_staff_read
on public.anamnese_template_versions
for select to authenticated
using (private.is_bc_active_staff());

drop policy if exists anamneses_staff_read on public.anamneses_gerais;
create policy anamneses_staff_read
on public.anamneses_gerais
for select to authenticated
using (private.is_bc_active_staff());

drop policy if exists anamnese_respostas_staff_read on public.anamnese_respostas;
create policy anamnese_respostas_staff_read
on public.anamnese_respostas
for select to authenticated
using (private.is_bc_active_staff());

drop policy if exists anamnese_confirmacoes_staff_read on public.anamnese_confirmacoes_clinicas;
create policy anamnese_confirmacoes_staff_read
on public.anamnese_confirmacoes_clinicas
for select to authenticated
using (private.is_bc_active_staff());

revoke all on public.anamnese_template_versions from anon, authenticated;
revoke all on public.anamneses_gerais from anon, authenticated;
revoke all on public.anamnese_respostas from anon, authenticated;
revoke all on public.anamnese_confirmacoes_clinicas from anon, authenticated;
grant select on public.anamnese_template_versions to authenticated;
grant select on public.anamneses_gerais to authenticated;
grant select on public.anamnese_respostas to authenticated;
grant select on public.anamnese_confirmacoes_clinicas to authenticated;

create or replace function private.bc_anamnese_annual_valid_until(p_base timestamptz)
returns timestamptz
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select p_base + interval '12 months';
$$;

revoke all on function private.bc_anamnese_annual_valid_until(timestamptz) from public;

insert into public.anamnese_template_versions(template_key, version, schema_json, active)
values (
  'bc-geral',
  1,
  '{
    "key":"bc-geral",
    "version":1,
    "question_keys":[
      "queixa_principal","objetivos_esteticos","objetivo_detalhes",
      "historico_estetico_realizou","historico_estetico_detalhes","historico_estetico_reacao",
      "pele_tipo","pele_condicoes_atuais","pele_condicoes_detalhes","hiperpigmentacao_pos_inflamatoria",
      "exposicao_solar_recente","exposicao_solar_faixa","usa_fotoprotecao",
      "condicao_saude_importante","condicao_saude_detalhes","acompanhamento_medico","acompanhamento_medico_detalhes",
      "condicoes_relevantes","condicoes_relevantes_detalhes","medicamentos_continuos","medicamentos_detalhes",
      "suplementos","suplementos_detalhes","tratamento_dermatologico_recente","tratamento_dermatologico_detalhes",
      "alergias_conhecidas","alergias_detalhes","reacao_alergica_procedimento","reacao_alergica_detalhes",
      "herpes_historico","herpes_regiao","herpes_ultimo_episodio","cicatrizacao_alterada_queloide","cicatrizacao_detalhes",
      "cirurgias_procedimentos_recentes","cirurgias_recentes_detalhes",
      "tabagismo_nicotina","tabagismo_detalhes","alcool","alcool_frequencia","alcool_observacao",
      "gestacao_possibilidade","amamentacao","expectativas","resultado_especifico","observacoes_finais",
      "declaracao_veracidade","declaracao_dados"
    ]
  }'::jsonb,
  true
)
on conflict (template_key, version) do update
set schema_json = excluded.schema_json,
    active = true;

create or replace function private.bc_staff_update_clinical_identity_impl(
  p_user_id uuid,
  p_profissao text,
  p_conselho text,
  p_registro_conselho text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if auth.uid() is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode alterar identidade clínica profissional.' using errcode = '42501';
  end if;

  if nullif(trim(p_profissao),'') is null
     or nullif(trim(p_conselho),'') is null
     or nullif(trim(p_registro_conselho),'') is null then
    raise exception 'Profissão, conselho e registro são obrigatórios.' using errcode = '22023';
  end if;

  update public.staff_profiles
     set profissao = trim(p_profissao),
         conselho = upper(trim(p_conselho)),
         registro_conselho = trim(p_registro_conselho),
         updated_at = now()
   where user_id = p_user_id
     and active;

  if not found then
    raise exception 'Profissional ativa não encontrada.' using errcode = 'P0002';
  end if;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'staff_clinical_identity_updated', 'staff_profiles', p_user_id,
          jsonb_build_object('fields', jsonb_build_array('profissao','conselho','registro_conselho')));

  return true;
end;
$$;

create or replace function public.bc_staff_update_clinical_identity(
  p_user_id uuid,
  p_profissao text,
  p_conselho text,
  p_registro_conselho text
)
returns boolean
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_staff_update_clinical_identity_impl(p_user_id,p_profissao,p_conselho,p_registro_conselho);
$$;

create or replace function private.bc_anamnese_begin_impl(
  p_cliente_id uuid,
  p_source text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_version integer;
  v_previous_id uuid;
  v_anamnese_id uuid;
  v_source text := lower(coalesce(nullif(trim(p_source),''),'presencial'));
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if v_source not in ('presencial','remota') then
    raise exception 'Origem da anamnese inválida.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.clientes where id = p_cliente_id and ativo) then
    raise exception 'Cliente ativa não encontrada.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.anamneses_gerais
    where cliente_id = p_cliente_id
      and status in ('em_preenchimento','aguardando_revisao_profissional','aguardando_assinaturas')
  ) then
    raise exception 'Já existe uma anamnese aberta para esta cliente.' using errcode = '23505';
  end if;

  select id into v_template_id
  from public.anamnese_template_versions
  where template_key = 'bc-geral' and active
  order by version desc limit 1;

  if v_template_id is null then
    raise exception 'Template ativo não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(max(version),0)+1,
         (array_agg(id order by version desc))[1]
    into v_version, v_previous_id
  from public.anamneses_gerais
  where cliente_id = p_cliente_id;

  insert into public.anamneses_gerais(
    cliente_id, version, template_version_id, status, source, supersedes_id, created_by
  ) values (
    p_cliente_id, v_version, v_template_id, 'em_preenchimento', v_source, v_previous_id, v_user_id
  )
  returning id into v_anamnese_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values (v_user_id, 'anamnese_started', 'anamneses_gerais', v_anamnese_id,
          jsonb_build_object('cliente_id', p_cliente_id, 'version', v_version, 'source', v_source));

  return v_anamnese_id;
end;
$$;

create or replace function public.bc_anamnese_begin(p_cliente_id uuid, p_source text)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_begin_impl(p_cliente_id,p_source); $$;

create or replace function private.bc_anamnese_save_answers_impl(
  p_anamnese_id uuid,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_key text;
  v_value jsonb;
  v_allowed text[] := array[
    'queixa_principal','objetivos_esteticos','objetivo_detalhes',
    'historico_estetico_realizou','historico_estetico_detalhes','historico_estetico_reacao',
    'pele_tipo','pele_condicoes_atuais','pele_condicoes_detalhes','hiperpigmentacao_pos_inflamatoria',
    'exposicao_solar_recente','exposicao_solar_faixa','usa_fotoprotecao',
    'condicao_saude_importante','condicao_saude_detalhes','acompanhamento_medico','acompanhamento_medico_detalhes',
    'condicoes_relevantes','condicoes_relevantes_detalhes','medicamentos_continuos','medicamentos_detalhes',
    'suplementos','suplementos_detalhes','tratamento_dermatologico_recente','tratamento_dermatologico_detalhes',
    'alergias_conhecidas','alergias_detalhes','reacao_alergica_procedimento','reacao_alergica_detalhes',
    'herpes_historico','herpes_regiao','herpes_ultimo_episodio','cicatrizacao_alterada_queloide','cicatrizacao_detalhes',
    'cirurgias_procedimentos_recentes','cirurgias_recentes_detalhes','tabagismo_nicotina','tabagismo_detalhes',
    'alcool','alcool_frequencia','alcool_observacao','gestacao_possibilidade','amamentacao',
    'expectativas','resultado_especifico','observacoes_finais','declaracao_veracidade','declaracao_dados'
  ];
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Respostas inválidas.' using errcode = '22023';
  end if;

  select status into v_status from public.anamneses_gerais where id = p_anamnese_id for update;
  if v_status is null then raise exception 'Anamnese não encontrada.' using errcode = 'P0002'; end if;
  if v_status not in ('em_preenchimento','aguardando_revisao_profissional') then
    raise exception 'Anamnese não está aberta para edição.' using errcode = '55000';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_answers)
  loop
    if not (v_key = any(v_allowed)) then
      raise exception 'Campo de anamnese inválido: %', v_key using errcode = '22023';
    end if;
    insert into public.anamnese_respostas(anamnese_id,question_key,answer_json,updated_at)
    values (p_anamnese_id,v_key,v_value,now())
    on conflict (anamnese_id,question_key)
    do update set answer_json=excluded.answer_json, updated_at=now();
  end loop;

  update public.anamneses_gerais set updated_at=now() where id=p_anamnese_id;
  return p_anamnese_id;
end;
$$;

create or replace function public.bc_anamnese_save_answers(p_anamnese_id uuid, p_answers jsonb)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_save_answers_impl(p_anamnese_id,p_answers); $$;

create or replace function private.bc_anamnese_submit_review_impl(p_anamnese_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_source text;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  update public.anamneses_gerais
     set status='aguardando_revisao_profissional', updated_at=now()
   where id=p_anamnese_id and status='em_preenchimento'
   returning source into v_source;

  if not found then
    raise exception 'Anamnese não está disponível para revisão.' using errcode = '55000';
  end if;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user_id,'anamnese_submitted_for_review','anamneses_gerais',p_anamnese_id,
         jsonb_build_object('source',v_source));

  return p_anamnese_id;
end;
$$;

create or replace function public.bc_anamnese_submit_review(p_anamnese_id uuid)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_submit_review_impl(p_anamnese_id); $$;

create or replace function public.bc_anamnese_state(p_cliente_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select case
    when not private.is_bc_active_staff() then null
    else (
      select jsonb_build_object(
        'id', a.id,
        'version', a.version,
        'status', case when a.status='finalizada' and a.valid_until < now() then 'vencida' else a.status end,
        'source', a.source,
        'finalized_at', a.finalized_at,
        'valid_until', a.valid_until
      )
      from public.anamneses_gerais a
      where a.cliente_id=p_cliente_id
      order by a.version desc limit 1
    )
  end;
$$;

create or replace function public.bc_anamnese_versions(p_cliente_id uuid)
returns table(id uuid, version integer, status text, source text, finalized_at timestamptz, valid_until timestamptz)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select a.id,a.version,
         case when a.status='finalizada' and a.valid_until < now() then 'vencida' else a.status end,
         a.source,a.finalized_at,a.valid_until
  from public.anamneses_gerais a
  where private.is_bc_active_staff() and a.cliente_id=p_cliente_id
  order by a.version desc;
$$;

create or replace function private.bc_anamnese_confirm_clinical_change_impl(
  p_cliente_id uuid,
  p_anamnese_id uuid,
  p_changed boolean,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if not exists(select 1 from public.anamneses_gerais where id=p_anamnese_id and cliente_id=p_cliente_id and status='finalizada') then
    raise exception 'Anamnese vigente não encontrada.' using errcode='P0002';
  end if;
  insert into public.anamnese_confirmacoes_clinicas(cliente_id,anamnese_id,changed,details,confirmed_by)
  values(p_cliente_id,p_anamnese_id,p_changed,nullif(trim(p_details),''),auth.uid())
  returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'anamnese_clinical_change_confirmed','anamnese_confirmacoes_clinicas',v_id,
         jsonb_build_object('cliente_id',p_cliente_id,'anamnese_id',p_anamnese_id,'changed',p_changed));
  return v_id;
end;
$$;

create or replace function public.bc_anamnese_confirm_clinical_change(
  p_cliente_id uuid,p_anamnese_id uuid,p_changed boolean,p_details text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_confirm_clinical_change_impl(p_cliente_id,p_anamnese_id,p_changed,p_details); $$;

-- Placeholder wrapper; implementação final é criada na migration de documentos, quando clinical_documents já existe.
create or replace function public.bc_anamnese_mark_reviewed(p_anamnese_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
begin
  raise exception 'Fluxo documental ainda não instalado.' using errcode='55000';
end;
$$;

revoke all on function public.bc_staff_update_clinical_identity(uuid,text,text,text) from public;
revoke all on function public.bc_anamnese_begin(uuid,text) from public;
revoke all on function public.bc_anamnese_save_answers(uuid,jsonb) from public;
revoke all on function public.bc_anamnese_submit_review(uuid) from public;
revoke all on function public.bc_anamnese_state(uuid) from public;
revoke all on function public.bc_anamnese_versions(uuid) from public;
revoke all on function public.bc_anamnese_confirm_clinical_change(uuid,uuid,boolean,text) from public;
revoke all on function public.bc_anamnese_mark_reviewed(uuid) from public;

grant execute on function public.bc_staff_update_clinical_identity(uuid,text,text,text) to authenticated;
grant execute on function public.bc_anamnese_begin(uuid,text) to authenticated;
grant execute on function public.bc_anamnese_save_answers(uuid,jsonb) to authenticated;
grant execute on function public.bc_anamnese_submit_review(uuid) to authenticated;
grant execute on function public.bc_anamnese_state(uuid) to authenticated;
grant execute on function public.bc_anamnese_versions(uuid) to authenticated;
grant execute on function public.bc_anamnese_confirm_clinical_change(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.bc_anamnese_mark_reviewed(uuid) to authenticated;

revoke all on function private.bc_staff_update_clinical_identity_impl(uuid,text,text,text) from public;
revoke all on function private.bc_anamnese_begin_impl(uuid,text) from public;
revoke all on function private.bc_anamnese_save_answers_impl(uuid,jsonb) from public;
revoke all on function private.bc_anamnese_submit_review_impl(uuid) from public;
revoke all on function private.bc_anamnese_confirm_clinical_change_impl(uuid,uuid,boolean,text) from public;

revoke execute on function private.bc_staff_update_clinical_identity_impl(uuid,text,text,text) from anon;
revoke execute on function private.bc_anamnese_begin_impl(uuid,text) from anon;
revoke execute on function private.bc_anamnese_save_answers_impl(uuid,jsonb) from anon;
revoke execute on function private.bc_anamnese_submit_review_impl(uuid) from anon;
revoke execute on function private.bc_anamnese_confirm_clinical_change_impl(uuid,uuid,boolean,text) from anon;

grant execute on function private.bc_staff_update_clinical_identity_impl(uuid,text,text,text) to authenticated;
grant execute on function private.bc_anamnese_begin_impl(uuid,text) to authenticated;
grant execute on function private.bc_anamnese_save_answers_impl(uuid,jsonb) to authenticated;
grant execute on function private.bc_anamnese_submit_review_impl(uuid) to authenticated;
grant execute on function private.bc_anamnese_confirm_clinical_change_impl(uuid,uuid,boolean,text) to authenticated;
