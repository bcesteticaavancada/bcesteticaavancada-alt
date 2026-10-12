# BC Gestão — Fase 6C: Biblioteca Clínica, Consentimentos e Atendimentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Biblioteca Clínica 6C pronta para uso, com 30 procedimentos/protocolos pré-configurados, cadastro simples de novos procedimentos, permissões clínicas por profissional, dois consentimentos mestres, ficha individual por sessão e PDFs privados, sem quebrar agenda/financeiro existentes.

**Architecture:** `procedimentos` continua como identidade estável já usada pela agenda e pelo financeiro. A 6C adiciona uma camada clínica versionada (`procedure_versions`) e cria um prontuário de sessão próprio (`clinical_treatments`) em vez de reutilizar o legado `atendimentos`, que é preso a agendamento. RLS/RPC são a autoridade. Assinaturas e Storage privado reaproveitam a infraestrutura da 6B; consentimentos/fichas da 6C têm finalização e Edge Function próprias.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Node 22 `node:test`, Supabase/PostgreSQL 17 com RLS/RPC, Supabase Storage privado, Supabase Edge Functions Deno 2 + `pdf-lib`, Web Crypto SHA-256, GitHub Pages e GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-12-bc-gestao-fase6c-biblioteca-clinica-design.md`

## Global Constraints

- Repo: `bcesteticaavancada/bcesteticaavancada-alt`.
- Supabase correto: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`). Nunca tocar `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`).
- Não alterar `/admin/`; somente `/gestao/`, migrations/funções e testes da Gestão.
- Nunca expor `service_role`, senha, secret key, UUID interno de profissional ou segredo no código/UI/log.
- Escrita clínica sensível somente por RPC; `auth.uid()` e banco definem autoria, papel, permissão, versão e snapshot profissional.
- `procedimentos.id` permanece estável para agenda/financeiro. Não substituir IDs já referenciados.
- `atendimentos` legado continua funcionando; a 6C cria `clinical_treatments` para walk-in/agendado e versionamento clínico.
- Catálogo inicial: 30 itens únicos com os preços aprovados; `Hidratação Facial` é alias histórico de `Reset Glow™`, não item ativo separado.
- Classe visível continua binária: `injetável` ou `não injetável`. Agulha, cânula, PDO ou inserção invasiva usam a classe documental rigorosa `injetável`.
- Protocolo composto escala para `injetável` se qualquer componente real da sessão for dessa classe.
- Capacidade de **gerenciar/publicar** procedimentos é independente da permissão de **executar** procedimentos.
- Mel/admin e colaboradoras autorizadas podem cadastrar/editar/publicar. Alice deve poder fazer isso sem virar admin.
- Somente Mel/admin concede/revoga execução, habilita gestor de procedimentos e arquiva/desativa.
- Procedimento usado nunca é apagado. Published e prontuários finalizados são históricos imutáveis.
- Injetável/invasivo: novo consentimento por sessão. Não injetável pode reutilizar dentro de ciclo/protocolo explicitamente vinculado; sem ciclo explícito, novo consentimento é fallback.
- Cada sessão = um `clinical_treatment`, inclusive mesmo dia/protocolo/pacote.
- Estados: `rascunho -> pronto_para_iniciar -> em_atendimento -> finalizado`.
- Gate de início: Anamnese Geral válida quando exigida, confirmação de saúde do atendimento, alertas revisados, profissional autorizada, consentimento correto assinado e módulo obrigatório completo.
- 6D continua dona de fotos clínicas, produtos/lotes, equipamentos/parâmetros e intercorrências estruturadas; 6C guarda apenas flags para integração futura.
- 6E continua dona da integração financeira por paciente/pacotes. A 6C apenas snapshot de preço base/final.
- Correção no mesmo dia clínico `America/Sao_Paulo` preserva versão anterior. Depois, apenas com reabertura temporária da Mel/admin e correção pelo autor original.
- Não usar pacientes reais em testes. Homologação sintética deve terminar com zero resíduo.
- Antes de migrations/Edge Functions, consultar docs/changelog atuais do Supabase.
- Criar migrations somente com `supabase migration new <nome>`; nunca inventar timestamp manualmente.

