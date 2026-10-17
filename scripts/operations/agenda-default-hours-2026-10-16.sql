-- Authorized operational setup, not a schema migration.
-- Run first with ROLLBACK (as committed). Change only the last ROLLBACK to
-- COMMIT after inspecting the returned summary. Do not replay automatically.
-- Requires the verified existing Alice/Mel staff profiles; no Auth accounts,
-- appointments, patients, clinical versions or RLS policies are changed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $setup$
declare
  v_operation uuid := gen_random_uuid();
  v_admin uuid;
  v_staff uuid[];
  v_procedures uuid[];
  v_from date := (now() at time zone 'America/Sao_Paulo')::date;
  v_until date := (v_from + interval '1 year')::date;
  v_before jsonb;
  v_duration_count integer;
  v_access_count integer;
  v_permission_count integer;
  v_day_count integer;
  v_lunch_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('bc-operations:universal-hours-2026-10-16',0));
  if exists(select 1 from public.audit_log where action='agenda_operational_setup'
    and new_data->>'request_key'='2026-10-16-universal-hours-v1') then
    raise exception 'This operational request was already applied; inspect its audit record before rerunning.';
  end if;

  if (select count(*) from public.staff_profiles where display_name='Mel' and role='admin' and active)=1 then
    select user_id into v_admin from public.staff_profiles where display_name='Mel' and role='admin' and active;
  else
    raise exception 'Expected exactly one verified active Mel admin profile.';
  end if;
  select array_agg(user_id order by display_name) into v_staff
  from public.staff_profiles where display_name in ('Alice','Mel') and active and atende_clientes;
  if coalesce(cardinality(v_staff),0)<>2 or
    (select count(distinct display_name) from public.staff_profiles where user_id=any(v_staff))<>2 then
    raise exception 'Expected the two verified active Alice and Mel profiles.';
  end if;
  select array_agg(p.id order by p.id) into v_procedures
  from public.procedimentos p join public.procedure_versions pv on pv.id=p.current_version_id
  where p.ativo and p.archived_at is null and pv.status='published';
  if coalesce(cardinality(v_procedures),0)=0 then
    raise exception 'No active published procedures found.';
  end if;

  -- Save the exact previous operational state in the existing protected audit
  -- log. The actor is null because this is an external authorized operation,
  -- not a sign-in by Mel; granted_by references the verified clinic admin.
  select jsonb_build_object(
    'procedures',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'duracao_padrao',duracao_padrao,'access_mode',access_mode)),'[]'::jsonb)
      from public.procedimentos where id=any(v_procedures)),
    'permissions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.procedure_professional_permissions x
      where procedimento_id=any(v_procedures) and professional_user_id=any(v_staff)),
    'availability',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.professional_availability_days x
      where professional_user_id=any(v_staff) and local_date between v_from and v_until),
    'lunch_blocks',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.professional_schedule_blocks x
      where professional_user_id=any(v_staff) and block_type='almoco'
        and (starts_at at time zone 'America/Sao_Paulo')::date between v_from and v_until)
  ) into v_before;

  update public.procedimentos set duracao_padrao=60
  where id=any(v_procedures) and coalesce(duracao_padrao,0)<=0;
  get diagnostics v_duration_count = row_count;

  -- General mode ignores individual permissions. Explicit mode is necessary
  -- so future Aline/Kate accounts do not inherit every general procedure.
  update public.procedimentos set access_mode='restricted'
  where id=any(v_procedures) and access_mode<>'restricted';
  get diagnostics v_access_count = row_count;

  insert into public.procedure_professional_permissions
    (procedimento_id,professional_user_id,allowed,granted_by,granted_at,revoked_at)
  select p,s,true,v_admin,now(),null from unnest(v_procedures) p cross join unnest(v_staff) s
  on conflict(procedimento_id,professional_user_id) do update
    set allowed=true,granted_by=excluded.granted_by,granted_at=excluded.granted_at,revoked_at=null
    where not procedure_professional_permissions.allowed or procedure_professional_permissions.revoked_at is not null;
  get diagnostics v_permission_count = row_count;

  insert into public.professional_availability_days
    (professional_user_id,local_date,enabled,start_time,end_time,created_by,updated_by)
  select s,d::date,true,time '09:00',time '19:00',v_admin,v_admin
  from unnest(v_staff) s cross join generate_series(v_from::timestamp,v_until::timestamp,interval '1 day') d
  where extract(isodow from d) between 1 and 6
  on conflict(professional_user_id,local_date) do update
    set enabled=true,start_time=excluded.start_time,end_time=excluded.end_time,updated_by=v_admin,updated_at=now();
  get diagnostics v_day_count = row_count;

  update public.professional_availability_days set enabled=false,updated_by=v_admin,updated_at=now()
  where professional_user_id=any(v_staff) and local_date between v_from and v_until
    and extract(isodow from local_date)=7 and enabled;

  insert into public.professional_schedule_blocks
    (professional_user_id,starts_at,ends_at,block_type,internal_note,created_by)
  select s,(d::date+time '12:00') at time zone 'America/Sao_Paulo',
    (d::date+time '13:00') at time zone 'America/Sao_Paulo','almoco',
    'Pausa universal autorizada 2026-10-16; operation='||v_operation::text,v_admin
  from unnest(v_staff) s cross join generate_series(v_from::timestamp,v_until::timestamp,interval '1 day') d
  where extract(isodow from d) between 1 and 6 and not exists(
    select 1 from public.professional_schedule_blocks b where b.professional_user_id=s
      and b.block_type='almoco'
      and b.starts_at=(d::date+time '12:00') at time zone 'America/Sao_Paulo'
      and b.ends_at=(d::date+time '13:00') at time zone 'America/Sao_Paulo'
  );
  get diagnostics v_lunch_count = row_count;

  if exists(select 1 from public.procedimentos where id=any(v_procedures)
      and (duracao_padrao is null or duracao_padrao<60 or access_mode<>'restricted')) then
    raise exception 'Invalid duration/access mode after setup.';
  end if;
  if (select count(*) from public.procedure_professional_permissions where procedimento_id=any(v_procedures)
      and professional_user_id=any(v_staff) and allowed and revoked_at is null) <> cardinality(v_staff)*cardinality(v_procedures) then
    raise exception 'Incomplete Alice/Mel procedure permission matrix.';
  end if;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(null,'agenda_operational_setup','agenda_configuration',v_operation,v_before,jsonb_build_object(
    'request_key','2026-10-16-universal-hours-v1','requested_by','Fernando via ChatGPT',
    'staff_ids',to_jsonb(v_staff),'procedure_ids',to_jsonb(v_procedures),
    'date_from',v_from,'date_until',v_until,'weekdays','Monday-Saturday',
    'start','09:00','close','19:00','last_start','18:00','lunch','12:00-13:00',
    'default_duration_minutes',60,'preserve_existing_durations',true,
    'durations_filled',v_duration_count,'access_modes_changed',v_access_count,
    'permissions_changed',v_permission_count,'availability_rows',v_day_count,'lunch_blocks_added',v_lunch_count,
    'new_availability_ids',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.professional_availability_days
      where professional_user_id=any(v_staff) and local_date between v_from and v_until
        and not exists(select 1 from jsonb_array_elements(v_before->'availability') old where old->>'id'=id::text)),
    'new_lunch_block_ids',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.professional_schedule_blocks
      where internal_note='Pausa universal autorizada 2026-10-16; operation='||v_operation::text),
    'pending_profiles',jsonb_build_object('Aline','Skin procedures; exclude Botox and facial filler; account email pending',
      'Kate','Massage/lymphatic drainage family only; account email pending')
  ));
end;
$setup$;

select entity_id as operation_id,new_data-'staff_ids'-'procedure_ids'-'new_availability_ids'-'new_lunch_block_ids' as summary
from public.audit_log where action='agenda_operational_setup'
  and new_data->>'request_key'='2026-10-16-universal-hours-v1';
rollback;
