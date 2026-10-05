# Pré-Anamnese PDF Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o PDF de pré-anamnese em A4 vertical com cards compactos em grade de 3 colunas, paginação segura, cabeçalho/rodapé premium e síntese determinística, preservando CPF, rubrica, consentimentos e integridade já existentes.

**Architecture:** Separar normalização/conteúdo do cálculo de layout, mantendo `pdf.ts` como orquestrador do `pdf-lib`. A grade usa spans 1/2/3 e um empacotador puro de linhas; a síntese usa somente dados declarados pelo paciente. Nenhum schema do Supabase muda.

**Tech Stack:** Deno, TypeScript strict, `pdf-lib@1.17.1`, testes Deno.

**Spec:** `docs/superpowers/specs/2026-10-05-bc-editorial-site-pre-anamnese-pdf-design.md`

## Global Constraints

- PDF continua A4 vertical e pode ter múltiplas páginas.
- Campos curtos usam `1/3`, médios `1/2` e longos/críticos `1/1`.
- Nunca gerar diagnóstico, contraindicação, indicação de procedimento ou conclusão clínica automática.
- Preservar CPF, consentimentos, rubrica, hashes, armazenamento privado e URL assinada.
- Não alterar schema do banco nesta fase.
- Linguagem visual: marfim/papel, chocolate/preto quente, dourado sóbrio, alta legibilidade em impressão.

## Review Focus

- Resposta vazia ou `null`: renderizar `-` sem quebrar a grade.
- Texto extremamente longo: ocupar largura total e quebrar página sem sobreposição.
- Mistura de spans `1+1+1`, `1+2`, `2+1` e `3`: nunca ultrapassar 3 colunas.
- Rubrica ausente no gerador: PDF permanece estruturalmente válido; validação de envio continua fora do layout.
- Conteúdo com acentos/emojis: sanitização existente continua segura e previsível.

---

### Task 1: Extrair modelo de conteúdo e política de spans

**Files:**
- Create: `supabase/functions/submit-pre-anamnese/pdf-content.ts`
- Create: `supabase/functions/submit-pre-anamnese/pdf-content_test.ts`
- Modify: `supabase/functions/submit-pre-anamnese/pdf.ts`

**Interfaces:**
- Move `PdfInput` to `pdf-content.ts`; `pdf.ts` imports it and re-exports the type so current callers remain compatible.
- Produces: `PdfField`, `PdfSection`, `humanLabel(key: string): string`, `displayValue(value: unknown): string`, `fieldSpan(key: string, value: unknown): 1 | 2 | 3`, `buildPdfSections(input: PdfInput): PdfSection[]`, `buildStructuredSummary(input: PdfInput): PdfSection`.
- `PdfField` carries `key`, `label`, `displayValue`, `span` and `importance`.

- [ ] **Step 1: Write the failing tests**
  - `fieldSpan` returns `1` for CPF/idade/gestação/alergia/nicotina with short values.
  - returns `2` for WhatsApp/e-mail and medium values.
  - returns `3` for `observacoes`, `expectativa`, `resultadoEsp` and long values.
  - empty values normalize to `-`.
  - summary includes only facts present in input and contains no diagnostic language.

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf-content_test.ts`
Expected: FAIL because `pdf-content.ts` does not exist.

- [ ] **Step 3: Implement the pure content functions**

Preserve current Portuguese labels and sanitization behavior. Do not reorder answers inside a clinical section.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf-content_test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "refactor: extract pre-anamnese PDF content model"`

### Task 2: Implementar planejador de linhas em grade

**Files:**
- Create: `supabase/functions/submit-pre-anamnese/pdf-layout.ts`
- Create: `supabase/functions/submit-pre-anamnese/pdf-layout_test.ts`

**Interfaces:**
- Consumes: `PdfField` from Task 1.
- Produces: `packFieldsIntoRows(fields: PdfField[]): PdfField[][]`, `estimateCardHeight(field: PdfField, width: number): number`.

