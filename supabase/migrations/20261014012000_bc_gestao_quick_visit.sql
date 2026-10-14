-- BC Gestão — atendimento rápido / encaixe transacional.
-- Cria agenda + tratamento em uma única transação, com idempotência por request_key
-- e proteção de sobreposição para qualquer agendamento da clínica.

alter table public.agendamentos
  add column if not exists origem text not null default 'agenda';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.agendamentos'::regclass
      and conname='agendamentos_origem_check'
  ) then
    alter table public.agendamentos
      add constraint agendamentos_origem_check check (origem in ('agenda','encaixe'));
  end if;
end;
$$;

create table if not exists public.quick_visit_requests (
  request_key uuid primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  profissional_user_id uuid not null references auth.users(id) on delete restrict,
  procedimento_id uuid not null references public.procedimentos(id) on delete restrict,
  inicio timestamptz not null,
  fim timestamptz,
  component_version_ids uuid[] not null default '{}'::uuid[],
  component_keys text[] not null default '{}'::text[],
  appointment_id uuid not null references public.agendamentos(id) on delete restrict,
  treatment_id uuid not null references public.clinical_treatments(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (fim is null or fim > inicio)
);

create index if not exists quick_visit_requests_actor_idx
  on public.quick_visit_requests(actor_user_id,created_at desc);
create index if not exists quick_visit_requests_cliente_idx
  on public.quick_visit_requests(cliente_id,created_at desc);

alter table public.quick_visit_requests enable row level security;
revoke all on public.quick_visit_requests from anon, authenticated;

-- Serializa gravações da agenda por profissional e impede sobreposição até quando
-- duas sessões são criadas concorrentemente por fluxos diferentes.
create or replace function private.bc_agendamento_no_overlap()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_duration integer;
  v_new_end timestamptz;
  v_conflict boolean;
begin
  if new.inicio is null then
    raise exception 'Horário do agendamento inválido.' using errcode='22023';
  end if;
  if new.status in ('cancelado','faltou') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bc-agenda:'||new.colaboradora_user_id::text, 41)
  );

  select coalesce(p.duracao_padrao,60)
    into v_duration
    from public.procedimentos p
   where p.id=new.procedimento_id;
  v_duration:=coalesce(v_duration,60);
  v_new_end:=coalesce(new.fim,new.inicio+pg_catalog.make_interval(mins=>v_duration));
  if v_new_end<=new.inicio then
    raise exception 'Horário do agendamento inválido.' using errcode='22023';
  end if;

  select exists(
    select 1
      from public.agendamentos a
      left join public.procedimentos ap on ap.id=a.procedimento_id
     where a.colaboradora_user_id=new.colaboradora_user_id
       and a.id<>new.id
       and a.status not in ('cancelado','faltou')
       and a.inicio < v_new_end
       and coalesce(a.fim,a.inicio+pg_catalog.make_interval(mins=>coalesce(ap.duracao_padrao,60))) > new.inicio
  ) into v_conflict;

  if v_conflict then
    raise exception 'Horário indisponível para esta profissional.' using errcode='23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists bc_agendamento_no_overlap on public.agendamentos;
create trigger bc_agendamento_no_overlap
before insert or update on public.agendamentos
for each row execute function private.bc_agendamento_no_overlap();

revoke all on function private.bc_agendamento_no_overlap() from public, anon, authenticated;

