# BC Gestão — Fase 6B: Anamnese Geral, alertas, assinatura, PDF e link remoto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Anamnese Geral versionada da BC dentro da Pasta da Cliente, com preenchimento presencial/remoto, alertas clínicos informativos, dupla assinatura, PDF clínico privado e link remoto temporário de 72 horas.

**Architecture:** A 6B adiciona entidades pequenas e auditáveis para template, versões, respostas, links remotos, alertas, documentos e assinaturas. O navegador nunca define autoria, identidade profissional ou status final: RPC/RLS derivam isso de `auth.uid()` e dos cadastros. O token remoto fica no fragmento da URL e o banco armazena apenas seu hash; PDFs são gerados por Edge Function autenticada e gravados no bucket privado já existente.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Canvas 2D + Pointer Events, Web Crypto SHA-256, Node `node:test`, Supabase/PostgreSQL RLS/RPC, Supabase Storage, Supabase Edge Functions (Deno + `pdf-lib`), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-11-bc-gestao-fase6-prontuario-clientes-design.md`

## Global Constraints

- Repositório: `bcesteticaavancada/bcesteticaavancada-alt`.
- Supabase correto: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Não alterar `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`).
- Não alterar `/admin/`; somente `/gestao/`, migrations e funções da Gestão.
- Nunca expor `service_role`, senha ou secret key.
- RLS/RPC são autoridade; escrita clínica sensível não ocorre por DML direto do browser.
- Cliente pertence à BC; equipe clínica ativa lê o prontuário compartilhado.
- Financeiro da Fase 5 permanece intacto e fora da Anamnese/Linha clínica.
- Anamnese é versionada e não sobrescreve versão finalizada.
- Validade completa: 12 meses; `vencida` é estado efetivo derivado de `valid_until`.
- Estados: `nao_iniciada`, `em_preenchimento`, `aguardando_revisao_profissional`, `aguardando_assinaturas`, `finalizada`, `vencida`, `substituida`.
- Remoto nunca finaliza nem assina como profissional.
- Link remoto: aleatório, 72h, revogável, somente uma ficha, sem acesso a pasta/fotos/histórico/financeiro.
- Token remoto no fragmento `#t=...`, nunca query string; banco guarda só SHA-256.
- Sistema não diagnostica nem decide indicação/contraindicação; alertas só chamam atenção profissional.
- Documento final exige assinatura cliente/responsável + profissional.
- Menor de 18 anos exige assinatura do responsável legal; idade é recalculada na assinatura.
- Identidade profissional vem de `staff_profiles` e é snapshotada no documento.
- Assinaturas e PDFs ficam em `bc-prontuario-private`; sem URL pública.
- Não usar paciente real em teste/homologação.
- A pré-anamnese antiga é referência de UX e PDF, não fonte de dados do novo prontuário.

## Escopo da 6B

Inclui: Anamnese Geral v1, versões, revisão anual, confirmação de mudança clínica, alertas automáticos/manuais, identidade profissional, link remoto 72h, assinatura dupla, PDF privado, abas Anamnese/Documentos, timeline e download autenticado.

Fica para 6C+: módulos específicos, TCLE por procedimento, Biblioteca Clínica, nova ficha completa, gate obrigatório de leitura de alertas no início do procedimento, fotos clínicas, produtos/lotes, intercorrências, planos/pacotes e exportação integral.

## Anamnese Geral v1

Perguntas com IDs estáveis e condicionais:

- `queixa_principal`;
- `objetivos_esteticos` + `objetivo_detalhes`;
- `historico_estetico_realizou` + detalhes/reação;
- `pele_tipo`;
- `pele_condicoes_atuais` + detalhes;
- `hiperpigmentacao_pos_inflamatoria`;
- `exposicao_solar_recente` + faixa temporal;
- `usa_fotoprotecao`;
- `condicao_saude_importante` + descrição;
- `acompanhamento_medico` + descrição;
- `condicoes_relevantes` (diabetes, hipertensão, cardiovascular, autoimune, neurológica, oncológica, coagulação/trombose, imunológica, outra, nenhuma, não sabe) + detalhes;
- `medicamentos_continuos` + detalhes;
- `suplementos` + detalhes;
- `tratamento_dermatologico_recente` + detalhes;
- `alergias_conhecidas` + detalhes;
- `reacao_alergica_procedimento` + detalhes;
- `herpes_historico` + região/último episódio;
- `cicatrizacao_alterada_queloide` + detalhes;
- `cirurgias_procedimentos_recentes` + qual/quando/recuperação/orientação;
- `tabagismo_nicotina` + frequência/tempo;
- `alcool` + frequência/observação;
- `gestacao_possibilidade`;
- `amamentacao`;
- `expectativas`;
- `resultado_especifico`;
- `observacoes_finais`;
- declaração obrigatória de veracidade/atualidade;
- declaração obrigatória de tratamento de dados para finalidade de atendimento.