## Review Focus

1. **Gerenciar ≠ executar:** Alice/colaboradora pode publicar sem ganhar autorização clínica automática; executor autorizado não ganha poder de editar biblioteca.
2. **Histórico imutável:** v2/arquivamento nunca altera atendimento finalizado em v1.
3. **Escalada de consentimento:** um componente invasivo torna a sessão inteira classe `injetável` para consentimento.
4. **Agendado x walk-in:** `agendamento_id` é idempotente quando existe e opcional para walk-in; `atendimentos` legado continua intacto.
5. **Integridade final:** trava/reabertura preserva versões; falha/retry de PDF não apaga assinaturas nem dados e é idempotente.

---

## File Structure

### Criar

- `gestao/js/procedure-domain.js`
- `gestao/js/procedure-api.js`
- `gestao/js/procedure-panel.js`
- `gestao/assets/procedure-library.css`
- `gestao/js/treatment-domain.js`
- `gestao/js/treatment-api.js`
- `gestao/js/treatment-panel.js`
- `gestao/assets/treatment.css`
- `supabase/functions/generate-procedure-pdf/{index.ts,pdf.ts,pdf_test.ts,deno.json}`
- `tests/gestao/procedure-domain.test.mjs`
- `tests/gestao/procedure-api.test.mjs`
- `tests/gestao/procedure-panel.test.mjs`
- `tests/gestao/treatment-domain.test.mjs`
- `tests/gestao/treatment-api.test.mjs`
- `tests/gestao/treatment-panel.test.mjs`
- `tests/gestao/phase6c-procedure-db-contract.test.mjs`
- `tests/gestao/phase6c-treatment-db-contract.test.mjs`
- `tests/gestao/phase6c-rpc-grants.test.mjs`
- `tests/gestao/phase6c-catalog-seed.test.mjs`
- `tests/gestao/phase6c-document-contract.test.mjs`

### Modificar

- `gestao/js/auth.js`
- `gestao/js/admin-agenda.js`
- `gestao/js/agenda-api.js`
- `gestao/admin/index.html`
- `gestao/colaborador/index.html`
- `gestao/js/clientes-folder.js`
- `gestao/js/clinical-folder-runtime.js`
- `gestao/js/clinical-documents-api.js`
- `gestao/assets/clientes-folder.css`
- `.github/workflows/site-ci.yml`
- testes existentes afetados em `tests/gestao/`.

### Migrations durante execução

Criar pela CLI e usar os nomes reais retornados:

1. `supabase migration new bc_gestao_phase6c_procedure_library`
2. `supabase migration new bc_gestao_phase6c_catalog_seed`
3. `supabase migration new bc_gestao_phase6c_treatment_core`
4. `supabase migration new bc_gestao_phase6c_documents`
5. Corretiva somente se testes/advisors exigirem, também via CLI.

## Interfaces

```js
normalizeProcedureDraft(input) -> ProcedureDraft
validateProcedureDraft(input) -> { valid, errors }
deriveConsentClass({ procedureVersion, componentVersions }) -> 'injetavel' | 'nao_injetavel'
formatProcedurePrice(procedureVersion) -> string

listProcedures({ client, includeArchived = false })
getProcedure({ client, procedureId })
saveProcedureDraft({ client, procedureId = null, payload })
publishProcedure({ client, procedureId })
archiveProcedure({ client, procedureId })
setProcedureExecutionPermission({ client, procedureId, professionalUserId, allowed })
setProcedureManagerCapability({ client, userId, enabled })
```

