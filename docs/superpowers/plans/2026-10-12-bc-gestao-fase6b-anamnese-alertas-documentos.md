# BC Gestão — Fase 6B: Anamnese Geral, alertas, assinatura, PDF e link remoto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Anamnese Geral versionada da BC dentro da Pasta da Cliente, com preenchimento presencial/remoto, alertas clínicos informativos, dupla assinatura, PDF clínico privado e link remoto temporário de 72 horas.

**Architecture:** A 6B adiciona entidades pequenas e auditáveis para template, versão da anamnese, respostas, links remotos, alertas, documentos e assinaturas. O navegador nunca define autoria clínica, identidade profissional, status final nem acesso; esses dados são derivados por RPCs/RLS de `auth.uid()` e do cadastro. O link remoto funciona como credencial bearer aleatória mantida apenas no fragmento da URL; o banco guarda somente o hash e expõe ao `anon` apenas RPCs estritamente limitadas à anamnese vinculada ao token. PDFs são gerados em Edge Function autenticada no projeto correto e gravados no bucket privado já existente.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Canvas 2D + Pointer Events, Web Crypto SHA-256, Node.js `node:test`, Supabase/PostgreSQL (RLS/RPC), Supabase Storage privado, Supabase Edge Functions (Deno + `pdf-lib`), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-11-bc-gestao-fase6-prontuario-clientes-design.md`

## Global Constraints

- Repositório: `bcesteticaavancada/bcesteticaavancada-alt`.
- Supabase correto: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Não alterar `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`).
- Não alterar o legado `/admin/`; trabalhar somente em `/gestao/`, migrations e nova Edge Function da Gestão.
- Nunca expor `service_role`, secret key, senha ou credencial em frontend, GitHub ou chat.
- Todo schema exposto deve usar RLS e grants explícitos; mutações clínicas sensíveis passam por RPC.
- Cliente pertence à BC; equipe clínica ativa pode ler o prontuário compartilhado.
- Financeiro da Fase 5 permanece intacto e não aparece na Anamnese/Linha do Tempo clínica.
- Anamnese Geral é versionada; versão anterior nunca é sobrescrita nem excluída.
- Anamnese completa vence 12 meses após finalização; vencimento é derivado de `valid_until`, sem cron obrigatório.
- Status canônicos: `nao_iniciada`, `em_preenchimento`, `aguardando_revisao_profissional`, `aguardando_assinaturas`, `finalizada`, `vencida`, `substituida`.
- Preenchimento remoto nunca finaliza documento nem coleta a assinatura profissional.
- Link remoto: token aleatório não enumerável, validade exata de 72h, acesso somente à ficha vinculada, revogável e inutilizável após finalização.
- URL remota usa token no fragmento (`#t=...`), não em query string.
- Sistema não diagnostica, não recomenda procedimento e não decide contraindicação; alertas são somente “informação para avaliação profissional”.
- Assinaturas são coletadas em tela; para menor de 18 anos, o responsável legal é o assinante obrigatório do lado da cliente.
- Documento final exige assinatura da cliente/responsável e da profissional.
- Identidade profissional no documento vem de `staff_profiles` e fica snapshotada no documento final.
- Foto/assinatura/PDF permanecem no bucket privado `bc-prontuario-private`; nunca usar `getPublicUrl`.
- PDF emitido é imutável; nova correção gera nova versão em fases que permitirem retificação documental.
- Não usar paciente real em testes/homologação; usar somente transações fictícias com `ROLLBACK` ou dados sintéticos explicitamente removidos.
- O conteúdo-base da Anamnese v1 preserva a organização da pré-anamnese existente (dados/objetivo/histórico/pele/sol/saúde/medicações/alergias/hábitos/gestação/cirurgias/expectativas/observações), expandida apenas pelas seções já aprovadas na spec.
- A pré-anamnese antiga continua independente e não é migrada/alterada pela 6B.

## Escopo da 6B

### Inclui

- Anamnese Geral v1 e versionamento;
- revisão anual em 12 meses;
- confirmação clínica “houve mudança?” para uso futuro no atendimento;
- alertas automáticos derivados de respostas informadas;
- alertas manuais e inativação administrativa auditada;
- campos profissionais (profissão/conselho/registro) em `staff_profiles`;
- link remoto de 72h;
- formulário remoto sem login e sem acesso ao prontuário;
- assinatura paciente/responsável + profissional;
- documento clínico e PDF privado da Anamnese Geral;
- aba Anamnese e Documentos na Pasta da Cliente;
- eventos na Linha do Tempo;
- download autenticado do PDF da Anamnese.

### Continua para 6C+

- módulos específicos por procedimento;
- termos/TCLE específicos;
- Biblioteca Clínica;
- nova ficha de atendimento completa e gate de leitura de alertas antes de procedimento;
- fotos clínicas antes/durante/depois;
- produtos/lotes/equipamentos;
- intercorrências;
- planos/pacotes e exportação integral.

## Conteúdo da Anamnese Geral v1

A definição é um template versionado. Perguntas condicionais usam IDs estáveis para permitir histórico e alertas sem depender do texto visual.

