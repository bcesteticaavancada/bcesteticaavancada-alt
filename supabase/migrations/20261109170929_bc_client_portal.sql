-- Acesso temporário aos horários da cliente por link individual.
create table private.bc_client_portal_links (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  token_hash bytea not null unique check (pg_catalog.octet_length(token_hash) = 32),
  expires_at timestamptz not null
);

alter table private.bc_client_portal_links enable row level security;
revoke all on table private.bc_client_portal_links from public, anon, authenticated, service_role;

create function private.bc_client_portal_issue_impl(p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_expires_at timestamptz := pg_catalog.now() + interval '24 hours';
begin
  if not private.is_bc_admin() then
    raise exception 'Acesso restrito à administração da clínica.' using errcode = '42501';
  end if;

  perform 1 from public.clientes
   where id = p_cliente_id and ativo
   for update;
  if not found then
    raise exception 'Selecione uma cliente ativa.' using errcode = '22023';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.bc_client_portal_links(cliente_id, token_hash, expires_at)
  values (p_cliente_id, extensions.digest(v_token, 'sha256'), v_expires_at)
  on conflict (cliente_id) do update
  set token_hash = excluded.token_hash, expires_at = excluded.expires_at;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values (
    auth.uid(), 'client_portal_link_issued', 'clientes', p_cliente_id,
    pg_catalog.jsonb_build_object('expires_at', v_expires_at)
  );

  return pg_catalog.jsonb_build_object('token', v_token, 'expires_at', v_expires_at);
end;
$$;

create function private.bc_client_portal_revoke_impl(p_cliente_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Acesso restrito à administração da clínica.' using errcode = '42501';
  end if;

  perform 1 from public.clientes where id = p_cliente_id for update;
  delete from private.bc_client_portal_links where cliente_id = p_cliente_id;
  if not found then return false; end if;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'client_portal_link_revoked', 'clientes', p_cliente_id);
  return true;
end;
$$;

create function private.bc_client_portal_schedule_impl(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('appointments', coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('starts_at', upcoming.inicio)
      order by upcoming.inicio
    )
    from (
      select a.inicio
      from public.agendamentos a
      where a.cliente_id = link.cliente_id
        and a.status = 'agendado'
        and a.inicio >= pg_catalog.now()
      order by a.inicio
      limit 20
    ) upcoming
  ), '[]'::jsonb))
  from private.bc_client_portal_links link
  join public.clientes cliente on cliente.id = link.cliente_id and cliente.ativo
  where p_token ~ '^[a-f0-9]{64}$'
    and link.token_hash = extensions.digest(p_token, 'sha256')
    and link.expires_at > pg_catalog.now();
$$;

create function private.bc_client_portal_clear_on_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.bc_client_portal_links where cliente_id = new.id;
  return new;
end;
$$;

create trigger bc_client_portal_clear_on_archive
after update of ativo on public.clientes
for each row
when (old.ativo and not new.ativo)
execute function private.bc_client_portal_clear_on_archive();

create function public.bc_client_portal_issue(p_cliente_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.bc_client_portal_issue_impl($1); $$;

create function public.bc_client_portal_revoke(p_cliente_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.bc_client_portal_revoke_impl($1); $$;

create function public.bc_client_portal_schedule(p_token text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.bc_client_portal_schedule_impl($1); $$;

revoke all on function
  private.bc_client_portal_issue_impl(uuid), private.bc_client_portal_revoke_impl(uuid),
  private.bc_client_portal_schedule_impl(text), private.bc_client_portal_clear_on_archive(),
  public.bc_client_portal_issue(uuid), public.bc_client_portal_revoke(uuid),
  public.bc_client_portal_schedule(text)
from public, anon, authenticated, service_role;

grant execute on function
  private.bc_client_portal_issue_impl(uuid), private.bc_client_portal_revoke_impl(uuid),
  public.bc_client_portal_issue(uuid), public.bc_client_portal_revoke(uuid)
to authenticated;

grant execute on function
  private.bc_client_portal_schedule_impl(text), public.bc_client_portal_schedule(text)
to service_role;
