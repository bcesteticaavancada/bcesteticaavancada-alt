-- Authorized automatic Storage -> Drive backup. No cron is enabled by this migration.
-- Server-only state; existing clinical/financial schemas, roles and RLS are untouched.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
revoke all on net.http_request_queue from public,anon,authenticated,service_role;

create table private.bc_drive_backup_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 run_secret_id uuid not null,
 lease_run_id uuid,
 lease_until timestamptz,
 copy_cursor text check(copy_cursor ~ '^[a-f0-9]{64}$'),
 audit_cursor text check(audit_cursor ~ '^[a-f0-9]{64}$'),
 last_success_at timestamptz
);
create table private.bc_drive_backup_runs (
 id uuid primary key default gen_random_uuid(),
 started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 status text not null default 'running' check(status in ('running','success','partial','failed','abandoned')),
 counters jsonb not null default '{}'::jsonb,
 error_code text check(error_code ~ '^[a-z_0-9]{1,64}$')
);
create table private.bc_drive_backup_versions (
 source_key text not null check(source_key ~ '^[a-f0-9]{64}$'),
 hash text not null check(hash ~ '^[a-f0-9]{64}$'),
 source_path text not null,
 source_updated text not null,
 file_id text not null unique check(file_id ~ '^[a-zA-Z0-9_-]{3,200}$'),
 kind text not null check(kind in ('clinical','client')),
 bytes integer not null check(bytes between 1 and 12582912),
 mime text not null check(mime in ('application/pdf','image/jpeg','image/png','image/webp')),
 status text not null default 'pending' check(status in ('pending','verified')),
 created_at timestamptz not null default clock_timestamp(),
 verified_at timestamptz,
 last_run_id uuid not null references private.bc_drive_backup_runs(id),
 primary key(source_key,hash)
);
create index bc_drive_backup_versions_latest on private.bc_drive_backup_versions(source_key,created_at desc);
alter table private.bc_drive_backup_control enable row level security;
alter table private.bc_drive_backup_runs enable row level security;
alter table private.bc_drive_backup_versions enable row level security;
revoke all on private.bc_drive_backup_control,private.bc_drive_backup_runs,private.bc_drive_backup_versions from public,anon,authenticated,service_role;

-- Generates the capability entirely inside the server; never returned to the caller.
insert into private.bc_drive_backup_control(singleton,run_secret_id)
 values(true,vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),
 'bc_drive_automatic_run_v1','BC hourly worker capability; server only'));