```js
deriveTreatmentGate({ anamnese, healthConfirmation, alertsReviewed, consent, permission, specificModule })
  -> { ready, reasons }
normalizeTreatmentDraft(input) -> TreatmentDraft
validateTreatmentDraft(input) -> { valid, errors }

createTreatment({ client, clienteId, procedureId, appointmentId = null, componentVersionIds = [] })
getTreatment({ client, treatmentId })
listClientTreatments({ client, clienteId })
updateTreatmentDraft({ client, treatmentId, patch })
confirmTreatmentHealthChange({ client, treatmentId, changed, details = null })
confirmTreatmentAlertReview({ client, treatmentId })
prepareTreatmentConsent({ client, treatmentId }) -> { documentId }
markTreatmentReady({ client, treatmentId })
startTreatment({ client, treatmentId })
finalizeTreatment({ client, treatmentId }) -> { treatmentVersionId, documentId }
correctTreatmentSameDay({ client, treatmentId, patch })
createTreatmentReopenGrant({ client, treatmentId, reason, expiresAt })
correctReopenedTreatment({ client, treatmentId, patch })
```

## Data Model

### `procedimentos`

Manter tabela atual e adicionar `current_version_id` e `archived_at`. Na publicação, sincronizar `nome`, `ativo` e `duracao_padrao` com a versão atual para manter agenda/financeiro compatíveis.

### `procedure_versions`

`id`, `procedimento_id`, `version`, `status (draft|published|superseded)`, `classe_documental`, `categoria`, `descricao`, `price_mode`, `base_price`, `suggested_duration`, `requires_general_anamnesis`, retorno/intervalo, orientações pré/pós, `consent_supplement`, `specific_schema jsonb`, `technical_schema jsonb`, `protocol_mode (simple|compound)`, flags 6D (`requires_photo`, `requires_product_lot`, `requires_equipment`) e autoria/publicação.

Published é imutável; edição cria/atualiza draft e publicação gera nova versão.

### Permissões/composição

- `procedure_professional_permissions`: procedimento + profissional + allowed + concessão/revogação.
- `procedure_version_components`: snapshot de componentes da versão do protocolo.
- `procedure_aliases`: alias histórico; seed `Hidratação Facial -> Reset Glow™`.
- `staff_profiles.pode_gerenciar_procedimentos boolean default false`; admin tem capacidade efetiva independentemente do flag.

Alice será habilitada operacionalmente por RPC/admin resolvendo o `user_id` no banco correto; não gravar e-mail/UUID em migration/código.

### `consent_template_versions`

Dois templates versionados: `injetavel` e `nao_injetavel`, com `title_pattern`, `body_json`, status e autoria/publicação. Documento antigo sempre aponta para a versão usada.

### `clinical_treatments`

`id`, cliente, procedimento + versão, profissional, `agendamento_id null`, status, snapshots `price_mode/base_price/final_price`, região, `specific_data`, `technical_data`, notas, orientações, retorno, anamnese, consent document, versão atual, autoria e timestamps. `agendamento_id` único quando não nulo.

### Entidades auxiliares

- `clinical_treatment_components` — composição real da sessão.
- `clinical_treatment_health_confirmations` — confirmação de saúde específica por treatment.
- `clinical_treatment_alert_reviews` — snapshot server-side de todos os alertas ativos revisados.
- `clinical_treatment_versions` — snapshots imutáveis de finalização/correção.
- `clinical_treatment_reopen_grants` — autorização temporária admin para o autor original.

### `clinical_documents`

Ampliar `document_type` de forma aditiva: `anamnese_geral` continua; adicionar `procedure_consent` e `treatment_record`. Não reutilizar a finalização específica da anamnese para o fluxo 6C.

## Regra de pré-configuração da Biblioteca

A Biblioteca Clínica inicial **não pode ser apenas nome + preço**.

Para os 30 itens do seed:

- pré-configurar classe documental quando suportada pela definição aprovada;
- pré-configurar `specific_schema`/`technical_schema` com campos úteis para a sessão;
- pré-configurar orientações pré/pós e retorno somente quando sustentados por material oficial/técnico adequado;
- incorporar os fluxos operacionais fornecidos pela BC como checklist/estrutura, sem acrescentar etapa clínica inventada;
- usar as definições da própria BC para Fort Hair™, Fort Hair Plus™, Fort Brow™, Sculpt Cryo™, Reset Glow™, Monaco Glow™, Skin Reset™ e Face Reset™;
- para os demais, pesquisar fontes atuais priorizando Anvisa, conselho profissional competente e instrução oficial de uso quando aplicável;
- não inventar dose, concentração, profundidade, energia, contraindicação ou conduta;
- copy de marketing nunca vira automaticamente instrução clínica;
- itens cuja via depende dos componentes reais devem exigir seleção dos componentes antes do gate de início.

