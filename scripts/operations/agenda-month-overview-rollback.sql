-- Rollback do calendário mensal. Restaurar frontend/Edge anteriores primeiro.
-- Definições hospedadas preservadas em 17/10/2026 antes do rollout.
-- Nenhuma alteração em clientes ou reservas.
begin;

CREATE OR REPLACE FUNCTION private.bc_schedule_assert_public_slot(p_professional_user_id uuid, p_procedimento_id uuid, p_inicio timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION private.bc_schedule_slots(p_professional_user_id uuid, p_procedimento_id uuid, p_local_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    to_timestamp(ceil(extract(epoch from v_window_start)/900)*900),
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
$function$
;

CREATE OR REPLACE FUNCTION public.bc_public_agenda_month(p_professional_user_id uuid, p_procedimento_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_current_month date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date; v_result jsonb;
begin
  if p_month is null or date_trunc('month',p_month::timestamp)::date<>v_current_month then
    raise exception 'Data fora do mês disponível.' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',v_current_month+n,
    'available',jsonb_array_length(private.bc_schedule_slots(p_professional_user_id,p_procedimento_id,v_current_month+n))>0) order by n),'[]'::jsonb)
    into v_result
    from pg_catalog.generate_series(0,extract(day from v_current_month+interval '1 month - 1 day')::integer-1) x(n);
  return v_result;
end;$function$
;

drop function if exists public.bc_public_agenda_overview(date);
drop function if exists private.bc_schedule_assert_public_month(date);
drop index if exists public.professional_availability_public_calendar_idx;
commit;

