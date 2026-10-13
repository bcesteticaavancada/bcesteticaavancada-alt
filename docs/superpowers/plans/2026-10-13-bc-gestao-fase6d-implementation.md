# BC Gestão — Fase 6D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a Fase 6D do BC Gestão com fotos clínicas privadas, produtos/lotes, equipamentos/parâmetros e intercorrências/evoluções integrados ao atendimento formal da 6C.

**Architecture:** `clinical_treatments` continua sendo a raiz da sessão. Cada subsistema 6D possui tabelas e RPCs próprios, enquanto `private.bc_treatment_gate` e `private.bc_treatment_finalize_impl` agregam exigências e snapshots de forma centralizada. O frontend permanece mobile-first e modular: APIs por domínio e cards recolhíveis integrados à ficha existente, sem criar prontuário paralelo.

**Tech Stack:** PostgreSQL/Supabase migrations + RLS/RPC, Supabase Storage privado, JavaScript ES modules, HTML/CSS mobile-first, Deno + `pdf-lib`, Node 22 `node:test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-13-bc-gestao-fase6d-design.md`

## Global Constraints

- Projeto Supabase correto: `tpqsmerlxquyrzrjbogj`; não tocar no projeto legado de pré-anamnese.
- `clinical_treatments` permanece a única raiz do atendimento clínico formal.
- Bucket clínico continua privado: `bc-prontuario-private`; nunca usar `getPublicUrl`.
- Fotos clínicas aceitam somente JPEG, PNG e WebP, com limite vigente de 8 MiB por arquivo.
- Foto clínica nunca implica autorização de marketing/portfólio.
- Registros finalizados são imutáveis; correções usam versionamento da 6C ou evolução append-only quando aplicável.
- Catálogos usados em prontuário são desativados, não apagados.
- `requires_photo`, `requires_product_lot` e `requires_equipment` da `procedure_version` são a fonte de verdade dos novos gates.
- Intercorrência aberta não encerra automaticamente e não recebe sugestão clínica automática.
- Testes e validação nunca criam ou alteram pacientes reais.
- 6D não implementa estoque, compras, manutenção de equipamentos, financeiro, pacotes ou publicação de fotos.

## Review Focus

- Upload de foto com `cliente_id`/`treatment_id` incompatíveis ou caminho fora de `fotos-clinicas/...` deve ser rejeitado no backend/Storage.
- Produto/lote incompleto em procedimento que exige lote nunca pode satisfazer o gate de finalização.
- Parâmetros de equipamento com tipo inválido, campo obrigatório ausente ou chave não prevista no schema devem ser rejeitados.
- Atendimento finalizado deve rejeitar mutações 6D, exceto nova evolução append-only de intercorrência existente.
- Confirmação de intercorrências abertas deve ficar inválida se o conjunto de intercorrências pendentes mudar antes da finalização.

---

### Task 1: Fotos clínicas privadas — backend, Storage e API

**Files:**
- Create: `supabase/migrations/20261013170000_bc_gestao_phase6d_photos.sql`
- Create: `gestao/js/treatment-photos-api.js`
- Create: `tests/gestao/phase6d-photos-contract.test.mjs`
- Create: `tests/gestao/treatment-photos-api.test.mjs`

**Interfaces:**
- Consumes: `clinical_treatments`, `clientes`, `staff_profiles`, `private.is_bc_active_staff()`, bucket `bc-prontuario-private`.
- Produces RPCs: `bc_treatment_photo_list(uuid)`, `bc_treatment_photo_register(uuid,text,text,bigint,text,text,text,text,timestamptz)`, `bc_treatment_photo_void(uuid,text)`.
- Produces JS: `listTreatmentPhotos({client,treatmentId})`, `uploadTreatmentPhoto({client,treatmentId,clienteId,kind,region,view,caption,capturedAt,file})`, `voidTreatmentPhoto({client,photoId,reason})`, `getTreatmentPhotoUrl({client,storagePath,expiresIn=300})`.

