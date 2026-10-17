-- Agenda V2: fechamento aditivo da homologação; sem reescrever migrations anteriores.
-- Canal de aquisição separado da origem operacional (agenda/encaixe).
alter table public.agendamentos add column booking_channel text not null default 'internal'
  constraint agendamentos_booking_channel_check check (booking_channel in ('internal','site'));
-- Não dispara o gate de horários em compromissos históricos durante o backfill.
create or replace function private.bc_agendamento_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='UPDATE' then
    if (new.colaboradora_user_id,new.procedimento_id,new.inicio,new.fim)
       is not distinct from (old.colaboradora_user_id,old.procedimento_id,old.inicio,old.fim)
       and (new.status=old.status or (new.status not in ('cancelado','faltou') and old.status not in ('cancelado','faltou'))) then
      return new;
    end if;
  end if;
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

update public.agendamentos set booking_channel='site' where origem='site';
alter table public.agendamentos drop constraint agendamentos_identity_by_origin_check;
alter table public.agendamentos add constraint agendamentos_identity_by_origin_check check (
 (booking_channel='internal' and cliente_id is not null and created_by is not null)
 or (booking_channel='site' and nullif(trim(public_booking_name),'') is not null
     and nullif(trim(public_booking_phone),'') is not null
     and public_booking_phone_normalized is not null
     and public_booking_phone_normalized ~ '^[0-9]{10,13}$')
);
comment on column public.agendamentos.booking_channel is 'Canal de reserva: site ou internal; origem operacional permanece independente.';

