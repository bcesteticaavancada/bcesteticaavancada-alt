-- BC Gestão — motor único de agenda pública/interna.
-- Centraliza duração, bloqueios, inativações, concorrência e RPCs de disponibilidade.
-- Disponibilidade pública não é obrigatória para encaixe interno autorizado.

create or replace function private.bc_schedule_effective_end(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_procedimento_id uuid
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duration integer;
  v_end timestamptz;
begin
  if p_inicio is null then
    raise exception 'Horário do agendamento inválido.' using errcode='22023';
  end if;

  select p.duracao_padrao into v_duration
    from public.procedimentos p
   where p.id=p_procedimento_id;

  if not found then
    raise exception 'Procedimento não encontrado.' using errcode='P0002';
  end if;

  if p_fim is null and coalesce(v_duration,0)<=0 then
    raise exception 'Procedimento sem duração válida para agenda.' using errcode='22023';
  end if;

  v_end:=coalesce(p_fim,p_inicio+pg_catalog.make_interval(mins=>v_duration));
  if v_end<=p_inicio then
    raise exception 'Horário do agendamento inválido.' using errcode='22023';
  end if;
  return v_end;
end;
$$;

create or replace function private.bc_schedule_public_eligible(
  p_professional_user_id uuid,
  p_procedimento_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
      from public.staff_profiles sp
      join public.procedimentos p on p.id=p_procedimento_id
      join public.procedure_versions pv on pv.id=p.current_version_id and pv.status='published'
     where sp.user_id=p_professional_user_id
       and sp.active=true
       and sp.atende_clientes=true
       and p.ativo=true
       and p.archived_at is null
       and p.duracao_padrao>0
       and (
         p.access_mode='general'
         or (
           p.access_mode='restricted'
           and exists(
             select 1
               from public.procedure_professional_permissions pp
              where pp.procedimento_id=p.id
                and pp.professional_user_id=p_professional_user_id
                and pp.allowed=true
                and pp.revoked_at is null
           )
         )
       )
  );
$$;

create or replace function private.bc_agendamento_lock_and_assert_no_conflict(
  p_professional_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_ignore_agendamento_id uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_end timestamptz;
  v_local_date date;
  v_conflict boolean;
begin
  v_end:=private.bc_schedule_effective_end(p_inicio,p_fim,p_procedimento_id);
  v_local_date:=(p_inicio at time zone 'America/Sao_Paulo')::date;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bc-agenda:'||p_professional_user_id::text||':'||v_local_date::text,
      41
    )
  );

  if exists(
    select 1
      from public.professional_agenda_inactivations i
     where i.professional_user_id=p_professional_user_id
       and i.reactivated_at is null
       and i.starts_on<=v_local_date
       and (i.planned_ends_on is null or i.planned_ends_on>=v_local_date)
  ) then
    raise exception 'slot_unavailable' using errcode='23P01';
  end if;

  if exists(
    select 1
      from public.professional_schedule_blocks b
     where b.professional_user_id=p_professional_user_id
       and b.starts_at<v_end
       and b.ends_at>p_inicio
  ) then
    raise exception 'slot_unavailable' using errcode='23P01';
  end if;

  select exists(
    select 1
      from public.agendamentos a
      left join public.procedimentos ap on ap.id=a.procedimento_id
     where a.colaboradora_user_id=p_professional_user_id
       and (p_ignore_agendamento_id is null or a.id<>p_ignore_agendamento_id)
       and a.status not in ('cancelado','faltou')
       and a.inicio<v_end
       and coalesce(
             a.fim,
             a.inicio+pg_catalog.make_interval(mins=>coalesce(ap.duracao_padrao,60))
           )>p_inicio
  ) into v_conflict;

  if v_conflict then
    raise exception 'slot_unavailable' using errcode='23P01';
  end if;

  return v_end;
end;
$$;

