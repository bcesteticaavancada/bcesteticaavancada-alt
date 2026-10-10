# BC Gestão — Fase 5 Financeiro Individual, Livros Semanais e Repasses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o financeiro individual das profissionais, a apuração semanal de livros, comissões privadas por profissional/procedimento e repasses administrados exclusivamente pela Mel, sem expor percentuais nem dados cruzados entre colaboradoras.

**Architecture:** Separar obrigação financeira (`pagamentos`), entradas reais de dinheiro (`recebimentos`), apuração semanal (`livros_financeiros`) e pagamento da profissional (`repasses`). Cálculo, autorização e auditoria ficam no Supabase por RLS/RPC/triggers; o frontend consome apenas superfícies próprias do papel da usuária. Pagamentos parciais são movimentos independentes para impedir dupla contagem entre semanas.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Supabase JS v2, PostgreSQL 17, RLS/RPC/triggers, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-10-bc-gestao-fase5-financeiro-repasses-design.md`

## Global Constraints

- Usar somente o Supabase `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Não alterar `bc-estetica-pre-anamnese` nem o `/admin/` legado da pré-anamnese.
- `service_role` nunca entra no navegador, GitHub ou arquivos públicos.
- RLS/RPC são a autoridade; frontend nunca é barreira de segurança.
- Colaboradora acessa somente o próprio financeiro e nunca recebe percentual em payload, view, RPC ou leitura direta autorizada.
- Mel/ADM administra percentuais, financeiro global, livros, repasses, correções e auditoria.
- Comissão é definida por `profissional × procedimento` e calculada somente sobre dinheiro efetivamente recebido.
- Pagamento parcial gera movimentos independentes; cada movimento pode pertencer a no máximo um item de livro válido.
- Períodos financeiros usam a data local `America/Sao_Paulo`; livro semanal tem exatamente 7 dias corridos (`periodo_fim = periodo_inicio + 6`).
- Fechar livro publica o valor devido, mas não paga a profissional.
- Ciclo de repasse é 7, 15 ou 30 dias, configurável pela Mel, inclusive por profissional.
- Livro fechado é congelado; correção exige reabertura explícita.
- Livro pago exige estorno/revisão explícita antes de qualquer recálculo.
- Homologação usa apenas dados fictícios e `ROLLBACK` sempre que possível; nenhum paciente real será alterado.

## Review Focus

1. **Parcela em semanas diferentes:** cada movimento entra uma única vez no livro correto.
2. **Privacidade do percentual:** colaboradora não consegue inferi-lo por tabela, RPC, view ou payload.
3. **Fechamento idempotente:** fechar novamente o mesmo período/profissional não duplica livro ou itens.
4. **Correção pós-fechamento:** recebimento usado em livro fechado/pago não pode ser alterado silenciosamente.
5. **Repasse duplicado:** o mesmo livro não pode ser pago duas vezes; ciclo fora de 7/15/30 é rejeitado.

---

### Task 1: Fundação de dados financeiros

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql`
- Create: `tests/gestao/phase5-database-contract.test.mjs`
- Create: `tests/gestao/phase5-security-contract.test.mjs`

**Interfaces:**
- Consumes: `pagamentos`, `agendamentos`, `atendimentos`, `procedimentos`, `staff_profiles`, `audit_log`.
- Produces: `recebimentos`, `comissao_profissional_procedimento`, `livros_financeiros`, `livro_financeiro_itens`, `config_repasses`, `repasses`, `repasse_livros`.

- [ ] **Step 1: Write failing schema/security contract tests**

Exigir FKs, checks, índices, RLS habilitado, `ciclo_dias in (7,15,30)`, percentual `0..100`, estados válidos, uma regra ativa por profissional/procedimento, um movimento por item de livro e um livro por repasse ativo/pago.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/gestao/phase5-database-contract.test.mjs tests/gestao/phase5-security-contract.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement foundation migration**

Criar:

- `recebimentos`: `id`, `pagamento_id`, `agendamento_id`, `atendimento_id`, `cliente_id`, `profissional_user_id`, `procedimento_id`, `valor`, `forma_pagamento`, `recebido_at`, `observacao`, `status ativo|estornado`, autoria/timestamps e metadados de estorno.
- `comissao_profissional_procedimento`: profissional, procedimento, percentual privado, ativo, autoria/timestamps.
- `livros_financeiros`: profissional, período de 7 dias, status `aberto|fechado|em_revisao|pago`, produção, repasse e metadados de fechamento/reabertura.
- `livro_financeiro_itens`: livro, recebimento, procedimento, valor-base, percentual aplicado privado, valor de repasse.
- `config_repasses`: profissional, ciclo 7/15/30, autoria/timestamp.
- `repasses`: profissional, intervalo, total, status `aberto|pago|estornado`, baixa/estorno e observação.
- `repasse_livros`: vínculo livro↔repasse com proteção contra duplicidade.

- [ ] **Step 4: Run contract tests and verify GREEN**

Run: `node --test tests/gestao/phase5-database-contract.test.mjs tests/gestao/phase5-security-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run existing BC Gestão suite**

