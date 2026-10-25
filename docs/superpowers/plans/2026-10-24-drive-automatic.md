# BC Drive Automatic Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ativar o backup horário dos objetos clínicos privados após a autorização explícita do usuário.
**Architecture:** Edge Function autentica acionador privado, usa Vault OAuth e journal com IDs Drive reservados. Cron/pg_net chama a função; leases, restauração SHA-256 e resultados privados tornam falhas verificáveis.
**Tech Stack:** Deno TypeScript sem dependências novas; Postgres PL/pgSQL, Vault, pg_cron e pg_net.
**Spec:** `docs/superpowers/specs/2026-10-24-drive-automatic-design.md`

## Global Constraints
- Bucket único `bc-prontuario-private`; escopo exclusivo `drive.file` e duas pastas consentidas.
- Nenhum dado clínico, caminho, refresh token ou segredo em outputs, Git ou ambiente local.
- 3.000 nós; 12 novos/alterados e 12 auditorias; 12 MiB/objeto; deadline 110 s; lease 10 min.
- Nenhum acesso financeiro, alteração de papéis, frontend clínico ou mescla integral em main.
- ID Drive reservado antes de upload, download verificado antes de marcar versão completa.

## Review Focus
- Timeout após upload: repetir com o ID durável e não duplicar.
- Byte inválido/BOM: comparar bytes crus, sem decodificação de texto.
- Pastas ou arquivos movidos/compartilhados: falhar antes de considerar a cópia válida.
- Lotes maiores/objeto gigante/falha de OAuth: registrar pendência e não dizer sucesso.
- Duas chamadas simultâneas ou lease vencida: somente um escritor.

### Task 1: Worker testável
**Files:** `supabase/functions/drive-backup/{worker.ts,worker_test.ts,index.ts,runtime.ts,deno.json}`.
**Interfaces:** `createBackupHandler(config,deps)` usa `store(op,payload)`, `oauth(op,payload)`, `fetch`, `now`; retorna somente contadores e run ID.
- [x] Escrever testes de autenticação, gates, classificação, integridade, dedup, IDs reservados, falhas e limites; observar RED sem worker.
- [x] Implementar worker e runtime usando REST server-only e helpers existentes.
- [x] Observar GREEN de testes Deno e typecheck.

### Task 2: Journal e acionador
**Files:** migration `bc_drive_automatic_backup`; `supabase/tests/drive-automatic.test.mjs`.
**Interfaces:** `public.bc_drive_backup_store_v2(text,jsonb)` server-only: authorize/begin/snapshot/reserve/record/assert/finish. `private.bc_drive_backup_invoke_v2()` é o acionador SQL.
- [x] Testes PGlite exercitam grants, lease, reserva imutável, finish, rejeição de chamadas fora do servidor; observar RED.
- [x] Implementar controle desativado, journal, runs, Vault secreto e acionador; cron não é ativado na migration.
- [x] Executar testes SQL e npm test; ajustar workflow de CI.

### Task 3: Revisão, implantação e ativação
**Files:** relatório `docs/BC_DRIVE_AUTOMATICO_ATIVACAO_2026-10-24.md`, ledger e evidências agregadas.
- [x] Revisão única da mudança completa; corrigir bloqueadores com teste RED/GREEN.
- [x] Persistir fonte em branch própria; aplicar migration e verificar ACL/RLS.
- [x] Implantar worker desativado; obter bundle e conferir com fonte revisada.
- [x] Habilitar controle privado DB e cron `0 * * * *`; disparar mesmo acionador. Ver ruling do ledger: gate Edge legado é exclusivo da preparação OAuth.
- [x] Verificar primeira execução e repetição, contadores de integridade e ausência de duplicatas; registrar horário/status e rollback.
