-- BC Gestão: explicit table privileges for fresh projects, branches and resets.
-- No patient/staff/financial rows or RLS policies are modified.
-- Additive: existing browser ACLs and RPC-only boundaries are preserved.
-- BYPASSRLS on service_role does not supply table privileges.

begin;

grant usage on schema public to anon, authenticated, service_role;

-- Named allowlist; never grant browser roles access to every public table.
-- The eight tables already granted explicitly are included for a complete,
-- reviewable server-access contract. Only DML is needed by the Data API.
grant select, insert, update, delete on table
  public.staff_profiles,
  public.clientes,
  public.procedimentos,
  public.agendamentos,
  public.atendimentos,
  public.pagamentos,
  public.audit_log,
  public.recebimentos,
  public.comissao_profissional_procedimento,
  public.livros_financeiros,
  public.livro_financeiro_itens,
  public.config_repasses,
  public.repasses,
  public.repasse_livros,
  public.cliente_identificacao_fotos,
  public.anamnese_template_versions,
  public.anamneses_gerais,
  public.anamnese_respostas,
  public.anamnese_confirmacoes_clinicas,
  public.clinical_alerts,
  public.clinical_documents,
  public.clinical_signatures,
  public.anamnese_remote_links,
  public.procedure_versions,
  public.procedure_version_components,
  public.procedure_aliases,
  public.procedure_professional_permissions,
  public.consent_template_versions,
  public.procedure_consents,
  public.clinical_treatments,
  public.clinical_treatment_components,
  public.clinical_treatment_health_confirmations,
  public.clinical_treatment_alert_reviews,
  public.clinical_treatment_versions,
  public.clinical_treatment_reopen_grants,
  public.clinical_treatment_photos,
  public.clinical_products,
  public.clinical_product_lots,
  public.clinical_treatment_product_usages,
  public.clinical_equipment,
  public.clinical_treatment_equipment_usages,
  public.clinical_intercurrences,
  public.clinical_intercurrence_updates,
  public.clinical_treatment_intercurrence_confirmations,
  public.client_files,
  public.quick_visit_requests,
  public.clinical_treatment_reports,
  public.treatment_external_consents,
  public.professional_availability_days,
  public.professional_schedule_blocks,
  public.professional_agenda_inactivations,
  public.bc_pre_anamneses
to service_role;

-- The first four legacy migrations are part of a complete local replay,
-- but these two tables are absent from the active bc-estetica-gestao project.
-- Restore their historical read permissions only where they actually exist.
-- The existing UPDATE(status) column grant is deliberately left untouched.
do $grants$
begin
  if to_regclass('public.admin_users') is not null then
    grant select on table public.admin_users to authenticated;
    grant select, insert, update, delete on table public.admin_users to service_role;
  end if;
  if to_regclass('public.pre_anamneses') is not null then
    grant select on table public.pre_anamneses to authenticated;
    grant select, insert, update, delete on table public.pre_anamneses to service_role;
  end if;
end
$grants$;

-- There are no public serial/identity sequences in the audited active schema.
-- private.public_booking_rate_limits_id_seq is used by a postgres-owned
-- SECURITY DEFINER implementation and must not gain browser permissions.
-- New tables must declare their own table/sequence grants at creation time.

commit;