Nenhuma pergunta/saída usa “liberado”, “contraindicado”, “seguro” ou diagnóstico automático.

## Alertas automáticos v1

- alergia conhecida → `critico`;
- reação alérgica prévia em procedimento → `critico`;
- medicamento contínuo → `atencao`;
- condição de saúde relevante informada → `atencao`;
- gestação possível/informada → `atencao`;
- amamentação → `atencao`;
- herpes histórico → `atencao`;
- cicatrização alterada/queloide → `atencao`;
- tratamento dermatológico recente → `informativo`;
- cirurgia/procedimento recente → `informativo`.

Os textos são factuais (“Alergia informada: …”), nunca decisões clínicas.

## File Structure

### Criar

- `gestao/js/anamnese-schema.js` — template v1/condicionais.
- `gestao/js/anamnese-domain.js` — status, validade e validação.
- `gestao/js/anamnese-api.js` — RPCs autenticadas.
- `gestao/js/anamnese-panel.js` — wizard/revisão/assinaturas.
- `gestao/js/clinical-alerts-api.js` e `clinical-alerts-panel.js`.
- `gestao/js/clinical-documents-api.js`.
- `gestao/js/signature-pad.js` — pad touch isolado da Gestão.
- `gestao/js/admin-staff-profile.js`.
- `gestao/anamnese-remota/index.html`, `anamnese-remota.css`, `anamnese-remota.js`.
- `gestao/assets/anamnese.css`.
- `supabase/functions/generate-anamnese-pdf/{index.ts,pdf.ts,pdf_test.ts,deno.json}`.
- `tests/gestao/anamnese-*.test.mjs`.
- `tests/gestao/clinical-alerts.test.mjs`.
- `tests/gestao/clinical-documents.test.mjs`.
- `tests/gestao/admin-staff-profile.test.mjs`.
- `tests/gestao/phase6b-{database-contract,rpc-grants,storage-contract}.test.mjs`.
- migrations 6B: core, alerts, documents/signatures, remote links e hardening corretivo se necessário.

### Modificar

- `gestao/js/clientes-folder.js` e `clientes-panel.js`.
- `gestao/admin/index.html` e `gestao/colaborador/index.html`.
- `gestao/assets/clientes-folder.css`.
- `tests/gestao/clientes-folder.test.mjs`.
- `.github/workflows/site-ci.yml` se necessário para testes Deno.

## Data Model

### `staff_profiles`
Adicionar `profissao`, `conselho`, `registro_conselho`. Nullable para compatibilidade; somente admin altera. Finalização bloqueia perfil profissional incompleto.

### `anamnese_template_versions`
`id`, `template_key`, `version`, `schema_json`, `active`, timestamps. Único por `(template_key,version)`. Seed inicial: `bc-geral` v1.

### `anamneses_gerais`
`id`, `cliente_id`, `version`, `template_version_id`, `status`, `source`, `supersedes_id`, `created_by`, `reviewed_by/at`, `finalized_by/at`, `valid_until`, timestamps. Único por `(cliente_id,version)` e uma única versão aberta por cliente.

### `anamnese_respostas`
`id`, `anamnese_id`, `question_key`, `answer_json`, `updated_at`; único por `(anamnese_id,question_key)`. Escrita só em versão aberta por RPC.

### `anamnese_confirmacoes_clinicas`
`id`, `cliente_id`, `anamnese_id`, `changed`, `details`, `confirmed_by`, `confirmed_at`.

### `clinical_alerts`
`id`, `cliente_id`, `level`, `origin_type`, `origin_id`, `alert_key`, `description`, `active`, `created_by/at`, `inactivated_by/at`, `inactivation_reason`.

### `anamnese_remote_links`
`id`, `anamnese_id`, `token_hash`, `expires_at`, `created_by/at`, `revoked_at`, `last_access_at`, `submitted_at`. Token bruto nunca persistido.

