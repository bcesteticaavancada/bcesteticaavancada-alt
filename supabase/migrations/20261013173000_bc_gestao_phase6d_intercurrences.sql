-- BC Gestão Fase 6D — intercorrências estruturadas e evoluções append-only.

create table if not exists public.clinical_intercurrences (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  moment text not null check (moment in ('antes','durante','apos')),
  severity text not null check (severity in ('leve','moderada','grave','critica')),
  description text not null check (nullif(trim(description),'') is not null),
  action_taken text not null check (nullif(trim(action_taken),'') is not null),
  status text not null default 'aberta' check (status in ('aberta','acompanhamento','encerrada')),
  occurred_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists clinical_intercurrences_treatment_idx on public.clinical_intercurrences(treatment_id,occurred_at,created_at);
create index if not exists clinical_intercurrences_open_idx on public.clinical_intercurrences(treatment_id,status) where status in ('aberta','acompanhamento');

create table if not exists public.clinical_intercurrence_updates (
  id uuid primary key default gen_random_uuid(),
  intercurrence_id uuid not null references public.clinical_intercurrences(id) on delete restrict,
  evolution text not null check (nullif(trim(evolution),'') is not null),
  status_after text not null check (status_after in ('aberta','acompanhamento','encerrada')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists clinical_intercurrence_updates_intercurrence_idx on public.clinical_intercurrence_updates(intercurrence_id,created_at,id);

create table if not exists public.clinical_treatment_intercurrence_confirmations (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  open_intercurrence_ids uuid[] not null,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now()
);
create index if not exists clinical_treatment_intercurrence_confirmations_idx on public.clinical_treatment_intercurrence_confirmations(treatment_id,confirmed_at desc,id desc);

alter table public.clinical_intercurrences enable row level security;
alter table public.clinical_intercurrence_updates enable row level security;
alter table public.clinical_treatment_intercurrence_confirmations enable row level security;
revoke all on public.clinical_intercurrences from anon,authenticated;
revoke all on public.clinical_intercurrence_updates from anon,authenticated;
revoke all on public.clinical_treatment_intercurrence_confirmations from anon,authenticated;

create or replace function private.bc_clinical_intercurrence_updates_immutable()
returns trigger language plpgsql set search_path=''
as $$begin
  raise exception 'Evoluções de intercorrência são imutáveis.' using errcode='55000';
end;$$;
revoke all on function private.bc_clinical_intercurrence_updates_immutable() from public;
drop trigger if exists clinical_intercurrence_updates_immutable on public.clinical_intercurrence_updates;
create trigger clinical_intercurrence_updates_immutable
before update or delete on public.clinical_intercurrence_updates
for each row execute function private.bc_clinical_intercurrence_updates_immutable();

create or replace function private.bc_treatment_intercurrence_list_impl(p_treatment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado às intercorrências.' using errcode='42501'; end if;
  if not exists(select 1 from public.clinical_treatments t where t.id=p_treatment_id) then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(
    to_jsonb(i) || jsonb_build_object('updates',coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at,u.id) from public.clinical_intercurrence_updates u where u.intercurrence_id=i.id),'[]'::jsonb))
    order by i.occurred_at,i.created_at,i.id
  ),'[]'::jsonb) into v_result
  from public.clinical_intercurrences i where i.treatment_id=p_treatment_id;
  return v_result;
end;$$;

create or replace function private.bc_treatment_intercurrence_create_impl(
  p_treatment_id uuid,p_moment text,p_severity text,p_description text,p_action_taken text,p_occurred_at timestamptz
)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_treatment public.clinical_treatments%rowtype; v_id uuid;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado às intercorrências.' using errcode='42501'; end if;
  select * into v_treatment from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null then
    raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501';
  end if;
  if p_moment not in ('antes','durante','apos') then raise exception 'Momento da intercorrência inválido.' using errcode='22023'; end if;
  if p_severity not in ('leve','moderada','grave','critica') then raise exception 'Gravidade da intercorrência inválida.' using errcode='22023'; end if;
  if nullif(trim(p_description),'') is null then raise exception 'Descrição é obrigatória.' using errcode='22023'; end if;
  if nullif(trim(p_action_taken),'') is null then raise exception 'Conduta registrada é obrigatória.' using errcode='22023'; end if;
  insert into public.clinical_intercurrences(treatment_id,cliente_id,moment,severity,description,action_taken,status,occurred_at,created_by)
  values(p_treatment_id,v_treatment.cliente_id,p_moment,p_severity,trim(p_description),trim(p_action_taken),'aberta',coalesce(p_occurred_at,now()),v_user)
  returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_intercurrence_created','clinical_intercurrences',v_id,jsonb_build_object('treatment_id',p_treatment_id,'severity',p_severity,'moment',p_moment));
  return v_id;
