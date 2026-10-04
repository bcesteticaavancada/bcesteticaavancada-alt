# BC Estética CPF + Rubrica de Confirmação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar CPF com autorização na identificação, rubrica manuscrita confiável no celular, trilha técnica de integridade e um PDF final premium da BC Estética, sem Base44.

**Architecture:** O frontend continua estático no GitHub Pages, em HTML/CSS/ES modules, e captura CPF e rubrica sem persistir CPF em `localStorage`. A submissão continua passando pela Supabase Edge Function, que revalida CPF e PNG, registra timestamps do servidor, calcula hashes SHA-256, persiste os metadados em Postgres/Storage privado e gera o PDF institucional. O painel administrativo permanece protegido por Supabase Auth + RLS e só exibe CPF completo no detalhe autenticado.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Canvas 2D + Pointer Events, GitHub Pages, Supabase Postgres/Auth/Storage/Edge Functions (Deno), `pdf-lib@1.17.1`, Web Crypto SHA-256, Node built-in test runner e Deno test.

**Spec:** `docs/superpowers/specs/2026-10-03-cpf-rubrica-pre-anamnese-bc-design.md`

## Global Constraints

- Base44 não faz parte desta arquitetura.
- A rubrica confirma o preenchimento da pré-anamnese; não deve ser apresentada como assinatura digital qualificada ou substituta da assinatura presencial.
- O CPF é obrigatório na Etapa 1, exibido como `000.000.000-00` e enviado/armazenado normalizado com 11 dígitos.
- O CPF não pode ser persistido no rascunho durável de `localStorage`.
- O aceite de tratamento de dados na Etapa 1 é obrigatório.
- A data/hora oficial da confirmação deve ser registrada pelo servidor.
- Rubricas e PDFs permanecem em buckets privados do Supabase.
- Não registrar CPF completo em logs ou mensagens de erro.
- Não adicionar biblioteca obrigatória de assinatura; manter Canvas 2D + Pointer Events.
- Não coletar localização precisa, biometria, reconhecimento facial ou IP como requisito de negócio.
- A logo oficial da BC deve manter proporção, área de respiro e alinhamento editorial; nunca distorcer, sobrepor ou esticar.
- O PDF final deve transmitir luxo discreto, ciência, organização e identidade BC, sem aparência de formulário bruto.
- Não aplicar automaticamente assinatura da profissional responsável.
- Preservar compatibilidade com fichas legadas já existentes no banco.

## Review Focus

1. **Canvas criado enquanto a Etapa 7 está oculta:** ao exibir a etapa, o backing canvas deve receber o tamanho real e a rubrica precisa desenhar corretamente sem depender de redimensionar a janela.
2. **CPF malformado, repetido ou com dígitos verificadores inválidos:** deve ser rejeitado tanto no frontend quanto no backend; CPF formatado e não formatado válidos devem normalizar para os mesmos 11 dígitos.
3. **Rascunho em dispositivo compartilhado:** `saveDraft` nunca pode gravar `cpf` no `localStorage`, mesmo quando o restante do formulário é salvo e restaurado.
4. **PNG aparentemente válido, mas com dimensões anormais/malformadas:** backend deve rejeitar antes de Storage/Postgres; rubrica visualmente vazia deve ser bloqueada no frontend por métricas mínimas de traço.
5. **Alteração de ordem das chaves JSON ou tentativa de adulteração posterior:** a serialização canônica deve produzir o mesmo hash para conteúdo semanticamente igual e hash diferente quando CPF, respostas, consentimentos, rubrica ou timestamp mudarem.

---

## File Structure

### Frontend público
- Modify: `agendamento/index.html` — CPF, autorização de dados, cópia correta de “rubrica de confirmação” e bloco de identidade sob o canvas.
- Modify: `agendamento/anamnese.css` — campo CPF, autorização, área de rubrica e identidade visual mobile-first.
- Create: `agendamento/js/cpf.js` — normalização, máscara e validação matemática de CPF.
- Modify: `agendamento/js/state.js` — sanitização do rascunho para excluir CPF do `localStorage`.
- Modify: `agendamento/js/validation.js` — CPF e autorização obrigatórios na Etapa 1.
- Modify: `agendamento/js/signature.js` — ativação quando visível, métricas de traço e validação da rubrica.
- Modify: `agendamento/js/api.js` — incluir CPF e autorização no payload.
- Modify: `agendamento/js/finalize.js` — exigir rubrica válida, não apenas “não vazia”.
- Modify: `agendamento/js/main.js` — máscara CPF, ativação do canvas na Etapa 7, identidade sob a rubrica e terminologia correta.
- Modify: `agendamento/js/config.js` — atualizar `FORM_VERSION` para a versão com CPF/rubrica.