### `clinical_documents`
`id`, `cliente_id`, `document_type`, `source_id`, `source_version`, `document_version`, `document_code`, `status`, snapshot profissional, `storage_path`, `sha256`, `generated_at`, `created_at`.

Estados: `aguardando_assinaturas`, `pronto_para_pdf`, `gerando_pdf`, `emitido`, `erro_pdf`.

### `clinical_signatures`
`id`, `document_id`, `signer_kind` (`paciente|responsavel|profissional`), `signer_user_id`, snapshot de nome/identidade profissional, `storage_path`, `sha256`, `signed_at`, `recorded_by`. Sem UPDATE/DELETE direto.

## Interfaces

```js
ANAMNESE_TEMPLATE_V1
getVisibleQuestions({ answers, template }) -> Question[]
validateAnamneseAnswers({ answers, template }) -> { valid, missing }
deriveEffectiveAnamneseStatus(record, now) -> string
isAnamneseCurrent(record, now) -> boolean
buildAnamneseSummary({ answers, template }) -> SummarySection[]
```

```js
getAnamneseState({ client, clienteId })
beginAnamnese({ client, clienteId, source })
saveAnamneseAnswers({ client, anamneseId, answers })
submitAnamneseForReview({ client, anamneseId })
markAnamneseReviewed({ client, anamneseId }) -> { documentId }
listAnamneseVersions({ client, clienteId })
recordClinicalConfirmation({ client, clienteId, anamneseId, changed, details })
createRemoteLink({ client, anamneseId }) -> { token, expiresAt }
revokeRemoteLink({ client, linkId })
```

RPCs autenticadas: `bc_anamnese_state`, `bc_anamnese_begin`, `bc_anamnese_save_answers`, `bc_anamnese_submit_review`, `bc_anamnese_mark_reviewed`, `bc_anamnese_versions`, `bc_anamnese_confirm_clinical_change`, `bc_anamnese_create_remote_link`, `bc_anamnese_revoke_remote_link`.

RPCs remotas permitidas a `anon`: `bc_anamnese_remote_get(p_token)` e `bc_anamnese_remote_save(p_token,p_answers,p_submit)`; nenhum grant direto de tabela.

```js
listClinicalAlerts({ client, clienteId, activeOnly })
createManualClinicalAlert({ client, clienteId, level, description })
inactivateClinicalAlert({ client, alertId, reason }) // admin-only
```

```js
uploadClinicalSignature({ client, documentId, signerKind, file })
registerClinicalSignature({ client, documentId, signerKind, storagePath, sha256 })
listClinicalDocuments({ client, clienteId })
finalizeAnamneseDocument({ client, documentId })
generateAnamnesePdf({ client, documentId })
getClinicalDocumentUrl({ client, storagePath, expiresIn = 300 })
```

Edge Function `generate-anamnese-pdf`: JWT obrigatório; recebe somente `documentId`; busca dados server-side; gera PDF; grava `documentos/anamnese/...`; calcula SHA-256; marca `emitido`; idempotente.

## Review Focus

1. Token inválido/expirado/revogado deve falhar sem enumerar cliente; token bruto nunca persiste.
2. Corrida de duas versões abertas deve resultar em uma única versão válida.
3. Menor que completa 18 entre preenchimento e assinatura usa idade na assinatura sem apagar histórico anterior.
4. Perfil profissional incompleto bloqueia assinatura/finalização sem inventar conselho/registro.
5. Falha na geração do PDF preserva assinaturas/anamnese e permite retry idempotente.

---

### Task 1: Testes RED da 6B

**Files:** todos os novos `tests/gestao/*6b*`, `anamnese-*`, `clinical-*`, `admin-staff-profile`.

- [ ] Escrever testes de template/condicionais, validade anual, APIs sem autoria enviada pelo browser, segurança/grants, Storage privado, remoto 72h, assinaturas e perfil profissional.
- [ ] Rodar `npm run test:gestao`.
- [ ] Esperado: testes antigos verdes e novos 6B falhando por implementação inexistente.
- [ ] Commit: `test: define contratos da fase 6B`.

### Task 2: Core versionado da Anamnese

**Files:** migration core + testes SQL.

- [ ] Verificar docs/changelog Supabase atuais.
- [ ] Criar template, anamnese, respostas e confirmações.
- [ ] Seed `bc-geral` v1.
- [ ] Garantir uma versão aberta por cliente.
- [ ] Implementar begin/save/submit/review/list/state/confirmation por RPC; autor vem de `auth.uid()`.
- [ ] `vencida` é derivado de `valid_until`; sem cron obrigatório.
- [ ] RLS/grants mínimos; nenhuma escrita clínica direta.
- [ ] Rodar contratos SQL e commit `feat: adiciona anamnese geral versionada`.