create function private.bc_drive_backup_store_impl(p_operation text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_control private.bc_drive_backup_control%rowtype;
 v_version private.bc_drive_backup_versions%rowtype;
 v_run uuid;v_user uuid;v_path text;v_key text;v_hash text;v_kind text;
 v_bytes integer;v_mime text;v_file text;v_updated text;v_counters jsonb;v_code text;
begin
 if current_setting('role',true) is distinct from 'service_role' then
  raise exception using errcode='42501',message='Backup store is server-only';
 end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then
  raise exception using errcode='22023',message='Invalid backup request';
 end if;
 if p_operation='authorize' then
  if coalesce(p_payload->>'secret_hash','') !~ '^[a-f0-9]{64}$' then return 'false'::jsonb;end if;
  return to_jsonb(coalesce((select encode(pg_catalog.sha256(pg_catalog.convert_to(s.decrypted_secret,'UTF8')),'hex')=(p_payload->>'secret_hash')
   from private.bc_drive_backup_control c join vault.decrypted_secrets s on s.id=c.run_secret_id where c.singleton),false));
 end if;
 select * into strict v_control from private.bc_drive_backup_control where singleton for update;
 if p_operation='begin' then
  if not v_control.enabled then return '{"disabled":true}'::jsonb;end if;
  if v_control.lease_until>clock_timestamp() then return '{"busy":true}'::jsonb;end if;
  select user_id into v_user from private.bc_drive_oauth_connection where singleton and folders_ready
   and account='decolarbh@gmail.com' and client_id='530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com';
  if v_user is null then raise exception using errcode='22023',message='Backup connection not ready';end if;
  update private.bc_drive_backup_runs set status='abandoned',finished_at=clock_timestamp(),error_code='lease_expired'
   where id=v_control.lease_run_id and status='running';
  insert into private.bc_drive_backup_runs default values returning id into v_run;
  update private.bc_drive_backup_control set lease_run_id=v_run,lease_until=clock_timestamp()+interval '10 minutes' where singleton;
  return jsonb_build_object('run_id',v_run,'user_id',v_user,'copy_cursor',v_control.copy_cursor,'audit_cursor',v_control.audit_cursor);
 end if;
 v_run:=(p_payload->>'run_id')::uuid;
 if not v_control.enabled or v_run is null or v_control.lease_run_id is distinct from v_run
  or v_control.lease_until is null or v_control.lease_until<=clock_timestamp() then
  raise exception using errcode='42501',message='Backup lease is invalid';
 end if;
 if p_operation='assert' then return 'true'::jsonb;
 elsif p_operation='snapshot' then
  if jsonb_typeof(p_payload->'source_keys') is distinct from 'array' then
   raise exception using errcode='22023',message='Invalid backup snapshot';end if;
  if jsonb_array_length(p_payload->'source_keys') not between 1 and 100
   or exists(select 1 from jsonb_array_elements_text(p_payload->'source_keys') k where k !~ '^[a-f0-9]{64}$') then
   raise exception using errcode='22023',message='Invalid backup snapshot';end if;
  return coalesce((select jsonb_agg(to_jsonb(v)) from (
   select distinct on(source_key) * from private.bc_drive_backup_versions
   where source_key in(select jsonb_array_elements_text(p_payload->'source_keys'))
   order by source_key,source_updated::timestamptz desc,created_at desc
  ) v),'[]'::jsonb);
 elsif p_operation='reserve' then
  v_path:=p_payload->>'source_path';v_key:=p_payload->>'source_key';v_hash:=p_payload->>'hash';
  v_kind:=p_payload->>'kind';v_bytes:=(p_payload->>'bytes')::integer;v_mime:=p_payload->>'mime';
  v_file:=p_payload->>'file_id';v_updated:=p_payload->>'source_updated';
  if v_path is null or length(v_path)>1024 or v_path !~ '^(documentos|assinaturas|pre-anamneses|arquivos-clientes|identificacao|fotos-clinicas)/.+'
   or v_path ~ '(^|/)(\.|\.\.|financeiro|finance|comiss[aã]o|comiss[oõ]es|recibos?|caixa|pagamentos?|payouts?|recebimentos?|repasses?|faturas?)(/|$)'
   or position('//' in v_path)>0 or right(v_path,1)='/'
   or v_key is distinct from encode(pg_catalog.sha256(pg_catalog.convert_to('bc-prontuario-private:'||v_path,'UTF8')),'hex')
   or v_hash is null or v_hash !~ '^[a-f0-9]{64}$' or v_file is null or v_file !~ '^[a-zA-Z0-9_-]{3,200}$'
   or v_updated is null or length(v_updated)>64 or not isfinite(v_updated::timestamptz)
   or v_kind is distinct from (case when split_part(v_path,'/',1) in ('documentos','assinaturas','pre-anamneses') then 'clinical' else 'client' end)
   or v_bytes is null or v_bytes not between 1 and 12582912
   or v_mime is null or v_mime not in ('application/pdf','image/jpeg','image/png','image/webp') then
   raise exception using errcode='22023',message='Invalid backup object';
  end if;
  select * into v_version from private.bc_drive_backup_versions where source_key=v_key and hash=v_hash for update;
  if found then
   if v_version.source_path<>v_path or v_version.bytes<>v_bytes or v_version.kind<>v_kind or v_version.mime<>v_mime then
    raise exception using errcode='22023',message='Backup version conflict';
   end if;
   update private.bc_drive_backup_versions set source_updated=v_updated,last_run_id=v_run
    where source_key=v_key and hash=v_hash returning * into v_version;
  else
   insert into private.bc_drive_backup_versions(source_key,hash,source_path,source_updated,file_id,kind,bytes,mime,last_run_id)
    values(v_key,v_hash,v_path,v_updated,v_file,v_kind,v_bytes,v_mime,v_run) returning * into v_version;
  end if;
  return to_jsonb(v_version);
 elsif p_operation='record' then
  update private.bc_drive_backup_versions set status='verified',verified_at=clock_timestamp(),last_run_id=v_run
   where source_key=p_payload->>'source_key' and hash=p_payload->>'hash' and file_id=p_payload->>'file_id';
  if not found then raise exception using errcode='22023',message='Unknown backup version';end if;
  return 'true'::jsonb;
 elsif p_operation='finish' then
  if coalesce(p_payload->>'status','') not in ('success','partial','failed') then
   raise exception using errcode='22023',message='Invalid backup outcome';end if;
  if ((p_payload->>'copy_cursor') is not null and (p_payload->>'copy_cursor') !~ '^[a-f0-9]{64}$')
   or ((p_payload->>'audit_cursor') is not null and (p_payload->>'audit_cursor') !~ '^[a-f0-9]{64}$') then
   raise exception using errcode='22023',message='Invalid backup cursor';end if;
  select coalesce(jsonb_object_agg(k,to_jsonb(coalesce((p_payload->'counters'->>k)::integer,0))),'{}'::jsonb)
   into v_counters from unnest(array['scanned','eligible','pending','selected','uploaded','reused','verified','audited','failed','oversized','excluded','remaining']) k;
  v_code:=p_payload->>'error_code';
  if v_code is not null and v_code !~ '^[a-z_0-9]{1,64}$' then
   raise exception using errcode='22023',message='Invalid backup error code';end if;
  update private.bc_drive_backup_runs set status=p_payload->>'status',finished_at=clock_timestamp(),counters=v_counters,error_code=v_code
   where id=v_run and status='running';
  if not found then raise exception using errcode='22023',message='Unknown backup run';end if;
  update private.bc_drive_backup_control set lease_run_id=null,lease_until=null,
   copy_cursor=case when p_payload ? 'copy_cursor' then p_payload->>'copy_cursor' else copy_cursor end,
   audit_cursor=case when p_payload ? 'audit_cursor' then p_payload->>'audit_cursor' else audit_cursor end,
   last_success_at=case when p_payload->>'status'='success' then clock_timestamp() else last_success_at end where singleton;
  return 'true'::jsonb;
 end if;
 raise exception using errcode='22023',message='Invalid backup operation';
end$$;
revoke all on function private.bc_drive_backup_store_impl(text,jsonb) from public,anon,authenticated;
grant execute on function private.bc_drive_backup_store_impl(text,jsonb) to service_role;
create function public.bc_drive_backup_store(p_operation text,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.bc_drive_backup_store_impl(p_operation,p_payload);
$$;
revoke all on function public.bc_drive_backup_store(text,jsonb) from public,anon,authenticated;
grant execute on function public.bc_drive_backup_store(text,jsonb) to service_role;

-- Cron stores only this function name. Its capability is decrypted inside this function.
create function private.bc_drive_backup_invoke()
returns bigint language plpgsql security definer set search_path='' as $$
declare v_secret text;v_request bigint;
begin
 select s.decrypted_secret into v_secret from private.bc_drive_backup_control c
  join vault.decrypted_secrets s on s.id=c.run_secret_id where c.singleton and c.enabled;
 if v_secret is null then raise exception 'Backup is disabled';end if;
 select net.http_post(url:='https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-backup',
  headers:=jsonb_build_object('Content-Type','application/json','x-bc-backup-secret',v_secret),
  body:='{"action":"run"}'::jsonb,timeout_milliseconds:=150000) into v_request;
 return v_request;
end$$;
revoke all on function private.bc_drive_backup_invoke() from public,anon,authenticated,service_role;
notify pgrst, 'reload schema';