Para **novo procedimento criado no futuro**, o sistema deve gerar automaticamente uma versão draft com ficha genérica funcional (região, objetivo/observações, execução, orientação pós, retorno), além do consentimento mestre da classe escolhida. Campos específicos adicionais são opcionais — ninguém precisa construir a ficha do zero para conseguir usar o cadastro.

## Dois modelos mestres

- `TCLE + Autorização para Procedimento Injetável/Invasivo` — assinatura por sessão.
- `Termo de Responsabilidade e Consentimento` — não injetável; pode valer por ciclo explicitamente vinculado.

Nome do procedimento entra automaticamente no cabeçalho. `consent_supplement` adiciona particularidade versionada sem criar um terceiro modelo inteiro.

Antes de seedar o texto v1, pesquisar referências oficiais atuais. Não copiar textos extensos de terceiros; redigir texto institucional próprio, claro e revisável pela BC.

---

### Task 1: Domínio TDD da Biblioteca

**Files:** `tests/gestao/procedure-domain.test.mjs`, `gestao/js/procedure-domain.js`.

- [ ] RED: validar nome, classe, `fixed|starting_at`, preço, duração e composição.
- [ ] RED: protocolo com componente injetável escala para `injetavel`.
- [ ] RED: formatar `R$ 180,00` e `A partir de R$ 195,00`.
- [ ] Rodar teste e confirmar falha por implementação inexistente.
- [ ] GREEN: implementar funções puras.
- [ ] Rodar teste + `npm run test:gestao`.
- [ ] Commit `feat: define dominio da biblioteca clinica`.

### Task 2: Banco da Biblioteca e capacidades

**Files:** migration `bc_gestao_phase6c_procedure_library`, contratos DB/grants, `gestao/js/auth.js`.

- [ ] Consultar docs/changelog atuais Supabase.
- [ ] RED: contratos para versões, aliases, componentes, permissões, flag de gestor e imutabilidade.
- [ ] Criar migration via CLI; RLS em tudo exposto.
- [ ] RPCs: `bc_procedure_list`, `bc_procedure_get`, `bc_procedure_save_draft`, `bc_procedure_publish`, `bc_procedure_archive`, `bc_procedure_set_execution_permission`, `bc_staff_set_procedure_manager`.
- [ ] Helpers sensíveis em schema privado + wrappers públicos `security invoker`; checar `auth.uid()`.
- [ ] Publicação transacional sincroniza root `procedimentos` e supersede versão antiga.
- [ ] Sem UPDATE/DELETE direto de published; sem DELETE de procedimento utilizado.
- [ ] `auth.js` passa a carregar `pode_gerenciar_procedimentos`.
- [ ] Testar gestão e execução como capacidades independentes.
- [ ] `npm run test:gestao`.
- [ ] Commit `feat: adiciona biblioteca clinica versionada`.

### Task 3: Catálogo oficial + conteúdo pré-configurado + API

**Files:** migration `bc_gestao_phase6c_catalog_seed`, `gestao/js/procedure-api.js`, testes seed/API.

- [ ] RED: exatamente 30 itens/nome/preço/mode; sem Hidratação Facial ativa; alias para Reset Glow™.
- [ ] RED: classes inequívocas e protocolo compound escalável.
- [ ] Pesquisar conteúdo técnico dos procedimentos não exclusivos conforme regras acima.
- [ ] Transformar fluxos BC já fornecidos em schemas/checklists iniciais.
- [ ] Preencher `specific_schema`, `technical_schema`, orientações e retorno dos 30 itens quando suportado; campos não sustentados ficam genéricos/editáveis, nunca inventados.
- [ ] Seed idempotente; nenhum ID real de staff no SQL.
- [ ] `procedure-api.js`: escrita apenas RPC, sem autoria enviada pelo browser.
- [ ] Novo procedimento recebe ficha genérica default automaticamente.
- [ ] Rodar testes específicos + `npm run test:gestao`.
- [ ] Commit `feat: carrega catalogo clinico preconfigurado da bc`.

