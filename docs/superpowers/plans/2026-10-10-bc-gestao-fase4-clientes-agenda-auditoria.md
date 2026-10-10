# BC Gestão Fase 4 — Clientes Compartilhados, Agenda Individual e Auditoria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o BC Gestão para clientes compartilhados pela clínica, histórico unificado, agenda individual por profissional, Mel como admin e profissional atendente, e auditoria automática de mudanças críticas.

**Architecture:** O frontend continua estático em `gestao/`, usando Supabase JS v2 com chave publishable. A autoridade de segurança permanece no PostgreSQL por RLS/RPC; clientes e histórico tornam-se recursos da equipe ativa, enquanto escrita de agenda continua limitada à própria profissional ou à Mel/admin. Auditoria é gerada no banco a partir de `auth.uid()`, sem confiar no browser para autoria.

**Tech Stack:** HTML/CSS/ES modules, Supabase JS v2, PostgreSQL 17, Supabase Auth/RLS/RPC, Node 22 test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-10-bc-gestao-fase4-clientes-agenda-auditoria-design.md`

## Global Constraints

- Usar somente o projeto Supabase `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Não modificar o `/admin/` legado da pré-anamnese.
- `service_role` nunca entra no navegador, GitHub ou arquivos públicos.
- RLS/RPC são a autoridade real de segurança; esconder botão no frontend não conta como proteção.
- Clientes pertencem à BC Estética e ficam acessíveis à equipe ativa autenticada.
- Colaboradora pode criar/editar cliente, mas nunca arquivar, desativar ou excluir cliente.
- Colaboradora opera somente a própria agenda; Mel/admin opera todas as agendas e também possui agenda própria.
- Histórico de atendimentos é compartilhado para a equipe ativa; escrita de atendimento continua vinculada à agenda própria ou ao admin.
- Financeiro continua exclusivo da Mel e fora do escopo funcional desta fase.
- Auditoria deve derivar o ator de `auth.uid()` e não pode ser editável/apagável por colaboradoras.
- Nenhum paciente real deve ser criado ou alterado durante testes técnicos; usar somente dados fictícios de homologação já autorizados.
- Horários continuam exibidos em `America/Sao_Paulo`.
- Mudanças de banco devem ser aditivas/forward-safe e passar pelo Security Advisor após aplicação.

## Review Focus

- **Duplo cadastro de cliente:** busca/edição deve favorecer cadastro único; testes garantem que a UI não cria duplicata por reenvio acidental depois de sucesso.
- **Escalada de agenda:** colaboradora jamais pode criar/mover/cancelar agendamento de outra profissional; testes de RPC/RLS devem rejeitar explicitamente.
- **Arquivamento concorrente:** cliente arquivado por Mel não pode continuar selecionável para novo agendamento de colaboradora; testes cobrem filtro `ativo = true`.
- **Auditoria incompleta:** operações críticas devem registrar ator, entidade, ação e antes/depois sem depender de payload de autoria do browser.
- **Mel como admin atendente:** `role = admin` não pode impedir que Mel apareça no diretório clínico nem receba agendamento próprio.

---

