-- Preparado para homologação isolada. Implementação aditiva.
create table private.bc_central_operations (
  request_id uuid primary key,
  actor_id uuid not null,
  action text not null check (action in ('status','search','analytics','checks','vitals','cash','brief','workspace')),
  state text not null default 'iniciada' check (state in ('iniciada','concluida','falha','incerta')),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  code text check (code in ('provedor','configuracao','limite','indisponivel')),
  document_id text check (length(document_id) between 1 and 160)
);
create index bc_central_actor_time on private.bc_central_operations(actor_id,started_at desc);
create index bc_central_action_time on private.bc_central_operations(action,started_at desc);
alter table private.bc_central_operations enable row level security;
revoke all on private.bc_central_operations from public,anon,authenticated;

create function public.bc_central_begin(p_actor uuid,p_key uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.bc_central_operations%rowtype;
begin
  if p_actor is null or p_key is null or p_action not in ('status','search','analytics','checks','vitals','cash','brief','workspace') or p_action is null then raise exception 'invalid'; end if;
  if not exists(select 1 from public.staff_profiles s where s.user_id=p_actor and s.active and
    (s.role::text='admin' or (s.role::text='admin_criacao' and p_action<>'cash'))) then raise exception 'profile' using errcode='42501'; end if;
  -- Orçamento global e limites por usuário são atômicos entre instâncias.
  perform pg_catalog.pg_advisory_xact_lock(20261126,1);
  select * into existing from private.bc_central_operations where request_id=p_key;
  if found then
    if existing.actor_id<>p_actor or existing.action<>p_action then return jsonb_build_object('state','conflito'); end if;
    return jsonb_build_object('state',existing.state,'document',existing.document_id);
  end if;
  if (select count(*) from private.bc_central_operations where actor_id=p_actor and started_at>now()-interval '1 minute')>=20
      or (p_action in ('brief','workspace') and (select count(*) from private.bc_central_operations where action=p_action and started_at>now()-interval '24 hours')>=10) then
    return jsonb_build_object('state','limite');
  end if;
  insert into private.bc_central_operations(request_id,actor_id,action) values(p_key,p_actor,p_action);
  return jsonb_build_object('state','nova');
end $$;

create function public.bc_central_finish(p_actor uuid,p_key uuid,p_state text,p_code text,p_document text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_state not in ('concluida','falha','incerta') or p_state is null then raise exception 'invalid'; end if;
  update private.bc_central_operations set state=p_state,code=p_code,document_id=p_document,finished_at=clock_timestamp()
    where request_id=p_key and actor_id=p_actor and state='iniciada';
  if not found then raise exception 'missing reservation'; end if;
end $$;

create function public.bc_central_history(p_actor uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('operations',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from
    (select action,state,started_at,finished_at,code from private.bc_central_operations where actor_id=p_actor and action<>'status'
       and (action<>'cash' or exists(select 1 from public.staff_profiles where user_id=p_actor and active and role::text='admin'))
       order by started_at desc limit 12)x),'[]'::jsonb),
    'requests24h',(select count(*) from private.bc_central_operations where actor_id=p_actor and started_at>now()-interval '24 hours'))
$$;
revoke all on function public.bc_central_begin(uuid,uuid,text), public.bc_central_finish(uuid,uuid,text,text,text), public.bc_central_history(uuid) from public,anon,authenticated;
grant execute on function public.bc_central_begin(uuid,uuid,text), public.bc_central_finish(uuid,uuid,text,text,text), public.bc_central_history(uuid) to service_role;

-- Agrega dentro do banco. Nenhuma descrição de movimento nem identidade sai desta RPC.
create function private.bc_central_cash_period(p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare totals jsonb;
begin
  perform private.bc_finance_require_admin();
  perform private.bc_finance_period(p_from,p_to);
  if p_to-p_from>31 then raise exception 'period'; end if;
  select jsonb_build_object('income',coalesce(sum(amount) filter(where included and direction='in'),0),
    'expense',coalesce(sum(amount) filter(where included and direction='out'),0)) into totals
    from private.bc_finance_rows(p_from,p_to);
  return totals;
end $$;
create function public.bc_central_cash_period(p_from date,p_to date)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.bc_central_cash_period(p_from,p_to)
$$;
revoke all on function private.bc_central_cash_period(date,date) from public,anon;
grant execute on function private.bc_central_cash_period(date,date) to authenticated;
revoke all on function public.bc_central_cash_period(date,date) from public,anon;
grant execute on function public.bc_central_cash_period(date,date) to authenticated;
