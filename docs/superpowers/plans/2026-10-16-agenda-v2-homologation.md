# Agenda V2 — closure ledger
Source: uploaded handoff BC_ESTETICA_WORK_HANDOFF_AGENDA_V2_2026-10-15.txt
Baseline: cf192ff23d9b868d4585d02224b20f5088f1a325, clean clone on feature/public-agenda-native.
Authorized execution: Native, finish free homologation, no production/main/paid resources.
Baseline npm test: frontend/site pass; gestão 520/523, two host-timezone-dependent age fixtures and one fragile optional-chaining regex.
Baseline database CI: migration replay passed; 15/16 tests, expected denial message differs.
Plan:
1. Repair brittle tests; introduce RED behavior tests for origin filters/channel and comprehensive database/concurrency tests.
2. Add one additive migration: separate booking_channel, scoped list RPC, canonical public booking/link, concurrency protection and guard against privilege expansion. Keep all historical migrations intact.
3. Wire Geral/Site/Interna in admin/chief/ordinary screens, pending public booking operations and manual linking. Use canonical API.
4. Prove clean replay, role isolation, rate limit, cross-channel conflicts and simultaneous reservations in free ephemeral CI; run full Node/Deno suite; review.
5. Commit verification report on feature only, leave production rollout separate.
Decisions: existing approved spec/plan and latest user request authorize continued execution without reapproval. Clone is an isolated workspace; no user's existing checkout was modified. Git HTTPS push unavailable; use connected GitHub Git data API with expected SHA lease.
