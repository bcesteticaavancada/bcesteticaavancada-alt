# BC Gestão 1.0 — Fase Zero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolar o desenvolvimento do BC Gestão em uma branch dedicada, registrar um baseline verificável do site atual e provar que nenhuma mudança operacional do BC Gestão atingiu o site público ou a área `/admin/` de pré-anamnese.

**Architecture:** A Fase 0 não cria telas, banco novo nem integrações. Ela cria uma fronteira de trabalho reversível: `main` permanece como fonte do site público; `feature/bc-gestao-1` nasce do HEAD aprovado no momento da execução; um manifesto de baseline registra SHA, páginas críticas e regras de não alteração. O BC Gestão só começa a ser implementado na branch dedicada depois dessa validação.

**Tech Stack:** GitHub, Git branches, GitHub Pages, documentação Markdown, verificações read-only do repositório.

**Spec:** `docs/superpowers/specs/2026-10-08-bc-gestao-design.md`

## Global Constraints

- Site público continua no GitHub Pages.
- `/admin/` existente da pré-anamnese permanece intacto nesta fase.
- Nenhuma tabela do Supabase é criada, alterada ou removida na Fase 0.
- Nenhum segredo, senha ou chave privilegiada é adicionado ao GitHub.
- Nenhuma implementação do BC Gestão ocorre diretamente em `main`.
- Nenhuma migração destrutiva é executada.
- O baseline de execução é sempre o HEAD real de `main` imediatamente antes da criação da branch, não um SHA antigo copiado de conversa.
- Rollback de código deve ser possível pela referência explícita do baseline.

## Review Focus

- `main` pode avançar entre planejamento e execução: a branch deve nascer do HEAD real lido imediatamente antes de `create_branch`.
- Uma branch `feature/bc-gestao-1` pode já existir: não sobrescrever nem mover silenciosamente uma branch existente; parar e comparar o head antes de qualquer ação.
- `/admin/` pode sofrer alterações paralelas: registrar os SHAs dos três arquivos atuais antes do desenvolvimento para detectar mudanças futuras.
- O workflow de Pages publica `main`: confirmar que criar/alterar a branch de trabalho não muda o branch publicado.
- Documentação não pode conter dados pessoais, credenciais ou conteúdo clínico real.

---

### Task 1: Congelar o baseline de execução

**Files:**
- Read: branch `main`
- Read: `.github/workflows/pages.yml`
- Read: `admin/index.html`
- Read: `admin/admin.js`
- Read: `admin/admin.css`
- Create later on branch: `docs/bc-gestao/phase-0-baseline.md`

**Interfaces:**
- Consumes: HEAD atual de `main` e SHAs dos arquivos críticos.
- Produces: `BASELINE_SHA`, `ADMIN_INDEX_SHA`, `ADMIN_JS_SHA`, `ADMIN_CSS_SHA`, confirmação de que Pages publica `main`.

- [ ] **Step 1: Ler o HEAD atual de `main`**

Usar a API de branch do GitHub imediatamente antes da criação da branch e capturar o SHA completo como `BASELINE_SHA`.

- [ ] **Step 2: Verificar o workflow de Pages**

Confirmar em `.github/workflows/pages.yml` que o gatilho de publicação continua limitado a `push` em `main` e que o conteúdo publicado vem do checkout do repositório.

- [ ] **Step 3: Registrar os SHAs da área administrativa atual**

Ler `admin/index.html`, `admin/admin.js` e `admin/admin.css` no `main` e guardar seus blob SHAs como referência de não regressão.

- [ ] **Step 4: Verificar ausência de mudança operacional nesta task**

Esperado: nenhum arquivo de runtime alterado e nenhuma ação em Supabase/Vercel.

---

### Task 2: Criar a branch isolada do BC Gestão

**Files:**
- Branch create: `feature/bc-gestao-1`

**Interfaces:**
- Consumes: `BASELINE_SHA` da Task 1.
- Produces: branch `feature/bc-gestao-1` apontando inicialmente exatamente para `BASELINE_SHA`.

- [ ] **Step 1: Consultar se `feature/bc-gestao-1` já existe**

Se existir, comparar o head com `BASELINE_SHA`. Não sobrescrever. Parar para revisão se os SHAs diferirem.