### Task 4: Painel de Procedimentos admin + colaboradora autorizada

**Files:** `procedure-panel.js`, CSS, admin/colaborador HTML, `admin-agenda.js`, `agenda-api.js`, testes.

- [ ] RED UI: nome, classe, preço/mode, categoria, duração, Anamnese, retorno, orientações, complemento, protocolo simples/composto e publicar.
- [ ] RED: colaboradora sem flag não vê/usa painel; com flag vê. Arquivar/permissão de execução apenas admin.
- [ ] Implementar `initProcedurePanel({ client, profile, root })` compartilhado.
- [ ] Substituir formulário simples do admin.
- [ ] Remover `createProcedure` do fluxo de agenda; preservar `listActiveProcedures` e selects existentes.
- [ ] Admin recebe controles `Pode gerenciar procedimentos` e `Pode executar` por procedimento.
- [ ] Habilitar Alice operacionalmente via RPC/admin, sem identificadores pessoais no repo.
- [ ] Rodar testes + regressão.
- [ ] Commit `feat: adiciona painel da biblioteca clinica`.

### Task 5: Templates de consentimento e documentos

**Files:** migration `bc_gestao_phase6c_documents`, `clinical-documents-api.js`, contratos de documento.

- [ ] RED: `consent_template_versions`, novos document types e preservação da anamnese 6B.
- [ ] Pesquisar/redigir os dois textos mestres institucionais v1.
- [ ] Seedar templates `injetavel` e `nao_injetavel` versionados.
- [ ] Ampliar `clinical_documents.document_type` de forma aditiva.
- [ ] Reutilizar `clinical_signatures`, bucket e `signature-pad.js`.
- [ ] RPC `bc_treatment_prepare_consent`: resolve classe/template/procedure version server-side e cria cabeçalho dinâmico.
- [ ] RPC `bc_treatment_consent_finalize` separado da anamnese.
- [ ] Menor usa responsável conforme regra 6B; paciente/responsável + profissional.
- [ ] Não injetável só reutiliza consentimento com vínculo explícito de ciclo/protocolo + mesmas versões.
- [ ] Rodar contratos + regressão 6B.
- [ ] Commit `feat: adiciona consentimentos clinicos da fase 6c`.

### Task 6: Core do atendimento, gates e correções

**Files:** migration `bc_gestao_phase6c_treatment_core`, `treatment-domain.js`, `treatment-api.js`, testes.

- [ ] RED: quatro estados e todos os motivos de gate.
- [ ] RED: agendado idempotente; walk-in sem agendamento.
- [ ] RED: preço fixed snapshot e starting_at final auditável, sem escrever financeiro 6E.
- [ ] Criar treatment + auxiliares de componentes, saúde, alert review, versions e reopen grants.
- [ ] RPCs create/get/list/update draft.
- [ ] Confirmação de saúde por treatment.
- [ ] Revisão de alertas copia server-side todos os alertas ativos.
- [ ] `mark_ready` recalcula todos os gates server-side.
- [ ] `start` somente profissional do treatment autorizada.
- [ ] `finalize` valida identidade/ficha e cria snapshot imutável + `treatment_record`.
- [ ] Correção same-day cria nova versão; após dia, grant admin temporário e autor original.
- [ ] Sem DML clínico direto pelo browser.
- [ ] Rodar testes + `npm run test:gestao`.
- [ ] Commit `feat: adiciona ficha clinica versionada por sessao`.

### Task 7: Pasta da Cliente e UX do atendimento

**Files:** `treatment-panel.js`, `treatment.css`, `clientes-folder.js`, `clinical-folder-runtime.js`, admin/colaborador HTML e testes.