end;$$;

create or replace function private.bc_treatment_intercurrence_update_draft_impl(p_intercurrence_id uuid,p_patch jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_item public.clinical_intercurrences%rowtype; v_treatment public.clinical_treatments%rowtype; v_moment text; v_severity text; v_description text; v_action text; v_occurred timestamptz;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado às intercorrências.' using errcode='42501'; end if;
  select * into v_item from public.clinical_intercurrences where id=p_intercurrence_id for update;
  if not found then raise exception 'Intercorrência não encontrada.' using errcode='P0002'; end if;
  select * into v_treatment from public.clinical_treatments where id=v_item.treatment_id for update;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null then
    raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501';
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(p_patch,'{}'::jsonb)) k where k not in ('moment','severity','description','action_taken','occurred_at')) then
    raise exception 'Campo de correção não permitido.' using errcode='22023';
  end if;
  v_moment:=coalesce(nullif(trim(p_patch->>'moment'),''),v_item.moment);
  v_severity:=coalesce(nullif(trim(p_patch->>'severity'),''),v_item.severity);
  v_description:=coalesce(nullif(trim(p_patch->>'description'),''),v_item.description);
  v_action:=coalesce(nullif(trim(p_patch->>'action_taken'),''),v_item.action_taken);
  v_occurred:=v_item.occurred_at;
  if p_patch ? 'occurred_at' and nullif(trim(p_patch->>'occurred_at'),'') is not null then v_occurred:=(p_patch->>'occurred_at')::timestamptz; end if;
  if v_moment not in ('antes','durante','apos') then raise exception 'Momento da intercorrência inválido.' using errcode='22023'; end if;
  if v_severity not in ('leve','moderada','grave','critica') then raise exception 'Gravidade da intercorrência inválida.' using errcode='22023'; end if;
  update public.clinical_intercurrences set moment=v_moment,severity=v_severity,description=v_description,action_taken=v_action,occurred_at=v_occurred,updated_at=now() where id=p_intercurrence_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_intercurrence_draft_updated','clinical_intercurrences',p_intercurrence_id,jsonb_build_object('treatment_id',v_item.treatment_id,'fields',coalesce(p_patch,'{}'::jsonb)));
  return p_intercurrence_id;
end;$$;

create or replace function private.bc_intercurrence_add_update_impl(p_intercurrence_id uuid,p_evolution text,p_status_after text)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_item public.clinical_intercurrences%rowtype; v_update_id uuid;
begin
  if v_user is null or not exists(select 1 from public.staff_profiles s where s.user_id=v_user and s.active and s.atende_clientes) then
    raise exception 'Acesso restrito a profissional clínica ativa.' using errcode='42501';
  end if;
  select * into v_item from public.clinical_intercurrences where id=p_intercurrence_id for update;
  if not found then raise exception 'Intercorrência não encontrada.' using errcode='P0002'; end if;
  if nullif(trim(p_evolution),'') is null then raise exception 'Evolução é obrigatória.' using errcode='22023'; end if;
  if p_status_after not in ('aberta','acompanhamento','encerrada') then raise exception 'Status de evolução inválido.' using errcode='22023'; end if;
  insert into public.clinical_intercurrence_updates(intercurrence_id,evolution,status_after,created_by)
  values(p_intercurrence_id,trim(p_evolution),p_status_after,v_user) returning id into v_update_id;
  update public.clinical_intercurrences
     set status=p_status_after,
         closed_at=case when p_status_after='encerrada' then coalesce(closed_at,now()) else null end,
         updated_at=now()
   where id=p_intercurrence_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_intercurrence_evolution_added','clinical_intercurrence_updates',v_update_id,jsonb_build_object('intercurrence_id',p_intercurrence_id,'treatment_id',v_item.treatment_id,'status_after',p_status_after));
  return v_update_id;
end;$$;

