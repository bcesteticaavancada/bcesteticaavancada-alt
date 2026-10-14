# SDD ledger — Central da Cliente, atendimento e documentos clínicos

Plan: `docs/superpowers/plans/2026-10-14-bc-gestao-central-cliente-atendimento-documentos.md`

Execution mode: Native / inline via branch GitHub dedicada + GitHub Actions.
Implementation branch: `implementation/client-central-clinical-documents`.
Production project autorizado: `tpqsmerlxquyrzrjbogj` (`bc-estetica-gestao`).
Projeto fora de escopo e proibido para escrita: `vniyooppvxpdykausdvc`.
Legacy `/admin/`: sem arquivos alterados neste PR.

## Status por tarefa

### Task 1 — TCLE específico de Bioestimulador
GREEN na branch. Migration `20261014010000_bc_gestao_bioestimulador_consent.sql`. Preserva versão histórica e cria nova versão publicada com complemento específico.
Evidência inicial: Site CI #533 e Pre-anamnese CI #274 verdes.

### Tasks 2–4 — Pasta documental + feed + Central da Cliente
GREEN na branch.
- `client_files` RPC-only, bucket privado `bc-prontuario-private`, SHA-256, MIME/tamanho, autoria e anulação auditável.
- Feed unificado de documentos BC + externos.
- Central da Cliente com hidratação sob demanda, documentos, fotos e atendimentos sem alterar `/admin/`.
Migrations: `11000` e `11500`.

### Tasks 5–6 — Atendimento rápido / encaixe
GREEN na branch.
- criação transacional de agendamento + atendimento;
- `request_key` idempotente com advisory lock;
- mesma chave + mesmo payload retorna os mesmos IDs; payload divergente é rejeitado;
- colaboradora somente na própria agenda, admin pode selecionar profissional;
- encaixe curto oferece apenas protocolo simples; composto segue fluxo clínico completo.
Migrations: `12000`, `12100`, `12200` e hardening `15000`.
Evidência: Site CI #561 e Pre-anamnese CI #302 verdes.

### Tasks 7–8 — Relatório / Parecer + PDF
GREEN na branch.
- parecer 1:1 por atendimento, autoria da profissional responsável;
- campos mínimos obrigatórios e gate `parecer_pendente`;
- parecer congelado antes do documento final;
- wizard mostra formulário e bloqueia finalização enquanto pendente;
- PDF clínico renderiza exclusivamente o parecer congelado no snapshot.
Migration: `13000`.
Evidências: Site CI #565/#569 e Pre-anamnese CI #306/#310 verdes.

### Task 9 — TCLE externo revisado
GREEN na branch.
- `treatment_external_consents` vincula um arquivo externo a um atendimento específico;
- arquivo solto nunca satisfaz o consentimento;
- somente a profissional responsável ativa pode revisar/vincular;
- mesma cliente, categoria `tcle_externo`, PDF não anulado, versão/classe/componentes compatíveis;
- gate aceita consentimento interno válido OU vínculo externo revisado compatível;
- versão final revalida o consentimento e congela referência + SHA-256 do PDF, sem `storage_path`, URL ou bytes;
- anulação/invalidação antes da versão final impede congelamento da ficha.
Migration: `14000`.
Evidências: Site CI #599, depois hardening Site CI #603; Pre-anamnese #323/#326 verdes.

### Task 10 — Hardening e regressão
GREEN na branch.
- runtime experimental redundante de TCLE externo removido; fluxo único permanece em `client-documents-panel.js` + `treatment-panel.js`;
- `anon` sem execute nos RPCs novos; tabelas clínicas permanecem RPC-only;
- protocolo composto bloqueado no encaixe curto;
- nenhum `getPublicUrl` ou policy pública adicionada;
- advisors de produção registrados como baseline antes do rollout: avisos RLS RPC-only e performance já existentes; nenhuma tentativa de "corrigir" avisos históricos fora do escopo.

## Verificação final pré-rollout

Head validado antes deste ledger: `e9bbc4fc9943f94e2cf47ad72bd7316f797c3d71`.
- Pre-anamnese CI #327: success.
- Site CI #604: success.
- Steps do Site CI: pre-anamnese existente, regressão do site, BC Gestão, Anamnese PDF e Clinical PDF — todos success.
- Lista de arquivos do PR revisada: nenhuma alteração em `/admin/`.
- Produção consultada antes do rollout: nenhuma migration `20261014` deste pacote aplicada ainda.

## Ordem de rollout aprovada pelo plano

1. Aplicar migrations `10000 → 11000 → 11500 → 12000 → 12100 → 12200 → 13000 → 14000 → 15000` no projeto `tpqsmerlxquyrzrjbogj`.
2. Publicar `generate-clinical-pdf` com JWT verification habilitada.
3. Mergear PR #39 no SHA travado após nova confirmação de CI verde.
4. Verificar GitHub Pages e advisors pós-rollout.
5. Não criar nem alterar pacientes reais durante validação; qualquer smoke de escrita deve usar dados sintéticos e somente se necessário.