### Backend/Supabase
- Create: `supabase/functions/submit-pre-anamnese/cpf.ts` — validação/normalização confiável de CPF no Deno.
- Modify: `supabase/functions/submit-pre-anamnese/validation.ts` — CPF e autorização obrigatórios no payload válido.
- Modify: `supabase/functions/submit-pre-anamnese/signature.ts` — validação de PNG, dimensões e limites da rubrica.
- Create: `supabase/functions/submit-pre-anamnese/integrity.ts` — SHA-256 e serialização canônica do conteúdo final.
- Modify: `supabase/functions/submit-pre-anamnese/index.ts` — persistir CPF, timestamps, hashes e usar rubrica validada antes de gerar PDF.
- Modify: `supabase/functions/submit-pre-anamnese/pdf.ts` — novo layout premium e bloco final de confirmação.
- Create: `supabase/migrations/20261004_004_cpf_rubric_integrity.sql` — colunas novas compatíveis com fichas legadas.

### Administrativo
- Modify: `admin/index.html` — campo de CPF no detalhe autenticado.
- Modify: `admin/admin.js` — exibir CPF apenas no detalhe; não adicionar CPF à listagem pública do painel.

### Testes
- Create: `tests/anamnese/cpf.test.mjs`.
- Modify: `tests/anamnese/state.test.mjs`.
- Modify: `tests/anamnese/validation.test.mjs`.
- Modify: `tests/anamnese/signature.test.mjs`.
- Modify: `tests/anamnese/api.test.mjs`.
- Modify: `tests/anamnese/finalize.test.mjs`.
- Modify: `tests/anamnese/main.test.mjs` ou `tests/anamnese/main-finalize.test.mjs` conforme o comportamento coberto.
- Modify: `tests/anamnese/admin.test.mjs`.
- Modify: `tests/anamnese/security-migrations.test.mjs`.
- Create: `supabase/functions/submit-pre-anamnese/cpf_test.ts`.
- Modify: `supabase/functions/submit-pre-anamnese/validation_test.ts`.
- Modify: `supabase/functions/submit-pre-anamnese/signature_test.ts`.
- Create: `supabase/functions/submit-pre-anamnese/integrity_test.ts`.
- Modify: `supabase/functions/submit-pre-anamnese/pdf_test.ts`.

---

### Task 1: CPF na Etapa 1, autorização e privacidade do rascunho

**Files:**
- Create: `agendamento/js/cpf.js`
- Modify: `agendamento/index.html`
- Modify: `agendamento/anamnese.css`
- Modify: `agendamento/js/state.js`
- Modify: `agendamento/js/validation.js`
- Create: `tests/anamnese/cpf.test.mjs`
- Modify: `tests/anamnese/state.test.mjs`
- Modify: `tests/anamnese/validation.test.mjs`

**Interfaces:**
- Consumes: estado atual `{ step, values }` e serialização existente do formulário.
- Produces: `normalizeCpf(value: unknown): string`, `formatCpf(value: unknown): string`, `isValidCpf(value: unknown): boolean`, `stripSensitiveDraftValues(values: object): object`.

- [ ] **Step 1: Escrever os testes de CPF**

Cobrir em `cpf.test.mjs`: CPF válido formatado e não formatado normalizam para os mesmos 11 dígitos; sequências repetidas falham; dígitos verificadores inválidos falham; `formatCpf` produz `000.000.000-00`.

- [ ] **Step 2: Escrever os testes de privacidade do draft**

Adicionar a `state.test.mjs`: salvar `{ nome, cpf, whatsapp }` deve persistir `nome` e `whatsapp`, mas o JSON em `bc.preAnamnese.draft.v1` não pode conter a chave `cpf` nem os 11 dígitos do CPF.

- [ ] **Step 3: Escrever os testes da Etapa 1**

