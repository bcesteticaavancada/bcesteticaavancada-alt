# BC Estética Pré-Anamnese Nativa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a pré-anamnese oficial da BC Estética dentro do site, com salvamento seguro no Supabase, assinatura, PDF institucional, download/compartilhamento e área administrativa autenticada.

**Architecture:** O frontend continua estático no GitHub Pages e usa ES modules sem framework. A submissão pública vai para uma Supabase Edge Function sem acesso direto de escrita/leitura às tabelas; a função valida, persiste, gera o PDF e devolve apenas metadados e uma URL assinada temporária. A área `/admin/` usa Supabase Auth e RLS para ler/atualizar fichas e acessar arquivos privados.

**Tech Stack:** HTML/CSS/JavaScript ES modules, GitHub Pages, Supabase Postgres/Auth/Storage/Edge Functions (Deno), `pdf-lib`, Canvas 2D, Web Share API, Node built-in test runner, Deno test.

**Spec:** `docs/superpowers/specs/2026-10-03-pre-anamnese-bc-design.md`

## Global Constraints

- GitHub permanece como fonte oficial do frontend/site.
- Supabase será o backend principal.
- Base44 deixará de ser dependência funcional da pré-anamnese.
- PDFs e assinaturas serão privados.
- Haverá área administrativa autenticada.
- O PDF será tratado como documento oficial da BC, não como relatório cru.
- O fluxo será mobile-first.
- Não adicionar integrações extras sem necessidade concreta.
- Não manter dois formulários oficiais em paralelo.
- Não expor `service_role` ou qualquer credencial administrativa no frontend.
- Preservar o conteúdo clínico/estético já aprovado no formulário atual durante a refatoração.

## Review Focus

1. **Reenvio ou duplo toque no botão Finalizar:** não pode criar duas fichas; testar bloqueio do botão no cliente e idempotência curta no backend.
2. **Caracteres especiais/Unicode no texto livre:** não podem corromper o PDF; testar acentos, aspas curvas, travessão e caracteres não suportados.
3. **Falha de rede após preencher tudo:** o rascunho local deve continuar disponível e a interface deve permitir tentar novamente sem perder respostas.
4. **Assinatura vazia ou canvas redimensionado no celular:** finalização deve bloquear assinatura vazia e manter coordenadas corretas em telas de alta densidade.
5. **Tentativa de acesso público às fichas/PDFs:** deve falhar; testar RLS, bucket privado e acesso administrativo autenticado.

---

## File Structure

### Frontend público
- Modify: `agendamento/index.html` — markup das 8 etapas e pontos de montagem; sem lógica de negócio inline.
- Create: `agendamento/anamnese.css` — estilos específicos do fluxo, reutilizando tokens do site.
- Create: `agendamento/js/config.js` — URL pública do projeto Supabase, chave publicável/anon e versão do formulário.
- Create: `agendamento/js/state.js` — estado, draft local e serialização.
- Create: `agendamento/js/validation.js` — validação de etapas e payload final.
- Create: `agendamento/js/conditional.js` — regras de perguntas condicionais.
- Create: `agendamento/js/review.js` — montagem da tela de revisão.
- Create: `agendamento/js/signature.js` — canvas de assinatura e exportação PNG.
- Create: `agendamento/js/api.js` — chamada à Edge Function e download/compartilhamento do PDF.
- Create: `agendamento/js/main.js` — orquestração de navegação e eventos.

### Backend/Supabase
- Create: `supabase/migrations/20261003_001_pre_anamnese.sql` — tabelas, índices, RLS, buckets e políticas.
- Create: `supabase/functions/submit-pre-anamnese/index.ts` — endpoint HTTP público com validação, persistência, storage e resposta.
- Create: `supabase/functions/submit-pre-anamnese/validation.ts` — normalização, tamanho e validação do payload.
- Create: `supabase/functions/submit-pre-anamnese/public-code.ts` — código `BC-YYYYMMDD-XXXXX`.
- Create: `supabase/functions/submit-pre-anamnese/pdf.ts` — geração A4 com logo, seções, consentimentos e assinaturas.

### Administrativo
- Create: `admin/index.html` — login/lista/detalhe.
- Create: `admin/admin.css` — visual institucional e responsivo.
- Create: `admin/admin.js` — auth, consulta, filtros, status e download.