create or replace function private.bc_treatment_confirm_open_intercurrences_impl(p_treatment_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$declare v_user uuid:=auth.uid(); v_treatment public.clinical_treatments%rowtype; v_ids uuid[]; v_id uuid;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado às intercorrências.' using errcode='42501'; end if;
  select * into v_treatment from public.clinical_treatments where id=p_treatment_id for update;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  if v_treatment.profissional_user_id<>v_user or v_treatment.status not in ('rascunho','pronto_para_iniciar','em_atendimento') or v_treatment.pending_document_id is not null then
    raise exception 'Atendimento não está editável por esta profissional.' using errcode='42501';
  end if;
  select coalesce(array_agg(i.id order by i.id),'{}'::uuid[]) into v_ids
    from public.clinical_intercurrences i where i.treatment_id=p_treatment_id and i.status in ('aberta','acompanhamento');
  insert into public.clinical_treatment_intercurrence_confirmations(treatment_id,open_intercurrence_ids,confirmed_by)
  values(p_treatment_id,v_ids,v_user) returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_open_intercurrences_confirmed','clinical_treatment_intercurrence_confirmations',v_id,jsonb_build_object('treatment_id',p_treatment_id,'open_intercurrence_ids',to_jsonb(v_ids)));
  return v_id;
end;$$;

create or replace function public.bc_treatment_intercurrence_list(p_treatment_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select private.bc_treatment_intercurrence_list_impl(p_treatment_id);$$;
create or replace function public.bc_treatment_intercurrence_create(p_treatment_id uuid,p_moment text,p_severity text,p_description text,p_action_taken text,p_occurred_at timestamptz)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_intercurrence_create_impl(p_treatment_id,p_moment,p_severity,p_description,p_action_taken,p_occurred_at);$$;
create or replace function public.bc_treatment_intercurrence_update_draft(p_intercurrence_id uuid,p_patch jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_intercurrence_update_draft_impl(p_intercurrence_id,p_patch);$$;
create or replace function public.bc_intercurrence_add_update(p_intercurrence_id uuid,p_evolution text,p_status_after text)
returns uuid language sql security invoker set search_path='' as $$select private.bc_intercurrence_add_update_impl(p_intercurrence_id,p_evolution,p_status_after);$$;
create or replace function public.bc_treatment_confirm_open_intercurrences(p_treatment_id uuid)
returns uuid language sql security invoker set search_path='' as $$select private.bc_treatment_confirm_open_intercurrences_impl(p_treatment_id);$$;

revoke all on function public.bc_treatment_intercurrence_list(uuid) from public; revoke execute on function public.bc_treatment_intercurrence_list(uuid) from anon; grant execute on function public.bc_treatment_intercurrence_list(uuid) to authenticated;
revoke all on function public.bc_treatment_intercurrence_create(uuid,text,text,text,text,timestamptz) from public; revoke execute on function public.bc_treatment_intercurrence_create(uuid,text,text,text,text,timestamptz) from anon; grant execute on function public.bc_treatment_intercurrence_create(uuid,text,text,text,text,timestamptz) to authenticated;
revoke all on function public.bc_treatment_intercurrence_update_draft(uuid,jsonb) from public; revoke execute on function public.bc_treatment_intercurrence_update_draft(uuid,jsonb) from anon; grant execute on function public.bc_treatment_intercurrence_update_draft(uuid,jsonb) to authenticated;
revoke all on function public.bc_intercurrence_add_update(uuid,text,text) from public; revoke execute on function public.bc_intercurrence_add_update(uuid,text,text) from anon; grant execute on function public.bc_intercurrence_add_update(uuid,text,text) to authenticated;
revoke all on function public.bc_treatment_confirm_open_intercurrences(uuid) from public; revoke execute on function public.bc_treatment_confirm_open_intercurrences(uuid) from anon; grant execute on function public.bc_treatment_confirm_open_intercurrences(uuid) to authenticated;

revoke all on function private.bc_treatment_intercurrence_list_impl(uuid) from public;
revoke all on function private.bc_treatment_intercurrence_create_impl(uuid,text,text,text,text,timestamptz) from public;
revoke all on function private.bc_treatment_intercurrence_update_draft_impl(uuid,jsonb) from public;
revoke all on function private.bc_intercurrence_add_update_impl(uuid,text,text) from public;
revoke all on function private.bc_treatment_confirm_open_intercurrences_impl(uuid) from public;
