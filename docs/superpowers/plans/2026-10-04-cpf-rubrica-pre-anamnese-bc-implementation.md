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
- O CPF não pode ser persistido no rascunho durável de `localStorage` nem duplicado dentro de `answers`.
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
2. **CPF malformado, repetido ou com dígitos verificadores inválidos:** deve ser rejeitado tanto no frontend quanto no backend; `529.982.247-25` e `52998224725` devem normalizar para o mesmo valor.
3. **Privacidade do CPF no navegador/payload:** `saveDraft` nunca pode gravar `cpf` no `localStorage`, e `buildSubmissionPayload` deve removê-lo de `answers`, mantendo-o apenas em `patient.cpf`.
4. **PNG aparentemente válido, mas com dimensões anormais/malformadas:** backend deve rejeitar antes de Storage/Postgres; rubrica visualmente vazia deve ser bloqueada no frontend por métricas mínimas de traço.
5. **Alteração de ordem das chaves JSON ou adulteração posterior:** a serialização canônica deve produzir o mesmo hash para conteúdo semanticamente igual e hash diferente quando CPF, respostas, consentimentos, rubrica ou timestamp mudarem.

---

## File Structure

### Frontend público
- Modify: `agendamento/index.html` — CPF, autorização de dados, cópia correta de “rubrica de confirmação” e bloco de identidade sob o canvas.
- Modify: `agendamento/anamnese.css` — campo CPF, autorização, área de rubrica e identidade visual mobile-first.
- Create: `agendamento/js/cpf.js` — normalização, máscara e validação matemática de CPF.
- Modify: `agendamento/js/state.js` — sanitização do rascunho para excluir CPF do `localStorage`.
- Modify: `agendamento/js/validation.js` — CPF e autorização obrigatórios na Etapa 1.
- Modify: `agendamento/js/signature.js` — ativação quando visível, métricas de traço e validação da rubrica.
- Modify: `agendamento/js/api.js` — incluir CPF/autorização no payload e excluir CPF de `answers`.
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
- Modify: `admin/admin.js` — exibir CPF apenas no detalhe; não adicionar CPF à listagem.

### Testes
- Create: `tests/anamnese/cpf.test.mjs`.
- Modify: `tests/anamnese/state.test.mjs`.
- Modify: `tests/anamnese/validation.test.mjs`.
- Modify: `tests/anamnese/signature.test.mjs`.
- Modify: `tests/anamnese/api.test.mjs`.
- Modify: `tests/anamnese/finalize.test.mjs`.
- Modify: `tests/anamnese/main-finalize.test.mjs`.
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
- Produces: `normalizeCpf(value)`, `formatCpf(value)`, `isValidCpf(value)`, `stripSensitiveDraftValues(values)`.

- [ ] **Step 1: Escrever os testes de CPF**

Em `cpf.test.mjs`, usar o CPF de teste `529.982.247-25`: formatado e não formatado devem normalizar para `52998224725`; sequências iguais e dígitos verificadores inválidos devem falhar; `formatCpf('52998224725')` deve retornar `529.982.247-25`.

- [ ] **Step 2: Escrever teste de privacidade do draft**

`saveDraft` com `{ nome:'Teste', cpf:'529.982.247-25', whatsapp:'...' }` deve persistir os outros campos, mas o JSON de `bc.preAnamnese.draft.v1` não pode conter `cpf`, `52998224725` nem `529.982.247-25`. `loadDraft` deve remover CPF de um draft legado que ainda o contenha.

- [ ] **Step 3: Escrever testes de validação da Etapa 1**

CPF ausente/inválido gera `errors.cpf`; `dataAuthorization !== true` gera `errors.dataAuthorization`; CPF válido + autorização marcada mantém a etapa válida quando os demais campos obrigatórios estão válidos.

- [ ] **Step 4: Rodar e confirmar falha**

Run: `node --test tests/anamnese/cpf.test.mjs tests/anamnese/state.test.mjs tests/anamnese/validation.test.mjs`
Expected: FAIL.

- [ ] **Step 5: Implementar `cpf.js`**