Adicionar a `validation.test.mjs`: CPF ausente/inválido gera `errors.cpf`; autorização desmarcada gera `errors.dataAuthorization`; CPF válido + autorização marcada mantém a Etapa 1 válida.

- [ ] **Step 4: Rodar os testes e confirmar falha**

Run: `node --test tests/anamnese/cpf.test.mjs tests/anamnese/state.test.mjs tests/anamnese/validation.test.mjs`
Expected: FAIL porque `cpf.js`, exclusão do draft e novas regras ainda não existem.

- [ ] **Step 5: Implementar `cpf.js`**

Assinaturas exatas:
`normalizeCpf(value: unknown) -> string`
`formatCpf(value: unknown) -> string`
`isValidCpf(value: unknown) -> boolean`

Usar algoritmo padrão dos dois dígitos verificadores e rejeitar sequências com todos os dígitos iguais.

- [ ] **Step 6: Implementar a exclusão de CPF do rascunho**

Adicionar `stripSensitiveDraftValues(values: object) -> object` em `state.js` e fazer `saveDraft(storage, state)` serializar uma cópia sem `cpf`. `loadDraft` permanece compatível com drafts legados, removendo `cpf` se algum draft antigo o contiver.

- [ ] **Step 7: Adicionar CPF e autorização à Etapa 1**

`agendamento/index.html`: campo `id="cpf"`, `name="cpf"`, `inputmode="numeric"`, `autocomplete="off"`; autorização `id="dataAuthorization"` com o texto aprovado na especificação. `anamnese.css`: manter o mesmo padrão premium e mobile-first dos demais campos.

- [ ] **Step 8: Aplicar máscara sem alterar o valor normalizado do payload**

Em `main.js` ou helper de UI, formatar visualmente durante digitação; validação usa `normalizeCpf`/`isValidCpf`.

- [ ] **Step 9: Rodar testes**

Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add agendamento/index.html agendamento/anamnese.css agendamento/js/cpf.js agendamento/js/state.js agendamento/js/validation.js tests/anamnese
git commit -m "feat: add private CPF identification flow"
```

---

### Task 2: Transformar o canvas atual em rubrica confiável no celular

**Files:**
- Modify: `agendamento/js/signature.js`
- Modify: `agendamento/js/main.js`
- Modify: `agendamento/js/finalize.js`
- Modify: `agendamento/index.html`
- Modify: `agendamento/anamnese.css`
- Modify: `tests/anamnese/signature.test.mjs`
- Modify: `tests/anamnese/finalize.test.mjs`
- Modify: `tests/anamnese/main-finalize.test.mjs`

**Interfaces:**
- Consumes: CPF/nome da Task 1.
- Produces: `createSignaturePad(canvas, options)` com `clear()`, `isEmpty()`, `isValid()`, `getMetrics()`, `toDataUrl()`, `resize()`; o nome técnico interno pode permanecer `signature`, mas a interface deve usar “rubrica de confirmação”.

- [ ] **Step 1: Escrever teste do canvas oculto → visível**

No fake canvas, iniciar com `clientWidth=0/clientHeight=0`; `resize()` deve sinalizar que ainda não está pronto sem destruir conteúdo. Depois alterar para `320x190` e chamar `resize()`; backing canvas deve assumir `320*dpr` por `190*dpr` e aceitar desenho normal.

- [ ] **Step 2: Escrever testes das métricas mínimas de rubrica**

Critérios mínimos aprovados para UX: `moveCount >= 2`, `totalDistance >= 20 CSS px` e `max(boundingBoxWidth, boundingBoxHeight) >= 10 CSS px`. Um toque ou microtraço deve manter `isValid() === false`; uma rubrica curta real deve retornar `true`.

- [ ] **Step 3: Escrever teste de preservação após rotação/resize**

Rubrica válida deve continuar válida e ser redesenhada após `resize()`.

- [ ] **Step 4: Rodar e confirmar falha**

Run: `node --test tests/anamnese/signature.test.mjs tests/anamnese/finalize.test.mjs tests/anamnese/main-finalize.test.mjs`
Expected: FAIL nas novas expectativas.

- [ ] **Step 5: Implementar métricas em `signature.js`**

`getMetrics() -> { moveCount:number, totalDistance:number, minX:number|null, minY:number|null, maxX:number|null, maxY:number|null }`.

`isValid()` deve aplicar exatamente os três limiares acima. `clear()` zera desenho e métricas. `resize()` não deve colapsar o canvas enquanto invisível.

- [ ] **Step 6: Ativar/redimensionar somente quando a Etapa 7 estiver visível**

Em `main.js`, depois de marcar a Etapa 7 como ativa, agendar `signaturePad.resize()` para o próximo frame; não depender de evento de `window.resize` para a primeira ativação.

- [ ] **Step 7: Atualizar a interface da rubrica**

Título: `Rubrica de confirmação da pré-anamnese`. Instrução aprovada na spec. Botão: `Limpar e refazer`. Sob o canvas, renderizar nome completo e CPF formatado; mostrar “Data/hora oficial registrada no envio”.

- [ ] **Step 8: Bloquear avanço/finalização por `isValid()`**

`signatureStepErrors` e `finalizePreAnamnese` devem exigir `signaturePad.isValid?.() === true`; manter mensagem clara sem chamar a rubrica de assinatura qualificada.

- [ ] **Step 9: Rodar testes**

Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add agendamento/js/signature.js agendamento/js/main.js agendamento/js/finalize.js agendamento/index.html agendamento/anamnese.css tests/anamnese
git commit -m "fix: harden mobile rubric capture"
```