1. `queixa_principal` — texto.
2. `objetivos_esteticos` — múltipla escolha + `objetivo_detalhes`.
3. `historico_estetico_realizou` — sim/não; se sim: `historico_estetico_detalhes`, `historico_estetico_reacao`.
4. `pele_tipo` — seca/oleosa/mista/sensível/normal/não sabe.
5. `pele_condicoes_atuais` — acne/manchas/vermelhidão/sensibilidade/descamação/feridas-ou-lesões/nenhuma/não sabe + detalhes.
6. `hiperpigmentacao_pos_inflamatoria` — sim/não/não sabe + detalhes.
7. `exposicao_solar_recente` — sim/não; se sim: faixa temporal.
8. `usa_fotoprotecao` — sim/não/às vezes.
9. `condicao_saude_importante` — sim/não/prefere conversar; se sim: descrição.
10. `acompanhamento_medico` — sim/não; se sim: descrição.
11. `condicoes_relevantes` — múltipla escolha informativa: diabetes, hipertensão, cardiovascular, autoimune, neurológica, oncológica, coagulação/trombose, imunológica, outra, nenhuma, não sabe; detalhes opcionais. Nenhuma opção decide elegibilidade.
12. `medicamentos_continuos` — sim/não; detalhes com nome/dose/motivo se souber.
13. `suplementos` — sim/não; detalhes.
14. `tratamento_dermatologico_recente` — sim/não/não sabe; detalhes/quando.
15. `alergias_conhecidas` — sim/não/não sabe; detalhes.
16. `reacao_alergica_procedimento` — sim/não; detalhes.
17. `herpes_historico` — sim/não/não sabe; região/último episódio se souber.
18. `cicatrizacao_alterada_queloide` — sim/não/não sabe; detalhes.
19. `cirurgias_procedimentos_recentes` — sim/não; qual/quando/recuperação/orientação médica relacionada.
20. `tabagismo_nicotina` — sim/não; frequência/tempo.
21. `alcool` — sim/não; frequência/observação.
22. `gestacao_possibilidade` — sim/não/prefere não informar/não se aplica.
23. `amamentacao` — sim/não/não se aplica.
24. `expectativas` — texto.
25. `resultado_especifico` — texto opcional.
26. `observacoes_finais` — texto livre.
27. declaração obrigatória de veracidade/atualidade.
28. declaração obrigatória de tratamento dos dados para finalidade de atendimento conforme aviso de privacidade.

O template não contém frases de “liberado”, “contraindicado”, “seguro” ou diagnóstico.

## Alertas automáticos v1

Alertas são espelhos informativos de respostas positivas e preservam a origem da versão da anamnese. Na 6B, os mapeamentos automáticos são deliberadamente conservadores:

- alergia conhecida → `critico`, texto factual “Alergia informada: …”;
- reação alérgica em procedimento → `critico`;
- medicamento contínuo → `atencao`;
- condição de saúde importante/condição relevante informada → `atencao`;
- gestação possível/informada → `atencao`;
- amamentação → `atencao`;
- herpes histórico → `atencao`;
- cicatrização alterada/queloide → `atencao`;
- tratamento dermatológico recente → `informativo`;
- cirurgia/procedimento recente → `informativo`.

A regra apenas chama atenção; não bloqueia automaticamente procedimento.

## File Structure

### Criar

- `gestao/js/anamnese-schema.js` — template v1, perguntas, condicionais e mapeamento de seções.
- `gestao/js/anamnese-domain.js` — status derivado, validade, serialização/validação de respostas.
- `gestao/js/anamnese-api.js` — RPCs autenticadas da anamnese/links/documentos.
- `gestao/js/anamnese-panel.js` — aba Anamnese da Pasta, wizard, revisão e status.
- `gestao/js/clinical-alerts-api.js` — leitura/criação/inativação de alertas.
- `gestao/js/clinical-alerts-panel.js` — resumo/gestão visual de alertas.
- `gestao/js/clinical-documents-api.js` — assinaturas, geração e download privado.
- `gestao/js/signature-pad.js` — pad touch isolado para o BC Gestão, baseado na experiência já homologada da pré-anamnese.
- `gestao/js/admin-staff-profile.js` — editor administrativo de profissão/conselho/registro.
- `gestao/anamnese-remota/index.html` — entrada pública por token no fragmento.
- `gestao/anamnese-remota/anamnese-remota.css`.
- `gestao/anamnese-remota/anamnese-remota.js` — bootstrap remoto e comunicação somente via RPC limitada por token.
- `gestao/assets/anamnese.css` — estilos do wizard/documentos/alertas dentro da Gestão.
- `supabase/functions/generate-anamnese-pdf/index.ts`.
- `supabase/functions/generate-anamnese-pdf/pdf.ts`.
- `supabase/functions/generate-anamnese-pdf/deno.json`.
- `supabase/functions/generate-anamnese-pdf/pdf_test.ts`.
- `tests/gestao/anamnese-schema.test.mjs`.
- `tests/gestao/anamnese-domain.test.mjs`.
- `tests/gestao/anamnese-api.test.mjs`.
- `tests/gestao/anamnese-panel.test.mjs`.
- `tests/gestao/clinical-alerts.test.mjs`.
- `tests/gestao/clinical-documents.test.mjs`.
- `tests/gestao/anamnese-remota.test.mjs`.
- `tests/gestao/admin-staff-profile.test.mjs`.
- `tests/gestao/phase6b-database-contract.test.mjs`.
- `tests/gestao/phase6b-rpc-grants.test.mjs`.
- `tests/gestao/phase6b-storage-contract.test.mjs`.
- `supabase/migrations/<gerado>_bc_gestao_phase6b_anamnese_core.sql`.
- `supabase/migrations/<gerado>_bc_gestao_phase6b_alerts.sql`.
- `supabase/migrations/<gerado>_bc_gestao_phase6b_documents_signatures.sql`.
- `supabase/migrations/<gerado>_bc_gestao_phase6b_remote_links.sql`.

### Modificar

- `gestao/js/clientes-folder.js` — incluir cabeçalho clínico, abas Anamnese/Documentos e eventos da linha do tempo.
- `gestao/js/clientes-panel.js` — inicializar módulos da 6B ao abrir cliente.
- `gestao/admin/index.html` — carregar CSS/JS, adicionar área administrativa mínima de identificação profissional.
- `gestao/colaborador/index.html` — carregar CSS/JS da 6B.
- `gestao/assets/clientes-folder.css` — encaixe de alertas/status no cabeçalho.
- `tests/gestao/clientes-folder.test.mjs`.
- `.github/workflows/site-ci.yml` — executar testes Deno da nova Edge Function se o runner ainda não os executar.

## Data Model

### `staff_profiles` — novos campos

- `profissao text`;
- `conselho text`;
- `registro_conselho text`.

São dados administrativos. Somente Mel/ADM altera. Documento final preserva snapshot; alteração futura não reescreve PDF antigo.

### `anamnese_template_versions`

- `id uuid`;
- `template_key text` (`bc-geral`);
- `version integer`;
- `schema_json jsonb`;
- `active boolean`;
- `created_at timestamptz`;
- `created_by uuid nullable` para seed inicial.

Único por `(template_key, version)`. A 6B semeia `bc-geral` v1; não cria editor de template.

### `anamneses_gerais`