Assinaturas: `normalizeCpf(value) -> string`, `formatCpf(value) -> string`, `isValidCpf(value) -> boolean`. Usar os dois dígitos verificadores e rejeitar 11 dígitos iguais.

- [ ] **Step 6: Implementar exclusão do CPF no draft**

Adicionar `stripSensitiveDraftValues(values)` e fazer `saveDraft` serializar cópia sem `cpf`; `loadDraft` também deve remover `cpf` de dados legados antes de devolver o estado.

- [ ] **Step 7: Adicionar CPF e autorização à Etapa 1**

Campo `id/name="cpf"`, `inputmode="numeric"`, `autocomplete="off"`; autorização `id="dataAuthorization"` com o texto aprovado na especificação. Manter o visual premium atual.

- [ ] **Step 8: Aplicar máscara durante a digitação**

A UI pode mostrar máscara; validação e payload sempre usam normalização.

- [ ] **Step 9: Rodar suíte frontend**

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
- Produces: `createSignaturePad(canvas, options)` com `clear()`, `isEmpty()`, `isValid()`, `getMetrics()`, `toDataUrl()`, `resize()`.

- [ ] **Step 1: Escrever teste canvas oculto → visível**

Iniciar fake canvas com `clientWidth=0/clientHeight=0`; `resize()` não deve colapsar/destruir. Depois alterar para `320x190`; com DPR 2, backing canvas deve ficar `640x380`.

- [ ] **Step 2: Escrever testes das métricas mínimas**

Rubrica válida exige: `moveCount >= 2`, `totalDistance >= 20 CSS px` e `max(boundingBoxWidth,boundingBoxHeight) >= 10 CSS px`. Toque isolado ou microtraço falha; rubrica curta real passa.

- [ ] **Step 3: Escrever teste de resize/orientação**

Rubrica válida deve continuar válida e visível após `resize()`.

- [ ] **Step 4: Rodar e confirmar falha**

Run: `node --test tests/anamnese/signature.test.mjs tests/anamnese/finalize.test.mjs tests/anamnese/main-finalize.test.mjs`
Expected: FAIL.

- [ ] **Step 5: Implementar métricas em `signature.js`**

`getMetrics()` retorna `{moveCount,totalDistance,minX,minY,maxX,maxY}`; `isValid()` aplica exatamente os limiares; `clear()` zera desenho/métricas; `resize()` ignora dimensões invisíveis em vez de transformar o canvas em `1x1`.

- [ ] **Step 6: Ativar o canvas ao entrar na Etapa 7**

Após tornar a etapa visível, `main.js` agenda `signaturePad.resize()` no próximo frame; a primeira ativação não pode depender de `window.resize`.

- [ ] **Step 7: Atualizar interface e linguagem**

Título `Rubrica de confirmação da pré-anamnese`; botão `Limpar e refazer`; sob o canvas mostrar nome, CPF formatado e `Data/hora oficial registrada no envio`.

- [ ] **Step 8: Bloquear avanço/finalização por `isValid()`**

`signatureStepErrors` e `finalizePreAnamnese` exigem rubrica válida.

- [ ] **Step 9: Rodar suíte frontend**

Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add agendamento/js/signature.js agendamento/js/main.js agendamento/js/finalize.js agendamento/index.html agendamento/anamnese.css tests/anamnese
git commit -m "fix: harden mobile rubric capture"
```

---

### Task 3: Incluir CPF/autorização no payload e revalidar no backend

**Files:**
- Modify: `agendamento/js/api.js`
- Modify: `agendamento/js/config.js`
- Modify: `tests/anamnese/api.test.mjs`
- Create: `supabase/functions/submit-pre-anamnese/cpf.ts`
- Create: `supabase/functions/submit-pre-anamnese/cpf_test.ts`
- Modify: `supabase/functions/submit-pre-anamnese/validation.ts`
- Modify: `supabase/functions/submit-pre-anamnese/validation_test.ts`

**Interfaces:**
- Consumes: regras de CPF da Task 1.
- Produces: `patient.cpf='52998224725'`, `consents.dataAuthorization===true`; `answers` sem CPF; backend `normalizeCpf(value)` e `isValidCpf(value)`.

- [ ] **Step 1: Escrever teste do payload frontend**

Com `values.cpf='529.982.247-25'`, `buildSubmissionPayload` deve gerar `patient.cpf='52998224725'`, `consents.dataAuthorization=true`, e `payload.answers` não pode ter a chave `cpf` nem qualquer representação do CPF.

- [ ] **Step 2: Escrever testes Deno de CPF**

Replicar os casos essenciais do frontend para evitar divergência.

- [ ] **Step 3: Escrever testes de validação backend**

Rejeitar CPF inválido/ausente e autorização ausente; payload válido devolve CPF normalizado.

- [ ] **Step 4: Rodar e confirmar falha**

Run frontend: `node --test tests/anamnese/api.test.mjs`
Run backend: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/cpf_test.ts supabase/functions/submit-pre-anamnese/validation_test.ts`
Expected: FAIL.