---

### Task 3: Incluir CPF e autorização no payload e revalidar no backend

**Files:**
- Modify: `agendamento/js/api.js`
- Modify: `agendamento/js/config.js`
- Modify: `tests/anamnese/api.test.mjs`
- Create: `supabase/functions/submit-pre-anamnese/cpf.ts`
- Create: `supabase/functions/submit-pre-anamnese/cpf_test.ts`
- Modify: `supabase/functions/submit-pre-anamnese/validation.ts`
- Modify: `supabase/functions/submit-pre-anamnese/validation_test.ts`

**Interfaces:**
- Consumes: `normalizeCpf/isValidCpf` semantics da Task 1.
- Produces: payload `patient.cpf` com 11 dígitos e `consents.dataAuthorization === true`; backend `normalizeCpf(value: unknown): string` e `isValidCpf(value: unknown): boolean` em Deno.

- [ ] **Step 1: Escrever teste do payload frontend**

`buildSubmissionPayload` deve transformar `123.456.789-XX` válido em 11 dígitos, incluir `patient.cpf`, e incluir `consents.dataAuthorization` a partir de `values.dataAuthorization`.

- [ ] **Step 2: Escrever testes Deno de CPF**

Cobrir os mesmos casos essenciais do frontend para evitar divergência de regra.

- [ ] **Step 3: Escrever testes de validação do payload**

`validateSubmission` deve rejeitar CPF inválido/ausente e autorização ausente; deve devolver `patient.cpf` normalizado em payload válido.

- [ ] **Step 4: Rodar e confirmar falha**

Run frontend: `node --test tests/anamnese/api.test.mjs`
Run backend: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/cpf_test.ts supabase/functions/submit-pre-anamnese/validation_test.ts`
Expected: FAIL.

- [ ] **Step 5: Implementar payload frontend**

Modificar `buildSubmissionPayload(values, signatureDataUrl, sourceVersion, submissionToken)` para incluir `patient.cpf` normalizado e `consents.dataAuthorization`.

- [ ] **Step 6: Implementar `cpf.ts` e integrar em `validation.ts`**

Atualizar `SubmissionPatient` para exigir `cpf: string`; atualizar `ValidSubmission.consents` para exigir `dataAuthorization: true` além dos consentimentos existentes.

- [ ] **Step 7: Atualizar a versão do formulário**

Em `agendamento/js/config.js`, definir `FORM_VERSION = '2026-10-04.v2'` para distinguir novas fichas das fichas legadas.

- [ ] **Step 8: Rodar testes frontend + backend**

Run: `npm run test:frontend`
Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add agendamento/js/api.js agendamento/js/config.js tests/anamnese/api.test.mjs supabase/functions/submit-pre-anamnese
git commit -m "feat: validate CPF and data authorization end to end"
```

---

### Task 4: Validar o PNG da rubrica e criar trilha de integridade SHA-256