Run: `npm run test:gestao`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql tests/gestao/phase5-database-contract.test.mjs tests/gestao/phase5-security-contract.test.mjs
git commit -m "feat: add phase 5 financial schema foundation"
```

---

### Task 2: Recebimentos seguros e correção por estorno

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql`
- Create: `gestao/js/finance-receipts-api.js`
- Create: `tests/gestao/phase5-receipts-rpc.test.mjs`
- Create: `tests/gestao/finance-receipts-api.test.mjs`

**Interfaces:**
- Consumes: Task 1 + `auth.uid()`.
- Produces:
  - `bc_recebimento_registrar(p_atendimento_id uuid, p_valor numeric, p_forma_pagamento text, p_recebido_at timestamptz default now(), p_observacao text default null) returns uuid`
  - `bc_recebimento_estornar(p_recebimento_id uuid, p_motivo text) returns uuid` — admin only.
  - `bc_meus_recebimentos(p_periodo_inicio date, p_periodo_fim date)` → `id, pagamento_id, atendimento_id, cliente_id, procedimento_id, valor, forma_pagamento, recebido_at, status, observacao`.
  - `bc_financeiro_recebimentos_admin(p_profissional_user_id uuid default null, p_periodo_inicio date default null, p_periodo_fim date default null)` → mesmos campos + `profissional_user_id`.
  - JS: `registerReceipt`, `reverseReceipt`, `listOwnReceipts`, `listAdminReceipts`.

- [ ] **Step 1: Write failing RPC/API tests**

Cobrir: colaboradora registra somente atendimento próprio; admin pode registrar qualquer atendimento; profissional/cliente/procedimento/autoria são derivados no banco; valor positivo; leitura própria somente; percentuais ausentes; estorno é admin-only; recebimento já usado em livro fechado/pago não pode ser estornado até reabertura/estorno do fluxo correspondente.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/phase5-receipts-rpc.test.mjs tests/gestao/finance-receipts-api.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement receipt RPCs and grants**

Usar implementações privadas `SECURITY DEFINER` com `search_path` fixo; wrappers públicos executáveis somente por `authenticated`; revogar `PUBLIC` e `anon`. Registrar/estornar deve recomputar `pagamentos.valor_recebido` como soma dos movimentos ativos e atualizar o status agregado do pagamento sem apagar histórico.

- [ ] **Step 4: Implement `finance-receipts-api.js`**

Seguir o padrão de validação/erros de `gestao/js/agenda-api.js`; não acessar tabela privada de comissão.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/gestao/phase5-receipts-rpc.test.mjs tests/gestao/finance-receipts-api.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql gestao/js/finance-receipts-api.js tests/gestao/phase5-receipts-rpc.test.mjs tests/gestao/finance-receipts-api.test.mjs
git commit -m "feat: add secure receipt movements"
```

---

### Task 3: Comissão privada e livros semanais

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql`
- Create: `gestao/js/finance-books-api.js`
- Create: `tests/gestao/phase5-books-rpc.test.mjs`
- Create: `tests/gestao/finance-books-api.test.mjs`

**Interfaces:**
- Consumes: movimentos ativos + comissão privada.
- Produces:
  - `bc_comissao_set(p_profissional_user_id uuid, p_procedimento_id uuid, p_percentual numeric) returns uuid` — admin only.
  - `bc_financeiro_comissoes_admin(p_profissional_user_id uuid default null)` — admin only.
  - `bc_livro_fechar(p_profissional_user_id uuid, p_periodo_inicio date, p_periodo_fim date) returns uuid` — exige intervalo de 7 dias.
  - `bc_livro_reabrir(p_livro_id uuid, p_motivo text) returns uuid` — admin only.
  - `bc_livros_recalcular(p_profissional_user_id uuid, p_procedimento_id uuid default null, p_periodo_inicio date, p_periodo_fim date) returns integer` — somente livros `em_revisao`.
  - `bc_meus_livros_financeiros(p_periodo_inicio date, p_periodo_fim date)` → `id, periodo_inicio, periodo_fim, status, producao_recebida, repasse_total, fechado_at` sem percentual.
  - `bc_financeiro_livros_admin(...)` → resumo + itens privados e percentual aplicado.
  - JS: `listOwnBooks`, `listAdminBooks`, `setCommission`, `closeBook`, `reopenBook`, `recalculateBooks`.

- [ ] **Step 1: Write failing commission/book tests**

