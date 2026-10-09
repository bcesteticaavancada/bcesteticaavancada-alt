# BC Gestão Fase 3 — Agenda e Atendimento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar os painéis já autenticados do BC Gestão em uma agenda operacional real, com criação administrativa de clientes/procedimentos/agendamentos, agenda individual da colaboradora, histórico autorizado e registro transacional do atendimento.

**Architecture:** O frontend continua estático e isolado em `gestao/`, usando Supabase JS com a chave publishable já configurada. Leituras e cadastros administrativos usam as tabelas existentes sob RLS; operações que exigem consistência entre múltiplas tabelas ou limitação de campos viram RPCs SQL pequenas, com `SECURITY DEFINER`, `search_path` fixo, validação explícita de papel/vínculo e grants mínimos. O financeiro permanece completamente fora desta fase.

**Tech Stack:** HTML/CSS/ES modules, Supabase JS v2, PostgreSQL 17, Supabase Auth/RLS/RPC, Node 22 test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-bc-gestao-design.md`

## Global Constraints

- Trabalhar somente em `feature/bc-gestao-1`; não alterar `main` durante a implementação.
- Não modificar o `/admin/` legado da pré-anamnese.
- Usar apenas o projeto Supabase `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- `service_role` nunca entra no navegador, GitHub ou arquivos públicos.
- RLS/RPC devem ser a autoridade de segurança; a interface é apenas uma camada de UX.
- Colaboradora vê somente agenda própria e histórico autorizado por vínculo; financeiro continua invisível.
- Mel/admin pode administrar agenda, clientes e procedimentos.
- Histórico clínico/operacional permanece separado de `pagamentos`.
- Nenhuma foto clínica, anamnese completa, prescrição ou documento médico entra nesta fase.
- Não cadastrar usuário, cliente ou paciente real como parte da implementação técnica; testes usam contratos/mocks e o banco continua sem dados reais até autorização específica.
- Horários devem ser apresentados em `America/Sao_Paulo` e não depender do timezone do dispositivo para exibição.
- Toda mudança de banco deve ser aditiva/forward-safe e passar pelo Security Advisor depois da aplicação.

## Review Focus

- **Timezone:** um horário salvo em `timestamptz` deve aparecer no painel no horário de Belo Horizonte/São Paulo, mesmo se o navegador estiver em outro fuso. O teste entra na Task 2.
- **Duplo clique/reenvio:** registrar atendimento duas vezes não pode gerar duas sessões nem mudar status de forma inconsistente. O teste entra na Task 1 e Task 5.
- **Agendamento cancelado/falta:** não deve aceitar registro clínico como se tivesse sido atendido. O teste entra na Task 1.
- **Falha de rede:** a UI deve manter o formulário preenchido e mostrar erro, sem afirmar sucesso. O teste entra na Task 5.
- **Base vazia:** painéis devem mostrar estados vazios úteis para agenda/clientes/procedimentos sem quebrar. Os testes entram nas Tasks 3 e 4.

---

### Task 1: Endurecer o contrato do banco para agenda e registro transacional

**Files:**
- Create: `supabase/migrations/20261009_bc_gestao_phase3_agenda_atendimento.sql`
- Create: `tests/gestao/phase3-database-contract.test.mjs`

**Interfaces:**
- Consumes: tabelas `staff_profiles`, `clientes`, `procedimentos`, `agendamentos`, `atendimentos`; helpers privados `private.is_bc_admin()` e `private.is_bc_active_colaborador()`.
- Produces:
  - RPC `public.bc_set_agendamento_status(p_agendamento_id uuid, p_status text)` retornando `uuid`.
  - RPC `public.bc_registrar_atendimento(p_agendamento_id uuid, p_queixa_objetivo text, p_observacoes text, p_reacoes text, p_intercorrencias text, p_feedback_cliente text, p_orientacoes text, p_recomendacao_proxima_sessao text)` retornando `uuid`.
  - RPC `public.bc_staff_directory()` retornando apenas `user_id uuid, display_name text` de profissionais ativos para equipe ativa autenticada.
  - Índice composto `agendamentos(colaboradora_user_id, inicio)` e índice de histórico `atendimentos(cliente_id, data_atendimento desc)`.

- [ ] **Step 1: Write the failing database contract tests**

Adicionar testes que exijam:
- RPCs com `security definer` e `search_path` fixo;
- `bc_set_agendamento_status` aceitando apenas `agendado|atendido|cancelado|faltou` e validando admin ou vínculo da colaboradora;
- `bc_registrar_atendimento` derivando `cliente_id`, `procedimento_id` e `colaboradora_user_id` do próprio agendamento, nunca de parâmetros do browser;
- rejeição de atendimento para `cancelado` ou `faltou`;
- prevenção de duplicidade por `agendamento_id`;
- insert de atendimento e mudança para `atendido` dentro da mesma função/transação;
- remoção da policy `atendimentos_colaborador_update_proprio`, deixando a colaboradora sem edição silenciosa de sessões já salvas;
- `bc_staff_directory` expondo somente identificador e nome de profissionais ativos;
- grants apenas para `authenticated`, nunca `anon`.

