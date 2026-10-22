-- FIN01: obrigação financeira deriva da cobrança conhecida ou versão clínica assinada.
-- Uma parcela nunca redefine o total; o pagamento serializa somas e estornos.

create or replace function private.bc_recompute_pagamento_impl(p_pagamento_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_total_recebido numeric(12,2);
  v_total numeric(12,2);
  v_ultima_forma text;
  v_ultima_data timestamptz;
begin
  select valor_total into v_total from public.pagamentos where id=p_pagamento_id for update;
  if not found then raise exception 'Cobrança não encontrada.' using errcode='P0002'; end if;
  select coalesce(sum(r.valor), 0)::numeric(12,2),
         (array_agg(r.forma_pagamento order by r.recebido_at desc, r.created_at desc))[1],
         max(r.recebido_at)
    into v_total_recebido, v_ultima_forma, v_ultima_data
    from public.recebimentos r
   where r.pagamento_id = p_pagamento_id
     and r.status = 'ativo';

  if v_total_recebido>v_total then raise exception 'Recebimentos excedem o valor total da cobrança.' using errcode='23514'; end if;
  update public.pagamentos
     set valor_recebido = v_total_recebido,
         forma_pagamento = case when v_total_recebido = 0 then forma_pagamento else v_ultima_forma end,
         data_recebimento = case when v_total_recebido = 0 then null else v_ultima_data end,
         status = case
           when status='cancelado' then 'cancelado'
           when v_total_recebido = 0 then 'pendente'
           when v_total_recebido < valor_total then 'parcial'
           else 'pago'
         end,
         updated_at = now()
   where id = p_pagamento_id;
end;
$$;

revoke all on function private.bc_recompute_pagamento_impl(uuid) from public, anon, authenticated;

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
  v_pagamento_id uuid;
  v_pagamento_ids uuid[];
  v_pagamento public.pagamentos%rowtype;
  v_total numeric(12,2);
  v_total_text text;
  v_recebido numeric(12,2);
  v_recebimento_id uuid;
  v_recebido_at timestamptz := coalesce(p_recebido_at, now());
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  if p_valor is null or p_valor::text in ('NaN','Infinity','-Infinity') or p_valor <= 0 or p_valor<>round(p_valor,2) then
    raise exception 'Valor recebido deve ser maior que zero.' using errcode = '22023';
  end if;

  if nullif(trim(p_forma_pagamento), '') is null then
    raise exception 'Forma de pagamento é obrigatória.' using errcode = '22023';
  end if;

  -- Mesma ordem da ponte de agenda: agenda, atendimento, pagamento.
  perform 1 from public.agendamentos where id=(select agendamento_id from public.atendimentos where id=p_atendimento_id) for update;
  select *
    into v_atendimento
    from public.atendimentos
   where id = p_atendimento_id
   for update;

  if not found then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0002';
  end if;

  if not private.is_bc_admin() then
    if not private.is_bc_active_colaborador()
       or v_atendimento.colaboradora_user_id <> v_user_id then
      raise exception 'Acesso negado ao recebimento deste atendimento.' using errcode = '42501';
    end if;
  end if;

  perform 1 from public.pagamentos p
   where p.atendimento_id=p_atendimento_id or (p.atendimento_id is null and p.agendamento_id=v_atendimento.agendamento_id)
   order by p.id for update;
  select array_agg(p.id order by p.id) into v_pagamento_ids from public.pagamentos p
   where p.atendimento_id=p_atendimento_id or (p.atendimento_id is null and p.agendamento_id=v_atendimento.agendamento_id);
  if cardinality(v_pagamento_ids)>1 then raise exception 'Há cobranças ambíguas para este atendimento; revise antes de receber.' using errcode='55000'; end if;
  v_pagamento_id:=v_pagamento_ids[1];
  if v_pagamento_id is not null then
    select * into v_pagamento from public.pagamentos where id=v_pagamento_id;
    if v_pagamento.status='cancelado' or v_pagamento.cliente_id<>v_atendimento.cliente_id
       or (v_pagamento.agendamento_id is not null and v_pagamento.agendamento_id<>v_atendimento.agendamento_id) then
      raise exception 'Cobrança cancelada ou incompatível com o atendimento.' using errcode='55000';
    end if;
    v_total:=v_pagamento.valor_total;
  else
    select v.snapshot->'treatment'->>'final_price' into v_total_text
      from public.clinical_treatments t join public.clinical_treatment_versions v on v.id=t.current_version_id and v.treatment_id=t.id
     where t.agendamento_id=v_atendimento.agendamento_id and t.operational_attendance_id=v_atendimento.id
       and t.cliente_id=v_atendimento.cliente_id and t.profissional_user_id=v_atendimento.colaboradora_user_id
       and t.procedimento_id=v_atendimento.procedimento_id and t.status='finalizado';
    begin v_total:=v_total_text::numeric; exception when invalid_text_representation or numeric_value_out_of_range then v_total:=null; end;
  end if;
  if v_total is null or v_total::text in ('NaN','Infinity','-Infinity') or v_total<=0 then
    raise exception 'Valor total não definido: revise a cobrança ou conclua a versão assinada do atendimento.' using errcode='55000';
  end if;
  if v_pagamento_id is null then
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
      v_total,
      0,
      trim(p_forma_pagamento),
      'pendente',
      null,
      v_user_id
    )
    returning id into v_pagamento_id;
  end if;

  select coalesce(sum(valor),0) into v_recebido from public.recebimentos where pagamento_id=v_pagamento_id and status='ativo';
  if p_valor>v_total-v_recebido then raise exception 'Valor recebido excede o saldo da cobrança.' using errcode='22023'; end if;
  update public.pagamentos set atendimento_id=v_atendimento.id where id=v_pagamento_id and atendimento_id is null;
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
    created_by
  ) values (
    v_pagamento_id,
    v_atendimento.agendamento_id,
    v_atendimento.id,
    v_atendimento.cliente_id,
    v_atendimento.colaboradora_user_id,
    v_atendimento.procedimento_id,
    p_valor,
    trim(p_forma_pagamento),
    v_recebido_at,
    nullif(trim(p_observacao), ''),
    v_user_id
  )
  returning id into v_recebimento_id;

  perform private.bc_recompute_pagamento_impl(v_pagamento_id);

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  ) values (
    v_user_id,
    'recebimento_created',
    'recebimentos',
    v_recebimento_id,
    jsonb_build_object(
      'pagamento_id', v_pagamento_id,
      'atendimento_id', v_atendimento.id,
      'profissional_user_id', v_atendimento.colaboradora_user_id,
      'procedimento_id', v_atendimento.procedimento_id,
      'valor', p_valor,
      'forma_pagamento', trim(p_forma_pagamento),
      'recebido_at', v_recebido_at
    )
  );

  return v_recebimento_id;
end;
$$;