### Testes
- Create: `package.json` — script `test:frontend` com Node test runner.
- Create: `tests/anamnese/state.test.mjs`.
- Create: `tests/anamnese/validation.test.mjs`.
- Create: `tests/anamnese/conditional.test.mjs`.
- Create: `tests/anamnese/api.test.mjs`.
- Create: `supabase/functions/submit-pre-anamnese/validation_test.ts`.
- Create: `supabase/functions/submit-pre-anamnese/public-code_test.ts`.
- Create: `supabase/functions/submit-pre-anamnese/pdf_test.ts`.

---

### Task 1: Criar a fundação Supabase e as políticas de acesso

**Files:**
- Create: `supabase/migrations/20261003_001_pre_anamnese.sql`

**Interfaces:**
- Consumes: organização Supabase escolhida pelo usuário no início da execução e projeto criado após confirmação de custo.
- Produces: tabela `pre_anamneses`, tabela `admin_users`, buckets privados `pre-anamnese-signatures` e `pre-anamnese-pdfs`, RLS e políticas administrativas.

- [ ] **Step 1: Durante a execução, listar organizações Supabase e pedir ao usuário qual organização usar**

Não criar projeto sem essa escolha; a ferramenta exige organização explícita e confirmação de custo.

- [ ] **Step 2: Obter e confirmar o custo do projeto Supabase**

Esperado: usuário confirma o valor retornado pela plataforma antes da criação.

- [ ] **Step 3: Criar o projeto na região `sa-east-1` e aguardar ficar ativo**

Nome: `bc-estetica-pre-anamnese`.

- [ ] **Step 4: Escrever a migration com o schema mínimo**

`pre_anamneses`: `id uuid primary key`, `public_code text unique not null`, `created_at timestamptz`, `updated_at timestamptz`, `status text check (...)`, `patient_name text`, `patient_email text`, `patient_phone text`, `procedure text`, `answers jsonb`, `consents jsonb`, `signature_path text`, `pdf_path text`, `source_version text`.

`admin_users`: `user_id uuid primary key references auth.users`, `display_name text`, `role text`, `active boolean`, timestamps.

- [ ] **Step 5: Adicionar RLS e storage privado**

Regras: `anon` não recebe `SELECT/INSERT/UPDATE/DELETE` direto em `pre_anamneses`; usuários autenticados só leem/atualizam quando `admin_users.user_id = auth.uid()` e `active = true`; buckets são privados e leitura é permitida apenas ao mesmo grupo administrativo.

- [ ] **Step 6: Aplicar migration e verificar**

Run: migration no projeto Supabase; depois listar tabelas e advisors de segurança.
Expected: tabelas presentes, RLS ativa, nenhum advisor crítico causado pela migration.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261003_001_pre_anamnese.sql
git commit -m "feat: add secure pre-anamnesis data model"
```

---

### Task 2: Extrair estado e rascunho do formulário atual

**Files:**
- Modify: `agendamento/index.html`
- Create: `agendamento/anamnese.css`
- Create: `agendamento/js/config.js`
- Create: `agendamento/js/state.js`
- Create: `tests/anamnese/state.test.mjs`
- Create: `package.json`

**Interfaces:**
- Consumes: campos e textos já existentes em `agendamento/index.html`.
- Produces: `createInitialState()`, `loadDraft(storage)`, `saveDraft(storage, state)`, `clearDraft(storage)`, `serializeForm(formElement)`.

- [ ] **Step 1: Escrever testes de estado e draft**

Testes: `loadDraft` devolve estado inicial quando vazio/corrompido; `saveDraft` e `loadDraft` fazem round-trip; `clearDraft` remove a chave `bc.preAnamnese.draft.v1`.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/anamnese/state.test.mjs`
Expected: FAIL porque `state.js` ainda não existe.

- [ ] **Step 3: Implementar `state.js`**

Assinaturas:
`createInitialState() -> object`
`loadDraft(storage: StorageLike) -> object`
`saveDraft(storage: StorageLike, state: object) -> void`
`clearDraft(storage: StorageLike) -> void`
`serializeForm(formElement: HTMLFormElement) -> object`

- [ ] **Step 4: Refatorar `agendamento/index.html` para 8 etapas conceituais sem remover perguntas**

Etapas: Identificação/Procedimento; Objetivo/Histórico; Pele/Exposição; Saúde/Medicamentos/Alergias; Hábitos/Módulos; Revisão; Consentimentos/Assinatura; Finalização.

- [ ] **Step 5: Mover estilos específicos para `agendamento/anamnese.css` e manter `../styles.css` como base**

