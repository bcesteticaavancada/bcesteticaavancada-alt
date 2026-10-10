# BC Gestão — Fase 5 Financeiro Individual, Livros Semanais e Repasses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o financeiro individual das profissionais, a apuração semanal de livros, comissões privadas por profissional/procedimento e repasses administrados exclusivamente pela Mel, sem expor percentuais nem dados cruzados entre colaboradoras.

**Architecture:** A Fase 5 separa obrigação financeira, movimentos efetivos de recebimento, apuração semanal e pagamento de repasses. O Supabase será a autoridade de segurança e cálculo por meio de RLS, RPCs `SECURITY DEFINER` com `search_path` fixo e auditoria no banco; o frontend apenas consome superfícies apropriadas ao papel da usuária. Pagamentos parciais serão normalizados como movimentos independentes para impedir dupla contagem entre semanas.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Supabase JS v2, PostgreSQL 17, RLS/RPC/triggers, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-10-bc-gestao-fase5-financeiro-repasses-design.md`

## Global Constraints

- Usar somente o projeto Supabase `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Não alterar o projeto `bc-estetica-pre-anamnese` nem o `/admin/` legado da pré-anamnese.
- `service_role` nunca entra no navegador, GitHub ou arquivos públicos.
- RLS/RPC são a autoridade real de segurança; esconder botão no frontend não basta.
- Colaboradora acessa apenas o próprio financeiro e nunca recebe percentual de comissão em payload, view, RPC ou consulta autorizada.
- Mel/ADM pode visualizar e administrar o financeiro global, percentuais, livros e repasses.
- Comissão é configurada por combinação `profissional × procedimento` e calculada sobre valor efetivamente recebido.
- Pagamentos parciais devem virar movimentos independentes de recebimento; o mesmo movimento não pode ser contabilizado em dois livros.
- Livro é fechado semanalmente; fechamento publica o valor devido, mas não equivale ao pagamento do repasse.
- Ciclo de repasse pode ser 7, 15 ou 30 dias, configurável pela Mel, inclusive por profissional.
- Livro fechado fica congelado; correção exige reabertura explícita pela Mel.
- Livro já pago exige fluxo explícito de estorno/revisão antes de recálculo.
- Homologação usa somente dados fictícios e transações com `ROLLBACK` quando possível; não tocar em pacientes reais.

## Review Focus

1. **Pagamento parcial em semanas diferentes:** cada parcela deve entrar uma única vez no livro correto; testes devem impedir dupla contagem do mesmo movimento.
2. **Privacidade do percentual:** colaboradora não pode inferir percentual via tabela, RPC, view ou payload; testes de contrato/RLS devem verificar ausência do campo e bloqueio direto.
3. **Fechamento idempotente:** repetir fechamento do mesmo período/profissional não pode duplicar movimentos nem itens do livro.
4. **Livro fechado/pago:** alteração financeira deve falhar até reabertura ou estorno explícito; testes devem cobrir os dois estados.
5. **Repasse duplicado:** o mesmo livro não pode pertencer a dois repasses ativos/concluídos; ciclo fora de 7/15/30 deve ser rejeitado.

---

### Task 1: Fundação de dados financeiros e contratos de segurança

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql`
- Create: `tests/gestao/phase5-database-contract.test.mjs`
- Create: `tests/gestao/phase5-security-contract.test.mjs`

**Interfaces:**
- Consumes: `pagamentos`, `agendamentos`, `atendimentos`, `procedimentos`, `staff_profiles`, `audit_log` existentes.
- Produces: tabelas `recebimentos`, `comissao_profissional_procedimento`, `livros_financeiros`, `livro_financeiro_itens`, `config_repasses`, `repasses`, `repasse_livros`; constraints, índices e RLS habilitado.

- [ ] **Step 1: Write failing database-contract tests**

Adicionar testes que exijam as sete tabelas, chaves estrangeiras, checks de valores positivos, `ciclo_dias in (7,15,30)`, estados permitidos, unicidade lógica de comissão ativa, unicidade de movimento em item de livro e unicidade de livro em repasse ativo/concluído.

- [ ] **Step 2: Run the new contract tests and verify RED**

Run: `node --test tests/gestao/phase5-database-contract.test.mjs tests/gestao/phase5-security-contract.test.mjs`

Expected: FAIL porque a migration e as estruturas ainda não existem.

- [ ] **Step 3: Implement the foundation migration**

Criar `20261010_bc_gestao_phase5_financial_foundation.sql` com:

- `recebimentos`: movimento imutável de entrada real, ligado a `pagamentos`, `atendimentos`, `agendamentos`, cliente e profissional derivada; valor, forma, data, autoria e status operacional.
- `comissao_profissional_procedimento`: configuração privada por profissional/procedimento, percentual `>= 0` e `<= 100`, ativo, autoria e timestamps.
- `livros_financeiros`: profissional, período semanal, status `aberto|fechado|em_revisao|pago`, totais e metadados de fechamento/reabertura.
- `livro_financeiro_itens`: referência ao movimento de recebimento, procedimento, base recebida, percentual aplicado privado e valor de repasse.
- `config_repasses`: ciclo 7/15/30 por profissional.
- `repasses`: lote de pagamento real da BC para profissional, status `aberto|pago|estornado` e metadados.
- `repasse_livros`: vínculo único livro↔repasse.
- índices por profissional, período, status e FKs de navegação.
- RLS habilitado em todas as novas tabelas sem conceder leitura bruta de percentuais à colaboradora.

- [ ] **Step 4: Run contract tests and verify GREEN**

Run: `node --test tests/gestao/phase5-database-contract.test.mjs tests/gestao/phase5-security-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run the full BC Gestão suite**

