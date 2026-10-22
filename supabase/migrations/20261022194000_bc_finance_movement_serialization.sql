-- Revisão: serializa movimentos e apuração da mesma profissional antes dos row locks.
-- Uma única trava por profissional evita lacunas entre semanas/datas e mantém a ordem simples.
create or replace function private.bc_finance_lock_professional(p_professional uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_professional is null then raise exception 'Profissional é obrigatória.' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bc_financial_professional:'||p_professional::text,0));
end $$;
revoke all on function private.bc_finance_lock_professional(uuid) from public,anon,authenticated;

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
  v_professional uuid;
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

  select colaboradora_user_id into v_professional from public.atendimentos where id=p_atendimento_id;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  perform private.bc_finance_lock_professional(v_professional);
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
  v_livro_id uuid;
  v_professional uuid;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode estornar recebimentos.' using errcode = '42501';
  end if;

  if nullif(trim(p_motivo), '') is null then
    raise exception 'Motivo do estorno é obrigatório.' using errcode = '22023';
  end if;

  select profissional_user_id into v_professional from public.recebimentos where id=p_recebimento_id;
  if not found then raise exception 'Recebimento não encontrado.' using errcode='P0002'; end if;
  perform private.bc_finance_lock_professional(v_professional);
  select *
    into v_recebimento
    from public.recebimentos
   where id = p_recebimento_id
   for update;

  if not found then
    raise exception 'Recebimento não encontrado.' using errcode = 'P0002';
  end if;

  if v_recebimento.profissional_user_id is distinct from v_professional then raise exception 'Vínculo do recebimento foi alterado; confira antes de estornar.' using errcode='55000'; end if;
  perform 1 from public.livros_financeiros lf join public.livro_financeiro_itens li on li.livro_id=lf.id
   where li.movimento_recebimento_id=p_recebimento_id order by lf.id for update of lf;
  if exists(select 1 from public.livro_financeiro_itens li join public.repasse_livros rl on rl.livro_id=li.livro_id
    where li.movimento_recebimento_id=p_recebimento_id and rl.ativo) then
    raise exception 'Estorne o repasse ativo antes de estornar recebimentos deste livro.' using errcode='55000';
  end if;
  if v_recebimento.status = 'estornado' then
    raise exception 'Recebimento já está estornado.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.livro_financeiro_itens li
      join public.livros_financeiros lf on lf.id = li.livro_id
     where li.movimento_recebimento_id = p_recebimento_id
       and lf.status in ('fechado', 'pago')
  ) then
    raise exception 'Recebimento pertence a livro fechado ou pago; reabra ou reverta o fluxo antes do estorno.' using errcode = '55000';
  end if;

  select li.livro_id
    into v_livro_id
    from public.livro_financeiro_itens li
    join public.livros_financeiros lf on lf.id = li.livro_id
   where li.movimento_recebimento_id = p_recebimento_id
     and lf.status = 'em_revisao'
   limit 1;

  if v_livro_id is not null then
    delete from public.livro_financeiro_itens
     where movimento_recebimento_id = p_recebimento_id;

    update public.livros_financeiros lf
       set producao_recebida = coalesce((
             select sum(li.valor_recebido_base)
               from public.livro_financeiro_itens li
              where li.livro_id = lf.id
           ), 0),
           repasse_total = coalesce((
             select sum(li.valor_repasse)
               from public.livro_financeiro_itens li
              where li.livro_id = lf.id
           ), 0),
           updated_at = now()
     where lf.id = v_livro_id;
  end if;

  update public.recebimentos
     set status = 'estornado',
         estornado_at = now(),
         estornado_by = v_user_id,
         estorno_motivo = trim(p_motivo)
   where id = p_recebimento_id;

  perform private.bc_recompute_pagamento_impl(v_recebimento.pagamento_id);

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) values (
    v_user_id,
    'recebimento_reversed',
    'recebimentos',
    p_recebimento_id,
    jsonb_build_object(
      'status', v_recebimento.status,
      'valor', v_recebimento.valor
    ),
    jsonb_build_object(
      'status', 'estornado',
      'motivo', trim(p_motivo)
    )
  );

  return p_recebimento_id;
