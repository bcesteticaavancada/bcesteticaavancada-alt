# BC Gestão — Fase 2 Banco e Autenticação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a fundação real do BC Gestão no projeto Supabase isolado, com esquema de dados, RLS, autenticação por papel e integração segura do frontend sem tocar no site público nem na pré-anamnese.

**Architecture:** O projeto `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`, `sa-east-1`) será o único backend desta fase. O banco PostgreSQL aplica permissões via RLS; o frontend usa somente URL e chave publishable, identifica o `staff_profiles.role` após login e roteia para `/gestao/admin/` ou `/gestao/colaborador/`. Nenhuma `service_role` entra no GitHub ou no navegador.

**Tech Stack:** Supabase Auth, PostgreSQL 17, Row Level Security, HTML/CSS/JavaScript ES modules, Node `node:test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-bc-gestao-design.md`

## Global Constraints

- O site público continua em GitHub Pages a partir de `main`.
- Todo trabalho permanece em `feature/bc-gestao-1` até revisão.
- O `/admin/` existente da pré-anamnese permanece intocado.
- O projeto Supabase `bc-estetica-pre-anamnese` não recebe migrations desta fase.
- Financeiro é exclusivo do papel `admin`.
- Colaboradora nunca recebe permissão de leitura em `pagamentos`.
- Histórico clínico/operacional fica em `atendimentos`, separado do financeiro.
- Senhas são gerenciadas somente pelo Supabase Auth.
- `service_role` nunca entra em JavaScript público, GitHub ou configuração entregue ao navegador.
- Nenhuma migration destrutiva é permitida nesta fase.

## Review Focus

- Usuário autenticado sem `staff_profiles` ativo deve ser negado e não roteado para painel.
- `role` desconhecido deve falhar fechado e voltar ao login.
- Colaboradora não pode ler agenda de outra colaboradora nem pesquisar cliente sem vínculo.
- Colaboradora não pode consultar `pagamentos`, mesmo chamando a API manualmente.
- Histórico de um cliente só pode ser lido por colaboradora que possua vínculo autorizado via agendamento.

---

### Task 1: Contrato do banco versionado e teste RED

**Files:**
- Create: `supabase/migrations/20261009_bc_gestao_core.sql`
- Create: `tests/gestao/database-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: schema versionado para `staff_profiles`, `clientes`, `procedimentos`, `agendamentos`, `atendimentos`, `pagamentos`, helpers de autorização, triggers de `updated_at` e políticas RLS.

- [ ] **Step 1: Write the failing test**

Criar testes que exijam no arquivo de migration: as seis tabelas, `enable row level security` nas seis, helper de admin, políticas de colaboradora por vínculo e ausência de qualquer marcador `service_role`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:gestao`

Expected: FAIL porque a migration ainda não existe.

- [ ] **Step 3: Implement the migration file**

Criar somente DDL aditivo. Usar UUIDs, FKs para `auth.users(id)` onde aplicável, `created_at`/`updated_at`, constraints de status e índices para `cliente_id`, `colaboradora_user_id`, `inicio` e FKs de histórico/financeiro.

RLS mínimo:
- `staff_profiles`: usuário lê o próprio perfil; admin lê todos.
- `procedimentos`: autenticados podem ler; admin administra.
- `agendamentos`: admin administra todos; colaboradora lê apenas `colaboradora_user_id = auth.uid()`.
- `clientes`: admin administra; colaboradora lê somente cliente vinculado a algum agendamento dela.
- `atendimentos`: admin administra; colaboradora lê histórico do cliente apenas quando existe vínculo por agendamento; colaboradora insere/edita somente atendimento próprio ligado a agendamento atribuído a ela.
- `pagamentos`: somente admin possui políticas de acesso.

- [ ] **Step 4: Run tests**

