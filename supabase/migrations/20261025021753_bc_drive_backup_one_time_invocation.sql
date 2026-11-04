-- pg_net temporarily stores request headers in a platform-owned queue.
-- Use a narrowly scoped, single-use ticket instead of transmitting a permanent secret.
create table private.bc_drive_backup_invocations (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 used_at timestamptz
);
alter table private.bc_drive_backup_invocations enable row level security;
revoke all on private.bc_drive_backup_invocations from public,anon,authenticated,service_role;

create function private.bc_drive_backup_authorize_once(p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_accepted boolean;
begin
 if current_setting('role',true) is distinct from 'service_role' then
  raise exception using errcode='42501',message='Backup authorization is server-only';end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then return false;end if;
 update private.bc_drive_backup_invocations set used_at=clock_timestamp()
  where token_hash=p_hash and used_at is null and expires_at>clock_timestamp() returning true into v_accepted;
 return coalesce(v_accepted,false);
end$$;
revoke all on function private.bc_drive_backup_authorize_once(text) from public,anon,authenticated;
grant execute on function private.bc_drive_backup_authorize_once(text) to service_role;

create function public.bc_drive_backup_store_v2(p_operation text,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select case when p_operation='authorize'
  then to_jsonb(private.bc_drive_backup_authorize_once(p_payload->>'secret_hash'))
  else private.bc_drive_backup_store_impl(p_operation,p_payload) end;
$$;
revoke all on function public.bc_drive_backup_store_v2(text,jsonb) from public,anon,authenticated;
grant execute on function public.bc_drive_backup_store_v2(text,jsonb) to service_role;

create function private.bc_drive_backup_invoke_v2()
returns bigint language plpgsql security definer set search_path='' as $$
declare v_ticket text;v_request bigint;
begin
 if not coalesce((select enabled from private.bc_drive_backup_control where singleton),false) then
  raise exception 'Backup is disabled';end if;
 v_ticket:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.bc_drive_backup_invocations(token_hash,expires_at)
  values(encode(pg_catalog.sha256(pg_catalog.convert_to(v_ticket,'UTF8')),'hex'),clock_timestamp()+interval '2 minutes');
 select net.http_post(url:='https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-backup',
  headers:=jsonb_build_object('Content-Type','application/json','x-bc-backup-secret',v_ticket),
  body:='{"action":"run"}'::jsonb,timeout_milliseconds:=150000) into v_request;
 return v_request;
end$$;
revoke all on function private.bc_drive_backup_invoke_v2() from public,anon,authenticated,service_role;
-- Legacy invocation functions remain unused. V2 preserves consumed-ticket audit rows.
notify pgrst, 'reload schema';