### Task 3: Identidade profissional administrativa

**Files:** `admin-staff-profile.js`, admin HTML, migration core/corretiva, teste.

- [ ] Adicionar `profissao`, `conselho`, `registro_conselho` a `staff_profiles`.
- [ ] Criar RPC de atualização admin-only e listagem clínica sem segredos.
- [ ] Adicionar seção “Identificação profissional” no BC Gestão admin.
- [ ] Marcar perfil incompleto; não hardcodar credenciais.
- [ ] Testar e commit `feat: cadastra identidade profissional para documentos`.

### Task 4: Alertas clínicos

**Files:** migration alerts, APIs/painel, teste.

- [ ] Criar `clinical_alerts` com RLS, sem delete direto.
- [ ] Implementar sync automático com os mapeamentos v1.
- [ ] Na nova versão finalizada, inativar alertas automáticos da versão substituída com motivo e recriar os atuais.
- [ ] Staff cria alerta manual; somente Mel inativa com motivo.
- [ ] Exibir ativos no topo da Pasta e histórico na área clínica.
- [ ] Testar ausência de diagnóstico e commit `feat: adiciona alertas clinicos do prontuario`.

### Task 5: Link remoto de 72h

**Files:** migration remote links, `gestao/anamnese-remota/*`, testes.

- [ ] Gerar token de >=32 bytes; armazenar só hash; expirar em 72h; regeneração revoga link ativo anterior.
- [ ] `remote_get/save` aceitam somente token, nunca `cliente_id` do browser.
- [ ] Payload remoto mínimo: nome de exibição, schema, respostas, status/expiração.
- [ ] Página lê `#t=`, mantém token apenas em memória e remove-o da barra com `history.replaceState`.
- [ ] Fluxo multipágina; submit remoto → `aguardando_revisao_profissional`.
- [ ] 71h59 válido; >=72h, revogado, finalizado ou token errado → mensagem neutra.
- [ ] Commit `feat: adiciona pre preenchimento remoto da anamnese`.

### Task 6: Documentos e assinaturas privadas

**Files:** migration documents/signatures, `signature-pad.js`, `clinical-documents-api.js`, testes.

- [ ] Criar `clinical_documents`/`clinical_signatures`, RLS e grants; escrita direta revogada.
- [ ] Storage: equipe ativa pode inserir somente `assinaturas/<documentId>/...`; sem update/delete; `documentos/` não é gravável pelo browser.
- [ ] Implementar pad touch robusto (DPR, resize, Pointer Events, validação de traço).
- [ ] Hash SHA-256 no cliente antes de registrar assinatura.
- [ ] Backend deriva assinante: profissional = `auth.uid()`/staff; paciente/responsável = cadastro da cliente.
- [ ] Regra de menoridade na data da assinatura.
- [ ] `bc_anamnese_finalize_document` exige revisão, assinaturas e perfil profissional completo; define `valid_until = finalized_at + interval '1 year'`, substitui versão anterior e deixa `pronto_para_pdf`.
- [ ] Commit `feat: adiciona assinaturas privadas da anamnese`.

### Task 7: PDF institucional da Anamnese

**Files:** `supabase/functions/generate-anamnese-pdf/*`, CI.

- [ ] Edge Function com `verify_jwt=true`; recebe só `documentId`.
- [ ] Gerar snapshot server-side: cliente, foto de identificação quando disponível, template/respostas, declarações, assinaturas e identidade profissional.
- [ ] PDF multi-page com cabeçalho BC, código, versão, data/hora, seções agrupadas e assinaturas; sem decisões clínicas.
- [ ] Gravar em `bc-prontuario-private/documentos/anamnese/<clienteId>/<documentId>/v<documentVersion>.pdf`.
- [ ] Calcular SHA-256, marcar `emitido`; geração idempotente; falha → `erro_pdf` e retry.
- [ ] Testar textos longos, menor/responsável e perfil profissional; adicionar Deno test ao CI se necessário.
- [ ] Commit `feat: gera PDF clinico da anamnese`.

### Task 8: Wizard presencial + revisão + assinatura na Pasta

