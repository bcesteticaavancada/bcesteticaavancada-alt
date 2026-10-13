-- BC Gestão Fase 6C — corrige EXECUTE das implementações privadas chamadas por wrappers SECURITY INVOKER.
revoke execute on function private.bc_treatment_prepare_consent_impl(uuid,uuid,uuid[],text[],text) from anon;
revoke execute on function private.bc_treatment_consent_finalize_impl(uuid) from anon;
grant execute on function private.bc_treatment_prepare_consent_impl(uuid,uuid,uuid[],text[],text) to authenticated;
grant execute on function private.bc_treatment_consent_finalize_impl(uuid) to authenticated;