- `id uuid`;
- `cliente_id uuid`;
- `version integer` sequencial por cliente;
- `template_version_id uuid`;
- `status text` armazenado para estados transitórios/finais, exceto `vencida` derivado por `valid_until`;
- `source text` (`presencial`/`remota`);
- `supersedes_id uuid nullable`;
- `created_by uuid`;
- `reviewed_by uuid nullable`;
- `reviewed_at timestamptz nullable`;
- `finalized_by uuid nullable`;
- `finalized_at timestamptz nullable`;
- `valid_until timestamptz nullable`;
- `created_at/updated_at`.

Invariantes:
- uma única versão aberta (`em_preenchimento`, `aguardando_revisao_profissional`, `aguardando_assinaturas`) por cliente;
- versão numérica única por cliente;
- versão finalizada não recebe alteração direta de respostas;
- ao finalizar nova versão, a anterior finalizada passa a `substituida` sem ser apagada.

### `anamnese_respostas`

- `id uuid`;
- `anamnese_id uuid`;
- `question_key text`;
- `answer_json jsonb`;
- `updated_at timestamptz`.

Único por `(anamnese_id, question_key)`. Escrita somente enquanto a versão estiver aberta e por RPC autorizada.

### `anamnese_confirmacoes_clinicas`

- `id uuid`;
- `cliente_id uuid`;
- `anamnese_id uuid`;
- `changed boolean`;
- `details text nullable`;
- `confirmed_by uuid`;
- `confirmed_at timestamptz`.

Na 6B expõe API e histórico; o gate obrigatório dentro da nova Ficha de Atendimento será conectado em 6C.

### `clinical_alerts`

- `id uuid`;
- `cliente_id uuid`;
- `level text` (`critico`, `atencao`, `informativo`);
- `origin_type text` (`anamnese`, `manual`, futuro `intercorrencia`);
- `origin_id uuid nullable`;
- `alert_key text nullable`;
- `description text`;
- `active boolean`;
- `created_by uuid nullable`;
- `created_at timestamptz`;
- `inactivated_by uuid nullable`;
- `inactivated_at timestamptz nullable`;
- `inactivation_reason text nullable`.

Alertas automáticos são sincronizados por versão finalizada e nunca sobrescrevem histórico de versões anteriores; os da versão substituída podem ser inativados automaticamente com motivo técnico explícito quando a nova versão é finalizada e então recriados conforme respostas atuais.

### `anamnese_remote_links`

- `id uuid`;
- `anamnese_id uuid`;
- `token_hash text` único;
- `expires_at timestamptz` = criação + 72h;
- `created_by uuid`;
- `created_at timestamptz`;
- `revoked_at timestamptz nullable`;
- `last_access_at timestamptz nullable`;
- `submitted_at timestamptz nullable`.

Nunca armazenar token bruto. Regenerar link revoga links ainda ativos da mesma versão.

### `clinical_documents`

- `id uuid`;
- `cliente_id uuid`;
- `document_type text` (`anamnese_geral` na 6B);
- `source_id uuid` (`anamneses_gerais.id`);
- `source_version integer`;
- `document_version integer` default 1;
- `document_code text` único;
- `status text` (`aguardando_assinaturas`, `pronto_para_pdf`, `gerando_pdf`, `emitido`, `erro_pdf`);
- `professional_name/profissao/conselho/registro_conselho` snapshot;
- `storage_path text nullable`;
- `sha256 text nullable`;
- `generated_at timestamptz nullable`;
- `created_at timestamptz`.

### `clinical_signatures`

- `id uuid`;
- `document_id uuid`;
- `signer_kind text` (`paciente`, `responsavel`, `profissional`);
- `signer_user_id uuid nullable` para profissional;
- `signer_name_snapshot text`;
- `professional_profissao/conselho/registro_snapshot text nullable`;
- `storage_path text`;
- `sha256 text`;
- `signed_at timestamptz`;
- `recorded_by uuid` (sessão autenticada que operou o aparelho).

Único por `(document_id, signer_kind)` para a versão atual do documento. Não há UPDATE/DELETE direto por `authenticated`.

## Interfaces

### Domínio/template

```js
ANAMNESE_TEMPLATE_V1
getVisibleQuestions({ answers, template = ANAMNESE_TEMPLATE_V1 }) -> Array<Question>
validateAnamneseAnswers({ answers, template = ANAMNESE_TEMPLATE_V1 }) -> { valid: boolean, missing: string[] }
deriveEffectiveAnamneseStatus({ status, valid_until }, now = new Date()) -> string
isAnamneseCurrent(record, now = new Date()) -> boolean
buildAnamneseSummary({ answers, template }) -> Array<SummarySection>
```

### API autenticada

```js
getAnamneseState({ client, clienteId }) -> Promise<AnamneseState>
beginAnamnese({ client, clienteId, source = 'presencial' }) -> Promise<string>
saveAnamneseAnswers({ client, anamneseId, answers }) -> Promise<void>
submitAnamneseForReview({ client, anamneseId }) -> Promise<void>
markAnamneseReviewed({ client, anamneseId }) -> Promise<{ documentId: string }>
listAnamneseVersions({ client, clienteId }) -> Promise<AnamneseVersion[]>
recordClinicalConfirmation({ client, clienteId, anamneseId, changed, details }) -> Promise<string>
createRemoteLink({ client, anamneseId }) -> Promise<{ token: string, expiresAt: string }>
revokeRemoteLink({ client, linkId }) -> Promise<void>
```

Backend autenticado:
- `public.bc_anamnese_state(p_cliente_id uuid)`;
- `public.bc_anamnese_begin(p_cliente_id uuid, p_source text) returns uuid`;
- `public.bc_anamnese_save_answers(p_anamnese_id uuid, p_answers jsonb)`;
- `public.bc_anamnese_submit_review(p_anamnese_id uuid)`;
- `public.bc_anamnese_mark_reviewed(p_anamnese_id uuid) returns uuid`;
- `public.bc_anamnese_versions(p_cliente_id uuid)`;
- `public.bc_anamnese_confirm_clinical_change(...)`;
- `public.bc_anamnese_create_remote_link(p_anamnese_id uuid)`;
- `public.bc_anamnese_revoke_remote_link(p_link_id uuid)`.