- [ ] **Step 1: Write the failing DB contract test**

In `phase6d-photos-contract.test.mjs`, assert the migration defines `clinical_treatment_photos`, `kind in ('antes','depois','adicional')`, logical void fields, RLS, no authenticated UPDATE/DELETE on Storage, the `fotos-clinicas/{cliente_id}/{treatment_id}/...` path rule, MIME/8 MiB checks, and all three RPCs.

- [ ] **Step 2: Run the DB contract test and verify RED**

Run: `node --test tests/gestao/phase6d-photos-contract.test.mjs`
Expected: FAIL because the migration/table/RPCs do not exist.

- [ ] **Step 3: Implement the photo migration**

Create `clinical_treatment_photos` exactly as defined by the spec. Storage INSERT policy must require active staff, editable treatment owned by the current professional, matching `cliente_id`, allowed extension and the expected path prefix. `bc_treatment_photo_register` must verify metadata against the treatment and `bc_treatment_photo_void` must be logical-only with non-empty reason and audit log.

- [ ] **Step 4: Re-run the DB contract test**

Run: `node --test tests/gestao/phase6d-photos-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the failing frontend API tests**

Assert `uploadTreatmentPhoto` rejects missing file/invalid kind/oversized file before upload, uploads to `fotos-clinicas/<cliente>/<treatment>/<uuid>.<ext>`, registers metadata through RPC, and `getTreatmentPhotoUrl` uses `createSignedUrl` only.

- [ ] **Step 6: Run API tests and verify RED**

Run: `node --test tests/gestao/treatment-photos-api.test.mjs`
Expected: FAIL because `treatment-photos-api.js` does not exist.

- [ ] **Step 7: Implement `treatment-photos-api.js`**

Keep file validation and Storage path creation client-side, but make the RPC authoritative for ownership/treatment state. Do not add delete-object behavior.

- [ ] **Step 8: Verify photo tests**

Run: `node --test tests/gestao/phase6d-photos-contract.test.mjs tests/gestao/treatment-photos-api.test.mjs`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261013170000_bc_gestao_phase6d_photos.sql gestao/js/treatment-photos-api.js tests/gestao/phase6d-photos-contract.test.mjs tests/gestao/treatment-photos-api.test.mjs
git commit -m "feat: add private clinical treatment photos"
```

### Task 2: Produtos, lotes e uso por sessão

**Files:**
- Create: `supabase/migrations/20261013171000_bc_gestao_phase6d_products.sql`
- Create: `gestao/js/treatment-products-api.js`
- Create: `tests/gestao/phase6d-products-contract.test.mjs`
- Create: `tests/gestao/treatment-products-api.test.mjs`

**Interfaces:**
- Consumes: `private.bc_can_manage_procedures()` for catalog management; editable `clinical_treatments` for usage mutation.
- Produces RPCs: `bc_clinical_product_list(boolean)`, `bc_clinical_product_upsert(uuid,jsonb)`, `bc_clinical_product_lot_list(uuid,boolean)`, `bc_clinical_product_lot_upsert(uuid,jsonb)`, `bc_treatment_product_usage_list(uuid)`, `bc_treatment_product_usage_add(uuid,uuid,uuid,numeric,text)`, `bc_treatment_product_usage_remove(uuid)`.
- Produces JS: `listClinicalProducts`, `saveClinicalProduct`, `listProductLots`, `saveProductLot`, `listTreatmentProductUsages`, `addTreatmentProductUsage`, `removeTreatmentProductUsage`.

- [ ] **Step 1: Write failing contract tests**

Assert tables `clinical_products`, `clinical_product_lots`, `clinical_treatment_product_usages`, unique product+lot, no destructive delete path for used catalogs, snapshot columns, positive quantity and RPC permission checks.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/gestao/phase6d-products-contract.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement product/lot migration**