- [ ] **Step 5: Implementar payload frontend**

Modificar `buildSubmissionPayload(...)`: copiar `values` para `answers`, remover `cpf` da cópia, preencher `patient.cpf` normalizado e `consents.dataAuthorization`.

- [ ] **Step 6: Implementar `cpf.ts` e integrar `validation.ts`**

`SubmissionPatient` passa a exigir `cpf`; `ValidSubmission.consents` passa a exigir `dataAuthorization:true` além dos consentimentos existentes.

- [ ] **Step 7: Atualizar versão do formulário**

`FORM_VERSION = '2026-10-04.v2'`.

- [ ] **Step 8: Rodar frontend + backend**

Run: `npm run test:frontend`
Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add agendamento/js/api.js agendamento/js/config.js tests/anamnese/api.test.mjs supabase/functions/submit-pre-anamnese
git commit -m "feat: validate CPF and data authorization end to end"
```

---

### Task 4: Validar PNG da rubrica e criar trilha SHA-256

**Files:**
- Modify: `supabase/functions/submit-pre-anamnese/signature.ts`
- Modify: `supabase/functions/submit-pre-anamnese/signature_test.ts`
- Create: `supabase/functions/submit-pre-anamnese/integrity.ts`
- Create: `supabase/functions/submit-pre-anamnese/integrity_test.ts`

**Interfaces:**
- Consumes: Data URL PNG e dados normalizados.
- Produces: `readPngDimensions(bytes)`, `validateRubricPngDataUrl(value)`, `canonicalStringify(value)`, `sha256Hex(bytes)`, `buildCanonicalSubmissionSnapshot(input)`.

- [ ] **Step 1: Escrever testes de PNG**

Aceitar PNG dentro dos limites; rejeitar assinatura mágica falsa, base64 malformado, IHDR ausente, dimensões abaixo de `120x80` ou acima de `4096x2048`, e bytes acima de `2_097_152`.

- [ ] **Step 2: Escrever testes SHA-256/canonicalização**

Hash deve ter 64 caracteres hex. Objetos iguais em ordem de chaves diferente devem canonicalizar igual; mudar CPF, respostas, consentimentos, hash da rubrica ou timestamp deve mudar o hash final.

- [ ] **Step 3: Rodar e confirmar falha**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/signature_test.ts supabase/functions/submit-pre-anamnese/integrity_test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar validação estrutural do PNG**

Manter `decodePngDataUrl` para compatibilidade; ler largura/altura big-endian do IHDR; `validateRubricPngDataUrl` aplica limites e calcula SHA-256 dos bytes.

- [ ] **Step 5: Implementar canonicalização**

`buildCanonicalSubmissionSnapshot` inclui exatamente `publicCode`, `patientName`, `patientCpf`, `procedure`, `answers`, `consents`, `sourceVersion`, `rubricSha256`, `confirmedAt`.

- [ ] **Step 6: Rodar todos os testes Deno**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/submit-pre-anamnese/signature.ts supabase/functions/submit-pre-anamnese/signature_test.ts supabase/functions/submit-pre-anamnese/integrity.ts supabase/functions/submit-pre-anamnese/integrity_test.ts
git commit -m "feat: add rubric integrity validation"
```

