-- BC Gestão Fase 6C — hardening de performance da Biblioteca Clínica.

create index if not exists procedimentos_current_version_idx
  on public.procedimentos(current_version_id);
create index if not exists procedure_aliases_procedimento_idx
  on public.procedure_aliases(procedimento_id);
create index if not exists procedure_professional_permissions_granted_by_idx
  on public.procedure_professional_permissions(granted_by);
create index if not exists procedure_version_components_component_idx
  on public.procedure_version_components(component_version_id);
create index if not exists procedure_versions_created_by_idx
  on public.procedure_versions(created_by);
create index if not exists procedure_versions_published_by_idx
  on public.procedure_versions(published_by);

drop policy if exists procedure_permissions_scoped_read on public.procedure_professional_permissions;
create policy procedure_permissions_scoped_read
on public.procedure_professional_permissions
for select to authenticated
using (
  private.is_bc_admin()
  or (private.is_bc_active_staff() and professional_user_id = (select auth.uid()))
);
