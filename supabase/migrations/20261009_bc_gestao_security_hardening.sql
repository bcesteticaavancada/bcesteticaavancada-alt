-- BC Gestão 1.0 — security hardening after Supabase database linter review.
-- Keeps data intact: no table/row deletion.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

alter function public.bc_set_updated_at() set search_path = pg_catalog, public;
revoke execute on function public.bc_set_updated_at() from anon, authenticated;
revoke execute on function public.bc_set_updated_at() from public;

create or replace function private.is_bc_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.active = true
      and sp.role = 'admin'
  );
$$;

create or replace function private.is_bc_active_colaborador()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.active = true
      and sp.role = 'colaborador'
  );
$$;

revoke all on function private.is_bc_admin() from public;
revoke all on function private.is_bc_active_colaborador() from public;
revoke execute on function private.is_bc_admin() from anon;
revoke execute on function private.is_bc_active_colaborador() from anon;
grant execute on function private.is_bc_admin() to authenticated;
grant execute on function private.is_bc_active_colaborador() to authenticated;

-- Supabase grants EXECUTE explicitly to API roles on functions in exposed schemas.
-- The legacy public helpers stay in place for forward-safe rollback, but no app role can call them.
revoke execute on function public.is_bc_admin() from anon, authenticated;
revoke execute on function public.is_bc_active_colaborador() from anon, authenticated;
revoke execute on function public.is_bc_admin() from public;
revoke execute on function public.is_bc_active_colaborador() from public;

alter policy "staff_profiles_admin_all"
on public.staff_profiles
using (private.is_bc_admin())
with check (private.is_bc_admin());

alter policy "procedimentos_admin_all"
on public.procedimentos
using (private.is_bc_admin())
with check (private.is_bc_admin());

alter policy "agendamentos_admin_all"
on public.agendamentos
using (private.is_bc_admin())
with check (private.is_bc_admin());

alter policy "agendamentos_colaborador_select"
on public.agendamentos
using (
  private.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
);

alter policy "clientes_admin_all"
on public.clientes
using (private.is_bc_admin())
with check (private.is_bc_admin());

alter policy "clientes_colaborador_select_por_vinculo"
on public.clientes
using (
  private.is_bc_active_colaborador()
  and exists (
    select 1
    from public.agendamentos a
    where a.cliente_id = clientes.id
      and a.colaboradora_user_id = auth.uid()
  )
);

alter policy "atendimentos_admin_all"
on public.atendimentos
using (private.is_bc_admin())
with check (private.is_bc_admin());

alter policy "atendimentos_colaborador_select_historico_por_vinculo"
on public.atendimentos
using (
  private.is_bc_active_colaborador()
  and exists (
    select 1
    from public.agendamentos a
    where a.cliente_id = atendimentos.cliente_id
      and a.colaboradora_user_id = auth.uid()
  )
);

alter policy "atendimentos_colaborador_insert_proprio"
on public.atendimentos
with check (
  private.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
  and created_by = auth.uid()
  and exists (
    select 1
    from public.agendamentos a
    where a.id = atendimentos.agendamento_id
      and a.colaboradora_user_id = auth.uid()
      and a.cliente_id = atendimentos.cliente_id
      and a.procedimento_id = atendimentos.procedimento_id
  )
);

alter policy "atendimentos_colaborador_update_proprio"
on public.atendimentos
using (
  private.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
)
with check (
  private.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
  and created_by = auth.uid()
  and exists (
    select 1
    from public.agendamentos a
    where a.id = atendimentos.agendamento_id
      and a.colaboradora_user_id = auth.uid()
      and a.cliente_id = atendimentos.cliente_id
      and a.procedimento_id = atendimentos.procedimento_id
  )
);

alter policy "pagamentos_admin_all"
on public.pagamentos
using (private.is_bc_admin())
with check (private.is_bc_admin());