create or replace function private.bc_schedule_assert_public_slot(
  p_professional_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_end timestamptz;
  v_local_date date;
  v_month date;
  v_start_time time;
  v_end_time time;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  v_local_date:=(p_inicio at time zone 'America/Sao_Paulo')::date;
  v_month:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;

  if date_trunc('month',v_local_date::timestamp)::date<>v_month then
    raise exception 'Data fora do mês disponível.' using errcode='22023';
  end if;
  if p_inicio<=now() then
    raise exception 'Horário já iniciado.' using errcode='22023';
  end if;
  if extract(minute from (p_inicio at time zone 'America/Sao_Paulo'))::integer%15<>0
     or extract(second from (p_inicio at time zone 'America/Sao_Paulo'))<>0 then
    raise exception 'Horário fora da grade de 15 minutos.' using errcode='22023';
  end if;
  if not private.bc_schedule_public_eligible(p_professional_user_id,p_procedimento_id) then
    raise exception 'Procedimento ou profissional indisponível para agenda online.' using errcode='22023';
  end if;

  select d.start_time,d.end_time
    into v_start_time,v_end_time
    from public.professional_availability_days d
   where d.professional_user_id=p_professional_user_id
     and d.local_date=v_local_date
     and d.enabled=true;
  if not found then
    raise exception 'slot_unavailable' using errcode='23P01';
  end if;

  v_end:=private.bc_schedule_effective_end(p_inicio,null,p_procedimento_id);
  v_window_start:=(v_local_date+v_start_time) at time zone 'America/Sao_Paulo';
  v_window_end:=(v_local_date+v_end_time) at time zone 'America/Sao_Paulo';
  if p_inicio<v_window_start or v_end>v_window_end then
    raise exception 'slot_unavailable' using errcode='23P01';
  end if;

  return private.bc_agendamento_lock_and_assert_no_conflict(
    p_professional_user_id,p_procedimento_id,p_inicio,v_end,null
  );
end;
$$;

-- O trigger legado do encaixe passa a delegar para o mesmo gate canônico.
create or replace function private.bc_agendamento_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.inicio is null then
    raise exception 'Horário do agendamento inválido.' using errcode='22023';
  end if;
  if new.status in ('cancelado','faltou') then
    return new;
  end if;

  new.fim:=private.bc_agendamento_lock_and_assert_no_conflict(
    new.colaboradora_user_id,
    new.procedimento_id,
    new.inicio,
    new.fim,
    case when tg_op='UPDATE' then new.id else null end
  );
  return new;
end;
$$;

-- Geração de slots públicos sem revelar compromissos ocupados.
create or replace function private.bc_schedule_slots(
  p_professional_user_id uuid,
  p_procedimento_id uuid,
  p_local_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  v_duration integer;
  v_start_time time;
  v_end_time time;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_result jsonb;
begin
  if date_trunc('month',p_local_date::timestamp)::date<>v_month then
    raise exception 'Data fora do mês disponível.' using errcode='22023';
  end if;
  if not private.bc_schedule_public_eligible(p_professional_user_id,p_procedimento_id) then
    return '[]'::jsonb;
  end if;
  if exists(
    select 1 from public.professional_agenda_inactivations i
     where i.professional_user_id=p_professional_user_id
       and i.reactivated_at is null
       and i.starts_on<=p_local_date
       and (i.planned_ends_on is null or i.planned_ends_on>=p_local_date)
  ) then
    return '[]'::jsonb;
  end if;

  select d.start_time,d.end_time
    into v_start_time,v_end_time
    from public.professional_availability_days d
   where d.professional_user_id=p_professional_user_id
     and d.local_date=p_local_date
     and d.enabled=true;
  if not found then return '[]'::jsonb; end if;

  select p.duracao_padrao into v_duration
    from public.procedimentos p where p.id=p_procedimento_id;
  if coalesce(v_duration,0)<=0 then return '[]'::jsonb; end if;

  v_window_start:=(p_local_date+v_start_time) at time zone 'America/Sao_Paulo';
  v_window_end:=(p_local_date+v_end_time) at time zone 'America/Sao_Paulo';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'start_at',s,
      'end_at',s+pg_catalog.make_interval(mins=>v_duration),
      'time',to_char(s at time zone 'America/Sao_Paulo','HH24:MI')
    ) order by s
  ),'[]'::jsonb)
  into v_result
  from pg_catalog.generate_series(
    v_window_start,
    v_window_end-pg_catalog.make_interval(mins=>v_duration),
    interval '15 minutes'
  ) s
  where s>now()
    and not exists(
      select 1 from public.professional_schedule_blocks b
       where b.professional_user_id=p_professional_user_id
         and b.starts_at<s+pg_catalog.make_interval(mins=>v_duration)
         and b.ends_at>s
    )
    and not exists(
      select 1
        from public.agendamentos a
        left join public.procedimentos ap on ap.id=a.procedimento_id
       where a.colaboradora_user_id=p_professional_user_id
         and a.status not in ('cancelado','faltou')
         and a.inicio<s+pg_catalog.make_interval(mins=>v_duration)
         and coalesce(a.fim,a.inicio+pg_catalog.make_interval(mins=>coalesce(ap.duracao_padrao,60)))>s
    );

  return v_result;