### API remota anônima

```js
loadRemoteAnamnese({ client, token }) -> Promise<RemoteAnamnesePayload>
saveRemoteAnamnese({ client, token, answers, submit = false }) -> Promise<RemoteSaveResult>
```

Backend permitido a `anon` e `authenticated`, sem grants de tabela:
- `public.bc_anamnese_remote_get(p_token text)`;
- `public.bc_anamnese_remote_save(p_token text, p_answers jsonb, p_submit boolean)`.

Retorno remoto mínimo:
- `anamnese_id` não precisa ser exposto;
- nome de exibição da cliente;
- template/schema v1;
- respostas daquela ficha;
- status remoto;
- expiração;
- nunca CPF, endereço, prontuário, fotos, histórico, financeiro, outras versões ou IDs de profissionais.

### Alertas

```js
listClinicalAlerts({ client, clienteId, activeOnly = false }) -> Promise<ClinicalAlert[]>
createManualClinicalAlert({ client, clienteId, level, description }) -> Promise<string>
inactivateClinicalAlert({ client, alertId, reason }) -> Promise<void>
```

Backend:
- `public.bc_clinical_alerts(p_cliente_id uuid, p_active_only boolean)`;
- `public.bc_clinical_alert_create_manual(...)`;
- `public.bc_clinical_alert_inactivate(...)` — admin-only.

### Identidade profissional

```js
listProfessionalProfiles({ client }) -> Promise<ProfessionalProfile[]>
updateProfessionalIdentity({ client, userId, profissao, conselho, registroConselho }) -> Promise<void>
```

Backend:
- `public.bc_staff_professional_profiles()`;
- `public.bc_staff_update_professional_identity(...)` — admin-only.

### Assinaturas/documentos

```js
uploadClinicalSignature({ client, documentId, signerKind, file }) -> Promise<{ storagePath, sha256 }>
registerClinicalSignature({ client, documentId, signerKind, storagePath, sha256 }) -> Promise<string>
listClinicalDocuments({ client, clienteId }) -> Promise<ClinicalDocument[]>
finalizeAnamneseDocument({ client, documentId }) -> Promise<{ documentId, anamneseId }>
generateAnamnesePdf({ client, documentId }) -> Promise<ClinicalDocument>
getClinicalDocumentUrl({ client, storagePath, expiresIn = 300 }) -> Promise<string>
```

Backend:
- `public.bc_document_register_signature(...)`;
- `public.bc_anamnese_finalize_document(p_document_id uuid)`;
- leitura de `clinical_documents`/`clinical_signatures` somente conforme RLS da equipe ativa; escrita direta revogada.

Edge Function autenticada:
- `generate-anamnese-pdf` com `verify_jwt=true`;
- recebe apenas `documentId`;
- valida JWT/equipe ativa;
- busca snapshot finalizado via RPC/DB server-side;
- gera PDF institucional com `pdf-lib`;
- grava em `bc-prontuario-private/documentos/anamnese/...`;
- calcula SHA-256;
- marca documento `emitido` de forma idempotente;
- nunca aceita respostas, identidade profissional ou `storage_path` arbitrários vindos do browser.

## Review Focus

1. **Token remoto vazado/expirado/revogado:** deve falhar sem revelar se existe outra cliente; token bruto nunca é persistido e não aparece em query string.
2. **Corrida entre duas versões abertas:** índice/regra do banco garante apenas uma anamnese aberta por cliente; segunda criação reutiliza a aberta ou falha de forma controlada.
3. **Menor completa 18 anos entre preenchimento e assinatura:** regra usa idade na data da assinatura/finalização e preserva responsável anterior sem apagar histórico.
4. **Perfil profissional incompleto:** documento não pode ser finalizado/emitido sem nome, profissão, conselho e registro da profissional; UI aponta pendência sem inventar dado.
5. **PDF falha depois das assinaturas:** anamnese/documento permanecem íntegros com `erro_pdf` e geração pode ser repetida idempotentemente sem criar versão clínica nova.

---

### Task 1: Criar contratos RED da Fase 6B

**Files:**
- Create: `tests/gestao/anamnese-schema.test.mjs`
- Create: `tests/gestao/anamnese-domain.test.mjs`
- Create: `tests/gestao/anamnese-api.test.mjs`
- Create: `tests/gestao/anamnese-panel.test.mjs`
- Create: `tests/gestao/clinical-alerts.test.mjs`
- Create: `tests/gestao/clinical-documents.test.mjs`
- Create: `tests/gestao/anamnese-remota.test.mjs`
- Create: `tests/gestao/admin-staff-profile.test.mjs`
- Create: `tests/gestao/phase6b-database-contract.test.mjs`
- Create: `tests/gestao/phase6b-rpc-grants.test.mjs`
- Create: `tests/gestao/phase6b-storage-contract.test.mjs`

**Interfaces:** produz o contrato RED consumido por todas as tarefas seguintes.

- [ ] **Step 1: Testar template e condicionais**
  - IDs v1 são estáveis e únicos.
  - pergunta condicional só aparece quando gatilho correspondente é positivo.
  - declarações obrigatórias faltantes impedem revisão.
  - template não contém palavras/estados que deem diagnóstico ou liberação automática.

- [ ] **Step 2: Testar domínio temporal/status**
  - finalizada antes de `valid_until` permanece `finalizada`.
  - após `valid_until`, estado efetivo é `vencida`.
  - `substituida` continua `substituida` independentemente da data.
  - limite anual usa data real, não `365*24h` cego.

- [ ] **Step 3: Testar contratos de API**
  - mutações usam RPC e não enviam `created_by/reviewed_by/finalized_by`.
  - link remoto não envia `cliente_id` ao salvar.
  - assinatura profissional não envia nome/profissão/conselho/registro como autoridade.

- [ ] **Step 4: Testar segurança SQL**
  - tabelas/índices/statuses esperados existem.
  - somente uma versão aberta por cliente.
  - `PUBLIC`/`anon` não executam RPCs autenticadas.
  - `anon` executa somente `bc_anamnese_remote_get/save` entre os RPCs da 6B.
  - `anon` não tem `SELECT/INSERT/UPDATE/DELETE` direto nas tabelas clínicas.
  - `clinical_signatures` e `clinical_documents` não aceitam escrita direta de `authenticated`.