**Files:**
- Modify: `supabase/functions/submit-pre-anamnese/signature.ts`
- Modify: `supabase/functions/submit-pre-anamnese/signature_test.ts`
- Create: `supabase/functions/submit-pre-anamnese/integrity.ts`
- Create: `supabase/functions/submit-pre-anamnese/integrity_test.ts`

**Interfaces:**
- Consumes: Data URL PNG e dados normalizados da Task 3.
- Produces: `readPngDimensions(bytes: Uint8Array): {width:number,height:number}`, `validateRubricPngDataUrl(value: string): Promise<{bytes:Uint8Array,width:number,height:number,sha256:string}>`, `canonicalStringify(value: unknown): string`, `sha256Hex(bytes: Uint8Array): Promise<string>`, `buildCanonicalSubmissionSnapshot(input): string`.

- [ ] **Step 1: Escrever testes de dimensões PNG**

Aceitar PNG real dentro dos limites; rejeitar assinatura mágica falsa, base64 malformado, ausência de IHDR, largura/altura abaixo de `120x80` ou acima de `4096x2048`, e bytes acima de `2_097_152`.

- [ ] **Step 2: Escrever testes de SHA-256**

`sha256Hex` deve gerar 64 caracteres hexadecimais e ser determinístico.

- [ ] **Step 3: Escrever testes de canonicalização**

Objetos semanticamente iguais com ordem diferente de chaves devem produzir o mesmo `canonicalStringify`; mudança em CPF, resposta, consentimento, `rubricSha256` ou `confirmedAt` deve mudar o hash final.

- [ ] **Step 4: Rodar e confirmar falha**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/signature_test.ts supabase/functions/submit-pre-anamnese/integrity_test.ts`
Expected: FAIL.

- [ ] **Step 5: Implementar validação estrutural do PNG**

Manter `decodePngDataUrl` para compatibilidade interna e adicionar leitura big-endian de largura/altura do IHDR. `validateRubricPngDataUrl` aplica limites e calcula hash sobre os bytes finais.

- [ ] **Step 6: Implementar canonicalização e hash**

`buildCanonicalSubmissionSnapshot` deve incluir exatamente: `publicCode`, `patientName`, `patientCpf`, `procedure`, `answers`, `consents`, `sourceVersion`, `rubricSha256`, `confirmedAt`.

- [ ] **Step 7: Rodar testes**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/submit-pre-anamnese/signature.ts supabase/functions/submit-pre-anamnese/signature_test.ts supabase/functions/submit-pre-anamnese/integrity.ts supabase/functions/submit-pre-anamnese/integrity_test.ts
git commit -m "feat: add rubric integrity validation"
```

---

### Task 5: Persistir CPF, timestamps e hashes sem quebrar fichas legadas

**Files:**
- Create: `supabase/migrations/20261004_004_cpf_rubric_integrity.sql`
- Modify: `supabase/functions/submit-pre-anamnese/index.ts`
- Modify: `tests/anamnese/security-migrations.test.mjs`

**Interfaces:**
- Consumes: CPF validado, rubrica validada e helpers de integridade das Tasks 3–4.
- Produces: colunas `patient_cpf`, `data_authorization_accepted_at`, `rubric_sha256`, `payload_sha256`, `rubric_confirmed_at`; novas submissões sempre preenchem esses campos.

- [ ] **Step 1: Escrever teste da migration**

