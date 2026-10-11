-- BC Gestão Fase 5 — follow-up do hardening de auditoria.
-- Remove privilégios legados herdados (inclusive SELECT/REFERENCES/TRIGGER)
-- e devolve somente leitura a authenticated, ainda protegida pela RLS admin-only.

revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;
