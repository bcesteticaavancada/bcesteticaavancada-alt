-- BC Gestão Fase 6B — alertas clínicos compartilhados e auditáveis.

create table if not exists public.clinical_alerts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  level text not null check (level in ('critico','atencao','informativo')),
  origin_type text not null check (origin_type in ('anamnese','manual','intercorrencia')),
  origin_id uuid,
  alert_key text,
  description text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  inactivated_by uuid references auth.users(id) on delete set null,
  inactivated_at timestamptz,
  inactivation_reason text
);

create unique index if not exists clinical_alerts_origin_key_idx
  on public.clinical_alerts(origin_type, origin_id, alert_key)
  where origin_id is not null and alert_key is not null;

create index if not exists clinical_alerts_client_active_idx
  on public.clinical_alerts(cliente_id, active, created_at desc);

alter table public.clinical_alerts enable row level security;

drop policy if exists clinical_alerts_staff_read on public.clinical_alerts;
create policy clinical_alerts_staff_read
on public.clinical_alerts
for select to authenticated
using (private.is_bc_active_staff());

revoke all on public.clinical_alerts from anon, authenticated;
grant select on public.clinical_alerts to authenticated;

create or replace function private.bc_sync_anamnese_alerts(p_anamnese_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_cliente_id uuid;
  v_alergia text;
  v_alergia_det text;
  v_reacao text;
  v_reacao_det text;
  v_medicamento text;
  v_medicamento_det text;
  v_condicao text;
  v_condicoes jsonb;
  v_condicoes_det text;
  v_gestacao text;
  v_amamentacao text;
  v_herpes text;
  v_herpes_regiao text;
  v_queloide text;
  v_queloide_det text;
  v_dermato text;
  v_dermato_det text;
  v_cirurgia text;
  v_cirurgia_det text;
begin
  select cliente_id into v_cliente_id
  from public.anamneses_gerais
  where id=p_anamnese_id;

  if v_cliente_id is null then
    raise exception 'Anamnese não encontrada.' using errcode='P0002';
  end if;

  select
    max(case when question_key='alergias_conhecidas' then answer_json #>> '{}' end),
    max(case when question_key='alergias_detalhes' then answer_json #>> '{}' end),
    max(case when question_key='reacao_alergica_procedimento' then answer_json #>> '{}' end),
    max(case when question_key='reacao_alergica_detalhes' then answer_json #>> '{}' end),
    max(case when question_key='medicamentos_continuos' then answer_json #>> '{}' end),
    max(case when question_key='medicamentos_detalhes' then answer_json #>> '{}' end),
    max(case when question_key='condicao_saude_importante' then answer_json #>> '{}' end),
    max(case when question_key='condicoes_relevantes_detalhes' then answer_json #>> '{}' end),
    max(case when question_key='gestacao_possibilidade' then answer_json #>> '{}' end),
    max(case when question_key='amamentacao' then answer_json #>> '{}' end),
    max(case when question_key='herpes_historico' then answer_json #>> '{}' end),
    max(case when question_key='herpes_regiao' then answer_json #>> '{}' end),
    max(case when question_key='cicatrizacao_alterada_queloide' then answer_json #>> '{}' end),
    max(case when question_key='cicatrizacao_detalhes' then answer_json #>> '{}' end),
    max(case when question_key='tratamento_dermatologico_recente' then answer_json #>> '{}' end),
    max(case when question_key='tratamento_dermatologico_detalhes' then answer_json #>> '{}' end),
    max(case when question_key='cirurgias_procedimentos_recentes' then answer_json #>> '{}' end),
    max(case when question_key='cirurgias_recentes_detalhes' then answer_json #>> '{}' end)
  into v_alergia,v_alergia_det,v_reacao,v_reacao_det,v_medicamento,v_medicamento_det,
       v_condicao,v_condicoes_det,v_gestacao,v_amamentacao,v_herpes,v_herpes_regiao,
       v_queloide,v_queloide_det,v_dermato,v_dermato_det,v_cirurgia,v_cirurgia_det
  from public.anamnese_respostas
  where anamnese_id=p_anamnese_id;

  select answer_json into v_condicoes
  from public.anamnese_respostas
  where anamnese_id=p_anamnese_id and question_key='condicoes_relevantes';

  if lower(coalesce(v_alergia,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'critico','anamnese',p_anamnese_id,'alergia',
           'Alergia informada' || case when nullif(v_alergia_det,'') is not null then ': '||v_alergia_det else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_reacao,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'critico','anamnese',p_anamnese_id,'reacao_alergica',
           'Reação alérgica prévia em procedimento informada' || case when nullif(v_reacao_det,'') is not null then ': '||v_reacao_det else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_medicamento,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'atencao','anamnese',p_anamnese_id,'medicamento_continuo',
           'Uso contínuo de medicamento informado' || case when nullif(v_medicamento_det,'') is not null then ': '||v_medicamento_det else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_condicao,''))='sim'
     or (v_condicoes is not null and v_condicoes <> '[]'::jsonb and v_condicoes <> '["nenhuma"]'::jsonb) then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'atencao','anamnese',p_anamnese_id,'condicao_saude',
           'Condição de saúde relevante informada' || case when nullif(v_condicoes_det,'') is not null then ': '||v_condicoes_det else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_gestacao,'')) in ('sim','possivel','possível') then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'atencao','anamnese',p_anamnese_id,'gestacao','Possibilidade/gestação informada para avaliação profissional.')
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_amamentacao,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'atencao','anamnese',p_anamnese_id,'amamentacao','Amamentação informada para avaliação profissional.')
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_herpes,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'atencao','anamnese',p_anamnese_id,'herpes',
           'Histórico de herpes informado' || case when nullif(v_herpes_regiao,'') is not null then ' — região: '||v_herpes_regiao else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_queloide,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'atencao','anamnese',p_anamnese_id,'cicatrizacao',
           'Cicatrização alterada/queloide informado' || case when nullif(v_queloide_det,'') is not null then ': '||v_queloide_det else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_dermato,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'informativo','anamnese',p_anamnese_id,'tratamento_dermatologico',
           'Tratamento dermatológico recente informado' || case when nullif(v_dermato_det,'') is not null then ': '||v_dermato_det else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;

  if lower(coalesce(v_cirurgia,''))='sim' then
    insert into public.clinical_alerts(cliente_id,level,origin_type,origin_id,alert_key,description)
    values(v_cliente_id,'informativo','anamnese',p_anamnese_id,'cirurgia_recente',
           'Cirurgia/procedimento médico recente informado' || case when nullif(v_cirurgia_det,'') is not null then ': '||v_cirurgia_det else '.' end)
    on conflict (origin_type,origin_id,alert_key) where origin_id is not null and alert_key is not null
    do update set description=excluded.description, level=excluded.level, active=true;
  end if;
end;
$$;

create or replace function public.bc_clinical_alert_list(p_cliente_id uuid, p_active_only boolean default true)
returns table(
  id uuid, level text, origin_type text, origin_id uuid, alert_key text,
  description text, active boolean, created_by uuid, created_at timestamptz,
  inactivated_by uuid, inactivated_at timestamptz, inactivation_reason text
)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select a.id,a.level,a.origin_type,a.origin_id,a.alert_key,a.description,a.active,
         a.created_by,a.created_at,a.inactivated_by,a.inactivated_at,a.inactivation_reason
  from public.clinical_alerts a
  where private.is_bc_active_staff()
    and a.cliente_id=p_cliente_id
    and (not p_active_only or a.active)
  order by case a.level when 'critico' then 0 when 'atencao' then 1 else 2 end, a.created_at desc;
$$;

create or replace function private.bc_clinical_alert_create_manual_impl(
  p_cliente_id uuid,p_level text,p_description text
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
  if p_level not in ('critico','atencao','informativo') or nullif(trim(p_description),'') is null then
    raise exception 'Alerta clínico inválido.' using errcode='22023';
  end if;
  if not exists(select 1 from public.clientes where id=p_cliente_id) then
    raise exception 'Cliente não encontrada.' using errcode='P0002';
  end if;

  insert into public.clinical_alerts(cliente_id,level,origin_type,description,created_by)
  values(p_cliente_id,p_level,'manual',trim(p_description),auth.uid())
  returning id into v_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'clinical_alert_created','clinical_alerts',v_id,
         jsonb_build_object('cliente_id',p_cliente_id,'level',p_level,'origin_type','manual'));
  return v_id;
end;
$$;

create or replace function public.bc_clinical_alert_create_manual(
  p_cliente_id uuid,p_level text,p_description text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_clinical_alert_create_manual_impl(p_cliente_id,p_level,p_description); $$;

create or replace function private.bc_clinical_alert_inactivate_impl(p_alert_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_cliente_id uuid;
begin
  if auth.uid() is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode inativar alerta clínico.' using errcode='42501';
  end if;
  if nullif(trim(p_reason),'') is null then
    raise exception 'Motivo de inativação é obrigatório.' using errcode='22023';
  end if;

  update public.clinical_alerts
     set active=false,inactivated_by=auth.uid(),inactivated_at=now(),inactivation_reason=trim(p_reason)
   where id=p_alert_id and active
   returning cliente_id into v_cliente_id;

  if not found then
    raise exception 'Alerta ativo não encontrado.' using errcode='P0002';
  end if;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'clinical_alert_inactivated','clinical_alerts',p_alert_id,
         jsonb_build_object('cliente_id',v_cliente_id,'reason',trim(p_reason)));
  return p_alert_id;
end;
$$;

create or replace function public.bc_clinical_alert_inactivate(p_alert_id uuid,p_reason text)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$ select private.bc_clinical_alert_inactivate_impl(p_alert_id,p_reason); $$;

revoke all on function public.bc_clinical_alert_list(uuid,boolean) from public;
revoke all on function public.bc_clinical_alert_create_manual(uuid,text,text) from public;
revoke all on function public.bc_clinical_alert_inactivate(uuid,text) from public;
grant execute on function public.bc_clinical_alert_list(uuid,boolean) to authenticated;
grant execute on function public.bc_clinical_alert_create_manual(uuid,text,text) to authenticated;
grant execute on function public.bc_clinical_alert_inactivate(uuid,text) to authenticated;

revoke all on function private.bc_sync_anamnese_alerts(uuid) from public;
revoke all on function private.bc_clinical_alert_create_manual_impl(uuid,text,text) from public;
revoke all on function private.bc_clinical_alert_inactivate_impl(uuid,text) from public;
revoke execute on function private.bc_sync_anamnese_alerts(uuid) from anon;
revoke execute on function private.bc_clinical_alert_create_manual_impl(uuid,text,text) from anon;
revoke execute on function private.bc_clinical_alert_inactivate_impl(uuid,text) from anon;
grant execute on function private.bc_sync_anamnese_alerts(uuid) to authenticated;
grant execute on function private.bc_clinical_alert_create_manual_impl(uuid,text,text) to authenticated;
grant execute on function private.bc_clinical_alert_inactivate_impl(uuid,text) to authenticated;
