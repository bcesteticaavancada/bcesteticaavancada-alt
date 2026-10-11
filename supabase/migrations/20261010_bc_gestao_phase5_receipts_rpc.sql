-- BC Gestão — Fase 5: recebimentos seguros e correção por estorno.
-- A identidade clínica e a autoria são sempre derivadas no banco.

alter table public.recebimentos
  add column if not exists observacao text;

create or replace function private.bc_recompute_pagamento_recebimentos(
  p_pagamento_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_total_recebido numeric(12,2) := 0;
  v_ultimo_recebimento timestamptz;
begin
  select coalesce(sum(r.valor), 0), max(r.recebido_at)
    into v_total_recebido, v_ultimo_recebimento
    from public.recebimentos r
   where r.pagamento_id = p_pagamento_id
     and r.status = 'ativo';

  update public.pagamentos
     set valor_total = greatest(valor_total, v_total_recebido),
         valor_recebido = v_total_recebido,
         status = case
           when v_total_recebido <= 0 then 'pendente'
           when v_total_recebido < greatest(valor_total, v_total_recebido) then 'parcial'
           else 'pago'
         end,
         data_recebimento = v_ultimo_recebimento,
         updated_at = now()
   where id = p_pagamento_id;
end;
$$;

revoke all on function private.bc_recompute_pagamento_recebimentos(uuid) from public, anon;
grant execute on function private.bc_recompute_pagamento_recebimentos(uuid) to authenticated;

create or replace function private.bc_recebimento_registrar_impl(
  p_atendimento_id uuid,
  p_valor numeric,
  p_forma_pagamento text,
  p_recebido_at timestamptz default now(),
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_atendimento public.atendimentos%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_recebimento_id uuid;
  v_recebido_at timestamptz := coalesce(p_recebido_at, now());
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao financeiro.' using errcode = '42501';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor recebido deve ser maior que zero.' using errcode = '22023';
  end if;

  if nullif(trim(p_forma_pagamento), '') is null then
    raise exception 'Forma de pagamento é obrigatória.' using errcode = '22023';
  end if;

  select *
    into v_atendimento
    from public.atendimentos
   where id = p_atendimento_id;

  if not found then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0002';
  end if;

  if not private.is_bc_admin() and v_atendimento.colaboradora_user_id <> v_user_id then
    raise exception 'Você só pode registrar recebimentos dos próprios atendimentos.' using errcode = '42501';
  end if;

  -- Serializa criação/seleção da obrigação financeira por atendimento.
  perform pg_advisory_xact_lock(hashtextextended(p_atendimento_id::text, 0));

  select p.*
    into v_pagamento
    from public.pagamentos p
   where p.atendimento_id = p_atendimento_id
     and p.status <> 'cancelado'
   order by p.created_at desc
   limit 1
   for update;

  if not found then
    insert into public.pagamentos (
      agendamento_id,
      atendimento_id,
      cliente_id,
      valor_total,
      valor_recebido,
      forma_pagamento,
      status,
      data_recebimento,
      created_by
    ) values (
      v_atendimento.agendamento_id,
      v_atendimento.id,
      v_atendimento.cliente_id,
      p_valor,
      0,
      trim(p_forma_pagamento),
      'pendente',
      null,
      v_user_id
    )
    returning * into v_pagamento;
  end if;

  insert into public.recebimentos (
    pagamento_id,
    agendamento_id,
    atendimento_id,
    cliente_id,
    profissional_user_id,
    procedimento_id,
    valor,
    forma_pagamento,
    recebido_at,
    observacao,
    status,
    created_by
  ) values (
    v_pagamento.id,
    v_atendimento.agendamento_id,
    v_atendimento.id,
    v_atendimento.cliente_id,
    v_atendimento.colaboradora_user_id,
    v_atendimento.procedimento_id,
    p_valor,
    trim(p_forma_pagamento),
    v_recebido_at,
    nullif(trim(p_observacao), ''),
    'ativo',
    v_user_id
  )
  returning id into v_recebimento_id;

  perform private.bc_recompute_pagamento_recebimentos(v_pagamento.id);

  update public.pagamentos
     set forma_pagamento = trim(p_forma_pagamento)
   where id = v_pagamento.id;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    v_user_id,
    'recebimento_created',
    'recebimentos',
    v_recebimento_id,
    null,
    jsonb_build_object(
      'pagamento_id', v_pagamento.id,
      'atendimento_id', v_atendimento.id,
      'profissional_user_id', v_atendimento.colaboradora_user_id,
      'procedimento_id', v_atendimento.procedimento_id,
      'valor', p_valor,
      'status', 'ativo'
    )
  );

  return v_recebimento_id;
end;
$$;

create or replace function public.bc_recebimento_registrar(
  p_atendimento_id uuid,
  p_valor numeric,
  p_forma_pagamento text,
  p_recebido_at timestamptz default now(),
  p_observacao text default null
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_recebimento_registrar_impl(
    p_atendimento_id,
    p_valor,
    p_forma_pagamento,
    p_recebido_at,
    p_observacao
  );
$$;

create or replace function private.bc_recebimento_estornar_impl(
  p_recebimento_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_recebimento public.recebimentos%rowtype;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode estornar recebimentos.' using errcode = '42501';
  end if;

  if nullif(trim(p_motivo), '') is null then
    raise exception 'Motivo do estorno é obrigatório.' using errcode = '22023';
  end if;

  select *
    into v_recebimento
    from public.recebimentos
   where id = p_recebimento_id
   for update;

  if not found then
    raise exception 'Recebimento não encontrado.' using errcode = 'P0002';
  end if;

  if v_recebimento.status <> 'ativo' then
    raise exception 'Recebimento já está estornado.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.livro_financeiro_itens lfi
      join public.livros_financeiros lf on lf.id = lfi.livro_id
     where lfi.movimento_recebimento_id = p_recebimento_id
       and lf.status in ('fechado', 'pago')
  ) then
    raise exception 'Recebimento pertence a livro fechado ou pago. Reabra o fluxo financeiro antes do estorno.' using errcode = '23514';
  end if;

  update public.recebimentos
     set status = 'estornado',
         estornado_at = now(),
         estornado_by = v_user_id,
         observacao = concat_ws(' | ', nullif(observacao, ''), 'Estorno: ' || trim(p_motivo))
   where id = p_recebimento_id;

  perform private.bc_recompute_pagamento_recebimentos(v_recebimento.pagamento_id);

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    v_user_id,
    'recebimento_reversed',
    'recebimentos',
    p_recebimento_id,
    jsonb_build_object('status', v_recebimento.status, 'valor', v_recebimento.valor),
    jsonb_build_object('status', 'estornado', 'motivo', trim(p_motivo), 'valor', v_recebimento.valor)
  );

  return p_recebimento_id;
end;
$$;

create or replace function public.bc_recebimento_estornar(
  p_recebimento_id uuid,
  p_motivo text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_recebimento_estornar_impl(p_recebimento_id, p_motivo);
$$;

create or replace function private.bc_meus_recebimentos_impl(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table (
  id uuid,
  pagamento_id uuid,
  atendimento_id uuid,
  cliente_id uuid,
  procedimento_id uuid,
  valor numeric,
  forma_pagamento text,
  recebido_at timestamptz,
  status text,
  observacao text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao financeiro.' using errcode = '42501';
  end if;

  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim < p_periodo_inicio then
    raise exception 'Período financeiro inválido.' using errcode = '22023';
  end if;

  return query
  select
    r.id,
    r.pagamento_id,
    r.atendimento_id,
    r.cliente_id,
    r.procedimento_id,
    r.valor,
    r.forma_pagamento,
    r.recebido_at,
    r.status,
    r.observacao
  from public.recebimentos r
  where r.profissional_user_id = v_user_id
    and (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
  order by r.recebido_at desc;
end;
$$;

create or replace function public.bc_meus_recebimentos(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table (
  id uuid,
  pagamento_id uuid,
  atendimento_id uuid,
  cliente_id uuid,
  procedimento_id uuid,
  valor numeric,
  forma_pagamento text,
  recebido_at timestamptz,
  status text,
  observacao text
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_meus_recebimentos_impl(p_periodo_inicio, p_periodo_fim);
$$;

create or replace function private.bc_financeiro_recebimentos_admin_impl(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table (
  id uuid,
  pagamento_id uuid,
  atendimento_id uuid,
  cliente_id uuid,
  profissional_user_id uuid,
  procedimento_id uuid,
  valor numeric,
  forma_pagamento text,
  recebido_at timestamptz,
  status text,
  observacao text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Somente a administradora pode consultar o financeiro global.' using errcode = '42501';
  end if;

  if p_periodo_inicio is not null and p_periodo_fim is not null and p_periodo_fim < p_periodo_inicio then
    raise exception 'Período financeiro inválido.' using errcode = '22023';
  end if;

  return query
  select
    r.id,
    r.pagamento_id,
    r.atendimento_id,
    r.cliente_id,
    r.profissional_user_id,
    r.procedimento_id,
    r.valor,
    r.forma_pagamento,
    r.recebido_at,
    r.status,
    r.observacao
  from public.recebimentos r
  where (p_profissional_user_id is null or r.profissional_user_id = p_profissional_user_id)
    and (p_periodo_inicio is null or (r.recebido_at at time zone 'America/Sao_Paulo')::date >= p_periodo_inicio)
    and (p_periodo_fim is null or (r.recebido_at at time zone 'America/Sao_Paulo')::date <= p_periodo_fim)
  order by r.recebido_at desc;
end;
$$;

create or replace function public.bc_financeiro_recebimentos_admin(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table (
  id uuid,
  pagamento_id uuid,
  atendimento_id uuid,
  cliente_id uuid,
  profissional_user_id uuid,
  procedimento_id uuid,
  valor numeric,
  forma_pagamento text,
  recebido_at timestamptz,
  status text,
  observacao text
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_financeiro_recebimentos_admin_impl(
    p_profissional_user_id,
    p_periodo_inicio,
    p_periodo_fim
  );
$$;

-- Public wrappers invoke private implementations; private schema is not exposed to the browser.
revoke all on function private.bc_recebimento_registrar_impl(uuid,numeric,text,timestamptz,text) from public, anon;
revoke all on function private.bc_recebimento_estornar_impl(uuid,text) from public, anon;
revoke all on function private.bc_meus_recebimentos_impl(date,date) from public, anon;
revoke all on function private.bc_financeiro_recebimentos_admin_impl(uuid,date,date) from public, anon;
grant execute on function private.bc_recebimento_registrar_impl(uuid,numeric,text,timestamptz,text) to authenticated;
grant execute on function private.bc_recebimento_estornar_impl(uuid,text) to authenticated;
grant execute on function private.bc_meus_recebimentos_impl(date,date) to authenticated;
grant execute on function private.bc_financeiro_recebimentos_admin_impl(uuid,date,date) to authenticated;

revoke all on function public.bc_recebimento_registrar(uuid,numeric,text,timestamptz,text) from public;
revoke all on function public.bc_recebimento_registrar(uuid,numeric,text,timestamptz,text) from anon;
grant execute on function public.bc_recebimento_registrar(uuid,numeric,text,timestamptz,text) to authenticated;

revoke all on function public.bc_recebimento_estornar(uuid,text) from public;
revoke all on function public.bc_recebimento_estornar(uuid,text) from anon;
grant execute on function public.bc_recebimento_estornar(uuid,text) to authenticated;

revoke all on function public.bc_meus_recebimentos(date,date) from public;
revoke all on function public.bc_meus_recebimentos(date,date) from anon;
grant execute on function public.bc_meus_recebimentos(date,date) to authenticated;

revoke all on function public.bc_financeiro_recebimentos_admin(uuid,date,date) from public;
revoke all on function public.bc_financeiro_recebimentos_admin(uuid,date,date) from anon;
grant execute on function public.bc_financeiro_recebimentos_admin(uuid,date,date) to authenticated;
