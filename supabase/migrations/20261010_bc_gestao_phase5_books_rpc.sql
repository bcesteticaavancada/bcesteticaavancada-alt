-- BC Gestão — Fase 5: comissão privada e livros financeiros semanais.

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
  v_rule_id uuid;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode alterar comissões.' using errcode = '42501';
  end if;

  if p_percentual is null or p_percentual < 0 or p_percentual > 100 then
    raise exception 'Percentual inválido.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = p_profissional_user_id
      and sp.active = true
      and sp.atende_clientes = true
  ) then
    raise exception 'Profissional inválida ou inativa.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.procedimentos p
    where p.id = p_procedimento_id and p.ativo = true
  ) then
    raise exception 'Procedimento inválido ou inativo.' using errcode = '22023';
  end if;

  update public.comissao_profissional_procedimento
     set ativo = false,
         updated_by = v_user_id,
         updated_at = now()
   where profissional_user_id = p_profissional_user_id
     and procedimento_id = p_procedimento_id
     and ativo = true;

  insert into public.comissao_profissional_procedimento (
    profissional_user_id,
    procedimento_id,
    percentual,
    ativo,
    created_by,
    updated_by
  ) values (
    p_profissional_user_id,
    p_procedimento_id,
    p_percentual,
    true,
    v_user_id,
    v_user_id
  ) returning id into v_rule_id;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    v_user_id,
    'comissao_defined',
    'comissao_profissional_procedimento',
    v_rule_id,
    null,
    jsonb_build_object(
      'profissional_user_id', p_profissional_user_id,
      'procedimento_id', p_procedimento_id,
      'percentual', p_percentual,
      'ativo', true
    )
  );

  return v_rule_id;
end;
$$;

