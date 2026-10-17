-- Calendário público mensal: janela civil atual até +12 meses, inclusive.
-- Nenhuma disponibilidade é criada; dias sem horários reais continuam indisponíveis.
-- A mesma validação limita overview, month, slots e confirmação da reserva.
create index if not exists professional_availability_public_calendar_idx
  on public.professional_availability_days(local_date,professional_user_id)
  where enabled=true;

create or replace function private.bc_schedule_assert_public_month(p_date date)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_current date:=pg_catalog.date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  v_month date:=pg_catalog.date_trunc('month',p_date::timestamp)::date;
begin
  if p_date is null or v_month<v_current or v_month>(v_current+interval '12 months')::date then
    raise exception 'Data fora do mês disponível.' using errcode='22023';
  end if;
  return v_month;
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
  v_start_time time;
  v_end_time time;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  v_local_date:=(p_inicio at time zone 'America/Sao_Paulo')::date;
  perform private.bc_schedule_assert_public_month(v_local_date);
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
  v_duration integer;
  v_start_time time;
  v_end_time time;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_result jsonb;
begin
  perform private.bc_schedule_assert_public_month(p_local_date);
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
$$;

create or replace function public.bc_public_agenda_month(
  p_professional_user_id uuid,p_procedimento_id uuid,p_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date:=private.bc_schedule_assert_public_month(p_month);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',v_month+n,
    'available',jsonb_array_length(private.bc_schedule_slots(p_professional_user_id,p_procedimento_id,v_month+n))>0
  ) order by n),'[]'::jsonb)
  into v_result
  from pg_catalog.generate_series(0,extract(day from v_month+interval '1 month - 1 day')::integer-1) x(n);
  return v_result;
end;
$$;


-- EXISTS interrompe a busca no primeiro slot real de cada dia. Não agrega
-- todas as combinações de procedimentos/profissionais nem materializa seus slots.
create or replace function public.bc_public_agenda_overview(p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date:=private.bc_schedule_assert_public_month(p_month);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',v_month+calendar.n,
    'available',exists(
      select 1
      from public.professional_availability_days d
      join public.staff_profiles sp on sp.user_id=d.professional_user_id
        and sp.active=true and sp.atende_clientes=true
      cross join public.procedimentos p
      join public.procedure_versions pv on pv.id=p.current_version_id and pv.status='published'
      where d.local_date=v_month+calendar.n and d.enabled=true
        and p.ativo=true and p.archived_at is null and p.duracao_padrao>0
        and (p.access_mode='general' or (p.access_mode='restricted' and exists(
          select 1 from public.procedure_professional_permissions pp
          where pp.procedimento_id=p.id and pp.professional_user_id=sp.user_id
            and pp.allowed=true and pp.revoked_at is null
        )))
        and not exists(
          select 1 from public.professional_agenda_inactivations i
          where i.professional_user_id=sp.user_id and i.reactivated_at is null
            and i.starts_on<=d.local_date
            and (i.planned_ends_on is null or i.planned_ends_on>=d.local_date)
        )
        and exists(
          select 1
          from pg_catalog.generate_series(
            pg_catalog.to_timestamp(ceil(extract(epoch from ((d.local_date+d.start_time) at time zone 'America/Sao_Paulo'))/900)*900),
            ((d.local_date+d.end_time) at time zone 'America/Sao_Paulo')-pg_catalog.make_interval(mins=>p.duracao_padrao),
            interval '15 minutes'
          ) slot(start_at)
          where slot.start_at>now()
            and not exists(
              select 1 from public.professional_schedule_blocks b
              where b.professional_user_id=sp.user_id
                and b.starts_at<slot.start_at+pg_catalog.make_interval(mins=>p.duracao_padrao)
                and b.ends_at>slot.start_at
            )
            and not exists(
              select 1 from public.agendamentos a
              left join public.procedimentos ap on ap.id=a.procedimento_id
              where a.colaboradora_user_id=sp.user_id and a.status not in ('cancelado','faltou')
                and a.inicio<slot.start_at+pg_catalog.make_interval(mins=>p.duracao_padrao)
                and coalesce(a.fim,a.inicio+pg_catalog.make_interval(mins=>coalesce(ap.duracao_padrao,60)))>slot.start_at
            )
        )
    )
  ) order by calendar.n),'[]'::jsonb)
  into v_result
  from pg_catalog.generate_series(0,extract(day from v_month+interval '1 month - 1 day')::integer-1) calendar(n);
  return v_result;
end;
$$;

revoke all on function private.bc_schedule_assert_public_month(date) from public,anon,authenticated;
revoke all on function private.bc_schedule_assert_public_slot(uuid,uuid,timestamptz),
  private.bc_schedule_slots(uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.bc_public_agenda_month(uuid,uuid,date),
  public.bc_public_agenda_overview(date) from public,anon,authenticated;
grant execute on function public.bc_public_agenda_month(uuid,uuid,date),
  public.bc_public_agenda_overview(date) to service_role;
comment on function public.bc_public_agenda_overview(date) is
  'Backend público: somente data e existência de slot elegível; sem identidade ou motivo interno.';
