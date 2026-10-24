-- DRAFT: do not apply to the active project before approval of OAuth-only setup.
-- No customer data, Storage, clinical/financial tables or scheduling are accessed.
-- Vault must already be installed (present in target project's inspected catalog).
create schema if not exists private;

create table private.bc_drive_oauth_state (
  user_id uuid primary key,
  state_hash text not null unique check (state_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
create table private.bc_drive_oauth_connection (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null,
  account text not null check (account = 'decolarbh@gmail.com'),
  client_id text not null,
  refresh_secret_id uuid not null,
  folders_ready boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
alter table private.bc_drive_oauth_state enable row level security;
alter table private.bc_drive_oauth_connection enable row level security;
revoke all on private.bc_drive_oauth_state, private.bc_drive_oauth_connection
  from public, anon, authenticated, service_role;

-- Definer is necessary only for server access to Vault and private tables.
-- It has no public/user grant and checks the invoking SQL role explicitly.
create function private.bc_drive_oauth_store_impl(p_operation text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_hash text;
  v_consumed boolean;
  v_token text;
  v_secret uuid;
  v_connection private.bc_drive_oauth_connection%rowtype;
  v_client constant text := '530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com';
begin
  if current_setting('role', true) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'OAuth store is server-only';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid OAuth request';
  end if;
  v_user := (p_payload ->> 'user_id')::uuid;
  if v_user is null then
    raise exception using errcode = '22023', message = 'Invalid OAuth identity';
  end if;
  if p_operation in ('start', 'consume') then
    v_hash := p_payload ->> 'state_hash';
    if v_hash is null or v_hash !~ '^[a-f0-9]{64}$' then
      raise exception using errcode = '22023', message = 'Invalid OAuth state';
    end if;
    if p_operation = 'start' then
      delete from private.bc_drive_oauth_state where expires_at <= clock_timestamp();
      insert into private.bc_drive_oauth_state(user_id, state_hash, expires_at)
        values (v_user, v_hash, clock_timestamp() + interval '10 minutes')
        on conflict (user_id) do update
          set state_hash = excluded.state_hash, expires_at = excluded.expires_at;
      return 'true'::jsonb;
    end if;
    delete from private.bc_drive_oauth_state
      where user_id = v_user and state_hash = v_hash and expires_at > clock_timestamp()
      returning true into v_consumed;
    return to_jsonb(coalesce(v_consumed, false));
  end if;
  if (p_payload ->> 'client_id') is distinct from v_client then
    raise exception using errcode = '22023', message = 'Invalid OAuth client';
  end if;
  if p_operation = 'save' then
    if (p_payload ->> 'account') is distinct from 'decolarbh@gmail.com' then
      raise exception using errcode = '22023', message = 'Invalid OAuth account';
    end if;
    v_token := p_payload ->> 'refresh_token';
    if v_token is null or length(v_token) not between 16 and 8192 then
      raise exception using errcode = '22023', message = 'Invalid OAuth credential';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('bc-drive-oauth-test-v1', 0));
    select * into v_connection from private.bc_drive_oauth_connection where singleton for update;
    if found then
      v_secret := v_connection.refresh_secret_id;
      perform vault.update_secret(v_secret, v_token);
    else
      v_secret := vault.create_secret(v_token, 'bc_drive_oauth_test_refresh_v1', 'BC Drive OAuth test, server only');
    end if;
    insert into private.bc_drive_oauth_connection(singleton,user_id,account,client_id,refresh_secret_id,folders_ready)
      values(true,v_user,'decolarbh@gmail.com',v_client,v_secret,false)
      on conflict(singleton) do update set user_id=excluded.user_id,
        account=excluded.account,client_id=excluded.client_id,
        refresh_secret_id=excluded.refresh_secret_id,folders_ready=false,updated_at=clock_timestamp();
    return 'true'::jsonb;
  end if;
  select * into v_connection from private.bc_drive_oauth_connection
    where singleton and user_id = v_user and client_id = v_client;
  if p_operation = 'status' then
    return jsonb_build_object('connected', found, 'folders_ready', coalesce(v_connection.folders_ready,false));
  elsif p_operation = 'read' then
    if not found then return 'null'::jsonb; end if;
    select decrypted_secret into v_token from vault.decrypted_secrets where id = v_connection.refresh_secret_id;
    if v_token is null then return 'null'::jsonb; end if;
    return jsonb_build_object('user_id',v_connection.user_id,'account',v_connection.account,
      'client_id',v_connection.client_id,'refresh_token',v_token);
  elsif p_operation = 'ready' then
    if (p_payload ->> 'clinical') is distinct from '1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y'
      or (p_payload ->> 'client') is distinct from '1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N' then
      raise exception using errcode = '22023', message = 'Invalid OAuth destinations';
    end if;
    if not found then return 'false'::jsonb; end if;
    update private.bc_drive_oauth_connection set folders_ready=true, updated_at=clock_timestamp()
      where singleton and user_id=v_user and client_id=v_client;
    return 'true'::jsonb;
  end if;
  raise exception using errcode = '22023', message = 'Invalid OAuth operation';
end $$;

revoke all on function private.bc_drive_oauth_store_impl(text,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.bc_drive_oauth_store_impl(text,jsonb) to service_role;

-- Public schema is only a PostgREST entrypoint, never a user-accessible token API.
create function public.bc_drive_oauth_store(p_operation text, p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.bc_drive_oauth_store_impl(p_operation,p_payload);
$$;
revoke all on function public.bc_drive_oauth_store(text,jsonb) from public,anon,authenticated;
grant execute on function public.bc_drive_oauth_store(text,jsonb) to service_role;