- [ ] **Step 6: Rodar testes**

Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add agendamento package.json tests/anamnese/state.test.mjs
git commit -m "refactor: modularize pre-anamnesis state and layout"
```

---

### Task 3: Implementar validação, condicionais, revisão e recuperação após falha

**Files:**
- Create: `agendamento/js/validation.js`
- Create: `agendamento/js/conditional.js`
- Create: `agendamento/js/review.js`
- Create: `agendamento/js/main.js`
- Create: `tests/anamnese/validation.test.mjs`
- Create: `tests/anamnese/conditional.test.mjs`

**Interfaces:**
- Consumes: estado da Task 2.
- Produces: `validateStep(stepId, state)`, `validateSubmission(state)`, `getVisibleQuestionIds(state)`, `buildReviewSections(state)`.

- [ ] **Step 1: Escrever testes de validação obrigatória e condicionais**

Cobrir: nome/data/idade/WhatsApp; procedimento; consentimentos; perguntas dependentes só são obrigatórias quando visíveis; texto com acentos é preservado.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/anamnese/validation.test.mjs tests/anamnese/conditional.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar validação e regras condicionais**

`validateStep(stepId: string, state: object) -> {valid:boolean, errors:Record<string,string>}`
`validateSubmission(state: object) -> {valid:boolean, errors:Record<string,string>}`
`getVisibleQuestionIds(state: object) -> string[]`

- [ ] **Step 4: Implementar revisão**

`buildReviewSections(state: object) -> Array<{title:string, rows:Array<{label:string,value:string}>}>`.

- [ ] **Step 5: Implementar `main.js`**

Responsabilidades: navegação; progress bar; salvar draft a cada mudança; restaurar draft no load; impedir avanço inválido; manter botão Finalizar desabilitado durante submissão; em falha de rede, preservar o draft e permitir retry.

- [ ] **Step 6: Rodar testes**

Run: `npm run test:frontend`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add agendamento/js tests/anamnese
git commit -m "feat: add validation conditional flow and review"
```

---

### Task 4: Implementar assinatura touch e validação de canvas vazio

**Files:**
- Create: `agendamento/js/signature.js`
- Modify: `agendamento/index.html`
- Modify: `agendamento/js/main.js`
- Create: `tests/anamnese/signature.test.mjs`

**Interfaces:**
- Consumes: etapa 7 do fluxo.
- Produces: `createSignaturePad(canvas)`, retornando `{clear, isEmpty, toDataUrl, resize}`.

- [ ] **Step 1: Escrever testes das funções puras do pad**

Cobrir normalização de coordenadas por `devicePixelRatio`, estado vazio após `clear()` e marcação como não vazio após primeiro traço.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/anamnese/signature.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implementar `createSignaturePad(canvas)`**

Usar Pointer Events, Canvas 2D e escala por `devicePixelRatio`; `toDataUrl()` retorna PNG; redimensionar sem deslocar coordenadas do ponteiro.

- [ ] **Step 4: Integrar na etapa de consentimentos**

Bloquear finalização se assinatura estiver vazia; oferecer botão Limpar assinatura.

- [ ] **Step 5: Testar manualmente em viewport móvel**

Expected: dedo/caneta/mouse desenham no ponto correto; rolagem da página não interfere durante o traço.

- [ ] **Step 6: Commit**

```bash
git add agendamento tests/anamnese/signature.test.mjs
git commit -m "feat: add touch signature capture"
```

---

### Task 5: Criar endpoint de submissão seguro e idempotente

**Files:**
- Create: `supabase/functions/submit-pre-anamnese/index.ts`
- Create: `supabase/functions/submit-pre-anamnese/validation.ts`
- Create: `supabase/functions/submit-pre-anamnese/public-code.ts`
- Create: `supabase/functions/submit-pre-anamnese/validation_test.ts`
- Create: `supabase/functions/submit-pre-anamnese/public-code_test.ts`
- Create: `agendamento/js/api.js`
- Create: `tests/anamnese/api.test.mjs`

**Interfaces:**
- Consumes POST JSON `{patient, procedure, answers, consents, signatureDataUrl, sourceVersion, submissionToken}`.
- Produces HTTP 201 `{id, publicCode, createdAt, pdfUrl, pdfExpiresAt}`; nunca devolve `answers` completos.

- [ ] **Step 1: Escrever testes Deno de normalização/validação**

Cobrir payload válido; campos obrigatórios ausentes; assinatura inválida; payload maior que o limite definido; Unicode; strings excessivamente longas.