`security-migrations.test.mjs` deve exigir a presença das cinco colunas, RLS preservada e ausência de novos `GRANT` públicos sobre `pre_anamneses`/Storage.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/anamnese/security-migrations.test.mjs`
Expected: FAIL porque a migration `004` ainda não existe.

- [ ] **Step 3: Criar migration compatível com legado**

Adicionar as cinco colunas como nullable para não invalidar fichas anteriores. `patient_cpf` recebe `check (patient_cpf is null or patient_cpf ~ '^[0-9]{11}$')`. Não ampliar permissões existentes.

- [ ] **Step 4: Integrar rubrica validada no endpoint**

Trocar o uso direto de `decodePngDataUrl` por `await validateRubricPngDataUrl(...)` antes de qualquer write.

- [ ] **Step 5: Persistir timestamps do servidor e hashes**

Dentro da tentativa que já define `publicCode` e `createdAt`, usar esse timestamp como `rubric_confirmed_at` e `data_authorization_accepted_at`; calcular `payload_sha256` com o snapshot canônico antes do `insert`; gravar também `patient_cpf` e `rubric_sha256`.

- [ ] **Step 6: Preservar idempotência e fichas existentes**

`submission_token` continua sendo a chave de retry. `completeExisting` deve continuar funcionando para registros legados mesmo quando os novos campos forem `null`; não recomputar uma “nova confirmação” em retry de ficha já criada.

- [ ] **Step 7: Garantir que erros/logs não ecoem CPF**

Não concatenar payload, CPF ou respostas em `console.error`; manter mensagens genéricas já adotadas pelo endpoint.

- [ ] **Step 8: Rodar testes completos**

Run: `npm run test:frontend`
Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: PASS.

- [ ] **Step 9: Aplicar migration no Supabase de produção e verificar**

Expected: colunas presentes; RLS permanece ativa; buckets continuam privados; nenhuma ficha legada é perdida.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261004_004_cpf_rubric_integrity.sql supabase/functions/submit-pre-anamnese/index.ts tests/anamnese/security-migrations.test.mjs
git commit -m "feat: persist CPF and rubric integrity metadata"
```

---

### Task 6: Refazer o PDF no padrão “Hollywood BC” e anexar a rubrica corretamente

**Files:**
- Modify: `supabase/functions/submit-pre-anamnese/pdf.ts`
- Modify: `supabase/functions/submit-pre-anamnese/pdf_test.ts`
- Modify: `supabase/functions/submit-pre-anamnese/index.ts`

**Interfaces:**
- Consumes: `patient.cpf`, `rubricConfirmedAt`, rubrica PNG, protocolo e logo oficial já buscada pelo endpoint.
- Produces: `generatePreAnamnesePdf(input: PdfInput): Promise<Uint8Array>` com PDF A4 premium e seção final de confirmação.

- [ ] **Step 1: Atualizar teste do contrato `PdfInput`**

Adicionar CPF e `rubricConfirmedAt`; o PDF continua começando por `%PDF`, aceita observações longas, rubrica PNG e logo PNG válidas, e não quebra com caracteres portugueses.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: FAIL até o novo contrato/layout ser implementado.

- [ ] **Step 3: Implementar cabeçalho/capa premium da primeira página**

Logo oficial sem fundo centralizada no topo, respeitando proporção e caixa máxima de `118x62 pt`; mínimo de `20 pt` de respiro acima/abaixo. Abaixo: `BC ESTÉTICA AVANÇADA`, título `FICHA DE PRÉ-ANAMNESE`, slogan `Menos achismo. Mais ciência.`, divisor champagne/dourado e card de metadados com protocolo/data.

- [ ] **Step 4: Implementar páginas internas discretas e alinhadas**

Cabeçalho interno com logo menor, no máximo `52x30 pt`, alinhada ao grid; títulos de seção consistentes, margens fixas, campos agrupados e paginação/rodapé institucional sem sobreposição.

- [ ] **Step 5: Adicionar CPF à seção Identificação**

Exibir formatado como `000.000.000-00`; não repetir CPF fora de Identificação e do bloco final de confirmação.

- [ ] **Step 6: Criar bloco final “CONFIRMAÇÃO DO PREENCHIMENTO”**

Rubrica centralizada dentro de uma área visual de no máximo `260x90 pt`, sem distorção; abaixo: Nome completo, CPF, Data/hora oficial e Protocolo BC. Adicionar o texto aprovado: a rubrica confirma apenas o preenchimento da pré-anamnese e a assinatura formal/termos específicos serão realizados presencialmente.

- [ ] **Step 7: Preservar espaço separado para assinatura presencial da profissional**

Manter linha/campo visual separado, sem imagem automática e sem sugerir que a rubrica do cliente substitui a assinatura presencial.

- [ ] **Step 8: Passar os novos campos a partir de `index.ts`**

`generatePreAnamnesePdf` deve receber o CPF persistido e `rubric_confirmed_at` da mesma linha usada para gerar o PDF.

- [ ] **Step 9: Rodar testes do PDF**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: PASS.

- [ ] **Step 10: Gerar um PDF de amostra e fazer inspeção visual**

Verificar primeira página e página final: logo nítida/proporcional, respiro correto, grid alinhado, nenhuma quebra/sobreposição, rubrica legível, CPF/data/protocolo organizados e aparência coerente com a BC. Se houver problema visual, corrigir antes do commit.

