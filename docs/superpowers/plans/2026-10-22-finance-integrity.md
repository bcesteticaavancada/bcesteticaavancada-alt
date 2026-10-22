# Finance Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir FIN01–FIN04 sequencialmente sem movimentos financeiros reais de teste.
**Architecture:** migrations aditivas substituem implementações privadas e preservam autorização/RLS. Novos recebimentos usam chave de tentativa; livros em lotes ativos ficam congelados e a baixa confere novamente seus valores.
**Tech Stack:** PostgreSQL17/Supabase, pgTAP, JavaScript ES modules, Node tests.
**Spec:** docs/superpowers/specs/2026-10-22-finance-integrity.md

## Global Constraints

- Execução nativa sequencial já autorizada; atualizar o usuário sem novas confirmações genéricas.
- Nenhum paciente, assinatura ou movimento financeiro de teste em produção.
- Admin de Criação sem autorização financeira; usar migrações e API oficial.
- Total e comissão usam snapshots, valores monetários em centavos.

## Review Focus

- Corrida recebimento/estorno: soma final precisa corresponder aos movimentos ativos.
- Cobrança apenas de agenda ou duplicada: reutilizar uma obrigação inequívoca, recusar ambiguidade.
- Resposta perdida/reload: mesma tentativa mantém chave e não duplica lançamento.
- Reutilização de chave com outro conteúdo/autor: recusar, preservar registro original.
- Estado legado com revisão/lote divergente: impedir baixa e exigir estorno explícito.

### Task 1: FIN01 — cobrança e parcela

**Files:** nova migration `20261022190000_bc_finance_charge_total.sql`; novo pgTAP `supabase/tests/database/financial_integrity.test.sql`; fixture de finalização em `clinical_financial_bridge.test.sql`.
**Interfaces:** mantém `bc_recebimento_registrar(uuid,numeric,text,timestamptz,text)->uuid`; total deriva da cobrança ou snapshot clínico. Recompute bloqueia pagamento antes de somar.

- [x] Regressão RED total600/entrada100 espera total600/parcial/saldo500; casos sem total, ambiguidade, agenda-only, excesso e estorno.
- [x] Implementar resolução inequívoca da cobrança e snapshot assinado compatível com atendimento, preservar total, recusar excesso atomicamente.
- [x] GREEN SQL isolado; Node completo; registrar e commitar.

### Task 2: FIN02 — tentativa única

**Files:** nova migration `20261022191000_bc_finance_receipt_idempotency.sql`; `gestao/js/finance-receipts-api.js`, novo módulo `receipt-attempt.js`, controladores admin/colaborador, testes Node e pgTAP.
**Interfaces:** novos `bc_recebimento_registrar_v2` e `bc_recebimento_registrar_agendamento_v2`, com `p_request_key uuid` obrigatório; wrappers JS recebem `requestKey`. Tentativa pendente guarda somente chave/contexto opaco e hash local do payload em sessionStorage.

- [x] RED retry/corrida retorna mesmo UUID e uma entrada100; conteúdo/autor divergente recusado; reload mantém chave, sucesso libera nova tentativa, falha mantém.
- [x] Implementar chave/payload protegido no recebimento, bloqueio serial e validação; desativar escrita pelos wrappers antigos com mensagem de atualização.
- [x] GREEN SQL/Node; registrar e commitar.

### Task 3: FIN03 — revisão de lote

**Files:** nova migration `20261022192000_bc_finance_book_payout_guard.sql`; pgTAP e teste concorrente em `scripts/test-agenda-concurrency.py`.
**Interfaces:** mantém RPCs de livro/repasse existentes, usa ordem estável de bloqueio de livros.

- [x] RED lote50 impede reabrir/recálculo; estorno permite40 e novo lote40.
- [x] Guardas em reabertura e recálculo sob bloqueio do livro; manter estorno explícito e auditar.
- [x] GREEN SQL/Node; registrar e commitar.

### Task 4: FIN04 — baixa coerente e publicação

**Files:** nova migration `20261022193000_bc_finance_payout_settlement_guard.sql`; pgTAP e testes concorrentes financeiros.
**Interfaces:** mantém `bc_repasse_baixar(uuid,timestamptz)->uuid`, valida livros ativos fechados/mesma profissional/soma antes de alterar estados.

- [x] RED revisão/divergência/sem livros impedem baixa sem alterações; lote coerente continua funcionando.
- [x] Implementar conferências sob bloqueios; GREEN SQL/Node.
- [ ] Revisão independente da branch, CI PostgreSQL17/pgTAP/lint/advisors/concorrência e frontend, corrigir achados materiais.
- [ ] Aplicar migrations aprovadas, publicar app e verificar somente leitura/arquivos publicados; reportar limites do fluxo de caixa e convite pendente.