### Task 1: Criar o contrato de banco da Fase 4 e a auditoria imutável

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase4_shared_clients_audit.sql`
- Create: `tests/gestao/phase4-database-contract.test.mjs`

**Interfaces:**
- Consumes: `staff_profiles`, `clientes`, `procedimentos`, `agendamentos`, `atendimentos`, `pagamentos`, helpers `private.is_bc_admin()` e `private.is_bc_active_colaborador()`.
- Produces:
  - coluna `staff_profiles.atende_clientes boolean not null default false`;
  - colunas `clientes.ativo boolean not null default true`, `arquivado_at timestamptz null`, `arquivado_by uuid null`;
  - tabela `audit_log(id uuid, actor_user_id uuid, action text, entity_type text, entity_id uuid, old_data jsonb, new_data jsonb, created_at timestamptz)`;
  - RPC `public.bc_cliente_create(p_nome text, p_telefone text, p_email text default null) returns uuid`;
  - RPC `public.bc_cliente_update(p_cliente_id uuid, p_nome text, p_telefone text, p_email text default null) returns uuid`;
  - RPC `public.bc_cliente_set_active(p_cliente_id uuid, p_active boolean) returns uuid` admin-only;
  - RPC `public.bc_agendamento_create(p_cliente_id uuid, p_colaboradora_user_id uuid, p_procedimento_id uuid, p_inicio timestamptz, p_fim timestamptz default null, p_observacao text default null) returns uuid`;
  - RPC `public.bc_agendamento_update(p_agendamento_id uuid, p_procedimento_id uuid, p_inicio timestamptz, p_fim timestamptz default null, p_observacao text default null) returns uuid`;
  - `public.bc_staff_directory()` passando a retornar todo perfil ativo com `atende_clientes = true`, inclusive admin;
  - auditoria automática para cliente criado/editado/arquivado/reativado, agendamento criado/alterado/status e atendimento criado.

- [ ] **Step 1: Write the failing database contract tests**

Cobrir por regex/contrato:
- `atende_clientes`, `clientes.ativo`, `arquivado_at`, `arquivado_by`;
- `audit_log` com RLS e sem `UPDATE/DELETE` para `authenticated`;
- RPCs com wrapper público `security invoker`, implementação privada `security definer`, `search_path` fixo e grants apenas para `authenticated`;
- colaboradora em `bc_agendamento_create/update` obrigada a usar `auth.uid()` como profissional; admin pode escolher qualquer profissional atendente;
- `bc_cliente_set_active` rejeitando não-admin;
- `bc_staff_directory` filtrando `active = true and atende_clientes = true`, sem filtrar `role = 'colaborador'`;
- `atendimentos` SELECT para equipe ativa e INSERT ainda restrito ao atendimento próprio/admin;
- `pagamentos` permanecendo admin-only;
- trigger/auditoria derivando `actor_user_id` de `auth.uid()`.

- [ ] **Step 2: Run the new contract test and verify RED**

Run: `npm run test:gestao`
Expected: FAIL porque a migration da Fase 4 ainda não existe.

- [ ] **Step 3: Implement the additive migration**

Usar RPCs para escrita de cliente/agendamento e triggers para auditoria. Em `audit_log`, guardar apenas campos operacionais necessários; para `atendimento_created`, registrar IDs/metadados, não duplicar todo o texto clínico no log.

- [ ] **Step 4: Run tests and verify GREEN before touching production**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 5: Apply exactly the versioned migration to `bc-estetica-gestao`**

Aplicar a mesma migration versionada ao projeto `tpqsmerlxquyrzrjbogj`; marcar perfis ativos atuais de atendimento como `atende_clientes = true`, incluindo Mel e Alice, sem criar novos usuários.

- [ ] **Step 6: Verify catalog and Security Advisor**

Confirmar policies, signatures/grants, `audit_log` imutável para colaboradora e Security Advisor sem nova vulnerabilidade crítica.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase4_shared_clients_audit.sql tests/gestao/phase4-database-contract.test.mjs
git commit -m "feat: adiciona clientes compartilhados e auditoria"
```

---

### Task 2: Separar APIs de clientes e ampliar a API de agenda com escrita segura

**Files:**
- Create: `gestao/js/clientes-api.js`
- Create: `gestao/js/audit-api.js`
- Modify: `gestao/js/agenda-api.js`
- Create: `tests/gestao/clientes-api.test.mjs`
- Create: `tests/gestao/audit-api.test.mjs`
- Modify: `tests/gestao/agenda-api.test.mjs`

**Interfaces:**
- Produces `clientes-api.js`:
  - `listClients({ client, search = '', includeArchived = false }) -> Promise<Array>`;
  - `getClient({ client, clienteId }) -> Promise<object>`;
  - `createClient({ client, nome, telefone, email }) -> Promise<string>`;
  - `updateClient({ client, clienteId, nome, telefone, email }) -> Promise<string>`;
  - `setClientActive({ client, clienteId, active }) -> Promise<string>`;
  - `listClientHistory({ client, clienteId }) -> Promise<Array>`.
- Produces `audit-api.js`:
  - `listAuditLog({ client, limit = 100, entityType = null, entityId = null }) -> Promise<Array>`.
- Updates `agenda-api.js`:
  - manter `listOwnAppointments`, `listAdminAppointments`, `listActiveProcedures`, `listStaffDirectory`, `registerAttendance`;
  - `createAppointment({ client, clienteId, colaboradoraUserId, procedimentoId, inicioIso, fimIso, observacao }) -> Promise<string>` via `bc_agendamento_create`;
  - `updateAppointment({ client, appointmentId, procedimentoId, inicioIso, fimIso, observacao }) -> Promise<string>` via `bc_agendamento_update`;
  - remover dependência de `createdBy` vindo do browser.