- [ ] **Step 5: Testar Storage**
  - `bc-prontuario-private` continua `public=false`.
  - paths `assinaturas/` e `documentos/` não têm policy pública.
  - upload de assinatura só para equipe ativa e path de documento válido.
  - PDF não é gravável pelo navegador comum.

- [ ] **Step 6: Rodar RED**
  Run: `npm run test:gestao`
  Expected: testes antigos verdes; novos 6B falham por módulos/migrations inexistentes.

- [ ] **Step 7: Commit**
```bash
git add tests/gestao
git commit -m "test: define contratos da fase 6B"
```

---

### Task 2: Criar schema de Anamnese Geral versionada

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6b_anamnese_core.sql`
- Test: `tests/gestao/phase6b-database-contract.test.mjs`
- Test: `tests/gestao/phase6b-rpc-grants.test.mjs`

**Interfaces:** produz template v1, versões, respostas, confirmações e RPCs autenticadas do ciclo de vida.

- [ ] **Step 1: Verificar docs/changelog Supabase atuais**
  Confirmar Postgres/RLS/functions/grants antes de escrever DDL.

- [ ] **Step 2: Criar migration com padrão do repositório**
  Nome: `bc_gestao_phase6b_anamnese_core`.

- [ ] **Step 3: Criar `anamnese_template_versions`, `anamneses_gerais`, `anamnese_respostas`, `anamnese_confirmacoes_clinicas`**
  Incluir FKs, índices e checks definidos em Data Model.

- [ ] **Step 4: Semear somente `bc-geral` v1**
  `schema_json` deve corresponder semanticamente a `ANAMNESE_TEMPLATE_V1`. Nenhum módulo específico de procedimento nesta migration.

- [ ] **Step 5: Garantir uma única versão aberta por cliente**
  Usar índice único parcial/constraint equivalente para os três estados abertos.

- [ ] **Step 6: Implementar `bc_anamnese_begin`**
  - exige staff ativa;
  - cliente deve existir;
  - reutiliza versão aberta existente em vez de criar corrida duplicada;
  - nova versão recebe `max(version)+1` e `supersedes_id` da finalizada vigente, sem alterá-la ainda.

- [ ] **Step 7: Implementar save/submit/review**
  - save valida chaves contra template da versão;
  - finalizada/substituída não recebe respostas;
  - submit remoto/presencial valida campos obrigatórios e move para estado correto;
  - `mark_reviewed` somente staff ativa e cria/obtém documento `aguardando_assinaturas`.

- [ ] **Step 8: Implementar listagem/estado efetivo**
  `bc_anamnese_state` retorna status efetivo `vencida` quando aplicável, sem precisar mutar linha por cron.

- [ ] **Step 9: Implementar confirmação clínica**
  Staff registra `changed=false` contra versão vigente; `changed=true` devolve necessidade de abrir nova versão e não altera a vigente.

- [ ] **Step 10: Fixar RLS/grants**
  Equipe ativa lê; nenhuma mutação direta pelo browser; wrappers públicos restritos a `authenticated`; implementations private com `search_path` fixo.

- [ ] **Step 11: Rodar contratos**
```bash
node --test tests/gestao/phase6b-database-contract.test.mjs tests/gestao/phase6b-rpc-grants.test.mjs
```
Expected: PASS para núcleo da anamnese.

- [ ] **Step 12: Commit**
```bash
git add supabase/migrations tests/gestao/phase6b-*.test.mjs
git commit -m "feat: adiciona anamnese geral versionada"
```

---

### Task 3: Adicionar identidade profissional administrativa

**Files:**
- Modify: `supabase/migrations/<gerado>_bc_gestao_phase6b_anamnese_core.sql` somente se ainda não aplicada; após aplicação, criar migration corretiva separada.
- Create: `gestao/js/admin-staff-profile.js`
- Modify: `gestao/admin/index.html`
- Test: `tests/gestao/admin-staff-profile.test.mjs`

**Interfaces:** produz snapshot confiável para assinatura/PDF.

- [ ] **Step 1: Adicionar `profissao`, `conselho`, `registro_conselho` em `staff_profiles`**
  Campos nullable para compatibilidade; nenhuma credencial é inventada/seedada.

- [ ] **Step 2: Implementar RPC admin-only de atualização**
  `bc_staff_update_professional_identity` deriva ator de `auth.uid()`, exige Mel/ADM e atualiza somente os três campos permitidos.

- [ ] **Step 3: Implementar RPC/listagem de perfis profissionais**
  Disponível à equipe autenticada para exibir autoria clínica; sem e-mail/senha/segredos.

- [ ] **Step 4: Adicionar seção administrativa “Identificação profissional”**
  Mel edita profissão, conselho e registro de cada profissional ativa. Colaboradora não recebe controle de edição.

- [ ] **Step 5: Testar perfil incompleto**
  UI marca “pendente”; backend de finalização posterior deve bloquear assinatura profissional sem os quatro snapshots necessários (`display_name` + 3 campos).

- [ ] **Step 6: Rodar testes**
  Run: `node --test tests/gestao/admin-staff-profile.test.mjs`
  Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add gestao/admin/index.html gestao/js/admin-staff-profile.js tests/gestao/admin-staff-profile.test.mjs supabase/migrations
git commit -m "feat: cadastra identidade profissional para documentos"
```

---

