# SDD ledger — plan: docs/superpowers/plans/2026-10-14-bc-gestao-central-cliente-atendimento-documentos.md

Execution mode: Native / inline.
Implementation branch: `implementation/client-central-clinical-documents`.
Base commit: `58332b9f5da83e9299149421fb9722cd522c960f`.

Setup Ruling: o harness desta conversa não possui checkout Git local e a rede do container não resolve github.com; usar a branch GitHub dedicada como workspace isolado e GitHub Actions como executor dos comandos de teste — mantém `main` intacta e permite observar RED/GREEN por commit — custo se errado: menor granularidade de debug local e ciclos de CI mais lentos.

Pre-flight shared interfaces:
- Task 2 → Task 3: `client_files` e APIs de arquivo alimentam o feed unificado; nomes compatíveis.
- Task 3 → Task 4: painel documental será montado pela Central via lazy hydration; contratos compatíveis.
- Task 4 → Task 6: cabeçalho produz `[data-client-new-treatment]`; quick-visit panel consome esse ponto de entrada; compatível.
- Task 5 → Task 6: `createQuickVisit(...)` retorna `{appointment_id,treatment_id}`; painel abre `treatment_id`; compatível.
- Task 7 → Task 8: `getTreatmentReport`/`saveTreatmentReport` alimentam UI e PDF; compatível.
- Task 2/3 → Task 9: `client_files` categoria `tcle_externo` alimenta vínculo externo; compatível.
- Task 9 → gates existentes: helper `private.bc_treatment_consent_satisfied(uuid)` deve preservar consentimentos internos e aceitar externo revisado; compatível com a spec.
- Task 1 é independente das demais e pode ser publicada tecnicamente antes, mas rollout final permanece na Task 10.

## Task 1 — TCLE específico de Bioestimulador

Status: GREEN na branch; não aplicado em produção.

- RED commit: `f2bad1f23ef6a8bb9b6fdd414a837e5789f3e366`.
- RED Site CI #532 (`38509446899`): 407 testes antigos passaram e somente os 5 testes novos falharam por ENOENT da migration esperada.
- GREEN commit: `11d63bab8c99d351550b65809cfdc9bd75152c72`.
- GREEN Site CI #533 (`38509669243`): success, incluindo BC Gestão, site e os dois geradores de PDF.
- GREEN Pre-anamnese CI #274 (`38509668957`): success.
- Migration criada: `supabase/migrations/20261014010000_bc_gestao_bioestimulador_consent.sql`.
- Versão anterior permanece histórica; nova versão copia flags clínicas atuais e altera apenas o complemento específico.
- Ruling: não aplicar migration no Supabase produtivo antes do gate de publicação da Task 10.