---

### Task 5: Persistir CPF, timestamps e hashes sem quebrar legado

**Files:**
- Create: `supabase/migrations/20261004_004_cpf_rubric_integrity.sql`
- Modify: `supabase/functions/submit-pre-anamnese/index.ts`
- Modify: `tests/anamnese/security-migrations.test.mjs`

**Interfaces:**
- Consumes: CPF validado, rubrica validada e helpers de integridade.
- Produces: `patient_cpf`, `data_authorization_accepted_at`, `rubric_sha256`, `payload_sha256`, `rubric_confirmed_at`.

- [ ] **Step 1: Escrever teste da migration**

Exigir as cinco colunas, RLS preservada e nenhum novo `GRANT` público.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/anamnese/security-migrations.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Criar migration compatível com fichas antigas**

Adicionar as colunas como nullable; `patient_cpf` recebe check `patient_cpf is null or patient_cpf ~ '^[0-9]{11}$'`; não ampliar permissões.

- [ ] **Step 4: Integrar `validateRubricPngDataUrl` antes de qualquer write**

Nenhum Storage/Postgres write ocorre se PNG/CPF/consentimentos falharem.

- [ ] **Step 5: Persistir timestamps e hashes no mesmo ato de submissão**

O `createdAt` do servidor usado para a ficha será também o `rubric_confirmed_at` e o `data_authorization_accepted_at`: significa “submissão recebida pelo servidor com a autorização marcada”, não o instante exato do toque no checkbox. Calcular `payload_sha256` antes do `insert` usando esse mesmo timestamp.

- [ ] **Step 6: Preservar idempotência**

`submission_token` continua sendo a chave de retry. Retry de ficha existente não pode gerar novo timestamp/hash como se fosse nova confirmação.

- [ ] **Step 7: Garantir logs sem CPF**

Não logar payload, CPF ou respostas.

- [ ] **Step 8: Rodar suites**

Run: `npm run test:frontend`
Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: PASS.

- [ ] **Step 9: Aplicar migration no Supabase de produção e verificar RLS/buckets**

