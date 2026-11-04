-- DRAFT: atomic reconnect only; no cron, folder, clinical or financial changes.
-- Apply after the existing OAuth/automatic-backup migrations, before enabling
-- BC_DRIVE_OAUTH_ENABLE_ACTIVE_RECONNECT. Keep that flag false during rollout.
create function private.bc_drive_oauth_rotate_impl(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid;
  v_token text;
  v_expected text;
  v_previous text;
  v_control private.bc_drive_backup_control%rowtype;
  v_connection private.bc_drive_oauth_connection%rowtype;
  v_client constant text := '530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com';
begin
  if current_setting('role',true) is distinct from 'service_role' then
    raise exception using errcode='42501',message='OAuth rotation is server-only';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
    or (p_payload->>'account') is distinct from 'decolarbh@gmail.com'
    or (p_payload->>'client_id') is distinct from v_client then
    raise exception using errcode='22023',message='Invalid OAuth rotation';
  end if;
  v_user := (p_payload->>'user_id')::uuid;
  v_token := p_payload->>'refresh_token';
  v_expected := p_payload->>'expected_refresh_hash';
  if v_user is null or v_token is null or length(v_token) not between 16 and 8192
    or v_expected is null or v_expected !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='Invalid OAuth rotation';
  end if;

  -- Same control row as worker begin: a new claim cannot interleave this swap.
  -- Never pause/clear a live worker; the administrator may retry after it ends.
  select * into v_control from private.bc_drive_backup_control where singleton for update;
  if not found or not v_control.enabled or v_control.lease_until>clock_timestamp() then
    return 'false'::jsonb;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bc-drive-oauth-test-v1',0));
  select * into v_connection from private.bc_drive_oauth_connection where singleton for update;
  if not found or not v_connection.folders_ready then return 'false'::jsonb;end if;
  if v_connection.user_id is distinct from v_user
    or v_connection.client_id is distinct from v_client
    or v_connection.account is distinct from 'decolarbh@gmail.com' then
    raise exception using errcode='42501',message='Invalid OAuth owner';
  end if;
  select decrypted_secret into v_previous from vault.decrypted_secrets where id=v_connection.refresh_secret_id;
  if v_previous is null or encode(pg_catalog.sha256(convert_to(v_previous,'UTF8')),'hex')<>v_expected then
    return 'false'::jsonb;
  end if;
  -- An error in Vault rolls back the whole statement. Readiness is never reset.
  perform vault.update_secret(v_connection.refresh_secret_id,v_token);
  update private.bc_drive_oauth_connection set updated_at=clock_timestamp()
    where singleton and user_id=v_user and client_id=v_client;
  return 'true'::jsonb;
end $$;

revoke all on function private.bc_drive_oauth_rotate_impl(jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.bc_drive_oauth_rotate_impl(jsonb) to service_role;

create function public.bc_drive_oauth_rotate(p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.bc_drive_oauth_rotate_impl(p_payload);
$$;
revoke all on function public.bc_drive_oauth_rotate(jsonb) from public,anon,authenticated;
grant execute on function public.bc_drive_oauth_rotate(jsonb) to service_role;