Run: `npm run test:gestao`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: define schema seguro do BC Gestão`

---

### Task 2: Aplicar migration no Supabase isolado e verificar segurança

**Files:**
- No frontend files changed.
- Supabase target: `tpqsmerlxquyrzrjbogj` only.

**Interfaces:**
- Consumes: `supabase/migrations/20261009_bc_gestao_core.sql`.
- Produces: schema real no projeto `bc-estetica-gestao`.

- [ ] **Step 1: Verify target project before DDL**

Confirmar nome `bc-estetica-gestao`, região `sa-east-1`, status saudável e project id `tpqsmerlxquyrzrjbogj`.

- [ ] **Step 2: Apply migration**

Usar migration nomeada `bc_gestao_core` no projeto `tpqsmerlxquyrzrjbogj`.

- [ ] **Step 3: Verify tables and RLS from catalog**

Consultar `pg_tables`, `pg_class.relrowsecurity` e `pg_policies` para as seis tabelas.

Expected: seis tabelas presentes, RLS ligado em todas, nenhuma política de `pagamentos` para colaboradora.

- [ ] **Step 4: Run Supabase security advisors**

Expected: nenhum alerta crítico de tabela pública sem RLS. Qualquer alerta relevante deve ser corrigido antes de seguir.

- [ ] **Step 5: Record applied migration in project docs**

Criar `docs/bc-gestao/phase-2-database.md` com project id público, nome da migration, data e checklist de verificação. Não registrar chaves.

- [ ] **Step 6: Commit documentation**

Commit: `docs: registra banco da fase 2 do BC Gestão`

---

### Task 3: Configuração pública segura do Supabase no frontend

**Files:**
- Create: `gestao/js/config.js`
- Create: `gestao/js/supabase-client.js`
- Modify: `tests/gestao/foundation.test.mjs`
- Create: `tests/gestao/auth-routing.test.mjs`

**Interfaces:**
- Produces: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `getSupabaseClient()`.
- Constraint: apenas chave publishable; nenhum segredo privilegiado.

- [ ] **Step 1: Write failing tests**

Testar que `config.js` existe, aponta somente para o projeto `tpqsmerlxquyrzrjbogj`, não contém `service_role`, e que `supabase-client.js` exporta cliente único usando SDK oficial.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:gestao`

Expected: FAIL por arquivos ausentes.

- [ ] **Step 3: Fetch project URL and active publishable key from Supabase**

Usar somente chave publishable ativa. Não persistir nenhuma chave secreta.

- [ ] **Step 4: Implement minimal config/client**

Carregar SDK oficial do Supabase já aceito pelo projeto e expor um único cliente para os módulos do BC Gestão.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:gestao`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat: conecta BC Gestão ao Supabase isolado`

---

### Task 4: Login real e roteamento por papel

**Files:**
- Create: `gestao/js/auth.js`
- Modify: `gestao/js/routes.js`
- Modify: `gestao/login/index.html`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Modify: `tests/gestao/auth-routing.test.mjs`

**Interfaces:**
- Produces: `signIn(email, password)`, `signOut()`, `getCurrentProfile()`, `requireRole(role)`, `routeForRole(role)`.
- `routeForRole('admin') -> '../admin/'` a partir do login.
- `routeForRole('colaborador') -> '../colaborador/'`.
- Perfil ausente, inativo ou papel desconhecido -> logout/negação e retorno ao login.

- [ ] **Step 1: Write failing auth-routing tests**

Cobrir `admin`, `colaborador`, perfil inativo, perfil ausente e papel desconhecido.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:gestao`

Expected: FAIL nas funções ainda não implementadas.

- [ ] **Step 3: Implement auth module**

`signIn` usa `auth.signInWithPassword`; após sessão válida consulta somente `staff_profiles` do usuário atual. Nunca decide permissão a partir de e-mail hardcoded.

- [ ] **Step 4: Protect role pages**

`admin` exige `role=admin`; `colaborador` exige `role=colaborador`. Falha fechada em qualquer inconsistência.

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: suites de pré-anamnese, site e BC Gestão todas PASS.

- [ ] **Step 6: Commit**

Commit: `feat: adiciona login e roteamento por papel`

---

### Task 5: Gate final da Fase 2

**Files:**
- Verify only.

**Interfaces:**
- Confirma que a fundação está pronta para a Fase 3 (agenda real) sem publicar no site institucional.

- [ ] **Step 1: Verify branch isolation**

Comparar `main...feature/bc-gestao-1` e confirmar que `/admin/` legado, Home, Procedimentos e agendamento público não foram alterados nesta fase.

- [ ] **Step 2: Verify GitHub Pages isolation**

Confirmar `.github/workflows/pages.yml` ainda publica apenas `main`.

- [ ] **Step 3: Verify full CI**

Esperar GitHub Actions concluir `npm test` com sucesso no head da branch.

- [ ] **Step 4: Verify Supabase advisors again**

Executar advisors de segurança após todas as alterações de DDL.

- [ ] **Step 5: Stop before real staff enrollment**

Não criar usuários reais nem inserir dados de clientes nesta fase sem os e-mails/identidades fornecidos explicitamente. A criação de perfis reais ocorrerá depois do Auth user correspondente existir.

## Self-Review

- Spec coverage: esquema, Auth, role routing, RLS, isolamento, financeiro exclusivo e histórico por vínculo estão cobertos.
- Destructive changes: nenhuma operação de drop/delete/truncate incluída.
- Type consistency: `role` usa apenas `admin` e `colaborador`; status seguem a especificação.
- Review focus: todos os cinco cenários têm teste ou verificação explícita.
- Proportion: o plano limita a Fase 2 a banco + Auth; agenda, financeiro operacional e dashboard permanecem para fases posteriores.