- [ ] **Step 2: Escrever testes de código público**

`buildPublicCode(date, randomSuffix) -> "BC-YYYYMMDD-XXXXX"`; regex exata e sufixo alfanumérico em caixa alta.

- [ ] **Step 3: Rodar e confirmar falha**

Run: `deno test supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar validação e geração de código**

`validateSubmission(input: unknown) -> ValidationResult`
`normalizeText(value: string) -> string`
`buildPublicCode(date: Date, suffix?: string) -> string`

- [ ] **Step 5: Implementar `index.ts`**

Fluxo: aceitar apenas POST/OPTIONS; CORS restrito aos hosts oficiais e localhost de desenvolvimento; validar honeypot vazio; validar `submissionToken`; rejeitar duplicata recente do mesmo token; decodificar assinatura PNG; armazenar assinatura em bucket privado; inserir ficha via service role; gerar PDF na Task 6; devolver somente metadados e URL assinada curta.

- [ ] **Step 6: Implementar `api.js`**

`submitPreAnamnese(payload, fetchImpl=fetch) -> Promise<SubmissionResult>`; erro HTTP vira exceção legível; token de submissão fica estável durante retry da mesma finalização.

- [ ] **Step 7: Rodar testes**

Run: `deno test supabase/functions/submit-pre-anamnese/*_test.ts && npm run test:frontend`
Expected: PASS.

- [ ] **Step 8: Deploy da Edge Function**

Configuração: `verify_jwt=false` somente porque o endpoint é público e implementa validação própria; nenhum segredo administrativo vai ao browser.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/submit-pre-anamnese agendamento/js/api.js tests/anamnese/api.test.mjs
git commit -m "feat: add secure pre-anamnesis submission endpoint"
```

---

### Task 6: Gerar, armazenar, baixar e compartilhar o PDF institucional

**Files:**
- Create: `supabase/functions/submit-pre-anamnese/pdf.ts`
- Create: `supabase/functions/submit-pre-anamnese/pdf_test.ts`
- Modify: `supabase/functions/submit-pre-anamnese/index.ts`
- Modify: `agendamento/js/api.js`
- Modify: `agendamento/js/main.js`

**Interfaces:**
- Consumes: ficha validada + assinatura PNG + logo `assets/logo-oficial/logo-bc-estetica-sem-fundo.png`.
- Produces: `generatePreAnamnesePdf(input: PdfInput) -> Promise<Uint8Array>`, PDF em bucket privado e URL assinada temporária.

- [ ] **Step 1: Escrever testes do PDF**

Asserções mínimas: bytes começam com `%PDF`; saída não vazia; `sanitizePdfText` preserva português e converte caracteres incompatíveis sem lançar erro; documento aceita observação longa e cria página adicional quando necessário.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `deno test supabase/functions/submit-pre-anamnese/pdf_test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `sanitizePdfText(value)` e `generatePreAnamnesePdf(input)` com `pdf-lib`**

Layout: A4; logo; “BC Estética Avançada”; “Ficha de Pré-Anamnese”; código/data; seções; cores discretas da BC; rodapé; paginação; consentimentos; assinatura do cliente/paciente; linha de assinatura da profissional; sem inserir assinatura profissional automática.

- [ ] **Step 4: Armazenar PDF e criar URL assinada**

Caminho: `<yyyy>/<mm>/<public_code>.pdf` no bucket `pre-anamnese-pdfs`; URL assinada com validade curta (10 minutos) para a confirmação do paciente.

- [ ] **Step 5: Implementar download e compartilhamento no browser**

`downloadPdf(url, filename)` baixa Blob e cria link temporário; `sharePdf(url, filename, navigatorImpl=navigator)` usa Web Share com `File` quando `navigator.canShare({files})` suportar; fallback mantém botão Baixar PDF funcional.

- [ ] **Step 6: Testar caso Unicode problemático**

Entrada deve incluir `áéíóú ç ã ê “aspas” — travessão` e um caractere fora do conjunto suportado; PDF deve ser gerado sem glyph quebrado nem exceção.

- [ ] **Step 7: Teste visual do PDF**

Gerar ficha de demonstração e inspecionar todas as páginas: logo, hierarquia, quebras, assinatura, rodapé e ausência de sobreposição.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/submit-pre-anamnese agendamento/js
git commit -m "feat: generate branded BC pre-anamnesis PDF"
```

---

### Task 7: Criar área administrativa autenticada

**Files:**
- Create: `admin/index.html`
- Create: `admin/admin.css`
- Create: `admin/admin.js`

**Interfaces:**
- Consumes: Supabase Auth + RLS das Tasks 1 e 6.
- Produces: login, `loadPreAnamneses(filters)`, `loadPreAnamnese(id)`, `updateStatus(id,status)`, `getPdfSignedUrl(path)`.

- [ ] **Step 1: Criar um usuário administrativo de teste via Supabase Auth e registrar o `user_id` em `admin_users`**

Não armazenar senha no repositório.

- [ ] **Step 2: Implementar login e proteção de tela**

Sem sessão: mostrar somente formulário de login. Com sessão sem linha ativa em `admin_users`: negar acesso. Com sessão autorizada: mostrar painel.

- [ ] **Step 3: Implementar lista e filtros**

Filtros: `public_code`, `patient_name`, intervalo de `created_at`; ordenação padrão mais recente primeiro.

- [ ] **Step 4: Implementar detalhe, status e download**

Status permitidos: `recebida`, `em_avaliacao`, `avaliada`; PDF via URL assinada obtida com sessão autenticada.

- [ ] **Step 5: Verificar RLS negativamente**

Teste sem sessão: consulta `pre_anamneses` retorna zero/erro de permissão e storage privado não fornece URL pública funcional.

- [ ] **Step 6: Testar responsividade e navegação**

Viewports: 360px, 768px, desktop; sem dados sensíveis no HTML estático inicial.

- [ ] **Step 7: Commit**

```bash
git add admin
git commit -m "feat: add authenticated pre-anamnesis admin panel"
```

---

### Task 8: Integrar, testar regressões e cortar dependência funcional do Base44

**Files:**
- Modify: `agendamento/index.html`
- Modify: `agendamento/js/main.js`
- Modify: `README.md`
- Modify: any existing site links that still point to the retired Base44 flow, only after locating them by search.

**Interfaces:**
- Consumes: todas as tarefas anteriores.
- Produces: único fluxo oficial de pré-anamnese no site BC.

- [ ] **Step 1: Procurar referências funcionais a Base44 no repositório**

Run: busca por `base44`, `anamnese-pro` e URL do app antigo.
Expected: identificar cada referência antes de alterar; preservar apenas documentação histórica quando útil.

- [ ] **Step 2: Executar suíte completa**

Run: `npm run test:frontend && deno test supabase/functions/submit-pre-anamnese/*_test.ts`
Expected: PASS.

- [ ] **Step 3: Executar fluxo end-to-end manual**

Cenários: preenchimento novo; reload e retomada; pergunta condicional; voltar e corrigir; assinatura; duplo toque em Finalizar; falha/retry de rede; download; compartilhar em Android quando suportado; abertura da mesma ficha no admin; alteração de status; download administrativo.

- [ ] **Step 4: Verificar regressões do site BC**

Checar menu, header, footer, logo, WhatsApp, páginas Procedimentos/Resultados/Protocolos e comportamento mobile.

- [ ] **Step 5: Atualizar README com arquitetura operacional**

Documentar: frontend GitHub Pages; backend Supabase; função `submit-pre-anamnese`; buckets privados; rota `/admin/`; onde trocar `config.js`; como rodar testes.

- [ ] **Step 6: Criar checkpoint/release conhecida como boa**

Registrar commit final e, se o executor estiver usando branch de trabalho, abrir PR para revisão antes de merge.

- [ ] **Step 7: Commit**

```bash
git add agendamento admin README.md
git commit -m "feat: complete native BC pre-anamnesis flow"
```

---

## Self-Review

- **Spec coverage:** banco, autenticação, storage privado, Edge Function, draft local, condicionais, revisão, assinatura, PDF, download/compartilhamento, admin e corte do Base44 estão cobertos.
- **Step scan:** cada tarefa termina em um resultado testável e commit; criação de projeto/custo Supabase ficou explicitamente como ação de execução porque depende da escolha/autorização do usuário.
- **Type consistency:** frontend envia o contrato `{patient, procedure, answers, consents, signatureDataUrl, sourceVersion, submissionToken}` e o backend devolve `{id, publicCode, createdAt, pdfUrl, pdfExpiresAt}` em todas as tarefas.
- **Review Focus:** duplo envio, Unicode, perda de rede, assinatura touch e acesso público indevido têm testes ou verificações atribuídas às tarefas responsáveis.
- **Proportion:** o plano define interfaces, testes e decisões críticas sem transcrever a implementação.