`bc_treatment_product_usage_add` must build snapshots from server-side catalog values; it must reject a `lot_id` belonging to another product. `bc_treatment_product_usage_remove` is allowed only while the treatment is editable by its responsible professional.

- [ ] **Step 4: Verify DB GREEN**

Run: `node --test tests/gestao/phase6d-products-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write frontend API tests**

Assert the JS layer sends IDs/quantity/unit only for usage creation and never sends snapshot text supplied by the browser.

- [ ] **Step 6: Verify RED, implement `treatment-products-api.js`, then verify GREEN**

Run before implementation: `node --test tests/gestao/treatment-products-api.test.mjs`
Expected: FAIL.

Run after implementation: `node --test tests/gestao/treatment-products-api.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261013171000_bc_gestao_phase6d_products.sql gestao/js/treatment-products-api.js tests/gestao/phase6d-products-contract.test.mjs tests/gestao/treatment-products-api.test.mjs
git commit -m "feat: add clinical products and lot traceability"
```

### Task 3: Equipamentos e parâmetros por aparelho

**Files:**
- Create: `supabase/migrations/20261013172000_bc_gestao_phase6d_equipment.sql`
- Create: `gestao/js/treatment-equipment-api.js`
- Create: `tests/gestao/phase6d-equipment-contract.test.mjs`
- Create: `tests/gestao/treatment-equipment-api.test.mjs`

**Interfaces:**
- Produces RPCs: `bc_clinical_equipment_list(boolean)`, `bc_clinical_equipment_upsert(uuid,jsonb)`, `bc_treatment_equipment_usage_list(uuid)`, `bc_treatment_equipment_usage_add(uuid,uuid,jsonb)`, `bc_treatment_equipment_usage_remove(uuid)`.
- Produces private validator: `private.bc_validate_equipment_parameters(jsonb,jsonb) returns boolean`.
- Produces JS: `listClinicalEquipment`, `saveClinicalEquipment`, `listTreatmentEquipmentUsages`, `addTreatmentEquipmentUsage`, `removeTreatmentEquipmentUsage`.

- [ ] **Step 1: Write failing DB tests**

Pin supported schema field types to `number|text|select|boolean`; assert unknown keys, missing required values, invalid select options and wrong primitive types are rejected by the backend validator.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/gestao/phase6d-equipment-contract.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement equipment migration and validator**

Store `parameter_schema_snapshot` and `parameter_values` on each usage. Validation happens server-side using the current equipment schema before snapshotting it.

- [ ] **Step 4: Verify DB GREEN**

Run: `node --test tests/gestao/phase6d-equipment-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write/implement frontend API tests**

Run before implementation: `node --test tests/gestao/treatment-equipment-api.test.mjs`
Expected: FAIL.

Implement `treatment-equipment-api.js`, then run the same command.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261013172000_bc_gestao_phase6d_equipment.sql gestao/js/treatment-equipment-api.js tests/gestao/phase6d-equipment-contract.test.mjs tests/gestao/treatment-equipment-api.test.mjs
git commit -m "feat: add clinical equipment parameter tracking"
```

### Task 4: Intercorrências estruturadas e evoluções append-only

**Files:**
- Create: `supabase/migrations/20261013173000_bc_gestao_phase6d_intercurrences.sql`
- Create: `gestao/js/treatment-intercurrences-api.js`
- Create: `tests/gestao/phase6d-intercurrences-contract.test.mjs`
- Create: `tests/gestao/treatment-intercurrences-api.test.mjs`

**Interfaces:**
- Produces RPCs: `bc_treatment_intercurrence_list(uuid)`, `bc_treatment_intercurrence_create(uuid,text,text,text,text,timestamptz)`, `bc_treatment_intercurrence_update_draft(uuid,jsonb)`, `bc_intercurrence_add_update(uuid,text,text)`, `bc_treatment_confirm_open_intercurrences(uuid)`.
- Produces JS: `listTreatmentIntercurrences`, `createTreatmentIntercurrence`, `updateTreatmentIntercurrenceDraft`, `addIntercurrenceEvolution`, `confirmOpenIntercurrencesForFinalization`.

- [ ] **Step 1: Write failing DB tests**

Assert valid moment/severity/status values, original record editability only before treatment finalization, append-only `clinical_intercurrence_updates`, active-clinical-staff permission for later evolution, and audit events for creation/update/evolution/confirmation.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/gestao/phase6d-intercurrences-contract.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement intercurrence migration**

`bc_intercurrence_add_update` must insert the evolution and synchronize the current status atomically. `bc_treatment_confirm_open_intercurrences` must persist a snapshot/hash-equivalent ordered set of open intercurrence IDs so the confirmation becomes stale if the set changes.

- [ ] **Step 4: Verify DB GREEN**

Run: `node --test tests/gestao/phase6d-intercurrences-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write/implement frontend API tests**