- [ ] **Step 2: Run the new tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL porque a migration da Fase 3 ainda não existe.

- [ ] **Step 3: Implement the additive migration**

A migration deve:
- criar os dois índices;
- remover `atendimentos_colaborador_update_proprio` se existir;
- criar as três RPCs com validação explícita de `auth.uid()`;
- manter admin com as policies de tabela já existentes;
- impedir colaboradora de trocar cliente/procedimento/profissional via parâmetros;
- revogar `EXECUTE` de `PUBLIC` e `anon`, concedendo apenas a `authenticated`.

- [ ] **Step 4: Run tests and verify GREEN before touching Supabase**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 5: Apply exactly the versioned migration to `bc-estetica-gestao`**

Depois da aplicação, verificar no catálogo as assinaturas/policies e executar Security Advisor `security`.
Expected: migration aplicada, RPCs presentes e `lints: []`.

- [ ] **Step 6: Commit**

Commit message: `feat: adiciona contrato seguro de agenda e atendimento`

---

### Task 2: Criar camada compartilhada de agenda, histórico e formatação

**Files:**
- Create: `gestao/js/agenda-api.js`
- Create: `gestao/js/agenda-format.js`
- Create: `tests/gestao/agenda-api.test.mjs`
- Create: `tests/gestao/agenda-format.test.mjs`

**Interfaces:**
- Consumes: `createBcGestaoClient()` de `gestao/js/supabase-client.js`; perfil retornado por `requireRole()`; RPCs da Task 1.
- Produces:
  - `listOwnAppointments({ client, userId, fromIso, toIso }) -> Promise<Array>`
  - `listAdminAppointments({ client, fromIso, toIso }) -> Promise<Array>`
  - `listAdminClients({ client, search }) -> Promise<Array>`
  - `createClient({ client, nome, telefone, email, createdBy }) -> Promise<object>`
  - `listActiveProcedures({ client }) -> Promise<Array>`
  - `createProcedure({ client, nome, duracaoPadrao, createdBy }) -> Promise<object>`
  - `listActiveCollaborators({ client }) -> Promise<Array>`
  - `createAppointment({ client, clienteId, colaboradoraUserId, procedimentoId, inicioIso, fimIso, observacao, createdBy }) -> Promise<object>`
  - `setAppointmentStatus({ client, appointmentId, status }) -> Promise<string>`
  - `listAuthorizedHistory({ client, clienteId }) -> Promise<Array>`
  - `listStaffDirectory({ client }) -> Promise<Array>`
  - `registerAttendance({ client, appointmentId, fields }) -> Promise<string>`
  - `formatClinicDateTime(iso) -> string` usando `America/Sao_Paulo`.
  - `clinicDayRange(date = new Date()) -> { fromIso, toIso }` delimitando o dia da clínica.
  - `statusLabel(status) -> string`.

- [ ] **Step 1: Write failing API tests with injected Supabase doubles**

Cobrir joins permitidos (`clientes`, `procedimentos`), filtros de período, filtro explícito da colaboradora por `userId`, estados de erro e chamadas RPC com payload mínimo.

- [ ] **Step 2: Write failing timezone/format tests**

Fixar casos em que UTC cai no dia seguinte e confirmar que a apresentação continua no dia/hora de `America/Sao_Paulo`.

- [ ] **Step 3: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL porque os módulos ainda não existem.

- [ ] **Step 4: Implement the minimal shared modules**

Não renderizar HTML nesses módulos; eles só consultam/normalizam dados. Erros do Supabase devem virar exceções legíveis e nunca respostas falsas de sucesso.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: adiciona camada de dados da agenda`

---

### Task 3: Tornar a agenda administrativa da Mel operacional

**Files:**
- Create: `gestao/js/admin-agenda.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/admin-agenda.test.mjs`

**Interfaces:**
- Consumes: funções administrativas de `agenda-api.js`, `formatClinicDateTime()` e o perfil admin já validado por `requireRole('admin')`.
- Produces: `initAdminAgenda({ client, profile, root }) -> Promise<void>`.

- [ ] **Step 1: Write failing markup/controller tests**

Exigir:
- seletor de data da agenda;
- lista real de atendimentos do dia com horário, cliente, procedimento, profissional e status;
- formulário de novo cliente com nome/telefone/e-mail opcional;
- formulário de novo procedimento com nome/duração opcional;
- formulário de novo agendamento escolhendo cliente, colaboradora, procedimento, início/fim e observação administrativa;
- botões de status administrativo;
- estados `carregando`, vazio e erro;
- nenhuma referência a `service_role` ou credencial privilegiada.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL nas novas estruturas/controlador.

- [ ] **Step 3: Implement `initAdminAgenda` and wire it after role validation**

A UI deve recarregar apenas os blocos afetados após criar cliente/procedimento/agendamento; formulário só limpa depois de sucesso confirmado.

- [ ] **Step 4: Add focused responsive styles**

Usar o sistema visual existente e manter formulários/tabelas legíveis em mobile, sem reestruturar o CSS global do site institucional.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS, incluindo base vazia.

- [ ] **Step 6: Commit**

Commit message: `feat: ativa agenda administrativa da Mel`

---

### Task 4: Tornar a agenda individual e o histórico autorizado da colaboradora operacionais

**Files:**
- Create: `gestao/js/colaborador-agenda.js`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/colaborador-agenda.test.mjs`