Run: `npm run test:gestao`

Expected: PASS sem regressões.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql tests/gestao/phase5-database-contract.test.mjs tests/gestao/phase5-security-contract.test.mjs
git commit -m "feat: add phase 5 financial schema foundation"
```

---

### Task 2: Movimentos de recebimento e registro seguro pela colaboradora

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql`
- Create: `gestao/js/finance-receipts-api.js`
- Create: `tests/gestao/phase5-receipts-rpc.test.mjs`
- Create: `tests/gestao/finance-receipts-api.test.mjs`

**Interfaces:**
- Consumes: tabelas da Task 1 e `auth.uid()`.
- Produces:
  - `public.bc_recebimento_registrar(p_atendimento_id uuid, p_valor numeric, p_forma_pagamento text, p_recebido_at timestamptz default now(), p_observacao text default null) returns uuid`
  - `public.bc_meus_recebimentos(p_periodo_inicio date, p_periodo_fim date) returns setof record` sem percentual.
  - `public.bc_financeiro_recebimentos_admin(p_profissional_user_id uuid default null, p_periodo_inicio date default null, p_periodo_fim date default null) returns setof record`.
  - JS `registerReceipt({ client, atendimentoId, valor, formaPagamento, recebidoAt, observacao })`.
  - JS `listOwnReceipts({ client, fromDate, toDate })`.

- [ ] **Step 1: Write failing RPC and API tests**

Cobrir: colaboradora registra somente atendimento próprio; admin pode registrar/regularizar qualquer atendimento; valor precisa ser positivo; profissional/cliente/procedimento são derivados do atendimento; payload da colaboradora não contém percentual; colaboradora não lista recebimentos de outra profissional.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/phase5-receipts-rpc.test.mjs tests/gestao/finance-receipts-api.test.mjs`

Expected: FAIL por RPCs/módulo inexistentes.

- [ ] **Step 3: Implement receipt RPCs and grants**

Criar implementações privadas `SECURITY DEFINER` com `search_path` fixo e wrappers públicos executáveis somente por `authenticated`; revogar `PUBLIC` e `anon`. O registro deve derivar autoria e profissional do contexto autenticado/atendimento, nunca do browser.

- [ ] **Step 4: Implement `gestao/js/finance-receipts-api.js`**

Manter o padrão de validação/erro de `agenda-api.js`; o módulo apenas chama RPCs e não acessa tabelas sensíveis diretamente.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/gestao/phase5-receipts-rpc.test.mjs tests/gestao/finance-receipts-api.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql gestao/js/finance-receipts-api.js tests/gestao/phase5-receipts-rpc.test.mjs tests/gestao/finance-receipts-api.test.mjs
git commit -m "feat: add secure receipt movements"
```

---