- [ ] **Step 1: Write failing client API tests**

Exigir filtro de ativos por padrão, busca por nome, inclusão opcional de arquivados apenas quando solicitada, RPCs de create/update/archive e histórico completo por `cliente_id`.

- [ ] **Step 2: Write failing agenda/audit API tests**

Exigir `createAppointment/updateAppointment` via RPC sem `created_by` enviado pelo browser; `listStaffDirectory` continua por RPC; `listAuditLog` usa leitura admin e filtros opcionais.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL nos novos módulos/contratos.

- [ ] **Step 4: Implement the minimal data modules**

Não renderizar HTML nesses módulos. Erros Supabase devem virar exceções legíveis; nenhuma função pode afirmar sucesso se a RPC/query falhar.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gestao/js/clientes-api.js gestao/js/audit-api.js gestao/js/agenda-api.js tests/gestao/clientes-api.test.mjs tests/gestao/audit-api.test.mjs tests/gestao/agenda-api.test.mjs
git commit -m "feat: adiciona APIs seguras de clientes agenda e auditoria"
```

---

### Task 3: Criar painel compartilhado de clientes e histórico unificado

**Files:**
- Create: `gestao/js/clientes-panel.js`
- Create: `tests/gestao/clientes-panel.test.mjs`
- Modify: `gestao/assets/gestao.css`

**Interfaces:**
- Consumes: `listClients`, `getClient`, `createClient`, `updateClient`, `setClientActive`, `listClientHistory`, `listStaffDirectory`, `formatClinicDateTime`.
- Produces:
  - `initClientesPanel({ client, profile, root, canArchive = false }) -> Promise<{ refreshClients, openClient }>`;
  - markup esperado por IDs compartilhados: `clientsSearch`, `clientsList`, `clientCreateForm`, `clientEditor`, `clientHistoryTimeline`;
  - botão de arquivar/reativar somente quando `canArchive === true`.

- [ ] **Step 1: Write failing panel tests**

Cobrir busca, criação, edição, abertura de histórico de cliente atendido por outra profissional, manutenção do formulário em falha de rede e ausência total de ação de arquivar para colaboradora.

- [ ] **Step 2: Add the review-focus duplicate-submit test**

Exigir que, depois de sucesso confirmado, o botão fique protegido durante envio e o formulário só seja limpo uma vez; em erro, campos permanecem intactos.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL porque o painel compartilhado ainda não existe.

- [ ] **Step 4: Implement `initClientesPanel` and focused styles**

Reutilizar a estética atual do BC Gestão; não reestruturar o CSS global do site institucional.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gestao/js/clientes-panel.js gestao/assets/gestao.css tests/gestao/clientes-panel.test.mjs
git commit -m "feat: adiciona clientes compartilhados e historico unificado"
```

---

### Task 4: Evoluir a área da colaboradora para clientes globais e agenda própria editável

**Files:**
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/js/colaborador-agenda.js`
- Modify: `tests/gestao/colaborador-agenda.test.mjs`
- Create: `tests/gestao/colaborador-clientes-integration.test.mjs`

**Interfaces:**
- Consumes: `initClientesPanel`, `listOwnAppointments`, `createAppointment`, `updateAppointment`, `setAppointmentStatus`, `listActiveProcedures`, `formatClinicDateTime`.
- Produces:
  - navegação **Minha agenda** e **Clientes**;
  - formulário de novo agendamento sem seletor de profissional: usa sempre `profile.user_id`;
  - edição de procedimento/horário/observação somente de agendamento próprio;
  - detalhe do atendimento preservando o formulário clínico atual;
  - painel compartilhado de clientes com `canArchive = false`.

- [ ] **Step 1: Write failing collaborator integration tests**

Exigir que colaboradora consiga listar/criar/editar cliente e abrir histórico global, sem botão de arquivar e sem qualquer chamada de financeiro.

- [ ] **Step 2: Write failing own-agenda mutation tests**

Exigir criação e edição de agendamento usando `profile.user_id`; nenhum controle permite escolher outra profissional; cancelamento/falta continuam via RPC segura.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL nas novas estruturas/fluxos.

- [ ] **Step 4: Implement the collaborator UI changes**

Substituir textos “histórico autorizado/vinculado” por linguagem de histórico da clínica. Integrar `initClientesPanel({ canArchive: false })` e manter o registro de atendimento existente.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS, incluindo rejeições simuladas de agenda alheia.

- [ ] **Step 6: Commit**

```bash
git add gestao/colaborador/index.html gestao/js/colaborador-agenda.js tests/gestao/colaborador-agenda.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs
git commit -m "feat: amplia area da colaboradora com clientes globais"
```

---

### Task 5: Evoluir o painel da Mel para agenda geral, agenda própria, clientes e auditoria

**Files:**
- Modify: `gestao/admin/index.html`
- Modify: `gestao/js/admin-agenda.js`
- Create: `gestao/js/admin-audit.js`
- Modify: `tests/gestao/admin-agenda.test.mjs`
- Create: `tests/gestao/admin-audit.test.mjs`

**Interfaces:**
- Consumes: `initClientesPanel({ canArchive: true })`, `listAdminAppointments`, `listStaffDirectory`, `createAppointment`, `updateAppointment`, `setAppointmentStatus`, `listAuditLog`.
- Produces:
  - filtro `adminAgendaProfessionalFilter` com “Todas” + profissionais atendentes, incluindo Mel;
  - criação/edição de agendamento para qualquer profissional atendente;
  - visão da agenda própria da Mel por filtro do próprio `user_id`;
  - clientes compartilhados com arquivar/reativar disponível apenas no admin;
  - seção `#auditoria` com filtros básicos e lista somente leitura.