- [ ] **Step 1: Write the failing tests**
  - three span-1 fields share one row;
  - span-1 + span-2 share one row;
  - span-2 followed by span-2 starts a new row;
  - span-3 is always alone;
  - no row sum exceeds 3;
  - a long multiline value estimates higher than a short boolean.

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf-layout_test.ts`
Expected: FAIL because layout functions do not exist.

- [ ] **Step 3: Implement the planner**

Use deterministic first-fit-in-order packing; preserve input order; do not reorder clinical answers merely to fill gaps.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf-layout_test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add compact PDF grid planner"`

### Task 3: Renderizar cards, seções e paginação segura

**Files:**
- Modify: `supabase/functions/submit-pre-anamnese/pdf.ts`
- Modify: `supabase/functions/submit-pre-anamnese/pdf_test.ts`

**Interfaces:**
- Consumes: `buildPdfSections`, `packFieldsIntoRows`, `estimateCardHeight`.
- Produces: existing `generatePreAnamnesePdf(input: PdfInput): Promise<Uint8Array>` unchanged for callers.

- [ ] **Step 1: Extend failing PDF tests**
  - generated bytes begin with `%PDF`;
  - a very long `observacoes` value generates multiple pages without throwing;
  - empty `signaturePngBytes` still yields a valid PDF;
  - Portuguese accents remain supported.

- [ ] **Step 2: Run tests to verify the new multi-page/layout path fails before implementation**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: at least one new assertion FAILS.

- [ ] **Step 3: Replace `drawField` flow with row/card rendering**

Cards in a row share the row's maximum height; each card aligns to the top; `ensure(rowHeight)` runs before drawing the row; section titles never orphan at page bottom.

- [ ] **Step 4: Run PDF tests**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: render compact pre-anamnese PDF cards"`

### Task 4: Cabeçalho premium, rodapé e síntese estruturada

**Files:**
- Modify: `supabase/functions/submit-pre-anamnese/pdf.ts`
- Modify: `supabase/functions/submit-pre-anamnese/pdf-content_test.ts`
- Modify: `supabase/functions/submit-pre-anamnese/pdf_test.ts`

**Interfaces:**
- Keep `generatePreAnamnesePdf` signature unchanged.
- Produces helper: `formatPageLabel(pageNumber: number, totalPages: number): string` returning `Página X de Y`.

- [ ] **Step 1: Add failing tests for document structure helpers**
  - title text is `Pré-Avaliação Estética Individualizada` in the content model;
  - summary excludes empty categories;
  - public code is passed to the page chrome renderer;
  - `formatPageLabel(2, 5)` equals `Página 2 de 5`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf-content_test.ts supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: FAIL on new helper assertions.

- [ ] **Step 3: Implement header/footer/synthesis rendering**

Draw page numbers only after all pages exist so total page count is correct. Keep consent and signature sections readable and uncompressed; footer includes short disclaimer, code and page label.

- [ ] **Step 4: Run tests**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf-content_test.ts supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: finish premium pre-anamnese PDF composition"`

### Task 5: Regressão do fluxo de envio e verificação visual

**Files:**
- Verify only unless a regression is found: `supabase/functions/submit-pre-anamnese/index.ts`, `signature.ts`, `integrity.ts`, `validation.ts`.

**Interfaces:**
- No API contract change.

- [ ] **Step 1: Run all Edge Function tests**

Run: `deno test supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: all PASS.

- [ ] **Step 2: Generate one realistic fixture PDF locally**

Use `generatePreAnamnesePdf` with mixed short/medium/long answers, logo bytes when available, and a sample rubric.
Expected: file opens as PDF and uses horizontal card rows where appropriate.

- [ ] **Step 3: Inspect every page visually**

Check: no overlap, no clipped text, no orphan section header, balanced whitespace, readable print size, proportional logo/rubric.

- [ ] **Step 4: Commit only if visual-verification fixes were required**

`git commit -m "fix: polish pre-anamnese PDF pagination"`