-- Versão parametrizada do criador clínico. Permite que a administradora prepare
-- um encaixe para outra profissional, mantendo created_by=ator e profissional_user_id=executante.
create or replace function private.bc_treatment_create_for_professional_impl(
  p_cliente_id uuid,
  p_procedure_id uuid,
  p_agendamento_id uuid,
  p_profissional_user_id uuid,
  p_component_version_ids uuid[],
  p_component_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  p public.procedimentos%rowtype;
  pv public.procedure_versions%rowtype;
  a public.agendamentos%rowtype;
  v_id uuid;
  v_date date;
  ids uuid[]:=coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_component_version_ids,'{}'::uuid[])) x),'{}'::uuid[]);
  keys text[]:=coalesce((select array_agg(distinct trim(x) order by trim(x)) from unnest(coalesce(p_component_keys,'{}'::text[])) x where nullif(trim(x),'') is not null),'{}'::text[]);
  x uuid;
  k text;
  cv public.procedure_versions%rowtype;
  opt jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao atendimento clínico.' using errcode='42501';
  end if;
  if not private.is_bc_admin() and p_profissional_user_id<>v_user then
    raise exception 'Profissional só pode abrir atendimento para a própria agenda.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.staff_profiles sp
    where sp.user_id=p_profissional_user_id and sp.active and sp.atende_clientes
  ) then
    raise exception 'Profissional ativa não encontrada.' using errcode='42501';
  end if;
  if not exists(select 1 from public.clientes c where c.id=p_cliente_id and c.ativo=true) then
    raise exception 'Cliente ativa não encontrada.' using errcode='P0002';
  end if;

  select * into p
    from public.procedimentos
   where id=p_procedure_id;
  if not found or p.current_version_id is null then
    raise exception 'Procedimento publicado não encontrado.' using errcode='P0002';
  end if;
  select * into pv
    from public.procedure_versions
   where id=p.current_version_id and status='published';
  if not found then
    raise exception 'Versão publicada não encontrada.' using errcode='P0002';
  end if;
  if not private.bc_treatment_can_execute_version(pv.id,p_profissional_user_id) then
    raise exception 'Profissional não autorizada para este procedimento.' using errcode='42501';
  end if;

  if p_agendamento_id is not null then
    select * into a from public.agendamentos where id=p_agendamento_id;
    if not found then raise exception 'Agendamento não encontrado.' using errcode='P0002'; end if;
    if a.cliente_id<>p_cliente_id
       or a.procedimento_id<>p_procedure_id
       or a.colaboradora_user_id<>p_profissional_user_id then
      raise exception 'Agendamento não corresponde à cliente, procedimento e profissional selecionada.' using errcode='42501';
    end if;
    if a.status not in ('agendado','atendido') then
      raise exception 'Agendamento não pode iniciar atendimento clínico.' using errcode='55000';
    end if;
    select id into v_id from public.clinical_treatments where agendamento_id=p_agendamento_id;
    if v_id is not null then return v_id; end if;
    v_date:=(a.inicio at time zone 'America/Sao_Paulo')::date;
  else
    if not p.ativo or p.archived_at is not null then
      raise exception 'Procedimento inativo para atendimento direto.' using errcode='55000';
    end if;
    v_date:=(now() at time zone 'America/Sao_Paulo')::date;
  end if;

  if pv.protocol_mode='compound' and cardinality(ids)=0 and cardinality(keys)=0 then
    raise exception 'Protocolo composto exige componentes reais da sessão.' using errcode='22023';
  end if;
  if exists(
    select 1 from public.procedure_version_components req
    where req.parent_version_id=pv.id and req.required and not(req.component_version_id=any(ids))
  ) then
    raise exception 'Componente obrigatório não selecionado.' using errcode='22023';
  end if;

  insert into public.clinical_treatments(
    cliente_id,procedimento_id,procedure_version_id,profissional_user_id,agendamento_id,
    treatment_date,price_mode_snapshot,base_price_snapshot,final_price,created_by
  ) values(
    p_cliente_id,p.id,pv.id,p_profissional_user_id,p_agendamento_id,v_date,
    pv.price_mode,pv.base_price,case when pv.price_mode='fixed' then pv.base_price else null end,v_user
  ) returning id into v_id;

  foreach x in array ids loop
    if not exists(
      select 1 from public.procedure_version_components
      where parent_version_id=pv.id and component_version_id=x
    ) then
      raise exception 'Componente publicado inválido para este protocolo.' using errcode='22023';
    end if;
    select * into cv from public.procedure_versions where id=x and status='published';
    if not found then raise exception 'Componente publicado não encontrado.' using errcode='22023'; end if;
    insert into public.clinical_treatment_components(
      treatment_id,component_version_id,component_name_snapshot,classe_documental_snapshot
    ) values(v_id,x,cv.nome,cv.classe_documental);
  end loop;

  foreach k in array keys loop
    select o into opt
      from jsonb_array_elements(coalesce(pv.specific_schema->'component_options','[]'::jsonb)) o
     where trim(o->>'key')=k limit 1;
    if opt is null then raise exception 'Componente dinâmico inválido para este protocolo.' using errcode='22023'; end if;
    if lower(trim(opt->>'classe_documental')) not in ('injetavel','nao_injetavel') then
      raise exception 'Classe do componente dinâmico inválida.' using errcode='22023';
    end if;
    insert into public.clinical_treatment_components(
      treatment_id,component_key,component_name_snapshot,classe_documental_snapshot
    ) values(v_id,k,coalesce(nullif(trim(opt->>'label'),''),k),lower(trim(opt->>'classe_documental')));
  end loop;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(
    v_user,'clinical_treatment_created','clinical_treatments',v_id,
    jsonb_build_object('procedure_version_id',pv.id,'agendamento_id',p_agendamento_id,'profissional_user_id',p_profissional_user_id)
  );
  return v_id;