Cobrir: fechamento usa apenas recebimentos ativos cuja data local São Paulo cai dentro do período; ausência de regra de comissão bloqueia fechamento; movimento não duplica; fechar novamente o mesmo período é idempotente; colaboradora nunca recebe `percentual_aplicado`; livro fechado bloqueia recálculo; reabertura muda para `em_revisao`; recálculo pode filtrar procedimento.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/phase5-books-rpc.test.mjs tests/gestao/finance-books-api.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement commission/book RPCs**

`bc_livro_fechar` deve executar transacionalmente: validar período, selecionar movimentos elegíveis, resolver comissão, criar itens, somar produção/repasse, congelar livro e auditar.

- [ ] **Step 4: Implement `finance-books-api.js`**

Separar funções de leitura própria das operações administrativas; nunca incluir percentual em retorno próprio.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/gestao/phase5-books-rpc.test.mjs tests/gestao/finance-books-api.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql gestao/js/finance-books-api.js tests/gestao/phase5-books-rpc.test.mjs tests/gestao/finance-books-api.test.mjs
git commit -m "feat: add weekly financial books"
```

---

### Task 4: Ciclos, lotes de repasse, baixa e estorno

**Files:**
- Create: `supabase/migrations/20261010_bc_gestao_phase5_payouts_rpc.sql`
- Create: `gestao/js/finance-payouts-api.js`
- Create: `tests/gestao/phase5-payouts-rpc.test.mjs`
- Create: `tests/gestao/finance-payouts-api.test.mjs`

**Interfaces:**
- Consumes: livros `fechado` elegíveis + `config_repasses`.
- Produces:
  - `bc_config_repasse_set(p_profissional_user_id uuid, p_ciclo_dias integer) returns uuid`
  - `bc_repasse_criar(p_profissional_user_id uuid, p_livro_ids uuid[], p_observacao text default null) returns uuid`
  - `bc_repasse_baixar(p_repasse_id uuid, p_pago_at timestamptz default now()) returns uuid`
  - `bc_repasse_estornar(p_repasse_id uuid, p_motivo text) returns uuid`
  - `bc_meus_repasses(p_periodo_inicio date, p_periodo_fim date)` → `id, periodo_inicio, periodo_fim, valor_total, status, pago_at`.
  - `bc_financeiro_repasses_admin(...)` → resumo global por profissional.
  - JS: `setPayoutCycle`, `createPayout`, `settlePayout`, `reversePayout`, `listOwnPayouts`, `listAdminPayouts`.

- [ ] **Step 1: Write failing payout tests**

Cobrir: ciclo somente 7/15/30; lote aceita livros da mesma profissional; livro não entra em dois repasses ativos/pagos; baixa marca repasse e livros `pago`; colaboradora vê só próprios repasses; estorno marca lote `estornado`, move livros para `em_revisao` e preserva auditoria.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/phase5-payouts-rpc.test.mjs tests/gestao/finance-payouts-api.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement payout RPCs**

Todas as mutações admin-only; derivar autoria de `auth.uid()`; impedir baixa/estorno repetidos e misturar profissionais no mesmo lote.

- [ ] **Step 4: Implement `finance-payouts-api.js`**

Expor somente os métodos da seção **Interfaces** com validação leve no cliente e regras reais no banco.

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
- Consumes: APIs das Tasks 2–4 + `agenda.getCurrentAppointment()`.
- Produces: `initCollaboratorFinance({ client, profile, root, getCurrentAppointment }) -> { refresh, refreshReceipts }`.

- [ ] **Step 1: Write failing collaborator UI tests**

Exigir `Meu financeiro`, formulário de recebimento no atendimento atual, lista de recebimentos próprios, cards `Produção recebida`, `A receber`, `Pago`, livros/status e histórico de repasses. Testar que a área não contém controles/labels de percentual ou comissão.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/colaborador-finance.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement collaborator finance controller/UI**

Adicionar navegação e seção financeira; integrar registro de recebimento ao atendimento selecionado; inicializar após `initCollaboratorAgenda` passando `agenda.getCurrentAppointment`.

- [ ] **Step 4: Add minimal mobile-first finance styles**

Reusar `bcg-*`; adicionar somente resumo, badges/status e tabelas/listas necessárias.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/gestao/colaborador-finance.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gestao/js/colaborador-finance.js gestao/colaborador/index.html gestao/assets/gestao.css tests/gestao/colaborador-finance.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs
git commit -m "feat: add collaborator personal finance view"
```

---

### Task 6: Painel financeiro da Mel e auditoria

**Files:**
- Create: `gestao/js/admin-finance.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/js/admin-audit.js`
- Modify: `gestao/assets/gestao.css`
- Create: `supabase/migrations/20261010_bc_gestao_phase5_audit_hardening.sql`
- Create: `tests/gestao/admin-finance.test.mjs`
- Create: `tests/gestao/phase5-audit-security.test.mjs`
- Modify: `tests/gestao/admin-audit.test.mjs`

