create index if not exists clinical_treatment_alert_reviews_reviewed_by_idx
  on public.clinical_treatment_alert_reviews (reviewed_by);

create index if not exists clinical_treatment_components_component_version_id_idx
  on public.clinical_treatment_components (component_version_id);

create index if not exists clinical_treatment_health_confirmations_confirmed_by_idx
  on public.clinical_treatment_health_confirmations (confirmed_by);

create index if not exists clinical_treatment_reopen_grants_author_user_id_idx
  on public.clinical_treatment_reopen_grants (author_user_id);

create index if not exists clinical_treatment_reopen_grants_granted_by_idx
  on public.clinical_treatment_reopen_grants (granted_by);

create index if not exists clinical_treatment_versions_created_by_idx
  on public.clinical_treatment_versions (created_by);

create index if not exists clinical_treatment_versions_document_id_idx
  on public.clinical_treatment_versions (document_id);

create index if not exists clinical_treatment_versions_prior_version_id_idx
  on public.clinical_treatment_versions (prior_version_id);

create index if not exists clinical_treatments_anamnese_id_idx
  on public.clinical_treatments (anamnese_id);

create index if not exists clinical_treatments_consent_document_id_idx
  on public.clinical_treatments (consent_document_id);

create index if not exists clinical_treatments_created_by_idx
  on public.clinical_treatments (created_by);

create index if not exists clinical_treatments_current_version_id_idx
  on public.clinical_treatments (current_version_id);

create index if not exists clinical_treatments_pending_document_id_idx
  on public.clinical_treatments (pending_document_id);

create index if not exists clinical_treatments_pending_version_id_idx
  on public.clinical_treatments (pending_version_id);

create index if not exists clinical_treatments_procedimento_id_idx
  on public.clinical_treatments (procedimento_id);
