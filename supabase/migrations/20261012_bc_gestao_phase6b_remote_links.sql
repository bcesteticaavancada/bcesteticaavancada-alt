-- BC Gestão Fase 6B — pré-preenchimento remoto com bearer token temporário de 72 horas.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.anamnese_remote_links (
  id uuid primary key default gen_random_uuid(),
  anamnese_id uuid not null references public.anamneses_gerais(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_access_at timestamptz,
  submitted_at timestamptz
);

create index if not exists anamnese_remote_links_anamnese_idx
  on public.anamnese_remote_links(anamnese_id, created_at desc);

alter table public.anamnese_remote_links enable row level security;
revoke all on public.anamnese_remote_links from anon, authenticated;

create or replace function private.bc_anamnese_create_remote_link_impl(p_anamnese_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private, extensions
as $$
declare
  v_raw text;
  v_hash text;
  v_link_id uuid;
  v_expires timestamptz := now() + interval '72 hours';
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.anamneses_gerais
    where id=p_anamnese_id and status='em_preenchimento'
  ) then
    raise exception 'Anamnese não está disponível para link remoto.' using errcode='55000';
  end if;

  update public.anamnese_remote_links
     set revoked_at=now()
   where anamnese_id=p_anamnese_id
     and revoked_at is null and submitted_at is null and expires_at>now();

  v_raw := encode(extensions.gen_random_bytes(32),'hex');
  v_hash := encode(extensions.digest(v_raw,'sha256'),'hex');

  insert into public.anamnese_remote_links(anamnese_id,token_hash,expires_at,created_by)
  values(p_anamnese_id,v_hash,v_expires,auth.uid())
  returning id into v_link_id;

  update public.anamneses_gerais set source='remota',updated_at=now() where id=p_anamnese_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'anamnese_remote_link_created','anamnese_remote_links',v_link_id,
         jsonb_build_object('anamnese_id',p_anamnese_id,'expires_at',v_expires));

  return jsonb_build_object('link_id',v_link_id,'token',v_raw,'expires_at',v_expires);
end;
$$;