- [ ] **Step 11: Commit**

```bash
git add supabase/functions/submit-pre-anamnese/pdf.ts supabase/functions/submit-pre-anamnese/pdf_test.ts supabase/functions/submit-pre-anamnese/index.ts
git commit -m "style: deliver premium BC pre-anamnesis PDF"
```

---

### Task 7: Mostrar CPF no detalhe administrativo sem ampliar exposição

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `tests/anamnese/admin.test.mjs`

**Interfaces:**
- Consumes: `patient_cpf` da Task 5.
- Produces: detalhe autenticado com CPF formatado; a tabela/listagem permanece sem CPF.

- [ ] **Step 1: Escrever teste do painel**

A query de listagem não deve selecionar `patient_cpf`; `loadPreAnamnese('*')` continua trazendo o detalhe autenticado; render do detalhe deve preencher `detailCpf` com máscara quando houver valor e `—` para ficha legada.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/anamnese/admin.test.mjs`
Expected: FAIL até `detailCpf` existir.

- [ ] **Step 3: Adicionar o campo somente no detalhe**

`admin/index.html`: adicionar label/valor de CPF dentro do painel de detalhe. `admin.js`: formatar apenas no navegador autenticado; não adicionar CPF às colunas de `renderList` nem aos filtros nesta entrega.

- [ ] **Step 4: Rodar testes**

Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add admin/index.html admin/admin.js tests/anamnese/admin.test.mjs
git commit -m "feat: show CPF in authenticated record detail"
```

---

### Task 8: Verificação final, CI e teste real mobile-first

**Files:**
- Modify only if verification reveals a defect in files already owned by Tasks 1–7.

**Interfaces:**
- Consumes: feature completa das Tasks 1–7.
- Produces: evidência de que CPF + rubrica + Supabase + PDF funcionam juntos sem regressão.

- [ ] **Step 1: Rodar toda a suíte frontend**

Run: `npm run test:frontend`
Expected: todos os testes PASS.

- [ ] **Step 2: Rodar toda a suíte Deno**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: todos os testes PASS.

- [ ] **Step 3: Verificar GitHub Actions**

Expected: workflow `Pre-anamnese CI` verde no commit final; não publicar correção adicional enquanto o CI estiver vermelho.

- [ ] **Step 4: Teste real em celular**

Fluxo: preencher Etapa 1 com CPF → confirmar autorização → concluir perguntas → entrar na Etapa 7 → desenhar rubrica com dedo → limpar/refazer → girar a tela → confirmar que rubrica permanece → finalizar → receber protocolo → abrir/baixar PDF. Expected: nenhum campo perdido, canvas funcional e PDF com rubrica correta.

- [ ] **Step 5: Verificar privacidade local**

Abrir storage do navegador após salvar rascunho antes do envio. Expected: nenhum CPF em `bc.preAnamnese.draft.v1`.

- [ ] **Step 6: Verificar registro no Supabase**

Expected para ficha nova: `patient_cpf` com 11 dígitos; os dois timestamps preenchidos; `rubric_sha256` e `payload_sha256` com 64 hex; `signature_path` e `pdf_path` privados; nenhuma URL permanente pública.

- [ ] **Step 7: Verificar PDF final**

Expected: logo oficial nítida e bem posicionada; primeira página elegante; seções alinhadas; rubrica, nome, CPF, data/hora e protocolo no bloco final; rodapé/paginação corretos; sem sobreposição ou distorção.

- [ ] **Step 8: Verificar painel administrativo**

Expected: CPF não aparece na lista; aparece apenas no detalhe de usuário autenticado; ficha legada sem CPF abre normalmente.

- [ ] **Step 9: Commit somente se a verificação exigiu correção**

Mensagem deve descrever exclusivamente o defeito encontrado, sem refatoração paralela.

---

## Follow-up fora deste plano

Depois deste plano estar verde e validado em produção, abrir um plano separado para os dois itens já identificados pelo usuário e que não devem ser misturados nesta entrega: **download robusto do PDF em navegadores móveis** e **envio do PDF por e-mail**. O visual premium do PDF já é resolvido nesta entrega para que esses canais reutilizem exatamente o mesmo documento oficial.
