# SDD ledger — plan: docs/superpowers/plans/2026-10-12-bc-gestao-fase6c-implementation.md

Execution mode: Native / inline.
Workspace ruling: local git worktree unavailable because the sandbox cannot resolve github.com. Execution uses isolated GitHub branch `feature/fase6c-biblioteca-clinica`, GitHub Actions as the RED/GREEN runner, and Supabase migrations on the approved project. Cost if wrong: no local command runner; mitigation is every code change stays off `main`, every behavior change is gated by CI, and database changes are additive/idempotent.

Pre-flight: `procedimentos` identity is consumed by agenda/finance; 6C versions layer on top without replacing IDs. `clinical_documents`/signatures from 6B are consumed later by 6C documents. Legacy `atendimentos` remains untouched; 6C will create `clinical_treatments`.

Task 1: complete — procedure domain RED→GREEN; CI #349 green. Ruling: normalize NBSP from `Intl.NumberFormat` so the UI contract remains `R$ 180,00`.
Task 2: complete — versioned procedure database, capabilities, permissions, name snapshot and performance hardening. CI #359 green. Ruling: procedure name belongs to the immutable version snapshot; stable `procedimentos.nome` mirrors only current published version.
Task 3: complete — official 30-item catalog, safe preconfigured schemas, RPC-only procedure API and dynamic compound protocols. CI #369 green. Ruling: variable-route protocols use `specific_schema.component_options`; no fake component procedures are created. Ruling: legacy massage rows and synthetic homologation procedure are archived, never deleted; historical appointment remains intact.