**Interfaces:**
- Consumes: `listOwnAppointments`, `listAuthorizedHistory`, `listStaffDirectory`, `setAppointmentStatus`, `formatClinicDateTime`; perfil retornado por `requireRole('colaborador')`.
- Produces: `initCollaboratorAgenda({ client, profile, root }) -> Promise<void>`.

- [ ] **Step 1: Write failing collaborator-flow tests**

Exigir:
- lista “Hoje” apenas com atendimentos da profissional autenticada;
- próximos atendimentos em período futuro limitado;
- botão para abrir um atendimento sem colocar nome/telefone do cliente na URL;
- detalhe contendo dados básicos do cliente e histórico que o banco autorizar;
- timeline com data, procedimento, profissional, queixa/objetivo, reação, intercorrência, feedback, orientação e recomendação quando existentes;
- ações operacionais de `faltou`/`cancelado` passando exclusivamente pela RPC de status;
- nenhuma seção, chamada ou texto de financeiro;
- estado vazio quando não houver agenda.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL porque o controlador ainda não existe.

- [ ] **Step 3: Implement agenda and in-page detail dialog/panel**

O identificador do agendamento fica apenas em memória/`data-*`; não colocar dados pessoais em query string. RLS continua sendo a barreira real.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: ativa agenda individual da colaboradora`

---

### Task 5: Registrar atendimento e atualizar histórico sem estado parcial

**Files:**
- Create: `gestao/js/atendimento-form.js`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/atendimento-form.test.mjs`

**Interfaces:**
- Consumes: `registerAttendance({ client, appointmentId, fields })` e o refresh exposto pelo controlador da Task 4.
- Produces:
  - `normalizeAttendanceFields(values) -> object`
  - `validateAttendanceFields(values) -> { valid: boolean, message: string }`
  - `bindAttendanceForm({ form, client, appointmentId, onSuccess }) -> void`.

- [ ] **Step 1: Write failing form tests**

Cobrir os campos aprovados: `queixa_objetivo`, `observacoes`, `reacoes`, `intercorrencias`, `feedback_cliente`, `orientacoes`, `recomendacao_proxima_sessao`.

Exigir:
- ao menos um conteúdo clínico/operacional significativo antes de salvar;
- botão bloqueado enquanto a submissão está em curso;
- duplo clique colapsado em uma única chamada;
- erro de rede mantém valores preenchidos e exibe mensagem;
- sucesso limpa formulário, fecha detalhe e recarrega agenda/histórico;
- não envia cliente/procedimento/profissional pelo browser, apenas `appointmentId` + campos da evolução.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:gestao`
Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Implement the minimal form controller**

Não permitir edição posterior nesta fase pela interface da colaboradora; correções/auditoria ficam para etapa administrativa posterior.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: registra atendimento com histórico`

---

### Task 6: Gate final da Fase 3 e documentação operacional

**Files:**
- Create: `docs/bc-gestao/phase-3-agenda-atendimento.md`
- Modify only if required by tests: `.github/workflows/site-ci.yml`

**Interfaces:**
- Consumes: todos os artefatos das Tasks 1–5.
- Produces: evidência reproduzível de que a Fase 3 está funcional sem dados reais e sem afetar o site público.

- [ ] **Step 1: Run the complete CI suite**

Run via GitHub Actions:
- `npm run test:frontend`
- `npm run test:site`
- `npm run test:gestao`

Expected: all PASS.

- [ ] **Step 2: Re-run Supabase Security Advisor after all DDL**

Expected: `lints: []` ou apenas avisos explicitamente avaliados e documentados antes de seguir.

- [ ] **Step 3: Verify production data remains untouched**

Confirmar contagens antes de qualquer onboarding real; implementação técnica não deve ter criado usuários/clientes/agendamentos/atendimentos reais.

- [ ] **Step 4: Verify repository isolation**

Comparar `main...feature/bc-gestao-1` e confirmar que:
- `main` permanece no baseline protegido;
- `/admin/` legado da pré-anamnese não foi alterado;
- Pages continua disparando apenas em `main`;
- Fase 3 altera apenas `gestao/`, `tests/gestao/`, `supabase/migrations/`, documentação e CI quando estritamente necessário.

- [ ] **Step 5: Document the operational state**

Registrar RPCs, políticas, módulos de frontend, critérios de acesso, limitações da fase e próximo passo de onboarding controlado de Mel + uma colaboradora de teste.

- [ ] **Step 6: Commit**

Commit message: `docs: fecha fase 3 do BC Gestão`