Expected: colunas presentes, buckets privados, fichas antigas preservadas.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20261004_004_cpf_rubric_integrity.sql supabase/functions/submit-pre-anamnese/index.ts tests/anamnese/security-migrations.test.mjs
git commit -m "feat: persist CPF and rubric integrity metadata"
```

---

### Task 6: PDF “Hollywood BC” com logo e rubrica bem compostas

**Files:**
- Modify: `supabase/functions/submit-pre-anamnese/pdf.ts`
- Modify: `supabase/functions/submit-pre-anamnese/pdf_test.ts`
- Modify: `supabase/functions/submit-pre-anamnese/index.ts`

**Interfaces:**
- Consumes: CPF, `rubricConfirmedAt`, rubrica PNG, protocolo e logo oficial.
- Produces: `generatePreAnamnesePdf(input)` com A4 premium e bloco final de confirmação.

- [ ] **Step 1: Atualizar teste do contrato `PdfInput`**

Adicionar CPF e `rubricConfirmedAt`; PDF continua válido (`%PDF`), suporta texto longo, acentos, logo e rubrica.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar composição premium da primeira página**

Logo oficial sem fundo centralizada no topo, caixa máxima `118x62 pt`, proporção preservada e pelo menos `20 pt` de respiro. Abaixo: `BC ESTÉTICA AVANÇADA`, `FICHA DE PRÉ-ANAMNESE`, slogan `Menos achismo. Mais ciência.`, divisor dourado/champagne e card de protocolo/data.

- [ ] **Step 4: Implementar páginas internas alinhadas**

Logo interna no máximo `52x30 pt`, grid e margens consistentes, cabeçalhos discretos, rodapé/paginação sem sobreposição.

- [ ] **Step 5: Exibir CPF somente em Identificação e no bloco final**

Formatar `52998224725` como `529.982.247-25`; garantir que o loop de `answers` não duplique CPF.

- [ ] **Step 6: Criar bloco `CONFIRMAÇÃO DO PREENCHIMENTO`**

Rubrica centralizada em área máxima `260x90 pt`, sem distorção; abaixo mostrar Nome, CPF, Data/hora oficial e Protocolo BC. Incluir o texto aprovado de que a rubrica confirma apenas a pré-anamnese e a assinatura/termos formais serão presenciais.

- [ ] **Step 7: Manter campo separado da profissional**

Sem assinatura automática.

- [ ] **Step 8: Passar novos campos a partir de `index.ts`**

Usar exatamente `patient_cpf` e `rubric_confirmed_at` persistidos na ficha.

- [ ] **Step 9: Rodar teste do PDF**

Expected: PASS.

- [ ] **Step 10: Gerar PDF de amostra e fazer inspeção visual**

Verificar primeira página e bloco final: logo nítida/proporcional, respiro, alinhamento, nenhuma sobreposição, rubrica legível e aparência coerente com a BC. Corrigir antes do commit se necessário.

- [ ] **Step 11: Commit**

```bash
git add supabase/functions/submit-pre-anamnese/pdf.ts supabase/functions/submit-pre-anamnese/pdf_test.ts supabase/functions/submit-pre-anamnese/index.ts
git commit -m "style: deliver premium BC pre-anamnesis PDF"
```

---

### Task 7: CPF somente no detalhe administrativo autenticado

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `tests/anamnese/admin.test.mjs`

**Interfaces:**
- Consumes: `patient_cpf`.
- Produces: detalhe autenticado com CPF formatado; listagem permanece sem CPF.

- [ ] **Step 1: Escrever teste**

A query da lista não deve selecionar `patient_cpf`; o detalhe deve renderizar `detailCpf` formatado e mostrar `—` para ficha legada.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/anamnese/admin.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar campo somente no detalhe**

Não adicionar CPF à lista nem aos filtros nesta entrega.

- [ ] **Step 4: Rodar frontend**

Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add admin/index.html admin/admin.js tests/anamnese/admin.test.mjs
git commit -m "feat: show CPF in authenticated record detail"
```

---

### Task 8: Verificação final, CI e teste real no celular

**Files:**
- Modify only if verification reveals a defect already owned by Tasks 1–7.

**Interfaces:**
- Consumes: feature completa.
- Produces: evidência de funcionamento conjunto sem regressão.

- [ ] **Step 1: Rodar suíte frontend**

Run: `npm run test:frontend`
Expected: todos PASS.

- [ ] **Step 2: Rodar suíte Deno**

Run: `deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: todos PASS.

- [ ] **Step 3: Verificar `Pre-anamnese CI`**

Expected: verde no commit final.

- [ ] **Step 4: Teste real mobile-first**

Preencher CPF → autorizar → concluir → entrar na Etapa 7 → rubricar com dedo → limpar/refazer → girar tela → confirmar preservação → finalizar → receber protocolo → abrir/baixar PDF.

- [ ] **Step 5: Verificar privacidade local**

`bc.preAnamnese.draft.v1` não contém CPF.

- [ ] **Step 6: Verificar registro Supabase**

Ficha nova: CPF 11 dígitos; timestamps preenchidos; hashes 64 hex; `signature_path`/`pdf_path` privados; sem URL pública permanente.

- [ ] **Step 7: Verificar PDF final**

Logo oficial nítida e bem posicionada; primeira página elegante; seções alinhadas; rubrica, nome, CPF, data/hora e protocolo organizados; rodapé/paginação corretos.

- [ ] **Step 8: Verificar painel**

CPF ausente da lista e presente apenas no detalhe autenticado; ficha legada abre normalmente.

- [ ] **Step 9: Commit somente se houver correção de verificação**

Sem refatoração paralela.

---

## Follow-up fora deste plano

Depois deste plano estar verde e validado em produção, abrir plano separado para os dois itens já identificados pelo usuário: **download robusto do PDF em navegadores móveis** e **envio do PDF por e-mail**. O visual premium já estará pronto para que ambos reutilizem exatamente o mesmo documento oficial.