### Task 3: Comissão privada e fechamento semanal de livros

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql`
- Create: `gestao/js/finance-books-api.js`
- Create: `tests/gestao/phase5-books-rpc.test.mjs`
- Create: `tests/gestao/finance-books-api.test.mjs`

**Interfaces:**
- Consumes: `recebimentos`, `comissao_profissional_procedimento`, `livros_financeiros`, `livro_financeiro_itens`.
- Produces:
  - `public.bc_comissao_set(p_profissional_user_id uuid, p_procedimento_id uuid, p_percentual numeric) returns uuid` — admin only.
  - `public.bc_financeiro_comissoes_admin(p_profissional_user_id uuid default null) returns setof record` — admin only.
  - `public.bc_livro_fechar(p_profissional_user_id uuid, p_periodo_inicio date, p_periodo_fim date) returns uuid` — admin only.
  - `public.bc_livro_reabrir(p_livro_id uuid, p_motivo text) returns uuid` — admin only.
  - `public.bc_livros_recalcular(p_profissional_user_id uuid, p_procedimento_id uuid default null, p_periodo_inicio date, p_periodo_fim date) returns integer` — admin only; afeta somente livros `em_revisao`.
  - `public.bc_meus_livros_financeiros(p_periodo_inicio date, p_periodo_fim date) returns setof record` — sem percentual.
  - `public.bc_financeiro_livros_admin(p_profissional_user_id uuid default null, p_periodo_inicio date default null, p_periodo_fim date default null) returns setof record`.
  - JS `listOwnBooks`, `listAdminBooks`, `setCommission`, `closeBook`, `reopenBook`, `recalculateBooks`.

- [ ] **Step 1: Write failing book/commission tests**

Cobrir: percentual privado; fechamento semanal usa apenas movimentos elegíveis ainda não usados; mesma movimentação não entra duas vezes; repetir fechamento não duplica itens; ausência de regra de comissão bloqueia fechamento com erro claro; fechamento persiste `percentual_aplicado` apenas no lado administrativo; colaboradora recebe somente valores monetários; livro fechado bloqueia recálculo; livro reaberto muda para `em_revisao` e pode ser recalculado por procedimento/período.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/phase5-books-rpc.test.mjs tests/gestao/finance-books-api.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement commission and book RPCs**

O fechamento deve ocorrer em uma única transação: selecionar movimentos elegíveis, resolver procedimento e percentual, criar itens, somar produção/repasse, congelar o livro e registrar auditoria. `bc_meus_livros_financeiros` nunca retorna `percentual_aplicado`.

- [ ] **Step 4: Implement `gestao/js/finance-books-api.js`**

Expor as funções listadas em **Interfaces**, mantendo funções admin separadas das funções de leitura individual.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/gestao/phase5-books-rpc.test.mjs tests/gestao/finance-books-api.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql gestao/js/finance-books-api.js tests/gestao/phase5-books-rpc.test.mjs tests/gestao/finance-books-api.test.mjs
git commit -m "feat: add weekly financial books"
```

---

### Task 4: Ciclos de repasse, lotes, baixa e estorno

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_payouts_rpc.sql`
- Create: `gestao/js/finance-payouts-api.js`
- Create: `tests/gestao/phase5-payouts-rpc.test.mjs`
- Create: `tests/gestao/finance-payouts-api.test.mjs`

**Interfaces:**
- Consumes: livros fechados/reabertos e `config_repasses`.
- Produces:
  - `public.bc_config_repasse_set(p_profissional_user_id uuid, p_ciclo_dias integer) returns uuid` — admin only.
  - `public.bc_repasse_criar(p_profissional_user_id uuid, p_livro_ids uuid[], p_observacao text default null) returns uuid` — admin only.
  - `public.bc_repasse_baixar(p_repasse_id uuid, p_pago_at timestamptz default now()) returns uuid` — admin only.
  - `public.bc_repasse_estornar(p_repasse_id uuid, p_motivo text) returns uuid` — admin only.
  - `public.bc_meus_repasses(p_periodo_inicio date, p_periodo_fim date) returns setof record`.
  - `public.bc_financeiro_repasses_admin(p_profissional_user_id uuid default null, p_periodo_inicio date default null, p_periodo_fim date default null) returns setof record`.
  - JS `setPayoutCycle`, `createPayout`, `settlePayout`, `reversePayout`, `listOwnPayouts`, `listAdminPayouts`.

- [ ] **Step 1: Write failing payout tests**

Cobrir: somente 7/15/30; lote contém apenas livros da mesma profissional e em estado elegível; livro não pode entrar em dois repasses ativos/pagos; baixa marca repasse e livros como pagos; colaboradora vê somente os próprios lotes; estorno explícito move livros para `em_revisao` e mantém rastreabilidade.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/phase5-payouts-rpc.test.mjs tests/gestao/finance-payouts-api.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement payout RPCs and audit events**

Criar/gravar eventos mínimos: `repasse_cycle_updated`, `repasse_created`, `repasse_paid`, `repasse_reversed`; impedir mutações silenciosas em livros já pagos.

- [ ] **Step 4: Implement `gestao/js/finance-payouts-api.js`**

Validar entradas no cliente e delegar regras reais ao banco.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/gestao/phase5-payouts-rpc.test.mjs tests/gestao/finance-payouts-api.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_payouts_rpc.sql gestao/js/finance-payouts-api.js tests/gestao/phase5-payouts-rpc.test.mjs tests/gestao/finance-payouts-api.test.mjs
git commit -m "feat: add payout cycles and settlement"
```

