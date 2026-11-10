-- BC para Você. Cadastro espelho interno e Pontos BC.
-- As regras comerciais começam vazias. O cadastro espelho ainda aguarda ativação.
create table private.bc_para_voce_accounts (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  prepared_at timestamptz not null default now()
);

create table private.bc_para_voce_point_rules (
  procedimento_id uuid primary key references public.procedimentos(id) on delete cascade,
  points integer not null check (points between 0 and 100000),
  updated_at timestamptz not null default now()
);

create table private.bc_para_voce_point_events (
  treatment_id uuid primary key references public.clinical_treatments(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  points integer not null check (points between 0 and 100000),
  awarded_at timestamptz not null
);

create index bc_para_voce_point_events_cliente_idx
  on private.bc_para_voce_point_events(cliente_id);

alter table private.bc_para_voce_accounts enable row level security;
alter table private.bc_para_voce_point_rules enable row level security;
alter table private.bc_para_voce_point_events enable row level security;
revoke all on private.bc_para_voce_accounts, private.bc_para_voce_point_rules, private.bc_para_voce_point_events
  from public, anon, authenticated, service_role;

create function private.bc_para_voce_prepare_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.bc_para_voce_accounts(cliente_id) values (new.id)
  on conflict (cliente_id) do nothing;
  return new;
end;
$$;

create trigger bc_para_voce_prepare_account
after insert on public.clientes
for each row execute function private.bc_para_voce_prepare_account();

insert into private.bc_para_voce_accounts(cliente_id)
select id from public.clientes
on conflict (cliente_id) do nothing;

create function private.bc_para_voce_record_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.bc_para_voce_point_events(treatment_id, cliente_id, points, awarded_at)
  values (
    new.id, new.cliente_id, coalesce((
      select r.points from private.bc_para_voce_point_rules r
      where r.procedimento_id = new.procedimento_id
    ), 0), coalesce(new.finalized_at, pg_catalog.now())
  )
  on conflict (treatment_id) do nothing;
  return new;
end;
$$;

create trigger bc_para_voce_record_points
after update of status on public.clinical_treatments
for each row
when (old.status is distinct from 'finalizado' and new.status = 'finalizado')
execute function private.bc_para_voce_record_points();

create function private.bc_para_voce_set_point_rule_impl(p_procedimento_id uuid, p_points integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Acesso restrito à administração da clínica.' using errcode = '42501';
  end if;
  if p_points is null or p_points not between 0 and 100000 then
    raise exception 'Pontuação inválida.' using errcode = '22023';
  end if;

  insert into private.bc_para_voce_point_rules as rule(procedimento_id, points)
  values (p_procedimento_id, p_points)
  on conflict (procedimento_id) do update
  set points = excluded.points, updated_at = pg_catalog.now()
  where rule.points is distinct from excluded.points;

  if found then
    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
    values (auth.uid(), 'bc_para_voce_rule_updated', 'procedimentos', p_procedimento_id,
      pg_catalog.jsonb_build_object('points', p_points));
  end if;
  return p_points;
end;
$$;

create function private.bc_para_voce_staff_summary_impl(p_cliente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_active boolean;
  v_total bigint;
  v_level text;
begin
  if not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode = '42501';
  end if;

  select c.ativo into v_active
  from private.bc_para_voce_accounts a join public.clientes c on c.id = a.cliente_id
  where a.cliente_id = p_cliente_id;
  if not found then return null; end if;

  select coalesce(sum(e.points), 0) into v_total
  from private.bc_para_voce_point_events e where e.cliente_id = p_cliente_id;

  select tier.level_name into v_level
  from (values
    (0, 'adesao'), (1000, 'bronze'), (2000, 'prata'),
    (4000, 'ouro'), (6000, 'perola'), (10000, 'diamante')
  ) as tier(threshold, level_name)
  where tier.threshold <= v_total
  order by tier.threshold desc
  limit 1;

  return pg_catalog.jsonb_build_object(
    'account_state', case when v_active then 'ativacao_pendente' else 'arquivado' end,
    'total_points', v_total,
    'level', v_level
  );
end;
$$;

create function private.bc_para_voce_get_point_rule_impl(p_procedimento_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Acesso restrito à administração da clínica.' using errcode = '42501';
  end if;
  return coalesce((
    select r.points from private.bc_para_voce_point_rules r where r.procedimento_id = p_procedimento_id
  ), 0);
end;
$$;

create function public.bc_para_voce_get_point_rule(p_procedimento_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$ select private.bc_para_voce_get_point_rule_impl($1); $$;

create function public.bc_para_voce_set_point_rule(p_procedimento_id uuid, p_points integer)
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.bc_para_voce_set_point_rule_impl($1, $2); $$;

create function public.bc_para_voce_staff_summary(p_cliente_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.bc_para_voce_staff_summary_impl($1); $$;

revoke all on function private.bc_para_voce_prepare_account(), private.bc_para_voce_record_points(),
  private.bc_para_voce_get_point_rule_impl(uuid), private.bc_para_voce_set_point_rule_impl(uuid, integer),
  private.bc_para_voce_staff_summary_impl(uuid), public.bc_para_voce_get_point_rule(uuid),
  public.bc_para_voce_set_point_rule(uuid, integer), public.bc_para_voce_staff_summary(uuid)
from public, anon, authenticated, service_role;

grant execute on function private.bc_para_voce_get_point_rule_impl(uuid), private.bc_para_voce_set_point_rule_impl(uuid, integer),
  private.bc_para_voce_staff_summary_impl(uuid), public.bc_para_voce_get_point_rule(uuid),
  public.bc_para_voce_set_point_rule(uuid, integer), public.bc_para_voce_staff_summary(uuid)
to authenticated;
