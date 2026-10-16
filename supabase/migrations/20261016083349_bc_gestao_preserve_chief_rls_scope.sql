-- The Advisor cleanup combined permissive SELECT policies but omitted the
-- team-agenda capability introduced in 20261015205157. Restore that exact
-- approved scope without adding policies, grants, or write capabilities.
-- Uncorrelated role/identity checks are evaluated once per statement.
alter policy "agendamentos_colaborador_select"
on public.agendamentos
using (
  (select private.is_bc_admin())
  or (
    (select private.is_bc_active_colaborador())
    and (
      colaboradora_user_id = (select auth.uid())
      or (select private.bc_can_manage_all_agendas())
    )
  )
);