- [ ] RED: nova aba `Atendimentos`, histórico, Novo atendimento, agendamento e walk-in.
- [ ] Tabs: Linha do tempo, Cadastro, Anamnese, Atendimentos, Documentos.
- [ ] Timeline clínica não mistura financeiro.
- [ ] Wizard: procedimento/componentes -> saúde/alertas -> consentimento/assinaturas -> ficha -> finalizar.
- [ ] Protocolos compound exigem componentes reais e exibem classe resultante.
- [ ] Entrada a partir do agendamento cria/abre treatment 6C sem usar `atendimento-form.js` como novo prontuário.
- [ ] Manter histórico/fluxo legado compatível durante transição.
- [ ] Checklist de gates na UI; RPC continua autoridade.
- [ ] Rodar testes + `npm run test:gestao`.
- [ ] Commit `feat: integra atendimentos clinicos a pasta da cliente`.

### Task 8: PDF institucional 6C

**Files:** `supabase/functions/generate-procedure-pdf/*`, CI, `clinical-documents-api.js`.

- [ ] RED Deno: cabeçalho dinâmico, versões, cliente, profissional, template/suplemento, assinaturas e ficha técnica.
- [ ] Reutilizar identidade visual A4 da Anamnese sem alterar `generate-anamnese-pdf`.
- [ ] JWT obrigatório; entrada somente `documentId`; dados resolvidos server-side.
- [ ] Paths privados `documentos/procedimentos/...`; SHA-256 e status emitido.
- [ ] Retry idempotente; erro de PDF nunca desfaz assinatura/treatment.
- [ ] Adicionar teste Deno ao Site CI.
- [ ] Rodar Deno + `npm test`.
- [ ] Commit `feat: gera pdf de consentimento e atendimento clinico`.

### Task 9: Hardening e homologação sintética

- [ ] `npm test` completo.
- [ ] Rodar Deno da Anamnese 6B e Procedure PDF 6C.
- [ ] Conferir grants: `anon` sem acesso clínico; authenticated somente wrappers necessários.
- [ ] Rodar advisors Supabase e comparar ao baseline conhecido.
- [ ] Aplicar somente no projeto `tpqsmerlxquyrzrjbogj`.
- [ ] Validar os 30 itens, preços, alias e conteúdo pré-configurado.
- [ ] Habilitar Alice como gestora e permissões de execução aprovadas (incluindo Botox Mel + Alice) via operação administrativa, não hardcode.
- [ ] Testar cliente sintético: agendado + walk-in, injetável, não injetável, compound com escalada, assinaturas, gates, finalização e PDFs.
- [ ] Publicar v2 e confirmar que atendimento v1 não muda; arquivar e confirmar histórico.
- [ ] Testar correção same-day e reabertura posterior admin-only.
- [ ] Testar falha/retry de PDF sem perda.
- [ ] Rollback/apagar dados sintéticos e comprovar zero resíduo.
- [ ] Confirmar que projeto antigo e `/admin/` não mudaram.
- [ ] Site CI verde + review final antes de merge/publicação.
- [ ] Commit corretivo/documental final somente se necessário: `chore: valida fase 6c integrada`.

## Definition of Done

- Os 30 itens chegam úteis, pré-configurados — não como cadastro vazio.
- Novo procedimento criado por Mel/Alice/gestora autorizada já nasce com ficha genérica funcional e um dos dois consentimentos mestres.
- Alice gerencia sem virar admin e executa apenas o que estiver clinicamente autorizado.
- Agenda/financeiro antigos continuam usando `procedimentos` sem quebra.
- Nome do procedimento entra automaticamente no PDF correto.
- Protocolos compound derivam consentimento pelos componentes reais.
- Cada sessão tem ficha própria, agendada ou walk-in.
- Gate é backend-enforced.
- Finalizações/correções são versionadas e imutáveis historicamente.
- PDFs/assinaturas permanecem privados.
- 6D/6E não são antecipadas.
- Testes Node/Deno/CI verdes e homologação sintética deixa zero resíduo.