### Task 4: Implementar alertas clínicos automáticos e manuais

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6b_alerts.sql`
- Create: `gestao/js/clinical-alerts-api.js`
- Create: `gestao/js/clinical-alerts-panel.js`
- Test: `tests/gestao/clinical-alerts.test.mjs`

**Interfaces:** produz lista compartilhada de alertas ativos/históricos e sincronização a partir de Anamnese finalizada.

- [ ] **Step 1: Criar `clinical_alerts` + RLS**
  Equipe ativa lê; inserção/inativação somente por RPC; delete direto inexistente.

- [ ] **Step 2: Implementar `private.bc_sync_anamnese_alerts(p_anamnese_id)`**
  Gerar somente os mapeamentos aprovados em “Alertas automáticos v1”. Texto deve ser factual e incluir origem/versionamento; não gerar decisão clínica.

- [ ] **Step 3: Integrar sincronização à finalização da Anamnese**
  Quando nova versão se torna finalizada, inativar alertas automáticos da versão substituída com motivo técnico e criar os atuais.

- [ ] **Step 4: Implementar alerta manual**
  Staff ativa cria `critico|atencao|informativo` com descrição; autor vem de `auth.uid()`.

- [ ] **Step 5: Implementar inativação admin-only**
  Mel informa motivo obrigatório; linha é preservada.

- [ ] **Step 6: Implementar API/render**
  Cabeçalho da Pasta mostra ativos por severidade; aba/área permite histórico. Colaboradora vê, cria manual e não vê botão de inativar.

- [ ] **Step 7: Testar substituição e ausência de diagnóstico**
  Nova anamnese sem a resposta positiva inativa alerta automático anterior; alerta manual continua até ação administrativa.

- [ ] **Step 8: Commit**
```bash
git add supabase/migrations gestao/js/clinical-alerts-*.js tests/gestao/clinical-alerts.test.mjs
git commit -m "feat: adiciona alertas clinicos do prontuario"
```

---

### Task 5: Implementar link remoto seguro de 72 horas

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6b_remote_links.sql`
- Create: `gestao/anamnese-remota/index.html`
- Create: `gestao/anamnese-remota/anamnese-remota.css`
- Create: `gestao/anamnese-remota/anamnese-remota.js`
- Test: `tests/gestao/anamnese-remota.test.mjs`
- Test: `tests/gestao/phase6b-rpc-grants.test.mjs`

**Interfaces:** produz bearer link temporário sem login e RPCs anon estritamente limitadas.

- [ ] **Step 1: Criar `anamnese_remote_links`**
  Armazenar somente `token_hash`, expiração/revogação/acesso/submissão e autoria da geração.

- [ ] **Step 2: Implementar geração autenticada**
  `bc_anamnese_create_remote_link` exige staff, versão ainda aberta, gera pelo menos 32 bytes aleatórios, persiste SHA-256/`digest` e retorna token bruto uma única vez + `expires_at = now()+72h`. Regenerar revoga links ativos anteriores da mesma versão.

- [ ] **Step 3: Implementar RPCs anon**
  `remote_get/save` recalculam hash server-side, usam comparação exata, validam prazo/revogação/status e nunca aceitam `cliente_id/anamnese_id` do navegador.

- [ ] **Step 4: Minimizar payload remoto**
  Retornar apenas nome de exibição, schema, respostas, status/expiração. Não retornar CPF, telefone, e-mail, endereço, alertas, fotos, histórico ou financeiro.

- [ ] **Step 5: Implementar página pública**
  Ler `#t=...`; remover token da barra/`history.replaceState` após capturar em memória; fluxo multipágina; salvar progresso; `submit=true` move para `aguardando_revisao_profissional`.

- [ ] **Step 6: Tratar falhas sem enumeração**
  Expirado/revogado/inválido/finalizado exibem mensagem neutra “Este link não está mais disponível. Solicite um novo link à BC Estética.”

- [ ] **Step 7: Testar fronteiras de 72h**
  71h59m válido; >=72h inválido; revogado inválido; finalizado inválido; token errado não revela nada.

- [ ] **Step 8: Commit**
```bash
git add supabase/migrations gestao/anamnese-remota tests/gestao/anamnese-remota.test.mjs tests/gestao/phase6b-rpc-grants.test.mjs
git commit -m "feat: adiciona pre preenchimento remoto da anamnese"
```

---