**Interfaces:**
- Consumes: APIs das Tasks 2–4 + `staffMap` da agenda.
- Produces: `initAdminFinance({ client, profile, root, staffMap }) -> { refresh }` e filtros de auditoria financeira.

- [ ] **Step 1: Write failing admin/audit tests**

Exigir: filtro por profissional/período, consolidado BC, recebimentos + estorno/correção, comissão profissional×procedimento, fechar/reabrir/recalcular livro, ciclo 7/15/30, criar/baixar/estornar repasse; auditoria para `recebimento_created`, `recebimento_reversed`, `comissao_updated`, `livro_closed`, `livro_reopened`, `livro_recalculated`, `repasse_cycle_updated`, `repasse_created`, `repasse_paid`, `repasse_reversed`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/gestao/admin-finance.test.mjs tests/gestao/phase5-audit-security.test.mjs tests/gestao/admin-audit.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement audit hardening migration**

Registrar eventos financeiros no banco; revisar grants de todos os wrappers da Fase 5 para `authenticated` apenas; revogar `PUBLIC`/`anon`; manter leitura global de auditoria admin-only.

- [ ] **Step 4: Implement admin finance panel**

Substituir placeholder `Financeiro` sem mexer nas áreas existentes. Após mutações, atualizar somente a seção financeira afetada, sem reload da página.

- [ ] **Step 5: Extend audit UI filters and styles**

Adicionar entidades financeiras mantendo auditoria somente-leitura.

- [ ] **Step 6: Run focused tests and full BC Gestão suite**

Run: `node --test tests/gestao/admin-finance.test.mjs tests/gestao/phase5-audit-security.test.mjs tests/gestao/admin-audit.test.mjs && npm run test:gestao`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add gestao/js/admin-finance.js gestao/admin/index.html gestao/js/admin-audit.js gestao/assets/gestao.css supabase/migrations/20261010_bc_gestao_phase5_audit_hardening.sql tests/gestao/admin-finance.test.mjs tests/gestao/phase5-audit-security.test.mjs tests/gestao/admin-audit.test.mjs
git commit -m "feat: add admin finance and audit controls"
```

---

### Task 7: Integração, homologação e entrega

**Files:**
- Create: `tests/gestao/phase5-finance-integration.test.mjs`
- Modify: `gestao/README.md`
- Modify: `docs/bc-gestao/phase-2-database.md`

**Interfaces:**
- Consumes: toda a Fase 5.
- Produces: prova automatizada e homologação transacional do fluxo completo.

- [ ] **Step 1: Write end-to-end integration test**

Cenário fictício obrigatório:

1. atendimento fictício da Alice;
2. duas parcelas recebidas em semanas diferentes;
3. comissão definida pela Mel;
4. cada livro usa somente a parcela da sua semana;
5. Alice vê próprios livros/valores, nunca percentual;
6. Mel vê detalhe e consolidado;
7. ciclo de 15 dias reúne livros elegíveis em um repasse;
8. baixa marca repasse/livros pagos;
9. leitura cruzada pela Alice falha;
10. recálculo de livro pago falha até estorno/reabertura.

- [ ] **Step 2: Run full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Apply migrations only after tests are GREEN**

Durante execução, preferir branch Supabase de desenvolvimento se disponível/cabível; caso contrário aplicar sequencialmente em `bc-estetica-gestao`. Nunca tocar em `bc-estetica-pre-anamnese`.

- [ ] **Step 4: Run live permission homologation with fictional data**

Usar `BEGIN ... ROLLBACK` sempre que possível e provar: Alice registra só próprio recebimento; não vê percentual nem dados alheios; Mel fecha/reabre/recalcula; ciclos 7/15/30 funcionam; duplicidades são bloqueadas; baixa/estorno funcionam.

- [ ] **Step 5: Verify Security Advisor/grants once**

Fazer uma única checagem focada, sem polling repetitivo; separar warnings preexistentes de problemas introduzidos pela Fase 5.

- [ ] **Step 6: Update documentation**

Documentar recebimentos, livros, repasses, privacidade e fluxos em `gestao/README.md` e `docs/bc-gestao/phase-2-database.md`.

- [ ] **Step 7: Commit final integration/docs**

```bash
git add tests/gestao/phase5-finance-integration.test.mjs gestao/README.md docs/bc-gestao/phase-2-database.md
git commit -m "test: verify phase 5 financial workflow"
```

- [ ] **Step 8: Open draft PR and run final review**

Criar PR `feat/bc-gestao-fase5` → `main`, rodar CI uma vez, revisar o diff completo e só então marcar pronto para merge. Não fazer merge automático sem a revisão final do fluxo vigente.