**Files:** `anamnese-schema/domain/api/panel.js`, CSS, `clientes-folder/panel`, admin/colaborador HTML, testes.

- [ ] Implementar template/helpers v1.
- [ ] Adicionar aba Anamnese: status, versão, validade, iniciar/atualizar, link remoto e versões.
- [ ] Wizard multipágina com condicionais e revisão final.
- [ ] Remota submetida abre para revisão profissional; profissional pode corrigir versão aberta antes das assinaturas.
- [ ] Coletar paciente/responsável e depois profissional; bloquear perfil profissional incompleto.
- [ ] Finalizar por RPC e chamar Edge Function; retry de PDF sem duplicar versão.
- [ ] Checklist marca vigente/concluída ou vencida/pendente; cabeçalho mostra alertas.
- [ ] Commit `feat: integra anamnese geral a pasta da cliente`.

### Task 9: Documentos + Timeline + download privado

- [ ] Adicionar aba Documentos com código/versão/data/status da Anamnese.
- [ ] Download por signed URL de 300s; URL nunca persiste no banco.
- [ ] Timeline recebe eventos de Anamnese/documento sem financeiro.
- [ ] Versões antigas ficam somente leitura e mantêm PDFs antigos.
- [ ] Commit `feat: adiciona documentos da anamnese ao prontuario`.

### Task 10: Auditoria e hardening

- [ ] Auditar: início/submissão/revisão/finalização/substituição, link criado/revogado, alerta criado/inativado, assinatura, PDF emitido/erro, identidade profissional.
- [ ] `audit_log` não recebe respostas médicas completas, token, assinatura base64, CPF ou PDF.
- [ ] Confirmar `anon` somente em `remote_get/save`; private implementations nunca `PUBLIC`.
- [ ] Confirmar Storage sem acesso público.
- [ ] Rodar `npm test` (+ Deno tests) e corrigir regressões da Fase 5/6A.
- [ ] Commit `test: endurece seguranca da fase 6B`.

### Task 11: Aplicar e homologar no Supabase correto

- [ ] Confirmar `bc-estetica-gestao` / `tpqsmerlxquyrzrjbogj` saudável.
- [ ] Capturar advisors security/performance antes.
- [ ] Aplicar migrations em ordem; deploy `generate-anamnese-pdf` com JWT obrigatório.
- [ ] Verificar tabelas, índices, RLS, grants, policies e bucket privado.
- [ ] Homologar adulta, menor, versão única, vencimento, link 72h e alertas em transações sintéticas com `ROLLBACK` quando possível.
- [ ] Para PDF, se necessário criar exclusivamente entidade `HOMOLOGACAO_FASE6B`, emitir/verificar e remover dados/objetos sintéticos; nunca paciente real.
- [ ] Advisors pós-DDL sem novo finding crítico/alto provocado pela 6B.

### Task 12: Branch de implementação, PR e publicação

- [ ] Após aprovação deste plano, criar `feature/fase6b-anamnese-documentos` **a partir de `plan/fase6b-anamnese-documentos`**, para o plano viajar junto com o código.
- [ ] Executar as Tasks 1–11 em TDD, com commits frequentes.
- [ ] CI da branch verde; abrir PR contra `main`.
- [ ] Revisar diff completo, permissões, token/URLs, Storage, ausência de segredo e compatibilidade Fase 5/6A.
- [ ] Confirmar PR clean/mergeable e checks verdes.
- [ ] Mesclar somente após aprovação do usuário.
- [ ] Acompanhar CI da `main` e GitHub Pages no mesmo SHA; smoke test sem paciente real.

## Self-review

- **Cobertura:** 6B cobre Anamnese Geral, 12 meses, estados, remoto 72h, revisão, alertas, identidade profissional, dupla assinatura, PDF, Documentos, Timeline, auditoria e Storage.
- **Deferido conscientemente:** módulos/TCLE e gate de leitura de alertas no procedimento ficam para 6C, pois dependem da Biblioteca/Ficha nova.
- **Segurança:** token bruto nunca persiste; `anon` não acessa tabelas; assinatura/PDF não são públicos; service role só em environment da Edge Function.
- **Compatibilidade:** 6A continua base do cadastro/foto/Pasta; Fase 5 não é tocada; `/admin/` e pré-anamnese antiga permanecem intactos.
- **PDF:** falha de geração não perde anamnese/assinaturas e pode ser repetida idempotentemente.
- **Plan branch:** a implementação nasce da branch deste plano para preservar o documento no PR.