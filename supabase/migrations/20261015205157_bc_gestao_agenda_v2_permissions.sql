-- BC Gestão — Agenda V2 — permissão operacional da Colaboradora Chefe.
-- Mantém role='colaborador'; amplia somente o escopo administrativo da agenda.

alter table public.staff_profiles
  add column if not exists pode_gerenciar_agendas boolean not null default false;

comment on column public.staff_profiles.pode_gerenciar_agendas is
  'Permite à colaboradora gerir agendas da equipe sem promover o papel para admin.';

create or replace function private.bc_can_manage_all_agendas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_profiles sp
     where sp.user_id = auth.uid()
       and sp.active = true
       and (
         sp.role = 'admin'
         or (sp.role = 'colaborador' and sp.pode_gerenciar_agendas = true)
       )
  );
$$;

revoke all on function private.bc_can_manage_all_agendas() from public;
revoke execute on function private.bc_can_manage_all_agendas() from anon;
grant execute on function private.bc_can_manage_all_agendas() to authenticated;

create or replace function private.bc_schedule_can_manage(p_professional_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and private.is_bc_active_staff()
     and (
       auth.uid() = p_professional_user_id
       or private.bc_can_manage_all_agendas()
     );
$$;

revoke all on function private.bc_schedule_can_manage(uuid) from public, anon, authenticated;

-- A Colaboradora Chefe enxerga a agenda inteira, mas isso não altera
-- as políticas de atendimento clínico, pagamentos ou financeiro.
alter policy "agendamentos_colaborador_select"
on public.agendamentos
using (
  private.is_bc_active_colaborador()
  and (
    colaboradora_user_id = (select auth.uid())
    or private.bc_can_manage_all_agendas()
  )
);

-- Clientes já são compartilhados com a equipe ativa pela policy
-- clientes_equipe_select criada na Fase 4. Não ampliamos nem duplicamos
-- essa política aqui; a permissão nova é restrita à operação da agenda.

create or replace function private.bc_agendamento_create_impl(
  p_cliente_id uuid,
  p_colaboradora_user_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_end timestamptz;
  v_agendamento_id uuid;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à agenda.' using errcode = '42501';
  end if;
  if not private.bc_schedule_can_manage(p_colaboradora_user_id) then
    raise exception 'Acesso negado à agenda da profissional.' using errcode = '42501';
  end if;
  if not exists(select 1 from public.clientes c where c.id = p_cliente_id and c.ativo = true) then
    raise exception 'Cliente não encontrado ou arquivado.' using errcode = 'P0002';
  end if;
  if not exists(
    select 1 from public.staff_profiles sp
     where sp.user_id = p_colaboradora_user_id and sp.active = true and sp.atende_clientes = true
  ) then
    raise exception 'Profissional indisponível para agenda.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.procedimentos p where p.id = p_procedimento_id and p.ativo = true) then
    raise exception 'Procedimento inválido ou inativo.' using errcode = '22023';
  end if;

  v_end := private.bc_agendamento_lock_and_assert_no_conflict(
    p_colaboradora_user_id, p_procedimento_id, p_inicio, p_fim, null
  );

  insert into public.agendamentos(
    cliente_id, colaboradora_user_id, procedimento_id, inicio, fim, status,
    observacao_administrativa, created_by, origem
  ) values(
    p_cliente_id, p_colaboradora_user_id, p_procedimento_id, p_inicio, v_end, 'agendado',
    nullif(trim(p_observacao), ''), v_user_id, 'interno'
  ) returning id into v_agendamento_id;

  return v_agendamento_id;
end;
$$;

create or replace function private.bc_agendamento_update_impl(
  p_agendamento_id uuid,
  p_procedimento_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_agendamento public.agendamentos%rowtype;
  v_end timestamptz;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado à agenda.' using errcode = '42501';
  end if;

  select * into v_agendamento
    from public.agendamentos
   where id = p_agendamento_id
   for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if not private.bc_schedule_can_manage(v_agendamento.colaboradora_user_id) then
    raise exception 'Acesso negado ao agendamento.' using errcode = '42501';
  end if;
  if v_agendamento.cliente_id is not null
     and not exists(select 1 from public.clientes c where c.id = v_agendamento.cliente_id and c.ativo = true) then
    raise exception 'Cliente arquivado não pode ter agendamento remarcado.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.procedimentos p where p.id = p_procedimento_id and p.ativo = true) then
    raise exception 'Procedimento inválido ou inativo.' using errcode = '22023';
  end if;

  v_end := private.bc_agendamento_lock_and_assert_no_conflict(
    v_agendamento.colaboradora_user_id, p_procedimento_id, p_inicio, p_fim, p_agendamento_id
  );

  update public.agendamentos
     set procedimento_id = p_procedimento_id,
         inicio = p_inicio,
         fim = v_end,
         observacao_administrativa = nullif(trim(p_observacao), ''),
         updated_at = now()
   where id = p_agendamento_id;

  return p_agendamento_id;
end;
$$;

create or replace function private.bc_agendamento_link_cliente_impl(
  p_agendamento_id uuid,
  p_cliente_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_a public.agendamentos%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao vínculo.' using errcode = '42501';
  end if;

  select * into v_a
    from public.agendamentos
   where id = p_agendamento_id
   for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_a.origem <> 'site' then
    raise exception 'Somente reserva do site usa vínculo posterior.' using errcode = '22023';
  end if;
  if not private.bc_schedule_can_manage(v_a.colaboradora_user_id) then
    raise exception 'Acesso negado ao vínculo.' using errcode = '42501';
  end if;
  if not exists(select 1 from public.clientes c where c.id = p_cliente_id and c.ativo = true) then
    raise exception 'Cliente ativa não encontrada.' using errcode = 'P0002';
  end if;

  update public.agendamentos
     set cliente_id = p_cliente_id,
         updated_at = now()
   where id = p_agendamento_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
  values(v_user, 'public_booking_linked', 'agendamentos', p_agendamento_id, jsonb_build_object('cliente_id', p_cliente_id));

  return p_agendamento_id;
end;
$$;

-- Status administrativos podem ser geridos pela chefe; marcar atendimento
-- clínico de outra profissional continua proibido.
create or replace function private.bc_set_agendamento_status_impl(
  p_agendamento_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_agendamento public.agendamentos%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('agendado', 'atendido', 'cancelado', 'faltou') then
    raise exception 'Status de agendamento inválido.' using errcode = '22023';
  end if;

  select * into v_agendamento
    from public.agendamentos
   where id = p_agendamento_id
   for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if not private.bc_schedule_can_manage(v_agendamento.colaboradora_user_id) then
    raise exception 'Acesso negado ao agendamento.' using errcode = '42501';
  end if;
  if p_status = 'atendido'
     and not private.is_bc_admin()
     and v_agendamento.colaboradora_user_id <> v_user_id then
    raise exception 'Atendimento clínico deve ser concluído pela profissional responsável.' using errcode = '42501';
  end if;

  update public.agendamentos
     set status = p_status
   where id = p_agendamento_id;

  return p_agendamento_id;
end;
$$;

-- Reafirma privilégios: nenhum poder de Admin/financeiro é concedido.
revoke all on function private.bc_can_manage_all_agendas() from public;
revoke execute on function private.bc_can_manage_all_agendas() from anon;
grant execute on function private.bc_can_manage_all_agendas() to authenticated;