- [ ] **Step 1: Write failing Mel-as-provider tests**

Exigir que o diretório renderize Mel entre profissionais, que o filtro aceite “Todas” e Mel, e que novo agendamento possa ser atribuído à Mel.

- [ ] **Step 2: Write failing admin client/audit tests**

Exigir `canArchive = true`, ação de arquivar/reativar e auditoria mostrando ator, ação, entidade e data sem controles de edição/exclusão.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL.

- [ ] **Step 4: Implement admin agenda/client/audit wiring**

Manter o módulo financeiro apenas como área reservada; nenhuma consulta a `pagamentos` é adicionada nesta fase.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gestao/admin/index.html gestao/js/admin-agenda.js gestao/js/admin-audit.js tests/gestao/admin-agenda.test.mjs tests/gestao/admin-audit.test.mjs
git commit -m "feat: amplia painel da Mel com agenda e auditoria"
```

---

### Task 6: Homologar permissões reais, regressão e publicação

**Files:**
- Modify only if a regression test exposes a real defect: files from Tasks 1–5.
- Test: existing `tests/gestao/*.test.mjs`, `tests/site/*.test.mjs`, `tests/anamnese/*.test.mjs`.

**Interfaces:**
- Consumes: Fase 4 completa no branch e migration aplicada no projeto `bc-estetica-gestao`.
- Produces: evidência de segurança/funcionamento pronta para merge/publicação.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`
Expected: PASS em frontend, site e BC Gestão.

- [ ] **Step 2: Verify production-role behavior with existing non-real data**

Validar com Alice (`colaborador`) e Mel (`admin`) sem criar paciente real:
- Alice vê todos os clientes ativos e histórico compartilhado;
- Alice não arquiva cliente nem altera agenda alheia;
- Alice cria/edita apenas agenda própria;
- Mel aparece como profissional atendente e administra qualquer agenda;
- Mel consegue arquivar/reativar cliente;
- financeiro segue invisível à Alice.

- [ ] **Step 3: Verify audit records**

Usar apenas o cenário fictício de homologação para confirmar criação/edição/status gerando `audit_log` com ator correto; não apagar logs para “limpar” teste.

- [ ] **Step 4: Re-run Security Advisor**

Expected: nenhuma nova vulnerabilidade crítica; corrigir qualquer regressão antes do merge.

- [ ] **Step 5: Verify auth regressions**

Confirmar login e recuperação de senha continuam funcionando, inclusive rotas `/gestao/recuperar-senha/` e `/gestao/redefinir-senha/`; não alterar credenciais de usuários durante esta tarefa.

- [ ] **Step 6: Final branch verification and commit if fixes were needed**

Run: `npm test`
Expected: PASS final.

- [ ] **Step 7: Open PR / merge only after review**

PR deve resumir: clientes compartilhados, agenda individual, Mel como profissional/admin, auditoria, RLS/RPC, testes e Security Advisor. Após merge, verificar uma única execução de CI e Pages; não entrar em polling repetitivo.