- [ ] **Step 2: Criar `feature/bc-gestao-1` a partir de `BASELINE_SHA`**

Usar criação de branch por SHA exato, não por nome de branch mutável.

- [ ] **Step 3: Verificar a branch recém-criada**

Esperado: head de `feature/bc-gestao-1` = `BASELINE_SHA` antes de qualquer commit próprio.

- [ ] **Step 4: Verificar `main`**

Esperado: o HEAD de `main` continua sendo `BASELINE_SHA` neste ponto; se outro processo legítimo tiver avançado `main`, registrar o novo SHA e não tentar voltar o branch.

---

### Task 3: Criar manifesto de baseline na branch de trabalho

**Files:**
- Create: `docs/bc-gestao/phase-0-baseline.md` on `feature/bc-gestao-1`

**Interfaces:**
- Consumes: `BASELINE_SHA`, SHAs de `/admin`, regra de Pages e spec aprovada.
- Produces: documento operacional de rollback e fronteiras da Fase 0.

- [ ] **Step 1: Criar o manifesto com os valores verificados**

O documento deve conter exatamente:
- data da Fase 0;
- `BASELINE_SHA`;
- branch de trabalho `feature/bc-gestao-1`;
- SHAs de `admin/index.html`, `admin/admin.js`, `admin/admin.css`;
- confirmação de que `/admin/` permanece reservado à pré-anamnese nesta fase;
- confirmação de que nenhuma tabela Supabase foi alterada;
- confirmação de que o site público continua vindo de `main`;
- procedimento de rollback: retornar o código de integração futura ao baseline ou reverter commits de integração, sem apagar dados como rollback.

- [ ] **Step 2: Verificar que o manifesto não contém segredos ou dados pessoais**

Esperado: nenhum e-mail de paciente, CPF, telefone, senha, token, `service_role`, chave privada ou resposta clínica real.

- [ ] **Step 3: Commitar apenas o manifesto na branch de trabalho**

Commit esperado: `docs: registra baseline da fase zero do BC Gestão`.

- [ ] **Step 4: Comparar `main...feature/bc-gestao-1`**

Esperado: diferença restrita ao manifesto de baseline; nenhum HTML/CSS/JS operacional modificado.

---

### Task 4: Gate de conclusão da Fase 0

**Files:**
- Read-only verification of `main`, `feature/bc-gestao-1`, `/admin/`, workflow Pages.

**Interfaces:**
- Consumes: branch e manifesto criados nas Tasks 1–3.
- Produces: evidência de que a Fase 1 pode começar sem risco conhecido ao site atual.

- [ ] **Step 1: Revalidar `/admin/` no `main`**

Esperado: blob SHAs iguais aos registrados na Task 1, exceto se houver uma alteração paralela legítima ocorrida durante a execução; qualquer diferença deve ser reportada antes de avançar.

- [ ] **Step 2: Revalidar publicação**

Esperado: workflow de Pages ainda direcionado a `main`; branch `feature/bc-gestao-1` não é fonte de deploy do site público.

- [ ] **Step 3: Confirmar que nenhuma ação de banco foi executada**

Esperado: Fase 0 terminou sem SQL, migrations, alterações de RLS, criação de usuários ou escrita em dados de produção.

- [ ] **Step 4: Registrar resultado da Fase 0**

Resultado esperado para prosseguir: branch isolada criada, baseline documentado, site público intocado e `/admin/` preservado.

## Self-review

- **Spec coverage:** este plano cobre exclusivamente a Fase 0 aprovada; Auth, banco, agenda, histórico e financeiro permanecem para planos posteriores.
- **Step scan:** cada etapa produz uma evidência verificável e evita escrita operacional no site atual.
- **Type consistency:** os identificadores `BASELINE_SHA`, `ADMIN_INDEX_SHA`, `ADMIN_JS_SHA` e `ADMIN_CSS_SHA` são definidos na Task 1 e reutilizados sem renomeação.
- **Review Focus:** os cinco riscos principais estão ligados às Tasks 1–4.
- **Proportion:** o plano é restrito ao isolamento e rollback; não antecipa implementação do BC Gestão.