---

### Task 5: Área financeira da colaboradora

**Files:**
- Create: `gestao/js/colaborador-finance.js`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/colaborador-finance.test.mjs`
- Modify: `tests/gestao/colaborador-clientes-integration.test.mjs`

**Interfaces:**
- Consumes: `finance-receipts-api.js`, `finance-books-api.js`, `finance-payouts-api.js`, `agenda.getCurrentAppointment()`.
- Produces: `initCollaboratorFinance({ client, profile, root, getCurrentAppointment }) -> { refresh, refreshReceipts }`.

- [ ] **Step 1: Write failing collaborator-finance tests**

Exigir:

- item de navegação `Meu financeiro`;
- formulário de recebimento ligado ao atendimento atual com valor, forma, data e observação;
- lista de movimentos próprios;
- cards `Produção recebida`, `A receber`, `Pago`;
- livros com status `Aguardando fechamento`, `A receber`, `Pago`, `Em revisão`;
- histórico de repasses;
- nenhuma ocorrência de campo/label de percentual/comissão na área da colaboradora.

- [ ] **Step 2: Run focused UI tests and verify RED**

Run: `node --test tests/gestao/colaborador-finance.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement collaborator finance UI/controller**

Adicionar `Meu financeiro` à navegação, seção financeira própria e slot de registro de recebimento no detalhe do atendimento. Inicializar o módulo depois de `initCollaboratorAgenda`, passando `agenda.getCurrentAppointment`.

- [ ] **Step 4: Add minimal finance-specific styles**

Reusar os componentes `bcg-*`; adicionar apenas classes necessárias para resumo, status de livro e tabelas/listas mobile-first.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/gestao/colaborador-finance.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gestao/js/colaborador-finance.js gestao/colaborador/index.html gestao/assets/gestao.css tests/gestao/colaborador-finance.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs
git commit -m "feat: add collaborator personal finance view"
```

---

### Task 6: Painel financeiro administrativo da Mel

**Files:**
- Create: `gestao/js/admin-finance.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/admin-finance.test.mjs`

**Interfaces:**
- Consumes: `finance-receipts-api.js`, `finance-books-api.js`, `finance-payouts-api.js`, diretório de profissionais já carregado pela agenda.
- Produces: `initAdminFinance({ client, profile, root, staffMap }) -> { refresh }`.

- [ ] **Step 1: Write failing admin-finance UI tests**

Exigir painel com:

- filtro por profissional e período;
- consolidado geral BC e visão individual;
- lista/correção de recebimentos;
- matriz de comissão profissional × procedimento, visível apenas no admin;
- ação de fechar livro semanal;
- ações reabrir/recalcular com motivo;
- configuração de ciclo 7/15/30;
- criação de lote de repasse;
- baixa e estorno de repasse;
- estados claros e mensagens de erro sem dados sensíveis.

- [ ] **Step 2: Run focused UI test and verify RED**

Run: `node --test tests/gestao/admin-finance.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Replace the finance placeholder in `gestao/admin/index.html`**

Manter o restante do painel intacto; importar e inicializar `initAdminFinance` após agenda/clientes/auditoria, reutilizando o `staffMap` já disponível.

- [ ] **Step 4: Implement `gestao/js/admin-finance.js`**

Separar renderização/estado da UI das chamadas de API. Após qualquer mutação, recarregar apenas a seção financeira necessária, sem reload da página inteira.

- [ ] **Step 5: Add minimal admin finance styles and run tests**

Run: `node --test tests/gestao/admin-finance.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gestao/js/admin-finance.js gestao/admin/index.html gestao/assets/gestao.css tests/gestao/admin-finance.test.mjs
git commit -m "feat: add admin financial management panel"
```

---

### Task 7: Auditoria financeira e hardening de exposição

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_audit_hardening.sql`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/js/admin-audit.js`
- Create: `tests/gestao/phase5-audit-security.test.mjs`
- Modify: `tests/gestao/admin-audit.test.mjs`