create or replace function public.bc_comissao_set(
  p_profissional_user_id uuid,
  p_procedimento_id uuid,
  p_percentual numeric
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_comissao_set_impl(p_profissional_user_id, p_procedimento_id, p_percentual);
$$;

create or replace function private.bc_financeiro_comissoes_admin_impl(
  p_profissional_user_id uuid default null
)
returns table (
  id uuid,
  profissional_user_id uuid,
  procedimento_id uuid,
  percentual numeric,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Somente a administradora pode consultar comissões.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.profissional_user_id,
    c.procedimento_id,
    c.percentual,
    c.ativo,
    c.created_at,
    c.updated_at
  from public.comissao_profissional_procedimento c
  where p_profissional_user_id is null
     or c.profissional_user_id = p_profissional_user_id
  order by c.updated_at desc;
end;
$$;

create or replace function public.bc_financeiro_comissoes_admin(
  p_profissional_user_id uuid default null
)
returns table (
  id uuid,
  profissional_user_id uuid,
  procedimento_id uuid,
  percentual numeric,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_financeiro_comissoes_admin_impl(p_profissional_user_id);
$$;

create or replace function private.bc_livro_rebuild_items(
  p_livro_id uuid,
  p_procedimento_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_livro public.livros_financeiros%rowtype;
  v_count integer := 0;
begin
  select *
    into v_livro
    from public.livros_financeiros
   where id = p_livro_id
   for update;

  if not found then
    raise exception 'Livro financeiro não encontrado.' using errcode = 'P0002';
  end if;

  if v_livro.status not in ('aberto', 'em_revisao') then
    raise exception 'Livro não está aberto para cálculo.' using errcode = '23514';
  end if;

  -- Remove itens cujo recebimento foi estornado enquanto o livro estava em revisão.
  delete from public.livro_financeiro_itens lfi
   using public.recebimentos r
   where lfi.livro_id = p_livro_id
     and lfi.movimento_recebimento_id = r.id
     and (p_procedimento_id is null or lfi.procedimento_id = p_procedimento_id)
     and r.status <> 'ativo';

  if exists (
    select 1
      from public.recebimentos r
      left join public.comissao_profissional_procedimento c
        on c.profissional_user_id = r.profissional_user_id
       and c.procedimento_id = r.procedimento_id
       and c.ativo = true
     where r.profissional_user_id = v_livro.profissional_user_id
       and r.status = 'ativo'
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between v_livro.periodo_inicio and v_livro.periodo_fim
       and (p_procedimento_id is null or r.procedimento_id = p_procedimento_id)
       and c.id is null
  ) then
    raise exception 'Comissão não configurada para um ou mais procedimentos do período.' using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.recebimentos r
      join public.livro_financeiro_itens existing_item
        on existing_item.movimento_recebimento_id = r.id
     where r.profissional_user_id = v_livro.profissional_user_id
       and r.status = 'ativo'
       and (r.recebido_at at time zone 'America/Sao_Paulo')::date between v_livro.periodo_inicio and v_livro.periodo_fim
       and (p_procedimento_id is null or r.procedimento_id = p_procedimento_id)
       and existing_item.livro_id <> p_livro_id
  ) then
    raise exception 'Recebimento já pertence a outro livro financeiro.' using errcode = '23505';
  end if;

  insert into public.livro_financeiro_itens (
    livro_id,
    movimento_recebimento_id,
    atendimento_id,
    procedimento_id,
    valor_recebido_base,
    percentual_aplicado,
    valor_repasse
  )
  select
    v_livro.id,
    r.id,
    r.atendimento_id,
    r.procedimento_id,
    r.valor,
    c.percentual,
    round(r.valor * c.percentual / 100.0, 2)
  from public.recebimentos r
  join public.comissao_profissional_procedimento c
    on c.profissional_user_id = r.profissional_user_id
   and c.procedimento_id = r.procedimento_id
   and c.ativo = true
  where r.profissional_user_id = v_livro.profissional_user_id
    and r.status = 'ativo'
    and (r.recebido_at at time zone 'America/Sao_Paulo')::date between v_livro.periodo_inicio and v_livro.periodo_fim
    and (p_procedimento_id is null or r.procedimento_id = p_procedimento_id)
    and not exists (
      select 1
      from public.livro_financeiro_itens lfi
      where lfi.movimento_recebimento_id = r.id
    );

  update public.livro_financeiro_itens lfi
     set percentual_aplicado = c.percentual,
         valor_repasse = round(lfi.valor_recebido_base * c.percentual / 100.0, 2)
    from public.comissao_profissional_procedimento c
   where lfi.livro_id = p_livro_id
     and c.profissional_user_id = v_livro.profissional_user_id
     and c.procedimento_id = lfi.procedimento_id
     and c.ativo = true
     and (p_procedimento_id is null or lfi.procedimento_id = p_procedimento_id);

  update public.livros_financeiros lf
     set producao_recebida = coalesce((
           select sum(i.valor_recebido_base)
           from public.livro_financeiro_itens i
           where i.livro_id = p_livro_id
         ), 0),
         repasse_total = coalesce((
           select sum(i.valor_repasse)
           from public.livro_financeiro_itens i
           where i.livro_id = p_livro_id
         ), 0),
         updated_at = now()
   where lf.id = p_livro_id;

  select count(*)::integer
    into v_count
    from public.livro_financeiro_itens
   where livro_id = p_livro_id
     and (p_procedimento_id is null or procedimento_id = p_procedimento_id);

  return v_count;
end;
$$;

revoke all on function private.bc_livro_rebuild_items(uuid,uuid) from public, anon;

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
  v_livro public.livros_financeiros%rowtype;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode fechar livros.' using errcode = '42501';
  end if;

  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim <> p_periodo_inicio + 6 then
    raise exception 'Livro financeiro deve ter exatamente 7 dias.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = p_profissional_user_id
      and sp.active = true
      and sp.atende_clientes = true
  ) then
    raise exception 'Profissional inválida ou inativa.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profissional_user_id::text || ':' || p_periodo_inicio::text, 0));

  select *
    into v_livro
    from public.livros_financeiros
   where profissional_user_id = p_profissional_user_id
     and periodo_inicio = p_periodo_inicio
     and periodo_fim = p_periodo_fim
   for update;

  if found and v_livro.status in ('fechado', 'pago') then
    return v_livro.id;
  end if;

  if not found then
    insert into public.livros_financeiros (
      profissional_user_id,
      periodo_inicio,
      periodo_fim,
      status,
      producao_recebida,
      repasse_total
    ) values (
      p_profissional_user_id,
      p_periodo_inicio,
      p_periodo_fim,
      'aberto',
      0,
      0
    ) returning * into v_livro;
  end if;

  if v_livro.status = 'aberto' then
    perform private.bc_livro_rebuild_items(v_livro.id, null);
  elsif v_livro.status = 'em_revisao' then
    -- Impede recongelar livro com movimento estornado ou novo movimento ainda não revisado.
    if exists (
      select 1
      from public.livro_financeiro_itens lfi
      join public.recebimentos r on r.id = lfi.movimento_recebimento_id
      where lfi.livro_id = v_livro.id
        and r.status <> 'ativo'
    ) or exists (
      select 1
      from public.recebimentos r
      where r.profissional_user_id = v_livro.profissional_user_id
        and r.status = 'ativo'
        and (r.recebido_at at time zone 'America/Sao_Paulo')::date between v_livro.periodo_inicio and v_livro.periodo_fim
        and not exists (
          select 1 from public.livro_financeiro_itens lfi
          where lfi.movimento_recebimento_id = r.id
        )
    ) then
      raise exception 'Livro em revisão possui movimentos pendentes de recálculo.' using errcode = '23514';
    end if;
  else
    raise exception 'Estado do livro não permite fechamento.' using errcode = '23514';
  end if;

  update public.livros_financeiros
     set status = 'fechado',
         fechado_at = now(),
         fechado_by = v_user_id,
         updated_at = now()
   where id = v_livro.id
   returning * into v_livro;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    v_user_id,
    'livro_closed',
    'livros_financeiros',
    v_livro.id,
    null,
    jsonb_build_object(
      'profissional_user_id', v_livro.profissional_user_id,
      'periodo_inicio', v_livro.periodo_inicio,
      'periodo_fim', v_livro.periodo_fim,
      'producao_recebida', v_livro.producao_recebida,
      'repasse_total', v_livro.repasse_total,
      'status', v_livro.status
    )
  );

  return v_livro.id;
end;
$$;

create or replace function public.bc_livro_fechar(
  p_profissional_user_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_livro_fechar_impl(p_profissional_user_id, p_periodo_inicio, p_periodo_fim);
$$;

create or replace function private.bc_livro_reabrir_impl(
  p_livro_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro public.livros_financeiros%rowtype;
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode reabrir livros.' using errcode = '42501';
  end if;

  if nullif(trim(p_motivo), '') is null then
    raise exception 'Motivo da reabertura é obrigatório.' using errcode = '22023';
  end if;

  select * into v_livro
  from public.livros_financeiros
  where id = p_livro_id
  for update;

  if not found then
    raise exception 'Livro financeiro não encontrado.' using errcode = 'P0002';
  end if;

  if v_livro.status = 'pago' then
    raise exception 'Livro pago exige estorno do repasse antes da revisão.' using errcode = '23514';
  end if;

  if v_livro.status = 'em_revisao' then
    return v_livro.id;
  end if;

  if v_livro.status <> 'fechado' then
    raise exception 'Somente livro fechado pode ser reaberto.' using errcode = '23514';
  end if;

  update public.livros_financeiros
     set status = 'em_revisao',
         reaberto_at = now(),
         reaberto_by = v_user_id,
         updated_at = now()
   where id = p_livro_id;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    v_user_id,
    'livro_reopened',
    'livros_financeiros',
    p_livro_id,
    jsonb_build_object('status', v_livro.status),
    jsonb_build_object('status', 'em_revisao', 'motivo', trim(p_motivo))
  );

  return p_livro_id;
end;
$$;

create or replace function public.bc_livro_reabrir(
  p_livro_id uuid,
  p_motivo text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_livro_reabrir_impl(p_livro_id, p_motivo);
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
begin
  if v_user_id is null or not private.is_bc_admin() then
    raise exception 'Somente a administradora pode recalcular livros.' using errcode = '42501';
  end if;

  if p_periodo_inicio is null or p_periodo_fim is null or p_periodo_fim < p_periodo_inicio then
    raise exception 'Período de recálculo inválido.' using errcode = '22023';
  end if;

  for v_livro in
    select id, profissional_user_id, periodo_inicio, periodo_fim, status
    from public.livros_financeiros
    where profissional_user_id = p_profissional_user_id
      and status = 'em_revisao'
      and periodo_inicio >= p_periodo_inicio
      and periodo_fim <= p_periodo_fim
    order by periodo_inicio
    for update
  loop
    perform private.bc_livro_rebuild_items(v_livro.id, p_procedimento_id);
    v_count := v_count + 1;

    insert into public.audit_log (
      actor_user_id, action, entity_type, entity_id, old_data, new_data
    ) values (
      v_user_id,
      'livro_recalculated',
      'livros_financeiros',
      v_livro.id,
      null,
      jsonb_build_object(
        'profissional_user_id', p_profissional_user_id,
        'procedimento_id', p_procedimento_id,
        'periodo_inicio', p_periodo_inicio,
        'periodo_fim', p_periodo_fim,
        'status', 'em_revisao'
      )
    );
  end loop;

  return v_count;
end;
$$;

create or replace function public.bc_livros_recalcular(
  p_profissional_user_id uuid,
  p_procedimento_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns integer
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_livros_recalcular_impl(
    p_profissional_user_id,
    p_procedimento_id,
    p_periodo_inicio,
    p_periodo_fim
  );
$$;

create or replace function private.bc_meus_livros_financeiros_impl(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table (
  id uuid,
  periodo_inicio date,
  periodo_fim date,
  status text,
  producao_recebida numeric,
  repasse_total numeric,
  fechado_at timestamptz,
  reaberto_at timestamptz
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

  return query
  select
    lf.id,
    lf.periodo_inicio,
    lf.periodo_fim,
    lf.status,
    lf.producao_recebida,
    lf.repasse_total,
    lf.fechado_at,
    lf.reaberto_at
  from public.livros_financeiros lf
  where lf.profissional_user_id = v_user_id
    and lf.periodo_fim >= p_periodo_inicio
    and lf.periodo_inicio <= p_periodo_fim
  order by lf.periodo_inicio desc;
end;
$$;

create or replace function public.bc_meus_livros_financeiros(
  p_periodo_inicio date,
  p_periodo_fim date
)
returns table (
  id uuid,
  periodo_inicio date,
  periodo_fim date,
  status text,
  producao_recebida numeric,
  repasse_total numeric,
  fechado_at timestamptz,
  reaberto_at timestamptz
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_meus_livros_financeiros_impl(p_periodo_inicio, p_periodo_fim);
$$;

create or replace function private.bc_financeiro_livros_admin_impl(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table (
  id uuid,
  profissional_user_id uuid,
  periodo_inicio date,
  periodo_fim date,
  status text,
  producao_recebida numeric,
  repasse_total numeric,
  fechado_at timestamptz,
  reaberto_at timestamptz,
  itens jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if not private.is_bc_admin() then
    raise exception 'Somente a administradora pode consultar livros globais.' using errcode = '42501';
  end if;

  return query
  select
    lf.id,
    lf.profissional_user_id,
    lf.periodo_inicio,
    lf.periodo_fim,
    lf.status,
    lf.producao_recebida,
    lf.repasse_total,
    lf.fechado_at,
    lf.reaberto_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'movimento_recebimento_id', i.movimento_recebimento_id,
          'atendimento_id', i.atendimento_id,
          'procedimento_id', i.procedimento_id,
          'valor_recebido_base', i.valor_recebido_base,
          'percentual_aplicado', i.percentual_aplicado,
          'valor_repasse', i.valor_repasse
        ) order by i.created_at
      )
      from public.livro_financeiro_itens i
      where i.livro_id = lf.id
    ), '[]'::jsonb) as itens
  from public.livros_financeiros lf
  where (p_profissional_user_id is null or lf.profissional_user_id = p_profissional_user_id)
    and (p_periodo_inicio is null or lf.periodo_fim >= p_periodo_inicio)
    and (p_periodo_fim is null or lf.periodo_inicio <= p_periodo_fim)
  order by lf.periodo_inicio desc, lf.profissional_user_id;
end;
$$;

create or replace function public.bc_financeiro_livros_admin(
  p_profissional_user_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null
)
returns table (
  id uuid,
  profissional_user_id uuid,
  periodo_inicio date,
  periodo_fim date,
  status text,
  producao_recebida numeric,
  repasse_total numeric,
  fechado_at timestamptz,
  reaberto_at timestamptz,
  itens jsonb
)
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select * from private.bc_financeiro_livros_admin_impl(
    p_profissional_user_id,
    p_periodo_inicio,
    p_periodo_fim
  );
$$;

-- Execute private implementations only through authenticated public wrappers.
revoke all on function private.bc_comissao_set_impl(uuid,uuid,numeric) from public, anon;
revoke all on function private.bc_financeiro_comissoes_admin_impl(uuid) from public, anon;
revoke all on function private.bc_livro_fechar_impl(uuid,date,date) from public, anon;
revoke all on function private.bc_livro_reabrir_impl(uuid,text) from public, anon;
revoke all on function private.bc_livros_recalcular_impl(uuid,uuid,date,date) from public, anon;
revoke all on function private.bc_meus_livros_financeiros_impl(date,date) from public, anon;
revoke all on function private.bc_financeiro_livros_admin_impl(uuid,date,date) from public, anon;

grant execute on function private.bc_comissao_set_impl(uuid,uuid,numeric) to authenticated;
grant execute on function private.bc_financeiro_comissoes_admin_impl(uuid) to authenticated;
grant execute on function private.bc_livro_fechar_impl(uuid,date,date) to authenticated;
grant execute on function private.bc_livro_reabrir_impl(uuid,text) to authenticated;
grant execute on function private.bc_livros_recalcular_impl(uuid,uuid,date,date) to authenticated;
grant execute on function private.bc_meus_livros_financeiros_impl(date,date) to authenticated;
grant execute on function private.bc_financeiro_livros_admin_impl(uuid,date,date) to authenticated;

revoke all on function public.bc_comissao_set(uuid,uuid,numeric) from public, anon;
revoke all on function public.bc_financeiro_comissoes_admin(uuid) from public, anon;
revoke all on function public.bc_livro_fechar(uuid,date,date) from public, anon;
revoke all on function public.bc_livro_reabrir(uuid,text) from public, anon;
revoke all on function public.bc_livros_recalcular(uuid,uuid,date,date) from public, anon;
revoke all on function public.bc_meus_livros_financeiros(date,date) from public, anon;
revoke all on function public.bc_financeiro_livros_admin(uuid,date,date) from public, anon;

grant execute on function public.bc_comissao_set(uuid,uuid,numeric) to authenticated;
grant execute on function public.bc_financeiro_comissoes_admin(uuid) to authenticated;
grant execute on function public.bc_livro_fechar(uuid,date,date) to authenticated;
grant execute on function public.bc_livro_reabrir(uuid,text) to authenticated;
grant execute on function public.bc_livros_recalcular(uuid,uuid,date,date) to authenticated;
grant execute on function public.bc_meus_livros_financeiros(date,date) to authenticated;
grant execute on function public.bc_financeiro_livros_admin(uuid,date,date) to authenticated;
