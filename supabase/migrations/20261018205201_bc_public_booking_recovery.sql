create table if not exists private.public_booking_requests (
  request_key uuid primary key,
  payload_hash text not null,
  appointment_id uuid not null references public.agendamentos(id) on delete restrict,
  confirmation jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists public_booking_requests_appointment_idx on private.public_booking_requests(appointment_id);
revoke all on private.public_booking_requests from public,anon,authenticated;

create or replace function private.bc_public_agenda_book_v2_impl(
  p_request_key uuid,p_name text,p_phone text,p_professional_user_id uuid,p_procedimento_id uuid,p_inicio timestamptz,p_origin_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare fingerprint text; previous private.public_booking_requests%rowtype; result jsonb; appointment_status text;
begin
  if p_request_key is null then raise exception 'Tentativa inválida.' using errcode='22023'; end if;
  fingerprint:=encode(extensions.digest(convert_to(jsonb_build_array(
    regexp_replace(trim(p_name),'\s+',' ','g'),regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),
    p_professional_user_id,p_procedimento_id,p_inicio)::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('bc-booking-request:'||p_request_key::text,61));
  select * into previous from private.public_booking_requests where request_key=p_request_key;
  if found then
    if previous.payload_hash is distinct from fingerprint then raise exception 'request_key_mismatch' using errcode='23505'; end if;
    select status into appointment_status from public.agendamentos where id=previous.appointment_id;
    if appointment_status in ('cancelado','faltou') then raise exception 'request_booking_changed' using errcode='55000'; end if;
    return previous.confirmation;
  end if;
  result:=public.bc_public_agenda_book(p_name,p_phone,p_professional_user_id,p_procedimento_id,p_inicio,p_origin_hash);
  if result ? 'error_code' then return result; end if;
  result:=result||jsonb_build_object('procedure_name',(select nome from public.procedimentos where id=p_procedimento_id),
    'professional_name',(select display_name from public.staff_profiles where user_id=p_professional_user_id));
  insert into private.public_booking_requests(request_key,payload_hash,appointment_id,confirmation)
  values(p_request_key,fingerprint,(result->>'appointment_id')::uuid,result);
  return result;
end; $$;
create or replace function public.bc_public_agenda_book_v2(
  p_request_key uuid,p_name text,p_phone text,p_professional_user_id uuid,p_procedimento_id uuid,p_inicio timestamptz,p_origin_hash text
) returns jsonb language sql security invoker set search_path='' as $$ select private.bc_public_agenda_book_v2_impl($1,$2,$3,$4,$5,$6,$7); $$;
revoke all on function private.bc_public_agenda_book_v2_impl(uuid,text,text,uuid,uuid,timestamptz,text),public.bc_public_agenda_book_v2(uuid,text,text,uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function private.bc_public_agenda_book_v2_impl(uuid,text,text,uuid,uuid,timestamptz,text),public.bc_public_agenda_book_v2(uuid,text,text,uuid,uuid,timestamptz,text) to service_role;