**Interfaces:**
- Consumes: `audit_log` da Fase 4 e todas as tabelas/RPCs financeiras.
- Produces: eventos financeiros auditáveis e filtros admin para `recebimentos`, `comissoes`, `livros_financeiros`, `repasses`.

- [ ] **Step 1: Write failing audit/security tests**

Cobrir eventos: `recebimento_created`, `recebimento_corrected`, `comissao_updated`, `livro_closed`, `livro_reopened`, `livro_recalculated`, `repasse_cycle_updated`, `repasse_created`, `repasse_paid`, `repasse_reversed`; garantir que colaboradora não lê auditoria global nem tabelas brutas de comissão/itens privados.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/phase5-audit-security.test.mjs tests/gestao/admin-audit.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement audit/hardening migration**

Adicionar triggers/RPC-side audit conforme necessário; revisar grants de todas as funções públicas da Fase 5 para `authenticated` apenas; revogar `PUBLIC` e `anon`; preservar `private` implementations sem exposição direta indevida.

- [ ] **Step 4: Extend admin audit UI filters**

Adicionar tipos financeiros sem alterar a natureza somente-leitura da auditoria.

- [ ] **Step 5: Run focused tests and full gestao suite**

Run: `node --test tests/gestao/phase5-audit-security.test.mjs tests/gestao/admin-audit.test.mjs && npm run test:gestao`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_audit_hardening.sql gestao/admin/index.html gestao/js/admin-audit.js tests/gestao/phase5-audit-security.test.mjs tests/gestao/admin-audit.test.mjs
git commit -m "feat: harden phase 5 financial audit security"
```

---

### Task 8: Verificação integrada, homologação e entrega

**Files:**
- Create: `tests/gestao/phase5-finance-integration.test.mjs`
- Modify: `docs/bc-gestao/phase-2-database.md`
- Modify: `gestao/README.md`

**Interfaces:**
- Consumes: toda a Fase 5.
- Produces: prova automatizada + homologação transacional do fluxo completo.

- [ ] **Step 1: Write end-to-end contract test**

Cobrir o cenário fictício:

1. cliente fictício + atendimento da Alice;
2. dois movimentos parciais em datas/semanas distintas;
3. comissão Alice/procedimento definida pela Mel;
4. primeiro livro fecha usando somente o primeiro movimento;
5. segundo livro fecha usando somente o segundo movimento;
6. Alice vê valores dos próprios livros e nenhum percentual;
7. Mel vê os dois livros, percentual e consolidado;
8. ciclo de 15 dias agrupa os dois livros em um repasse;
9. baixa marca os dois livros como pagos;
10. Alice não consegue ler financeiro da Mel nem de outra profissional;
11. recálculo de livro pago falha até estorno/reabertura.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Apply migrations to a safe execution target**

Durante execução, usar branch Supabase de desenvolvimento se o ambiente/custo permitir; caso contrário, aplicar migrations sequencialmente no projeto `bc-estetica-gestao` somente após todos os testes estáticos passarem. Nunca alterar `bc-estetica-pre-anamnese`.

- [ ] **Step 4: Run transaction-based live permission homologation with fictional data**

Validar em `BEGIN ... ROLLBACK` sempre que possível:

- Alice registra próprio recebimento e não o de outra profissional;
- Alice lista apenas seus recebimentos/livros/repasses;
- Alice não recebe percentual;
- Mel fecha/reabre/recalcula livros;
- Mel configura 7/15/30;
- Mel cria/baixa/estorna repasse;
- duplicidade de movimento/livro é bloqueada.

Expected: todas as regras aprovadas passam; nenhum paciente real é criado ou alterado.

- [ ] **Step 5: Verify Security Advisor and grants once**

Executar uma verificação única, sem polling repetitivo. Confirmar ausência de nova vulnerabilidade de RLS/grants introduzida pela Fase 5 e registrar qualquer warning preexistente separadamente.

- [ ] **Step 6: Update documentation**

Atualizar `gestao/README.md` e `docs/bc-gestao/phase-2-database.md` para refletir o novo modelo de recebimentos, livros e repasses.

- [ ] **Step 7: Commit final integration/doc changes**

```bash
git add tests/gestao/phase5-finance-integration.test.mjs gestao/README.md docs/bc-gestao/phase-2-database.md
git commit -m "test: verify phase 5 financial workflow"
```

- [ ] **Step 8: Open a draft PR and run final verification**

Criar PR de `feat/bc-gestao-fase5` para `main`, rodar CI uma vez, revisar diff completo, e só então marcar pronto para merge. Não fazer merge automático sem a revisão final do usuário/fluxo vigente.