Run before implementation: `node --test tests/gestao/treatment-intercurrences-api.test.mjs`
Expected: FAIL.

Implement `treatment-intercurrences-api.js`, then re-run.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261013173000_bc_gestao_phase6d_intercurrences.sql gestao/js/treatment-intercurrences-api.js tests/gestao/phase6d-intercurrences-contract.test.mjs tests/gestao/treatment-intercurrences-api.test.mjs
git commit -m "feat: add structured clinical intercurrences"
```

### Task 5: Gates 6D, snapshot imutável e finalização

**Files:**
- Create: `supabase/migrations/20261013174000_bc_gestao_phase6d_treatment_integration.sql`
- Create: `tests/gestao/phase6d-treatment-integration.test.mjs`
- Modify: `gestao/js/treatment-api.js`
- Modify: `tests/gestao/treatment-api.test.mjs`

**Interfaces:**
- Consumes tables/RPCs from Tasks 1–4.
- Replaces/extends: `private.bc_treatment_gate(uuid)` and `private.bc_treatment_finalize_impl(uuid)` while preserving all 6C behavior.
- Produces gate reasons: `fotos_pendentes`, `produto_lote_pendente`, `equipamento_pendente`, `intercorrencia_aberta_nao_confirmada`.
- `bc_treatment_get` continues returning `gate_reasons`; add compact `phase6d_summary` counts/status for the UI.

- [ ] **Step 1: Write failing integration tests**

Assert each flag drives only its own gate, valid `antes+depois` clears photo gate, complete product/lot usage clears lot gate, valid equipment usage clears equipment gate, and open intercurrence requires a non-stale confirmation.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/gestao/phase6d-treatment-integration.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement gate extension**

Preserve every existing 6C reason and append 6D reasons deterministically. Voided photos never count. Product/equipment usage must belong to the same treatment.

- [ ] **Step 4: Extend finalization snapshot**

`private.bc_treatment_finalize_impl` must snapshot arrays under stable keys: `photos`, `product_usages`, `equipment_usages`, `intercurrences`. Include metadata/snapshots only; never inline photo bytes or signed URLs.

- [ ] **Step 5: Pin finalization immutability**

Tests must prove post-finalization calls to photo void/register, product usage add/remove, equipment usage add/remove and original intercurrence mutation fail; `bc_intercurrence_add_update` remains allowed for active clinical staff.

- [ ] **Step 6: Extend `treatment-api.js` minimally**

Add only `confirmTreatmentOpenIntercurrences({client,treatmentId})` if the UI needs a treatment-level convenience wrapper; do not duplicate domain APIs from Tasks 1–4.

- [ ] **Step 7: Verify integration GREEN**

Run: `node --test tests/gestao/phase6d-treatment-integration.test.mjs tests/gestao/treatment-api.test.mjs`
Expected: PASS.

- [ ] **Step 8: Run all existing 6C treatment tests**

Run: `node --test tests/gestao/*treatment*.test.mjs`
Expected: PASS with no 6C regressions.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20261013174000_bc_gestao_phase6d_treatment_integration.sql gestao/js/treatment-api.js tests/gestao/phase6d-treatment-integration.test.mjs tests/gestao/treatment-api.test.mjs
git commit -m "feat: integrate phase6d treatment gates and snapshots"
```

### Task 6: Mobile-first UI dos quatro cards 6D

**Files:**
- Create: `gestao/js/treatment-6d-panel.js`
- Modify: `gestao/js/treatment-panel.js`
- Modify: `gestao/assets/treatment.css`
- Create: `tests/gestao/treatment-6d-panel.test.mjs`
- Modify: `tests/gestao/treatment-panel.test.mjs`

**Interfaces:**
- Consumes all four domain API modules from Tasks 1–4.
- Produces: `renderTreatment6dCards({treatment,photos,products,lots,productUsages,equipment,equipmentUsages,intercurrences})` and `initTreatment6dController({client,root,getTreatment,getClientRecord,refreshTreatment})`.
- `treatment-panel.js` remains owner of the overall wizard and mounts the 6D cards inside the clinical step.

- [ ] **Step 1: Write failing renderer tests**

Assert the four headings `Fotos clínicas`, `Produtos e lotes`, `Equipamentos`, `Intercorrências`; required chips are driven by the procedure-version flags; finalized sessions render read-only controls; photo previews use signed URLs and never public URLs.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/gestao/treatment-6d-panel.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement renderers and controller**

Use `<details>`/collapsible sections or equivalent accessible controls. Keep touch targets mobile-friendly, show counts/status in collapsed headers, and defer loading signed photo URLs until the photo card is opened.

- [ ] **Step 4: Integrate into `treatment-panel.js`**

Add the four new gate labels to `GATE_LABELS`. Mount one 6D region inside the existing clinical wizard without moving the 6C health/alerts/consent/finalization stages.

- [ ] **Step 5: Add interaction tests**

Cover add/void photo, add/remove product usage, parameter form generation from schema, create/evolve intercurrence and explicit confirmation of open intercurrences.

- [ ] **Step 6: Verify UI GREEN**

Run: `node --test tests/gestao/treatment-6d-panel.test.mjs tests/gestao/treatment-panel.test.mjs`
Expected: PASS.

- [ ] **Step 7: Run full Gestão frontend suite**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add gestao/js/treatment-6d-panel.js gestao/js/treatment-panel.js gestao/assets/treatment.css tests/gestao/treatment-6d-panel.test.mjs tests/gestao/treatment-panel.test.mjs
git commit -m "feat: add mobile phase6d treatment cards"
```

### Task 7: PDF da ficha — referências 6D sem embutir fotos

**Files:**
- Modify: `supabase/functions/generate-clinical-pdf/pdf.ts`
- Modify: `supabase/functions/generate-clinical-pdf/pdf_test.ts`

**Interfaces:**
- Consumes 6D arrays already frozen inside `clinical_treatment_versions.snapshot`.
- Produces PDF textual com seções de produtos/lotes, equipamentos/parâmetros, intercorrências e resumo das fotos, sem bytes/URLs das imagens.

- [ ] **Step 1: Write failing PDF regression tests**

Build a synthetic `treatmentVersion.snapshot` containing all four 6D arrays. Assert the generated text model/fixtures include lot code, equipment name/parameter values, intercurrence status and photo classifications/count, while the snapshot contains no signed URL requirement.

- [ ] **Step 2: Verify RED**

Run: `deno test --config supabase/functions/generate-clinical-pdf/deno.json supabase/functions/generate-clinical-pdf/pdf_test.ts`
Expected: FAIL on missing 6D sections.

- [ ] **Step 3: Extend `buildClinicalPdf`**

Add sections after the existing treatment technical data and before signatures. Photos render metadata/counts only; no image download or embedding is introduced.

- [ ] **Step 4: Verify PDF GREEN**

Run: `deno test --config supabase/functions/generate-clinical-pdf/deno.json supabase/functions/generate-clinical-pdf/pdf_test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generate-clinical-pdf/pdf.ts supabase/functions/generate-clinical-pdf/pdf_test.ts
git commit -m "feat: include phase6d records in treatment pdf"
```

### Task 8: Security regression, full verification and production rollout

**Files:**
- Create: `tests/gestao/phase6d-security-regression.test.mjs`
- Modify if needed: `.github/workflows/site-ci.yml` only if new test locations are not already covered.
- Update: `docs/superpowers/ledgers/2026-10-13-bc-gestao-fase6d-progress.md`

**Interfaces:**
- Consumes the complete 6D implementation.
- Produces deployment evidence only; no new product behavior unless a regression is found.

- [ ] **Step 1: Write security regression tests**

Assert no 6D module calls `getPublicUrl`; authenticated users do not receive direct table mutation grants for clinical records; catalog writes remain permission-gated; service-role keys are absent from browser code; Storage paths are private and scoped.

- [ ] **Step 2: Run full local/CI-equivalent verification**

Run:
```bash
npm run test
deno test --config supabase/functions/generate-anamnese-pdf/deno.json supabase/functions/generate-anamnese-pdf/pdf_test.ts
deno test --config supabase/functions/generate-clinical-pdf/deno.json supabase/functions/generate-clinical-pdf/pdf_test.ts
```
Expected: all commands exit 0.

- [ ] **Step 3: Review migration ordering and idempotency**

Confirm the five new migrations sort after the current 6C migrations, use `if exists/if not exists` where rerun-safety is appropriate, and do not alter legacy `/admin/` objects.

- [ ] **Step 4: Apply migrations to production Supabase**

Target only project `tpqsmerlxquyrzrjbogj`. Apply in timestamp order and verify tables, policies, functions and bucket MIME/size configuration with read-only queries. Do not create real patient/test clinical records in production.

- [ ] **Step 5: Deploy `generate-clinical-pdf` only if function files changed**

Keep JWT verification enabled. Verify the deployed version is ACTIVE and its code hash/version changed as expected.

- [ ] **Step 6: Validate GitHub CI**

Require `Site CI` and `Pre-anamnese CI` to complete successfully on the implementation PR. Inspect failing job logs rather than retrying blindly.

- [ ] **Step 7: Production smoke checks without real-patient mutation**

Verify read-only that 6D RPCs exist, RLS is enabled, Storage remains private, the 6D gate function definition is installed, and the Edge Function is ACTIVE. Browser smoke-check the cards against development/synthetic fixtures only.

- [ ] **Step 8: Update progress ledger**

Record migration versions, CI run IDs, Edge Function version, remaining warnings and explicit 6E deferrals.

- [ ] **Step 9: Commit**

```bash
git add tests/gestao/phase6d-security-regression.test.mjs docs/superpowers/ledgers/2026-10-13-bc-gestao-fase6d-progress.md .github/workflows/site-ci.yml
git commit -m "test: verify phase6d security and rollout"
```

## Plan Self-Review Results

- **Spec coverage:** photos, product/lot, equipment, intercurrences, gates, snapshots, permissions, mobile UX, PDF references, Storage privacy and auditability all map to Tasks 1–8.
- **Scope:** kept as one implementation plan because all four domains share the same `clinical_treatments` lifecycle, finalization gate and immutable snapshot; splitting them into independent shipping plans would duplicate/rewrite the same core integration functions.
- **Type/interface consistency:** frontend function names mirror RPC domain names and Tasks 5–7 consume only interfaces created in Tasks 1–4.
- **Review Focus coverage:** path mismatch → Task 1; incomplete lot → Tasks 2/5; invalid parameter schema/value → Task 3; finalized mutation → Task 5; stale open-intercurrence confirmation → Tasks 4/5.
- **YAGNI:** no stock ledger, supplier/cost, equipment maintenance, marketing-photo consent, finance/package logic or image embedding in PDFs.