end;
$$;

-- Reimplementa criação interna: não exige disponibilidade pública, mas respeita
-- bloqueio, inativação e conflito. O mesmo gate protege encaixe interno e admin.
create or replace function private.bc_agendamento_create_impl(
  p_cliente_id uuid,
  p_colaboradora_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_end timestamptz;
  v_agendamento_id uuid;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à agenda.' using errcode='42501';
  end if;
  if not private.is_bc_admin() and p_colaboradora_user_id<>v_user_id then
    raise exception 'Colaboradora só pode criar agendamento para a própria agenda.' using errcode='42501';
  end if;
  if not exists(select 1 from public.clientes c where c.id=p_cliente_id and c.ativo=true) then
    raise exception 'Cliente não encontrado ou arquivado.' using errcode='P0002';
  end if;
  if not exists(
    select 1 from public.staff_profiles sp
     where sp.user_id=p_colaboradora_user_id and sp.active=true and sp.atende_clientes=true
  ) then
    raise exception 'Profissional indisponível para agenda.' using errcode='22023';
  end if;
  if not exists(select 1 from public.procedimentos p where p.id=p_procedimento_id and p.ativo=true) then
    raise exception 'Procedimento inválido ou inativo.' using errcode='22023';
  end if;

  v_end:=private.bc_agendamento_lock_and_assert_no_conflict(
    p_colaboradora_user_id,p_procedimento_id,p_inicio,p_fim,null
  );

  insert into public.agendamentos(
    cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,status,
    observacao_administrativa,created_by,origem
  ) values(
    p_cliente_id,p_colaboradora_user_id,p_procedimento_id,p_inicio,v_end,'agendado',
    nullif(trim(p_observacao),''),v_user_id,'interno'
  ) returning id into v_agendamento_id;
  return v_agendamento_id;
end;
$$;

create or replace function private.bc_agendamento_update_impl(
  p_agendamento_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_agendamento public.agendamentos%rowtype;
  v_end timestamptz;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à agenda.' using errcode='42501';
  end if;
  select * into v_agendamento from public.agendamentos where id=p_agendamento_id for update;
  if not found then raise exception 'Agendamento não encontrado.' using errcode='P0002'; end if;
  if not private.is_bc_admin() and v_agendamento.colaboradora_user_id<>v_user_id then
    raise exception 'Acesso negado ao agendamento.' using errcode='42501';
  end if;
  if v_agendamento.cliente_id is not null
     and not exists(select 1 from public.clientes c where c.id=v_agendamento.cliente_id and c.ativo=true) then
    raise exception 'Cliente arquivado não pode ter agendamento remarcado.' using errcode='22023';
  end if;
  if not exists(select 1 from public.procedimentos p where p.id=p_procedimento_id and p.ativo=true) then
    raise exception 'Procedimento inválido ou inativo.' using errcode='22023';
  end if;

  v_end:=private.bc_agendamento_lock_and_assert_no_conflict(
    v_agendamento.colaboradora_user_id,p_procedimento_id,p_inicio,p_fim,p_agendamento_id
  );
  update public.agendamentos
     set procedimento_id=p_procedimento_id,
         inicio=p_inicio,
         fim=v_end,
         observacao_administrativa=nullif(trim(p_observacao),''),
         updated_at=now()
   where id=p_agendamento_id;
  return p_agendamento_id;
end;
$$;

create or replace function private.bc_schedule_can_manage(p_professional_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and private.is_bc_active_staff()
     and (private.is_bc_admin() or auth.uid()=p_professional_user_id);
$$;

create or replace function private.bc_schedule_month_get_impl(
  p_professional_user_id uuid,
  p_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_month date:=date_trunc('month',p_month::timestamp)::date; v_result jsonb;
begin
  if not private.bc_schedule_can_manage(p_professional_user_id) then
    raise exception 'Acesso negado à disponibilidade.' using errcode='42501';
  end if;
  select jsonb_build_object(
    'professional_user_id',p_professional_user_id,
    'month',v_month,
    'days',coalesce((select jsonb_agg(to_jsonb(d) order by d.local_date) from public.professional_availability_days d where d.professional_user_id=p_professional_user_id and d.local_date>=v_month and d.local_date<(v_month+interval '1 month')::date),'[]'::jsonb),
    'blocks',coalesce((select jsonb_agg(to_jsonb(b) order by b.starts_at) from public.professional_schedule_blocks b where b.professional_user_id=p_professional_user_id and b.starts_at<((v_month+interval '1 month') at time zone 'America/Sao_Paulo') and b.ends_at>(v_month at time zone 'America/Sao_Paulo')),'[]'::jsonb),
    'inactivations',coalesce((select jsonb_agg(to_jsonb(i) order by i.starts_on) from public.professional_agenda_inactivations i where i.professional_user_id=p_professional_user_id and i.starts_on<(v_month+interval '1 month')::date and (i.planned_ends_on is null or i.planned_ends_on>=v_month)),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.bc_schedule_month_get(p_professional_user_id uuid,p_month date)
returns jsonb language sql security definer set search_path=''
as $$select private.bc_schedule_month_get_impl($1,$2);$$;

create or replace function private.bc_schedule_day_upsert_impl(
  p_professional_user_id uuid,p_local_date date,p_enabled boolean,p_start_time time,p_end_time time
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if not private.bc_schedule_can_manage(p_professional_user_id) then raise exception 'Acesso negado à disponibilidade.' using errcode='42501'; end if;
  if p_enabled and (p_start_time is null or p_end_time is null or p_end_time<=p_start_time) then raise exception 'Janela de atendimento inválida.' using errcode='22023'; end if;
  insert into public.professional_availability_days(id,professional_user_id,local_date,enabled,start_time,end_time,created_by,updated_by)
  values(gen_random_uuid(),p_professional_user_id,p_local_date,p_enabled,case when p_enabled then p_start_time end,case when p_enabled then p_end_time end,v_user,v_user)
  on conflict(professional_user_id,local_date) do update set enabled=excluded.enabled,start_time=excluded.start_time,end_time=excluded.end_time,updated_by=v_user,updated_at=now()
  returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'schedule_day_upserted','professional_availability_days',v_id,jsonb_build_object('professional_user_id',p_professional_user_id,'local_date',p_local_date,'enabled',p_enabled));
  return v_id;
end;$$;
create or replace function public.bc_schedule_day_upsert(p_professional_user_id uuid,p_local_date date,p_enabled boolean,p_start_time time default null,p_end_time time default null)
returns uuid language sql security definer set search_path='' as $$select private.bc_schedule_day_upsert_impl($1,$2,$3,$4,$5);$$;

create or replace function private.bc_schedule_days_apply_impl(
  p_professional_user_id uuid,p_local_dates date[],p_enabled boolean,p_start_time time,p_end_time time
)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_date date; v_count integer:=0;
begin
  if not private.bc_schedule_can_manage(p_professional_user_id) then raise exception 'Acesso negado à disponibilidade.' using errcode='42501'; end if;
  foreach v_date in array coalesce(p_local_dates,'{}'::date[]) loop
    perform private.bc_schedule_day_upsert_impl(p_professional_user_id,v_date,p_enabled,p_start_time,p_end_time); v_count:=v_count+1;
  end loop;
  return v_count;
end;$$;
create or replace function public.bc_schedule_days_apply(p_professional_user_id uuid,p_local_dates date[],p_enabled boolean,p_start_time time default null,p_end_time time default null)
returns integer language sql security definer set search_path='' as $$select private.bc_schedule_days_apply_impl($1,$2,$3,$4,$5);$$;

create or replace function private.bc_schedule_block_create_impl(
  p_professional_user_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_block_type text,p_internal_note text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if not private.bc_schedule_can_manage(p_professional_user_id) then raise exception 'Acesso negado ao bloqueio.' using errcode='42501'; end if;
  if p_starts_at is null or p_ends_at<=p_starts_at then raise exception 'Período do bloqueio inválido.' using errcode='22023'; end if;
  if p_block_type not in ('almoco','compromisso','reuniao','preparacao_manutencao','outro') then raise exception 'Tipo de bloqueio inválido.' using errcode='22023'; end if;
  insert into public.professional_schedule_blocks(professional_user_id,starts_at,ends_at,block_type,internal_note,created_by)
  values(p_professional_user_id,p_starts_at,p_ends_at,p_block_type,nullif(trim(p_internal_note),''),v_user) returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'schedule_block_created','professional_schedule_blocks',v_id,jsonb_build_object('professional_user_id',p_professional_user_id,'starts_at',p_starts_at,'ends_at',p_ends_at,'block_type',p_block_type));
  return v_id;
end;$$;
create or replace function public.bc_schedule_block_create(p_professional_user_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_block_type text,p_internal_note text default null)
returns uuid language sql security definer set search_path='' as $$select private.bc_schedule_block_create_impl($1,$2,$3,$4,$5);$$;

create or replace function private.bc_schedule_block_delete_impl(p_block_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_prof uuid;
begin
  select professional_user_id into v_prof from public.professional_schedule_blocks where id=p_block_id;
  if not found then raise exception 'Bloqueio não encontrado.' using errcode='P0002'; end if;
  if not private.bc_schedule_can_manage(v_prof) then raise exception 'Acesso negado ao bloqueio.' using errcode='42501'; end if;
  delete from public.professional_schedule_blocks where id=p_block_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data) values(v_user,'schedule_block_deleted','professional_schedule_blocks',p_block_id,jsonb_build_object('professional_user_id',v_prof));
  return p_block_id;
end;$$;
create or replace function public.bc_schedule_block_delete(p_block_id uuid)
returns uuid language sql security definer set search_path='' as $$select private.bc_schedule_block_delete_impl($1);$$;

create or replace function private.bc_agenda_inactivation_create_impl(
  p_professional_user_id uuid,p_starts_on date,p_planned_ends_on date,p_reason text,p_internal_note text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_affected integer;
begin
  if not private.bc_schedule_can_manage(p_professional_user_id) then raise exception 'Acesso negado à inativação.' using errcode='42501'; end if;
  if p_planned_ends_on is not null and p_planned_ends_on<p_starts_on then raise exception 'Período de inativação inválido.' using errcode='22023'; end if;
  if p_reason not in ('ferias','motivos_pessoais','motivo_medico','licenca_afastamento','curso_capacitacao','viagem','folga','outro') then raise exception 'Motivo de inativação inválido.' using errcode='22023'; end if;
  select count(*)::integer into v_affected from public.agendamentos a where a.colaboradora_user_id=p_professional_user_id and a.status not in ('cancelado','faltou') and (a.inicio at time zone 'America/Sao_Paulo')::date>=p_starts_on and (p_planned_ends_on is null or (a.inicio at time zone 'America/Sao_Paulo')::date<=p_planned_ends_on);
  insert into public.professional_agenda_inactivations(professional_user_id,starts_on,planned_ends_on,reason,internal_note,created_by)
  values(p_professional_user_id,p_starts_on,p_planned_ends_on,p_reason,nullif(trim(p_internal_note),''),v_user) returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'agenda_inactivated','professional_agenda_inactivations',v_id,jsonb_build_object('professional_user_id',p_professional_user_id,'starts_on',p_starts_on,'planned_ends_on',p_planned_ends_on,'reason',p_reason,'affected_appointments',v_affected));
  return jsonb_build_object('id',v_id,'affected_appointments',v_affected);
end;$$;
create or replace function public.bc_agenda_inactivation_create(p_professional_user_id uuid,p_starts_on date,p_planned_ends_on date,p_reason text,p_internal_note text default null)
returns jsonb language sql security definer set search_path='' as $$select private.bc_agenda_inactivation_create_impl($1,$2,$3,$4,$5);$$;

create or replace function private.bc_agenda_reactivate_impl(p_inactivation_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_prof uuid;
begin
  select professional_user_id into v_prof from public.professional_agenda_inactivations where id=p_inactivation_id for update;
  if not found then raise exception 'Inativação não encontrada.' using errcode='P0002'; end if;
  if not private.bc_schedule_can_manage(v_prof) then raise exception 'Acesso negado à inativação.' using errcode='42501'; end if;
  update public.professional_agenda_inactivations set reactivated_at=now(),reactivated_by=v_user where id=p_inactivation_id and reactivated_at is null;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'agenda_reactivated','professional_agenda_inactivations',p_inactivation_id,jsonb_build_object('professional_user_id',v_prof,'reactivated_at',now()));
  return p_inactivation_id;
end;$$;
create or replace function public.bc_agenda_reactivate(p_inactivation_id uuid)
returns uuid language sql security definer set search_path='' as $$select private.bc_agenda_reactivate_impl($1);$$;

create or replace function private.bc_agendamento_link_cliente_impl(p_agendamento_id uuid,p_cliente_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_a public.agendamentos%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao vínculo.' using errcode='42501'; end if;
  select * into v_a from public.agendamentos where id=p_agendamento_id for update;
  if not found then raise exception 'Agendamento não encontrado.' using errcode='P0002'; end if;
  if v_a.origem<>'site' then raise exception 'Somente reserva do site usa vínculo posterior.' using errcode='22023'; end if;
  if not private.is_bc_admin() and v_a.colaboradora_user_id<>v_user then raise exception 'Acesso negado ao vínculo.' using errcode='42501'; end if;
  if not exists(select 1 from public.clientes c where c.id=p_cliente_id and c.ativo=true) then raise exception 'Cliente ativa não encontrada.' using errcode='P0002'; end if;
  update public.agendamentos set cliente_id=p_cliente_id,updated_at=now() where id=p_agendamento_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'public_booking_linked','agendamentos',p_agendamento_id,jsonb_build_object('cliente_id',p_cliente_id));
  return p_agendamento_id;
end;$$;
create or replace function public.bc_agendamento_link_cliente(p_agendamento_id uuid,p_cliente_id uuid)
returns uuid language sql security definer set search_path='' as $$select private.bc_agendamento_link_cliente_impl($1,$2);$$;

-- Catálogo/agenda pública: wrappers só para o papel backend service_role.
create or replace function public.bc_public_agenda_catalog()
returns jsonb language sql stable security definer set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.nome,'duration',p.duracao_padrao) order by p.nome),'[]'::jsonb)
  from public.procedimentos p
  join public.procedure_versions pv on pv.id=p.current_version_id and pv.status='published'
  where p.ativo=true and p.archived_at is null and p.duracao_padrao>0;
$$;

create or replace function public.bc_public_agenda_professionals(p_procedimento_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',sp.user_id,'name',sp.display_name) order by sp.display_name),'[]'::jsonb)
  from public.staff_profiles sp
  where private.bc_schedule_public_eligible(sp.user_id,p_procedimento_id);
$$;

create or replace function public.bc_public_agenda_slots(p_professional_user_id uuid,p_procedimento_id uuid,p_local_date date)
returns jsonb language sql stable security definer set search_path=''
as $$select private.bc_schedule_slots($1,$2,$3);$$;

create or replace function public.bc_public_agenda_month(p_professional_user_id uuid,p_procedimento_id uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_current_month date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date; v_result jsonb;
begin
  if date_trunc('month',p_month::timestamp)::date<>v_current_month then raise exception 'Data fora do mês disponível.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',d,'available',jsonb_array_length(private.bc_schedule_slots(p_professional_user_id,p_procedimento_id,d))>0) order by d),'[]'::jsonb)
    into v_result
    from pg_catalog.generate_series(v_current_month,(v_current_month+interval '1 month-1 day')::date,interval '1 day') x(d);
  return v_result;
end;$$;

create or replace function public.bc_public_agenda_book(
  p_name text,
  p_phone text,
  p_professional_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_origin_hash text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_name text:=nullif(trim(p_name),'');
  v_phone text:=nullif(trim(p_phone),'');
  v_phone_normalized text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  v_end timestamptz;
  v_id uuid;
  v_attempts integer;
begin
  if v_name is null or char_length(v_name)<2 or char_length(v_name)>160 then raise exception 'Nome inválido.' using errcode='22023'; end if;
  if char_length(v_phone_normalized)<10 or char_length(v_phone_normalized)>13 then raise exception 'WhatsApp inválido.' using errcode='22023'; end if;
  if p_origin_hash is null or char_length(p_origin_hash)<32 then raise exception 'Origem inválida.' using errcode='22023'; end if;

  -- Limite inicial: 10 tentativas de confirmação por 10 minutos por origem hash.
  select count(*)::integer into v_attempts
    from private.public_booking_rate_limits r
   where r.origin_hash=p_origin_hash
     and r.attempted_at>=now()-interval '10 minutes';
  if v_attempts>=10 then raise exception 'rate_limit_exceeded' using errcode='53300'; end if;
  insert into private.public_booking_rate_limits(origin_hash) values(p_origin_hash);

  v_end:=private.bc_schedule_assert_public_slot(p_professional_user_id,p_procedimento_id,p_inicio);
  insert into public.agendamentos(
    cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,status,created_by,origem,
    public_booking_name,public_booking_phone,public_booking_phone_normalized
  ) values(
    null,p_professional_user_id,p_procedimento_id,p_inicio,v_end,'agendado',null,'site',
    v_name,v_phone,v_phone_normalized
  ) returning id into v_id;
  return jsonb_build_object('appointment_id',v_id,'start_at',p_inicio,'end_at',v_end);
end;$$;

-- Reserva pública sem cliente vinculada ocupa agenda, mas não abre prontuário formal.
create or replace function private.bc_treatment_requires_linked_client()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_client uuid;
begin
  if new.agendamento_id is null then return new; end if;
  select a.cliente_id into v_client from public.agendamentos a where a.id=new.agendamento_id;
  if not found then raise exception 'Agendamento não encontrado.' using errcode='P0002'; end if;
  if v_client is null then raise exception 'Cadastro da cliente precisa ser vinculado antes do atendimento.' using errcode='55000'; end if;
  if new.cliente_id<>v_client then raise exception 'Cliente do atendimento não corresponde ao agendamento.' using errcode='42501'; end if;
  return new;
end;$$;
drop trigger if exists bc_treatment_requires_linked_client on public.clinical_treatments;
create trigger bc_treatment_requires_linked_client before insert or update of agendamento_id,cliente_id on public.clinical_treatments for each row execute function private.bc_treatment_requires_linked_client();

drop trigger if exists bc_attendance_requires_linked_client on public.atendimentos;
create trigger bc_attendance_requires_linked_client before insert or update of agendamento_id,cliente_id on public.atendimentos for each row execute function private.bc_treatment_requires_linked_client();

-- Privilégios: gestão autenticada por wrappers; camada pública apenas pelo backend.
revoke all on function private.bc_schedule_effective_end(timestamptz,timestamptz,uuid) from public,anon,authenticated;
revoke all on function private.bc_schedule_public_eligible(uuid,uuid) from public,anon,authenticated;
revoke all on function private.bc_agendamento_lock_and_assert_no_conflict(uuid,uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;
revoke all on function private.bc_schedule_assert_public_slot(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function private.bc_schedule_slots(uuid,uuid,date) from public,anon,authenticated;
revoke all on function private.bc_schedule_can_manage(uuid) from public,anon,authenticated;
revoke all on function private.bc_treatment_requires_linked_client() from public,anon,authenticated;

revoke execute on function public.bc_schedule_month_get(uuid,date) from public,anon;
revoke execute on function public.bc_schedule_day_upsert(uuid,date,boolean,time,time) from public,anon;
revoke execute on function public.bc_schedule_days_apply(uuid,date[],boolean,time,time) from public,anon;
revoke execute on function public.bc_schedule_block_create(uuid,timestamptz,timestamptz,text,text) from public,anon;
revoke execute on function public.bc_schedule_block_delete(uuid) from public,anon;
revoke execute on function public.bc_agenda_inactivation_create(uuid,date,date,text,text) from public,anon;
revoke execute on function public.bc_agenda_reactivate(uuid) from public,anon;
revoke execute on function public.bc_agendamento_link_cliente(uuid,uuid) from public,anon;
grant execute on function public.bc_schedule_month_get(uuid,date) to authenticated;
grant execute on function public.bc_schedule_day_upsert(uuid,date,boolean,time,time) to authenticated;
grant execute on function public.bc_schedule_days_apply(uuid,date[],boolean,time,time) to authenticated;
grant execute on function public.bc_schedule_block_create(uuid,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.bc_schedule_block_delete(uuid) to authenticated;
grant execute on function public.bc_agenda_inactivation_create(uuid,date,date,text,text) to authenticated;
grant execute on function public.bc_agenda_reactivate(uuid) to authenticated;
grant execute on function public.bc_agendamento_link_cliente(uuid,uuid) to authenticated;

revoke execute on function public.bc_public_agenda_catalog() from public,anon,authenticated;
revoke execute on function public.bc_public_agenda_professionals(uuid) from public,anon,authenticated;
revoke execute on function public.bc_public_agenda_month(uuid,uuid,date) from public,anon,authenticated;
revoke execute on function public.bc_public_agenda_slots(uuid,uuid,date) from public,anon,authenticated;
revoke execute on function public.bc_public_agenda_book(text,text,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.bc_public_agenda_catalog() to service_role;
grant execute on function public.bc_public_agenda_professionals(uuid) to service_role;
grant execute on function public.bc_public_agenda_month(uuid,uuid,date) to service_role;
grant execute on function public.bc_public_agenda_slots(uuid,uuid,date) to service_role;
grant execute on function public.bc_public_agenda_book(text,text,uuid,uuid,timestamptz,text) to service_role;