### Task 6: Implementar documentos e assinaturas privadas

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6b_documents_signatures.sql`
- Create: `gestao/js/signature-pad.js`
- Create: `gestao/js/clinical-documents-api.js`
- Test: `tests/gestao/clinical-documents.test.mjs`
- Test: `tests/gestao/phase6b-storage-contract.test.mjs`

**Interfaces:** produz documento de Anamnese aguardando assinaturas, armazenamento imutável das assinaturas e finalização clínica.

- [ ] **Step 1: Criar `clinical_documents` e `clinical_signatures`**
  Aplicar RLS, índices, checks e revogar escrita direta de `authenticated`/`anon`.

- [ ] **Step 2: Ampliar policies do bucket privado**
  Permitir à equipe ativa inserir somente `assinaturas/<document_id>/...`; impedir update/delete direto. `documentos/` será gravado apenas pela Edge Function/server-side.

- [ ] **Step 3: Criar `signature-pad.js`**
  Replicar o comportamento robusto já usado na pré-anamnese: Pointer Events, DPR, preservação em resize, `isValid()` para traço mínimo, `toBlob/toDataUrl`.

- [ ] **Step 4: Implementar upload + hash no frontend autenticado**
  Aceitar somente PNG de assinatura gerada pelo pad; calcular SHA-256 Web Crypto antes do RPC; path contém `documentId`, não cliente arbitrário.

- [ ] **Step 5: Implementar registro de assinatura no backend**
  RPC valida documento/cliente/status. Para `profissional`, signer é `auth.uid()` e snapshot vem do `staff_profiles`; para `paciente/responsavel`, nome snapshot vem de `clientes`, jamais do browser.

- [ ] **Step 6: Aplicar regra de menoridade na assinatura**
  Idade é recalculada na data da assinatura. `<18`: exige `responsavel`; `>=18`: exige `paciente`. Assinatura profissional é sempre obrigatória.

- [ ] **Step 7: Implementar `bc_anamnese_finalize_document`**
  Verifica respostas/revisão, assinaturas exigidas, identidade profissional completa e versão aberta correta. Finaliza Anamnese, define `valid_until = finalized_at + interval '1 year'`, substitui versão anterior e deixa documento `pronto_para_pdf`.

- [ ] **Step 8: Testar ausência de escrita destrutiva**
  Trocar assinatura antes da finalização cria nova linha/versionamento controlado ou substituição via RPC auditada; após finalização, assinatura usada no documento não é apagada/alterada.

- [ ] **Step 9: Commit**
```bash
git add supabase/migrations gestao/js/signature-pad.js gestao/js/clinical-documents-api.js tests/gestao/clinical-documents.test.mjs tests/gestao/phase6b-storage-contract.test.mjs
git commit -m "feat: adiciona assinaturas privadas da anamnese"
```

---

### Task 7: Gerar PDF institucional e imutável da Anamnese

**Files:**
- Create: `supabase/functions/generate-anamnese-pdf/index.ts`
- Create: `supabase/functions/generate-anamnese-pdf/pdf.ts`
- Create: `supabase/functions/generate-anamnese-pdf/deno.json`
- Create: `supabase/functions/generate-anamnese-pdf/pdf_test.ts`
- Modify: `.github/workflows/site-ci.yml`

**Interfaces:** consome documento `pronto_para_pdf` e produz `clinical_documents.status='emitido'` + PDF privado.

- [ ] **Step 1: Reutilizar padrões visuais do PDF atual sem acoplamento de dados**
  Layout premium BC: cabeçalho, código/documento, identificação, seções agrupadas, respostas condicionais, declarações, assinaturas e bloco da profissional. Não copiar lógica do Supabase antigo.

- [ ] **Step 2: Implementar snapshot server-side**
  Função recebe somente `documentId`; JWT obrigatório; valida staff ativa; busca documento/anamnese/template/respostas/assinaturas/cliente/snapshots no projeto correto.

- [ ] **Step 3: Implementar `buildAnamnesePdf(snapshot)`**
  PDF inclui: código, versão, data/hora, identificação básica, foto de identificação quando disponível, seções da Anamnese Geral, alertas não são impressos como diagnóstico, declarações, assinatura paciente/responsável, assinatura profissional e profissão/conselho/registro.

- [ ] **Step 4: Gravar PDF privado**
  Path determinístico `documentos/anamnese/<clienteId>/<documentId>/v<documentVersion>.pdf`; sem URL pública; calcular SHA-256.

- [ ] **Step 5: Tornar geração idempotente**
  Se `emitido` e SHA/path existem, devolver o mesmo documento. Em falha, marcar `erro_pdf` com auditoria mínima e permitir retry sem recriar Anamnese/assinaturas.

- [ ] **Step 6: Testar PDF**
  Testar multi-page, textos longos, resposta condicional ausente, menor com responsável e identidade profissional; garantir que senha/chaves nunca aparecem.

- [ ] **Step 7: Incluir testes Deno no CI**
  Se necessário, adicionar setup de Deno e `deno test` apenas para a função 6B, sem alterar deploy Pages.

- [ ] **Step 8: Commit**
```bash
git add supabase/functions/generate-anamnese-pdf .github/workflows/site-ci.yml
git commit -m "feat: gera PDF clinico da anamnese"
```

---

### Task 8: Implementar domínio/API e wizard presencial na Pasta da Cliente

**Files:**
- Create: `gestao/js/anamnese-schema.js`
- Create: `gestao/js/anamnese-domain.js`
- Create: `gestao/js/anamnese-api.js`
- Create: `gestao/js/anamnese-panel.js`
- Create: `gestao/assets/anamnese.css`
- Modify: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Test: `tests/gestao/anamnese-schema.test.mjs`
- Test: `tests/gestao/anamnese-domain.test.mjs`
- Test: `tests/gestao/anamnese-api.test.mjs`
- Test: `tests/gestao/anamnese-panel.test.mjs`
- Modify: `tests/gestao/clientes-folder.test.mjs`

**Interfaces:** entrega a experiência clínica da 6B dentro da Pasta.

- [ ] **Step 1: Implementar template/domínio**
  Reproduzir `bc-geral` v1 do banco e helpers definidos em Interfaces; nenhum texto de diagnóstico/liberação.

- [ ] **Step 2: Adicionar aba `Anamnese`**
  Exibir status, versão, data da última finalização, validade, botão iniciar/atualizar, gerar link remoto e versões anteriores.

- [ ] **Step 3: Implementar wizard multipágina**
  Poucas perguntas por etapa, indicador “Etapa X de Y”, voltar/continuar, condicionais e revisão final, inspirado na UX existente.

- [ ] **Step 4: Implementar revisão profissional**
  Remota submetida abre em `aguardando_revisao_profissional`; profissional revisa/edita e só então avança para assinaturas.

- [ ] **Step 5: Integrar assinatura dupla**
  Tela mostra primeiro paciente/responsável, depois profissional; bloqueia profissional se cadastro profissional estiver incompleto.

- [ ] **Step 6: Finalizar e chamar Edge Function**
  Após ambas assinaturas, chamar finalize RPC e então `generate-anamnese-pdf`; mostrar `PDF emitido` ou botão de retry se `erro_pdf`.

- [ ] **Step 7: Atualizar checklist/cabeçalho**
  Anamnese finalizada vigente marca concluído; vencida/ausente aparece pendente; alertas ativos aparecem no topo.

- [ ] **Step 8: Commit**
```bash
git add gestao/js/anamnese-* gestao/js/clientes-* gestao/assets/anamnese.css gestao/admin/index.html gestao/colaborador/index.html tests/gestao
git commit -m "feat: integra anamnese geral a pasta da cliente"
```

---

### Task 9: Integrar Documentos, Linha do Tempo e download privado

**Files:**
- Modify: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/js/clinical-documents-api.js`
- Test: `tests/gestao/clinical-documents.test.mjs`
- Test: `tests/gestao/clientes-folder.test.mjs`

**Interfaces:** expõe PDFs emitidos sem link público e registra eventos clínicos na linha do tempo.

- [ ] **Step 1: Adicionar aba `Documentos`**
  Listar Anamnese Geral por versão/código/data/status; não mostrar financeiro.

- [ ] **Step 2: Implementar download por signed URL curta**
  `createSignedUrl(..., 300)` somente para documento que a sessão autenticada pode ler; nunca persistir signed URL no banco.

- [ ] **Step 3: Integrar Linha do Tempo**
  Eventos: Anamnese iniciada/submetida/finalizada/substituída e documento emitido. Linha clínica continua sem valores financeiros.

- [ ] **Step 4: Preservar histórico de versões**
  Abrir uma versão antiga mostra conteúdo/documento antigo somente leitura.

- [ ] **Step 5: Commit**
```bash
git add gestao/js/clientes-folder.js gestao/js/clientes-panel.js gestao/js/clinical-documents-api.js tests/gestao
git commit -m "feat: adiciona documentos da anamnese ao prontuario"
```