-- Lock por profissional protege inclusive intervalos que cruzam meia-noite.
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
      'bc-agenda:'||p_professional_user_id::text,
      41
    )
  );

  if exists(
    select 1
      from public.professional_agenda_inactivations i
     where i.professional_user_id=p_professional_user_id
       and i.reactivated_at is null
       and (i.starts_on::timestamp at time zone 'America/Sao_Paulo')<v_end
       and (i.planned_ends_on is null or ((i.planned_ends_on+1)::timestamp at time zone 'America/Sao_Paulo')>p_inicio)
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

create or replace function public.bc_public_agenda_month(p_professional_user_id uuid,p_procedimento_id uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bc-public-rate:'||p_origin_hash,42));
  -- Limite inicial: 10 tentativas de confirmação por 10 minutos por origem hash.
  select count(*)::integer into v_attempts
    from private.public_booking_rate_limits r
   where r.origin_hash=p_origin_hash
     and r.attempted_at>=now()-interval '10 minutes';
  if v_attempts>=10 then return jsonb_build_object('error_code','53300','error','rate_limit_exceeded'); end if;
  insert into private.public_booking_rate_limits(origin_hash) values(p_origin_hash);

  -- O sub-bloco preserva a tentativa quando o slot é recusado.
  begin
  v_end:=private.bc_schedule_assert_public_slot(p_professional_user_id,p_procedimento_id,p_inicio);
  insert into public.agendamentos(
    cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,status,created_by,origem,booking_channel,
    public_booking_name,public_booking_phone,public_booking_phone_normalized
  ) values(
    null,p_professional_user_id,p_procedimento_id,p_inicio,v_end,'agendado',null,'agenda','site',
    v_name,v_phone,v_phone_normalized
  ) returning id into v_id;
  exception when exclusion_violation or invalid_parameter_value then
    return jsonb_build_object('error_code',sqlstate,'error',sqlerrm);
  end;
  return jsonb_build_object('appointment_id',v_id,'start_at',p_inicio,'end_at',v_end);
end;$$;
create or replace function private.bc_agendamento_link_cliente_impl(
  p_agendamento_id uuid,
  p_cliente_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_a public.agendamentos%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao vínculo.' using errcode = '42501';
  end if;

  select * into v_a
    from public.agendamentos
   where id = p_agendamento_id
   for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_a.booking_channel <> 'site' then
    raise exception 'Somente reserva do site usa vínculo posterior.' using errcode = '22023';
  end if;
  if not private.bc_schedule_can_manage(v_a.colaboradora_user_id) then
    raise exception 'Acesso negado ao vínculo.' using errcode = '42501';
  end if;
  if v_a.cliente_id is not null then
    if v_a.cliente_id=p_cliente_id then return p_agendamento_id; end if;
    raise exception 'Reserva já vinculada a outro cadastro.' using errcode='55000';
  end if;
  if not exists(select 1 from public.clientes c where c.id = p_cliente_id and c.ativo = true) then
    raise exception 'Cliente ativa não encontrada.' using errcode = 'P0002';
  end if;

  update public.agendamentos
     set cliente_id = p_cliente_id,
         updated_at = now()
   where id = p_agendamento_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values(v_user, 'public_booking_linked', 'agendamentos', p_agendamento_id, jsonb_build_object('cliente_id', p_cliente_id));

  return p_agendamento_id;
end;
$$;

-- Uma leitura canônica; identidade e escopo vêm de auth.uid(), nunca do cliente.
create or replace function private.bc_agenda_list_impl(p_from timestamptz,p_to timestamptz,p_origin text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null or not private.is_bc_active_staff() then
   raise exception 'Acesso negado à agenda.' using errcode='42501';
 end if;
 if p_from is null or p_to is null or p_to<=p_from or p_origin is null or p_origin not in ('all','site','internal') then
   raise exception 'Filtro de agenda inválido.' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',a.id,'cliente_id',a.cliente_id,'colaboradora_user_id',a.colaboradora_user_id,
   'procedimento_id',a.procedimento_id,'inicio',a.inicio,'fim',a.fim,'status',a.status,
   'origem',a.origem,'booking_channel',a.booking_channel,'public_booking_name',a.public_booking_name,
   'public_booking_phone',a.public_booking_phone,'public_booking_phone_normalized',a.public_booking_phone_normalized,
   'observacao_administrativa',a.observacao_administrativa,
   'clientes',case when c.id is null then null else jsonb_build_object('id',c.id,'nome',c.nome,'telefone',c.telefone,'email',c.email) end,
   'procedimentos',jsonb_build_object('id',p.id,'nome',p.nome,'duracao_padrao',p.duracao_padrao)
 ) order by a.inicio,a.id),'[]'::jsonb) into v_result
 from public.agendamentos a
 left join public.clientes c on c.id=a.cliente_id
 left join public.procedimentos p on p.id=a.procedimento_id
 where a.inicio>=p_from and a.inicio<p_to
   and (a.colaboradora_user_id=v_user or private.bc_can_manage_all_agendas())
   and (p_origin='all' or a.booking_channel=p_origin);
 return v_result;
end;$$;
create or replace function public.bc_agenda_list(p_from timestamptz,p_to timestamptz,p_origin text default 'all')
returns jsonb language sql stable security invoker set search_path=''
as $$select private.bc_agenda_list_impl($1,$2,$3);$$;
revoke all on function private.bc_agenda_list_impl(timestamptz,timestamptz,text) from public,anon;
grant execute on function private.bc_agenda_list_impl(timestamptz,timestamptz,text) to authenticated;
revoke all on function public.bc_agenda_list(timestamptz,timestamptz,text) from public,anon;
grant execute on function public.bc_agenda_list(timestamptz,timestamptz,text) to authenticated;

-- Helpers de disponibilidade só são chamados pelos wrappers autenticados.
revoke all on function private.bc_schedule_month_get_impl(uuid,date),
 private.bc_schedule_day_upsert_impl(uuid,date,boolean,time,time),
 private.bc_schedule_days_apply_impl(uuid,date[],boolean,time,time),
 private.bc_schedule_block_create_impl(uuid,timestamptz,timestamptz,text,text),
 private.bc_schedule_block_delete_impl(uuid),
 private.bc_agenda_inactivation_create_impl(uuid,date,date,text,text),
 private.bc_agenda_reactivate_impl(uuid),
 private.bc_agendamento_link_cliente_impl(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.bc_public_agenda_month(uuid,uuid,date),
 public.bc_public_agenda_book(text,text,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.bc_public_agenda_month(uuid,uuid,date),
 public.bc_public_agenda_book(text,text,uuid,uuid,timestamptz,text) to service_role;

-- Status clínico também exige identidade formal confirmada.
create or replace function private.bc_set_agendamento_status_impl(
  p_agendamento_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_agendamento public.agendamentos%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('agendado', 'atendido', 'cancelado', 'faltou') then
    raise exception 'Status de agendamento inválido.' using errcode = '22023';
  end if;

  select * into v_agendamento
    from public.agendamentos
   where id = p_agendamento_id
   for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if not private.bc_schedule_can_manage(v_agendamento.colaboradora_user_id) then
    raise exception 'Acesso negado ao agendamento.' using errcode = '42501';
  end if;
  if p_status='atendido' and v_agendamento.cliente_id is null then
    raise exception 'Cadastro da cliente precisa ser vinculado antes do atendimento.' using errcode='55000';
  end if;
  if p_status = 'atendido'
     and not private.is_bc_admin()
     and v_agendamento.colaboradora_user_id <> v_user_id then
    raise exception 'Atendimento clínico deve ser concluído pela profissional responsável.' using errcode = '42501';
  end if;

  update public.agendamentos
     set status = p_status
   where id = p_agendamento_id;

  return p_agendamento_id;
end;
$$;

-- A contagem considera todo o intervalo, inclusive passagem de meia-noite.
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
  select count(*)::integer into v_affected
    from public.agendamentos a left join public.procedimentos p on p.id=a.procedimento_id
   where a.colaboradora_user_id=p_professional_user_id
     and a.status not in ('cancelado','faltou')
     and coalesce(a.fim,a.inicio+pg_catalog.make_interval(mins=>coalesce(p.duracao_padrao,60)))
         > (p_starts_on::timestamp at time zone 'America/Sao_Paulo')
     and (p_planned_ends_on is null or a.inicio < ((p_planned_ends_on+1)::timestamp at time zone 'America/Sao_Paulo'));
  insert into public.professional_agenda_inactivations(professional_user_id,starts_on,planned_ends_on,reason,internal_note,created_by)
  values(p_professional_user_id,p_starts_on,p_planned_ends_on,p_reason,nullif(trim(p_internal_note),''),v_user) returning id into v_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(v_user,'agenda_inactivated','professional_agenda_inactivations',v_id,jsonb_build_object('professional_user_id',p_professional_user_id,'starts_on',p_starts_on,'planned_ends_on',p_planned_ends_on,'reason',p_reason,'affected_appointments',v_affected));
  return jsonb_build_object('id',v_id,'affected_appointments',v_affected);
end;$$;
