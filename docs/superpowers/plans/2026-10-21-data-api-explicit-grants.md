# BC Data API Explicit Grants Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in this session. Steps use checkboxes for tracking.

**Goal:** Recreate BC access correctly when new public tables no longer inherit Data API grants.

**Architecture:** Add one forward migration with explicit, named table grants. Keep browser access and RLS unchanged; replay the complete migration history with no automatic grants in disposable CI and assert the resulting access boundaries.

**Tech Stack:** Supabase CLI 2.121.0, PostgreSQL, pgTAP, Python 3, Node.js tests.

**Spec:** User request of 21 October 2026, reproduced under Global Constraints.

## Global Constraints

- Review the active BC project, migrations and RLS for the 30 October 2026 cutoff.
- Prepare SQL and validate access without creating, changing or deleting real records.
- Do not apply the prepared migration to production in this task.
- Preserve the existing distinction between browser tables, RPC-only tables and server-only calls.
- Never restore automatic grants or grant every public table to anon/authenticated.
- Keep migration history and unrelated work intact. Do not merge or deploy.

## Review Focus

- service_role bypasses RLS but still requires object privileges.
- RPC-only financial and clinical tables must remain inaccessible directly to browsers.
- Local replay includes two legacy tables absent from the active project.
- The private identity sequence must not gain browser access.
- Fresh future tables must remain inaccessible without a migration declaring their access.

### Task 1: Explicit access and secure replay regression

**Files:**
- Create a CLI-named migration in `supabase/migrations/`.
- Create `supabase/tests/database/data_api_explicit_grants.test.sql`.
- Modify `supabase/config.toml` to disable automatic grants locally and pin PostgreSQL 17.
- Modify `.github/workflows/agenda-db-ci.yml` to require the secure local config before replay.
- Create operational documentation in `docs/bc-gestao/data-api-grants-2026-10-21.md`.

**Interfaces:**
- Consumes: 52 active public tables, 42 RLS policies, 69 applied migration entries and 73 repository migrations at main `7274d12` (counts to verify from catalog/history).
- Produces: explicit service DML on the named current tables; conditional legacy grants; unchanged browser table privileges; tests covering catalog ACLs and real role-scoped queries.

- [x] Read the current email, project catalog, migration history, application access sites and previous audit.
- [x] Replay the 73 original migrations without inherited public grants and record the missing access.
- [x] Write failing runtime assertions for service DML, legacy reads, existing RLS scopes and new-table default denial.
- [x] Run the assertions before the fix and retain the failing result (42501 on legacy admin_users, plus 44 active service-role gaps).
- [x] Generate the migration with Supabase CLI and add the least additional grants needed for replay.
- [x] Add secure-default setup and CI replay; assert all runtime boundaries.
- [x] Run the relevant SQL scenarios and full existing Node suite; report environment limitations (325 SQL assertions; 753 Node tests).
- [x] Review the entire diff and commit to an isolated branch. Delivery links and the report are prepared next.

## Execution decisions

- The selected task authorizes preparation and isolated validation; implementation continues without a separate plan approval.
- The checkout is an independent clone of the current published commit. Uncommitted creation-admin work in another checkout is excluded.
- Production is inspected through catalog-only reads. Fixtures and writes run only in memory or disposable CI.
- CLI 2.121.0's generated config documents `api.auto_expose_new_tables`; use this native setting instead of a migration-prepending script. It also covers developers' local resets without modifying historical SQL.

## Final review record

- Independent read-only review of `7274d12..0a54cb9`: no migration defect or browser access expansion found.
- Clarified the important documentation finding: the existing CI proves database behavior only. HTTP/Auth/Storage/PDF integration remains a separate staging check.
- Strengthened both sequence assertions for anon and authenticated. A deliberately injected anonymous sequence grant made both tests fail; removing the injected grants restored 29/29 new assertions and 325/325 total SQL assertions.
- Full Node suite after the review changes: 753/753 passing. No production mutation was performed.
- Native PostgreSQL 17 database CI and hosted preview/full-stack validation are not established by PGlite. Do not claim otherwise or merge/apply automatically.
