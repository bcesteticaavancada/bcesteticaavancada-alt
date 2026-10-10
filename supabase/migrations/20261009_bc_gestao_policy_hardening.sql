-- BC Gestão 1.0 — restrict procedure catalog to active BC staff profiles.
-- Forward-safe policy hardening. No data deletion.

drop policy if exists "procedimentos_authenticated_select" on public.procedimentos;

create policy "procedimentos_staff_select"
on public.procedimentos for select
to authenticated
using (
  private.is_bc_admin()
  or private.is_bc_active_colaborador()
);