create or replace function public.bc_anamnese_create_remote_link(p_anamnese_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_create_remote_link_impl(p_anamnese_id); $$;

create or replace function private.bc_anamnese_revoke_remote_link_impl(p_link_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_anamnese_id uuid;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  update public.anamnese_remote_links
     set revoked_at=coalesce(revoked_at,now())
   where id=p_link_id
   returning anamnese_id into v_anamnese_id;
  if not found then raise exception 'Link não encontrado.' using errcode='P0002'; end if;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'anamnese_remote_link_revoked','anamnese_remote_links',p_link_id,
         jsonb_build_object('anamnese_id',v_anamnese_id));
  return p_link_id;
end;
$$;

create or replace function public.bc_anamnese_revoke_remote_link(p_link_id uuid)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_revoke_remote_link_impl(p_link_id); $$;

create or replace function private.bc_anamnese_remote_get_impl(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private, extensions
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex');
  v_link public.anamnese_remote_links%rowtype;
  v_anamnese public.anamneses_gerais%rowtype;
  v_cliente public.clientes%rowtype;
  v_answers jsonb;
begin
  select * into v_link
  from public.anamnese_remote_links
  where token_hash=v_hash
    and revoked_at is null
    and submitted_at is null
    and expires_at>now()
  for update;

  if not found then
    raise exception 'Link inválido ou expirado.' using errcode='42501';
  end if;

  select * into v_anamnese
  from public.anamneses_gerais
  where id=v_link.anamnese_id and status='em_preenchimento';

  if not found then
    raise exception 'Ficha não está disponível para preenchimento.' using errcode='55000';
  end if;

  select * into v_cliente from public.clientes where id=v_anamnese.cliente_id;
  if not found then raise exception 'Ficha indisponível.' using errcode='P0002'; end if;

  select coalesce(jsonb_object_agg(question_key,answer_json),'{}'::jsonb)
    into v_answers
  from public.anamnese_respostas
  where anamnese_id=v_anamnese.id;

  update public.anamnese_remote_links set last_access_at=now() where id=v_link.id;

  return jsonb_build_object(
    'expires_at',v_link.expires_at,
    'client_name',v_cliente.nome,
    'version',v_anamnese.version,
    'answers',v_answers
  );
end;
$$;

create or replace function public.bc_anamnese_remote_get(p_token text)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_remote_get_impl(p_token); $$;

create or replace function private.bc_anamnese_remote_save_impl(
  p_token text,p_answers jsonb,p_submit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private, extensions
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex');
  v_link public.anamnese_remote_links%rowtype;
  v_anamnese public.anamneses_gerais%rowtype;
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
  if p_answers is null or jsonb_typeof(p_answers)<>'object' then
    raise exception 'Respostas inválidas.' using errcode='22023';
  end if;

  select * into v_link
  from public.anamnese_remote_links
  where token_hash=v_hash
    and revoked_at is null
    and submitted_at is null
    and expires_at>now()
  for update;

  if not found then
    raise exception 'Link inválido ou expirado.' using errcode='42501';
  end if;

  select * into v_anamnese from public.anamneses_gerais
  where id=v_link.anamnese_id and status='em_preenchimento'
  for update;
  if not found then
    raise exception 'Ficha não está disponível para preenchimento.' using errcode='55000';
  end if;

  for v_key,v_value in select key,value from jsonb_each(p_answers)
  loop
    if not (v_key=any(v_allowed)) then
      raise exception 'Campo de anamnese inválido.' using errcode='22023';
    end if;
    insert into public.anamnese_respostas(anamnese_id,question_key,answer_json,updated_at)
    values(v_anamnese.id,v_key,v_value,now())
    on conflict(anamnese_id,question_key)
    do update set answer_json=excluded.answer_json,updated_at=now();
  end loop;

  update public.anamneses_gerais set updated_at=now() where id=v_anamnese.id;
  update public.anamnese_remote_links set last_access_at=now() where id=v_link.id;

  if p_submit then
    update public.anamneses_gerais
       set status='aguardando_revisao_profissional',updated_at=now()
     where id=v_anamnese.id;
    update public.anamnese_remote_links
       set submitted_at=now()
     where id=v_link.id;

    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
    values(null,'anamnese_remote_submitted','anamneses_gerais',v_anamnese.id,
           jsonb_build_object('version',v_anamnese.version,'source','remota'));
  end if;

  return jsonb_build_object('saved',true,'submitted',p_submit,'expires_at',v_link.expires_at);
end;
$$;

create or replace function public.bc_anamnese_remote_save(
  p_token text,p_answers jsonb,p_submit boolean default false
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_anamnese_remote_save_impl(p_token,p_answers,p_submit); $$;

revoke all on function public.bc_anamnese_create_remote_link(uuid) from public;
revoke all on function public.bc_anamnese_revoke_remote_link(uuid) from public;
revoke all on function public.bc_anamnese_remote_get(text) from public;
revoke all on function public.bc_anamnese_remote_save(text,jsonb,boolean) from public;

grant execute on function public.bc_anamnese_create_remote_link(uuid) to authenticated;
grant execute on function public.bc_anamnese_revoke_remote_link(uuid) to authenticated;
grant execute on function public.bc_anamnese_remote_get(text) to anon, authenticated;
grant execute on function public.bc_anamnese_remote_save(text,jsonb,boolean) to anon, authenticated;

revoke all on function private.bc_anamnese_create_remote_link_impl(uuid) from public;
revoke all on function private.bc_anamnese_revoke_remote_link_impl(uuid) from public;
revoke all on function private.bc_anamnese_remote_get_impl(text) from public;
revoke all on function private.bc_anamnese_remote_save_impl(text,jsonb,boolean) from public;

grant execute on function private.bc_anamnese_create_remote_link_impl(uuid) to authenticated;
grant execute on function private.bc_anamnese_revoke_remote_link_impl(uuid) to authenticated;
grant execute on function private.bc_anamnese_remote_get_impl(text) to anon, authenticated;
grant execute on function private.bc_anamnese_remote_save_impl(text,jsonb,boolean) to anon, authenticated;