end;
$$;

create or replace function private.bc_livro_fechar_impl(
  p_profissional_user_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro_id uuid;
  v_status text;
  v_producao numeric(12,2) := 0;
  v_repasse numeric(12,2) := 0;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode fechar livro.' using errcode = '42501';
  end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim <> p_periodo_inicio + 6 then
    raise exception 'Livro financeiro deve conter exatamente 7 dias.' using errcode = '22023';
  end if;

  perform private.bc_finance_lock_professional(p_profissional_user_id);
  select lf.id, lf.status into v_livro_id, v_status
    from public.livros_financeiros lf
   where lf.profissional_user_id = p_profissional_user_id
     and lf.periodo_inicio = p_periodo_inicio
     and lf.periodo_fim = p_periodo_fim
   for update;

  if v_livro_id is not null and v_status in ('fechado', 'pago') then
    return v_livro_id;
  end if;
  if v_livro_id is not null and v_status = 'em_revisao' then
    raise exception 'Livro está em revisão; use o recálculo administrativo.' using errcode = '55000';
  end if;

  if exists (
    select 1
      from public.recebimentos r
      left join public.comissao_profissional_procedimento c
        on c.profissional_user_id = r.profissional_user_id
       and c.procedimento_id = r.procedimento_id
       and c.ativo = true
     where r.profissional_user_id = p_profissional_user_id
       and r.status = 'ativo'
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
       and not exists (
         select 1 from public.livro_financeiro_itens li
          where li.movimento_recebimento_id = r.id
       )
       and c.id is null
  ) then
    raise exception 'Comissão não configurada para todos os procedimentos recebidos no período.' using errcode = '23514';
  end if;

  if v_livro_id is null then
    insert into public.livros_financeiros (
      profissional_user_id, periodo_inicio, periodo_fim, status
    ) values (
      p_profissional_user_id, p_periodo_inicio, p_periodo_fim, 'aberto'
    ) returning id into v_livro_id;
  else
    delete from public.livro_financeiro_itens where livro_id = v_livro_id;
  end if;

  insert into public.livro_financeiro_itens (
    livro_id,
    movimento_recebimento_id,
    pagamento_id,
    atendimento_id,
    procedimento_id,
    valor_recebido_base,
    percentual_aplicado,
    valor_repasse
  )
  select v_livro_id,
         r.id,
         r.pagamento_id,
         r.atendimento_id,
         r.procedimento_id,
         r.valor,
         c.percentual,
         round((r.valor * c.percentual / 100.0)::numeric, 2)
    from public.recebimentos r
    join public.comissao_profissional_procedimento c
      on c.profissional_user_id = r.profissional_user_id
     and c.procedimento_id = r.procedimento_id
     and c.ativo = true
   where r.profissional_user_id = p_profissional_user_id
     and r.status = 'ativo'
     and (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
     and not exists (
       select 1
         from public.livro_financeiro_itens li
        where li.movimento_recebimento_id = r.id
     );

  select coalesce(sum(li.valor_recebido_base), 0), coalesce(sum(li.valor_repasse), 0)
    into v_producao, v_repasse
    from public.livro_financeiro_itens li
   where li.livro_id = v_livro_id;

  update public.livros_financeiros
     set status = 'fechado',
         producao_recebida = v_producao,
         repasse_total = v_repasse,
         fechado_at = now(),
         fechado_by = v_user_id,
         reaberto_at = null,
         reaberto_by = null,
         revisao_motivo = null,
         updated_at = now()
   where id = v_livro_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values (v_user_id, 'livro_closed', 'livros_financeiros', v_livro_id,
    jsonb_build_object('profissional_user_id', p_profissional_user_id, 'periodo_inicio', p_periodo_inicio, 'periodo_fim', p_periodo_fim, 'producao_recebida', v_producao, 'repasse_total', v_repasse));

  return v_livro_id;
end;
$$;

create or replace function private.bc_livros_recalcular_impl(
  p_profissional_user_id uuid,
  p_procedimento_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro record;
  v_count integer := 0;
  v_old_producao numeric;
  v_old_repasse numeric;
  v_new_producao numeric;
  v_new_repasse numeric;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode recalcular livros.' using errcode = '42501';
  end if;
  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim < p_periodo_inicio then
    raise exception 'Período de recálculo inválido.' using errcode = '22023';
  end if;

  perform private.bc_finance_lock_professional(p_profissional_user_id);
  if exists (
    select 1 from public.livros_financeiros lf
     where lf.profissional_user_id = p_profissional_user_id
       and lf.periodo_fim >= p_periodo_inicio
       and lf.periodo_inicio <= p_periodo_fim
       and lf.status <> 'em_revisao'
  ) then
    raise exception 'Todos os livros atingidos devem estar em revisão; livro fechado ou pago não pode ser recalculado silenciosamente.' using errcode = '55000';
  end if;

  for v_livro in
    select * from public.livros_financeiros lf
     where lf.profissional_user_id = p_profissional_user_id
       and lf.periodo_fim >= p_periodo_inicio
       and lf.periodo_inicio <= p_periodo_fim
       and lf.status = 'em_revisao'
     order by lf.periodo_inicio
     for update
  loop
    if exists(select 1 from public.repasse_livros rl where rl.livro_id=v_livro.id and rl.ativo) then
      raise exception 'Estorne o repasse ativo antes de revisar ou recalcular o livro.' using errcode='55000';
    end if;
    v_old_producao := v_livro.producao_recebida;
    v_old_repasse := v_livro.repasse_total;

    if exists (
      select 1
        from public.recebimentos r
        left join public.comissao_profissional_procedimento c
          on c.profissional_user_id = r.profissional_user_id
         and c.procedimento_id = r.procedimento_id
         and c.ativo = true
       where r.profissional_user_id = p_profissional_user_id
         and r.status = 'ativo'
         and (r.recebido_at at time zone 'America/Sao_Paulo')::date between greatest(v_livro.periodo_inicio, p_periodo_inicio) and least(v_livro.periodo_fim, p_periodo_fim)
         and (p_procedimento_id is null or r.procedimento_id = p_procedimento_id)
         and c.id is null
    ) then
      raise exception 'Comissão não configurada para o recálculo solicitado.' using errcode = '23514';
    end if;

    delete from public.livro_financeiro_itens li
     using public.recebimentos r
     where li.livro_id = v_livro.id
       and r.id = li.movimento_recebimento_id
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_periodo_inicio and p_periodo_fim
       and (p_procedimento_id is null or li.procedimento_id = p_procedimento_id);

    insert into public.livro_financeiro_itens (
      livro_id, movimento_recebimento_id, pagamento_id, atendimento_id, procedimento_id,
      valor_recebido_base, percentual_aplicado, valor_repasse
    )
    select v_livro.id, r.id, r.pagamento_id, r.atendimento_id, r.procedimento_id,
           r.valor, c.percentual, round((r.valor * c.percentual / 100.0)::numeric, 2)
      from public.recebimentos r
      join public.comissao_profissional_procedimento c
        on c.profissional_user_id = r.profissional_user_id
       and c.procedimento_id = r.procedimento_id
       and c.ativo = true
     where r.profissional_user_id = p_profissional_user_id
       and r.status = 'ativo'
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between greatest(v_livro.periodo_inicio, p_periodo_inicio) and least(v_livro.periodo_fim, p_periodo_fim)
       and (p_procedimento_id is null or r.procedimento_id = p_procedimento_id)
       and not exists (
         select 1 from public.livro_financeiro_itens existing
          where existing.movimento_recebimento_id = r.id
       );

    select coalesce(sum(li.valor_recebido_base),0), coalesce(sum(li.valor_repasse),0)
      into v_new_producao, v_new_repasse
      from public.livro_financeiro_itens li
     where li.livro_id = v_livro.id;

    update public.livros_financeiros
       set producao_recebida = v_new_producao,
           repasse_total = v_new_repasse,
           status = 'fechado',
           fechado_at = now(),
           fechado_by = v_user_id,
           updated_at = now()
     where id = v_livro.id;

    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
    values (v_user_id, 'livro_recalculated', 'livros_financeiros', v_livro.id,
      jsonb_build_object('producao_recebida', v_old_producao, 'repasse_total', v_old_repasse),
      jsonb_build_object('producao_recebida', v_new_producao, 'repasse_total', v_new_repasse, 'procedimento_id', p_procedimento_id, 'periodo_inicio', p_periodo_inicio, 'periodo_fim', p_periodo_fim));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function private.bc_comissao_set_impl(
  p_profissional_user_id uuid,
  p_procedimento_id uuid,
  p_percentual numeric
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_old numeric;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode configurar comissão.' using errcode = '42501';
  end if;
  if p_percentual is null or p_percentual < 0 or p_percentual > 100 then
    raise exception 'Percentual de comissão inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff_profiles sp where sp.user_id = p_profissional_user_id and sp.active = true and sp.atende_clientes = true) then
    raise exception 'Profissional inválida ou inativa.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.procedimentos p where p.id = p_procedimento_id and p.ativo = true) then
    raise exception 'Procedimento inválido ou inativo.' using errcode = '22023';
  end if;

  perform private.bc_finance_lock_professional(p_profissional_user_id);
  select c.id, c.percentual into v_id, v_old
    from public.comissao_profissional_procedimento c
   where c.profissional_user_id = p_profissional_user_id
     and c.procedimento_id = p_procedimento_id
     and c.ativo = true
   for update;

  if v_id is null then
    insert into public.comissao_profissional_procedimento (
      profissional_user_id, procedimento_id, percentual, ativo, created_by, updated_by
    ) values (
      p_profissional_user_id, p_procedimento_id, p_percentual, true, v_user_id, v_user_id
    ) returning id into v_id;
  else
    update public.comissao_profissional_procedimento
       set percentual = p_percentual,
           updated_by = v_user_id,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_user_id,
    'comissao_updated',
    'comissao_profissional_procedimento',
    v_id,
    case when v_old is null then null else jsonb_build_object('percentual', v_old) end,
    jsonb_build_object('profissional_user_id', p_profissional_user_id, 'procedimento_id', p_procedimento_id, 'percentual', p_percentual)
  );
  return v_id;
end;
$$;

create or replace function private.bc_guard_recebimento_book_period()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_data date := (new.recebido_at at time zone 'America/Sao_Paulo')::date;
  v_status text;
  v_book uuid;
begin
  perform private.bc_finance_lock_professional(new.profissional_user_id);
  select lf.status,lf.id
    into v_status,v_book
    from public.livros_financeiros lf
   where lf.profissional_user_id = new.profissional_user_id
     and v_data between lf.periodo_inicio and lf.periodo_fim
     and lf.status in ('fechado', 'pago', 'em_revisao')
   order by case lf.status
              when 'pago' then 1
              when 'fechado' then 2
              else 3
            end
   limit 1;

  if v_status in ('fechado', 'pago') then
    raise exception 'Recebimento pertence a livro fechado ou pago; reabra ou reverta o fluxo antes de registrar o movimento.'
      using errcode = '55000';
  end if;

  if v_status='em_revisao' and exists(select 1 from public.repasse_livros where livro_id=v_book and ativo) then
    raise exception 'Estorne o repasse ativo antes de registrar movimentos neste período.' using errcode='55000';
  end if;
  if v_status = 'em_revisao' and not private.is_bc_admin() then
    raise exception 'Período financeiro está em revisão; somente a administradora pode registrar movimentos retroativos.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
