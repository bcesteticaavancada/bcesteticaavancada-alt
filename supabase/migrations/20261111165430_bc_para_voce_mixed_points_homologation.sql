-- Homologação do modelo misto de Pontos BC (sem ativação automática em produção).
-- Regras manuais existentes continuam válidas. Sem regra manual, a escala mista
-- somente vale depois de habilitação deliberada e data efetiva aprovada.
create table private.bc_para_voce_program_settings (
  singleton boolean primary key default true check (singleton),
  automatic_enabled boolean not null default false,
  effective_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into private.bc_para_voce_program_settings(singleton, automatic_enabled)
values (true, false);

alter table private.bc_para_voce_program_settings enable row level security;
revoke all on private.bc_para_voce_program_settings from public, anon, authenticated, service_role;

alter table private.bc_para_voce_point_events
  add column calculation_mode text not null default 'legacy_manual'
    check (calculation_mode in (
      'legacy_manual', 'manual', 'disabled', 'automatic_fixed',
      'automatic_final', 'pending_price', 'pending_cycle', 'no_charge'
    )),
  add column amount_snapshot numeric(12, 2),
  add column policy_version integer not null default 1;

create index bc_para_voce_points_pending_idx
  on private.bc_para_voce_point_events(cliente_id, awarded_at desc)
  where calculation_mode in ('pending_price', 'pending_cycle');

create or replace function private.bc_para_voce_record_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule_points integer;
  v_enabled boolean;
  v_effective_at timestamptz;
  v_awarded_at timestamptz := coalesce(new.finalized_at, pg_catalog.now());
  v_amount numeric;
  v_points integer := 0;
  v_mode text;
begin
  -- O override manual é deliberado e precede o programa automático.
  select r.points into v_rule_points
  from private.bc_para_voce_point_rules r
  where r.procedimento_id = new.procedimento_id;

  if found then
    v_points := v_rule_points;
    v_mode := case when v_points = 0 then 'disabled' else 'manual' end;
  else
    select s.automatic_enabled, s.effective_at
      into v_enabled, v_effective_at
    from private.bc_para_voce_program_settings s where s.singleton;

    if not coalesce(v_enabled, false) or v_effective_at is null
       or v_awarded_at < v_effective_at then
      return new;
    end if;

    -- O ciclo pode representar um pacote pago uma única vez: nunca multiplicar
    -- créditos antes de confirmar a forma de cobrança da clínica.
    if nullif(pg_catalog.btrim(new.cycle_key), '') is not null then
      v_mode := 'pending_cycle';
    else
      if new.price_mode_snapshot = 'fixed' then
        v_amount := new.base_price_snapshot;
        v_mode := 'automatic_fixed';
      elsif new.price_mode_snapshot = 'starting_at' then
        v_amount := new.final_price;
        v_mode := 'automatic_final';
      else
        v_mode := 'pending_price';
      end if;

      if v_amount is null or v_amount > 100000 or v_amount < 0 then
        v_mode := 'pending_price';
      elsif v_amount = 0 then
        v_mode := 'no_charge';
      else
        v_points := pg_catalog.round(v_amount)::integer;
      end if;
    end if;
  end if;

  insert into private.bc_para_voce_point_events(
    treatment_id, cliente_id, points, awarded_at,
    calculation_mode, amount_snapshot, policy_version
  ) values (
    new.id, new.cliente_id, v_points, v_awarded_at,
    v_mode, v_amount, 2
  ) on conflict (treatment_id) do nothing;
  return new;
end;
$$;

-- Sem revelar preços, o resumo interno informa pendências para revisão.
create or replace function private.bc_para_voce_staff_summary_impl(p_cliente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_active boolean;
  v_total bigint;
  v_pending bigint;
  v_level text;
begin
  if not private.is_bc_active_staff() then
    raise exception 'Acesso restrito à equipe clínica ativa.' using errcode = '42501';
  end if;

  select c.ativo into v_active
  from private.bc_para_voce_accounts a
  join public.clientes c on c.id = a.cliente_id
  where a.cliente_id = p_cliente_id;
  if not found then return null; end if;

  select coalesce(sum(e.points), 0), count(*) filter (
    where e.calculation_mode in ('pending_price', 'pending_cycle')
  ) into v_total, v_pending
  from private.bc_para_voce_point_events e where e.cliente_id = p_cliente_id;

  select tier.level_name into v_level from (values
    (0, 'adesao'), (1000, 'bronze'), (2000, 'prata'),
    (4000, 'ouro'), (6000, 'perola'), (10000, 'diamante')
  ) as tier(threshold, level_name)
  where tier.threshold <= v_total
  order by tier.threshold desc limit 1;

  return pg_catalog.jsonb_build_object(
    'account_state', case when v_active then 'ativacao_pendente' else 'arquivado' end,
    'total_points', v_total, 'level', v_level,
    'pending_count', v_pending
  );
end;
$$;

-- A administração pode consultar se há override e remover uma regra manual.
-- A ativação global permanece restrita ao processo homologado de corte.
create function private.bc_para_voce_get_point_policy_impl(p_procedimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_points integer;
  v_is_manual boolean;
  v_enabled boolean;
  v_effective_at timestamptz;
begin
  if not private.is_bc_admin() then
    raise exception 'Acesso restrito à administração da clínica.' using errcode = '42501';
  end if;

  select r.points into v_points from private.bc_para_voce_point_rules r
  where r.procedimento_id = p_procedimento_id;
  v_is_manual := found;
  select s.automatic_enabled, s.effective_at into v_enabled, v_effective_at
  from private.bc_para_voce_program_settings s where s.singleton;

  return pg_catalog.jsonb_build_object(
    'mode', case when v_is_manual then 'manual' else 'automatic' end,
    'points', coalesce(v_points, 0),
    'automatic_enabled', coalesce(v_enabled, false),
    'effective_at', v_effective_at
  );
end;
$$;

create function private.bc_para_voce_reset_point_rule_impl(p_procedimento_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Acesso restrito à administração da clínica.' using errcode = '42501';
  end if;

  delete from private.bc_para_voce_point_rules
  where procedimento_id = p_procedimento_id;
  if found then
    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
    values (auth.uid(), 'bc_para_voce_rule_reset', 'procedimentos', p_procedimento_id,
      '{"mode":"automatic"}'::jsonb);
  end if;
  return true;
end;
$$;

create function public.bc_para_voce_get_point_policy(p_procedimento_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.bc_para_voce_get_point_policy_impl($1); $$;

create function public.bc_para_voce_reset_point_rule(p_procedimento_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.bc_para_voce_reset_point_rule_impl($1); $$;

revoke all on function private.bc_para_voce_get_point_policy_impl(uuid),
  private.bc_para_voce_reset_point_rule_impl(uuid),
  public.bc_para_voce_get_point_policy(uuid), public.bc_para_voce_reset_point_rule(uuid)
from public, anon, authenticated, service_role;

grant execute on function private.bc_para_voce_get_point_policy_impl(uuid),
  private.bc_para_voce_reset_point_rule_impl(uuid),
  public.bc_para_voce_get_point_policy(uuid), public.bc_para_voce_reset_point_rule(uuid)
to authenticated;