end;
$$;

-- Preserva o contrato 6C: criar tratamento pelo fluxo antigo continua atribuindo
-- a profissional autenticada e delega para o helper parametrizado acima.
create or replace function private.bc_treatment_create_impl(
  p_cliente_id uuid,
  p_procedure_id uuid,
  p_agendamento_id uuid,
  p_component_version_ids uuid[],
  p_component_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
begin
  return private.bc_treatment_create_for_professional_impl(
    p_cliente_id,p_procedure_id,p_agendamento_id,auth.uid(),p_component_version_ids,p_component_keys
  );
end;
$$;

revoke all on function private.bc_treatment_create_for_professional_impl(uuid,uuid,uuid,uuid,uuid[],text[]) from public,anon,authenticated;
revoke all on function private.bc_treatment_create_impl(uuid,uuid,uuid,uuid[],text[]) from public;
revoke execute on function private.bc_treatment_create_impl(uuid,uuid,uuid,uuid[],text[]) from anon;
grant execute on function private.bc_treatment_create_impl(uuid,uuid,uuid,uuid[],text[]) to authenticated;

create or replace function private.bc_quick_visit_create_impl(
  p_request_key uuid,
  p_cliente_id uuid,
  p_profissional_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_observacao text,
  p_component_version_ids uuid[],
  p_component_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_request public.quick_visit_requests%rowtype;
  v_appointment_id uuid;
  v_treatment_id uuid;
  v_version_id uuid;
  v_ids uuid[]:=coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_component_version_ids,'{}'::uuid[])) x),'{}'::uuid[]);
  v_keys text[]:=coalesce((select array_agg(distinct trim(x) order by trim(x)) from unnest(coalesce(p_component_keys,'{}'::text[])) x where nullif(trim(x),'') is not null),'{}'::text[]);
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao encaixe.' using errcode='42501';
  end if;
  if p_request_key is null then
    raise exception 'Chave idempotente do encaixe é obrigatória.' using errcode='22023';
  end if;
  if not private.is_bc_admin() and p_profissional_user_id<>v_user then
    raise exception 'Colaboradora só pode criar encaixe para a própria agenda.' using errcode='42501';
  end if;
  if not exists(select 1 from public.clientes c where c.id=p_cliente_id and c.ativo=true) then
    raise exception 'Cliente ativa não encontrada.' using errcode='P0002';
  end if;
  if not exists(
    select 1 from public.staff_profiles sp
    where sp.user_id=p_profissional_user_id and sp.active and sp.atende_clientes
  ) then
    raise exception 'Profissional indisponível para atendimento.' using errcode='22023';
  end if;
  select p.current_version_id into v_version_id
    from public.procedimentos p
   where p.id=p_procedimento_id
     and p.ativo=true
     and p.archived_at is null
     and p.current_version_id is not null;
  if not found or v_version_id is null then
    raise exception 'Procedimento inválido ou inativo.' using errcode='22023';
  end if;
  if not exists(select 1 from public.procedure_versions v where v.id=v_version_id and v.status='published') then
    raise exception 'Versão publicada não encontrada.' using errcode='P0002';
  end if;
  if not private.bc_treatment_can_execute_version(v_version_id,p_profissional_user_id) then
    raise exception 'Profissional não autorizada para este procedimento.' using errcode='42501';
  end if;
  if p_inicio is null or (p_fim is not null and p_fim<=p_inicio) then
    raise exception 'Horário do encaixe inválido.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bc-quick-visit:'||p_request_key::text, 59)
  );

  select * into v_request
    from public.quick_visit_requests
   where request_key=p_request_key;
  if found then
    if v_request.actor_user_id<>v_user
       or v_request.cliente_id<>p_cliente_id
       or v_request.profissional_user_id<>p_profissional_user_id
       or v_request.procedimento_id<>p_procedimento_id
       or v_request.inicio<>p_inicio
       or v_request.fim is distinct from p_fim
       or v_request.component_version_ids<>v_ids
       or v_request.component_keys<>v_keys then
      raise exception 'Chave de encaixe já utilizada com dados diferentes.' using errcode='23505';
    end if;
    return jsonb_build_object('appointment_id',v_request.appointment_id,'treatment_id',v_request.treatment_id);
  end if;

  v_appointment_id:=private.bc_agendamento_create_impl(
    p_cliente_id,p_profissional_user_id,p_procedimento_id,p_inicio,p_fim,p_observacao
  );
  update public.agendamentos set origem='encaixe' where id=v_appointment_id;

  v_treatment_id:=private.bc_treatment_create_for_professional_impl(
    p_cliente_id,p_procedimento_id,v_appointment_id,p_profissional_user_id,v_ids,v_keys
  );

  insert into public.quick_visit_requests(
    request_key,actor_user_id,cliente_id,profissional_user_id,procedimento_id,inicio,fim,
    component_version_ids,component_keys,appointment_id,treatment_id
  ) values(
    p_request_key,v_user,p_cliente_id,p_profissional_user_id,p_procedimento_id,p_inicio,p_fim,
    v_ids,v_keys,v_appointment_id,v_treatment_id
  );

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(
    v_user,'quick_visit_created','clinical_treatments',v_treatment_id,
    jsonb_build_object('appointment_id',v_appointment_id,'profissional_user_id',p_profissional_user_id,'origem','encaixe')
  );

  return jsonb_build_object('appointment_id',v_appointment_id,'treatment_id',v_treatment_id);
end;
$$;

create or replace function public.bc_quick_visit_create(
  p_request_key uuid,
  p_cliente_id uuid,
  p_profissional_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null,
  p_component_version_ids uuid[] default '{}'::uuid[],
  p_component_keys text[] default '{}'::text[]
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.bc_quick_visit_create_impl(
    p_request_key,p_cliente_id,p_profissional_user_id,p_procedimento_id,p_inicio,p_fim,p_observacao,
    p_component_version_ids,p_component_keys
  );
$$;

revoke all on function public.bc_quick_visit_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) from public;
revoke execute on function public.bc_quick_visit_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) from anon;
grant execute on function public.bc_quick_visit_create(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) to authenticated;

revoke all on function private.bc_quick_visit_create_impl(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) from public;
revoke execute on function private.bc_quick_visit_create_impl(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) from anon;
grant execute on function private.bc_quick_visit_create_impl(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid[],text[]) to authenticated;