---

### Task 10: Auditoria e hardening da 6B

**Files:**
- Modify/Create migrations 6B antes da aplicação; após aplicação, usar migration aditiva de hardening.
- Test: `tests/gestao/phase6b-database-contract.test.mjs`
- Test: `tests/gestao/phase6b-rpc-grants.test.mjs`
- Test: `tests/gestao/phase6b-storage-contract.test.mjs`

**Interfaces:** garante fronteiras de segurança/auditoria antes de produção.

- [ ] **Step 1: Cobrir eventos de auditoria**
  Anamnese iniciada/submetida/revisada/finalizada/substituída, link criado/revogado, alerta criado/inativado, assinatura registrada, PDF emitido/erro, identidade profissional atualizada.

- [ ] **Step 2: Minimizar `audit_log`**
  Não copiar respostas médicas completas, assinatura em base64, token, CPF ou PDF para o log. Registrar IDs, ação, versão/status e campos necessários.

- [ ] **Step 3: Confirmar grants de funções**
  `anon` somente remote get/save; authenticated somente wrappers necessários; private implementations nunca `PUBLIC`.

- [ ] **Step 4: Confirmar policies de Storage**
  Sem leitura/escrita pública; assinatura e PDF acessíveis somente pelo fluxo autorizado.

- [ ] **Step 5: Rodar suite completa**
```bash
npm test
```
Expected: frontend legado, site, Gestão 6A/6B e Fase 5 todos verdes.

- [ ] **Step 6: Commit**
```bash
git add supabase/migrations tests/gestao
git commit -m "test: endurece seguranca da fase 6B"
```

---

### Task 11: Aplicar no Supabase correto e homologar sem paciente real

**Files:** migrations/Edge Function já versionadas; nenhuma alteração de código deve nascer diretamente no dashboard.

**Interfaces:** prova banco/Storage/Edge Function no projeto `tpqsmerlxquyrzrjbogj` antes do merge.

- [ ] **Step 1: Confirmar projeto**
  `bc-estetica-gestao` / `tpqsmerlxquyrzrjbogj` / `ACTIVE_HEALTHY`.

- [ ] **Step 2: Capturar advisor baseline**
  Rodar security + performance antes das migrations.

- [ ] **Step 3: Aplicar migrations em ordem**
  Core → alertas → documentos/assinaturas → links remotos → hardening corretivo se necessário.

- [ ] **Step 4: Deploy `generate-anamnese-pdf`**
  `verify_jwt=true`; secrets somente em environment do Supabase; nunca gravar service role no repo.

- [ ] **Step 5: Verificação estrutural read-only**
  Confirmar colunas/tabelas/índices/RLS/grants/policies/bucket privado e zero novos registros clínicos reais.

- [ ] **Step 6: Homologação transacional sintética**
  Simular em `BEGIN ... ROLLBACK` quando possível: adulta, menor com responsável, duplicidade de versão aberta, vencimento, link remoto, expiração e alertas. Confirmar resíduo zero.

- [ ] **Step 7: Homologar PDF com entidade sintética descartável**
  Se Edge Function exigir commit real para Storage, criar somente cliente/anamnese com marcador `HOMOLOGACAO_FASE6B`, emitir PDF, verificar privado/assinaturas/layout, apagar objetos e dados sintéticos pelo fluxo administrativo/SQL controlado. Nunca usar paciente real.

- [ ] **Step 8: Rodar advisors pós-DDL**
  Nenhum novo finding crítico/alto provocado pela 6B. Registrar findings preexistentes separadamente.

---

### Task 12: PR, revisão, merge e deploy Pages

**Files:** branch de implementação completa.

**Interfaces:** entrega 6B publicada somente depois de testes e revisão.

- [ ] **Step 1: Criar branch de implementação a partir da `main` atual**
  Nome recomendado: `feature/fase6b-anamnese-documentos`.

- [ ] **Step 2: Garantir CI da branch verde**
  Suite Node + Deno conforme workflow.

- [ ] **Step 3: Abrir PR contra `main`**
  Descrever schema, link remoto, assinaturas, PDF, segurança, migrations aplicadas e homologação fictícia.

- [ ] **Step 4: Executar revisão final**
  Verificar diff completo, permissões, URLs/token, Storage, ausência de segredo e compatibilidade 6A/Fase 5.

- [ ] **Step 5: Confirmar PR clean/mergeable + CI verde**
  Não mesclar com check pendente/falhando.

- [ ] **Step 6: Mesclar somente após aprovação do usuário**
  Acompanhar CI `main` e GitHub Pages no mesmo SHA.

- [ ] **Step 7: Smoke test pós-deploy**
  Login admin/colaboradora, Pasta → Anamnese, criação de link sem expor token em query, visualização de status e carregamento da página remota. Não preencher paciente real.

## Self-review do plano

### 1. Cobertura da spec

Coberto nesta fatia: Anamnese Geral versionada, 12 meses, estados, remoto 72h, revisão profissional, alertas automáticos/manuais, identidade profissional, dupla assinatura, PDF privado/versionado, aba Documentos, timeline, auditoria e Storage. Gates específicos de procedimento/termo e leitura obrigatória de alertas ficam explicitamente para 6C porque dependem da nova ficha-mãe/ficha de atendimento.

### 2. Interfaces

`anamneseId` é UUID interno; link remoto nunca recebe/aceita cliente arbitrário. `documentId` é a única entrada da Edge Function; identidade/respostas/path são derivados server-side.

### 3. Segurança

Token remoto bruto só é devolvido na criação e mantido no fragmento da URL; banco guarda hash. `anon` não recebe grants de tabela. Assinatura/PDF nunca são públicos. `service_role` aparece somente em env da Edge Function.

### 4. Compatibilidade

6A permanece fonte do cadastro/foto/Pasta. Fase 5 não é tocada. `/admin/` legado e pré-anamnese antiga não são modificados.

### 5. Pontos de produto intencionalmente adiados

Compartilhamento por e-mail/WhatsApp, exportação integral, módulos específicos/TCLE e gate de alertas por procedimento ficam para 6C/6F conforme roadmap já aprovado; 6B entrega download autenticado do PDF individual e toda a fundação documental.