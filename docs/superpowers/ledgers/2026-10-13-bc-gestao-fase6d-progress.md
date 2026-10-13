# SDD ledger — plan: docs/superpowers/plans/2026-10-13-bc-gestao-fase6d-implementation.md

Execution mode: Native / inline.
Branch workspace: `phase6d/implementation` from `7efb6a1e75ba65976f3cff81b00abf57b201844d`.
Spec authority: `docs/superpowers/specs/2026-10-13-bc-gestao-fase6d-design.md`.

Setup Ruling: this harness has GitHub connector isolation but no local repository/worktree checkout; use the dedicated GitHub branch as the isolated workspace and GitHub Actions for full-suite verification. Cost if wrong: less convenient local recovery, but no production/shared-branch mutation occurs before explicit merge.
Baseline: code tree derives from the previously green hotfix head `930c2bff3826741072de3c5aca177387f672bccc`; Site CI run 488 completed successfully, and the only commits between that code tree and this branch before implementation are merge/docs commits.

Pre-flight Task 1→5: photos tables/RPC/API are consumed by central gates/snapshot; interface names match plan.
Pre-flight Task 2→5: product/lot usage tables are consumed by central gates/snapshot; interface names match plan.
Pre-flight Task 3→5: equipment usage/schema are consumed by central gates/snapshot; interface names match plan.
Pre-flight Task 4→5: intercurrence state/confirmation are consumed by central gates/snapshot; interface names match plan.
Pre-flight Tasks 1–4→6: four domain APIs are consumed by the mobile 6D controller; interface names match plan.
Pre-flight Task 5→6: gate reasons and `phase6d_summary` are consumed by UI; interface names match plan.
Pre-flight Task 5→7: frozen 6D snapshot arrays are consumed by PDF renderer; stable keys are `photos`, `product_usages`, `equipment_usages`, `intercurrences`.
Pre-flight Tasks 1–7→8: security and rollout tests consume the complete implementation; no conflict found.

Task 1 RED: `phase6d-photos-contract.test.mjs` failed because the photo migration did not exist; Site CI #490 failed specifically in BC Gestão tests while prior suites remained green.
Task 1 GREEN: migration + `treatment-photos-api.js` satisfy private Storage pathing, MIME/8 MiB limits, logical voiding, RPC-only metadata mutation, signed URLs and no public URL/delete path.
Task 1: complete (commits `14e0ab1..980f6fa`; targeted tests 7/7 PASS; Site CI #493 run `38436254381` → success).
