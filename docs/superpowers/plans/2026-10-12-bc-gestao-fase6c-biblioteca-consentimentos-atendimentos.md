# BC Gestão — Fase 6C: Biblioteca Clínica, Consentimentos e Atendimentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a Fase 6C do BC Gestão com Biblioteca Clínica versionada, catálogo inicial da BC, permissões por profissional, dois modelos mestres de consentimento, ficha clínica individual por sessão e fluxo completo de atendimento, sem quebrar agenda/financeiro existentes e sem puxar para esta fase recursos reservados à 6D.

**Architecture:** Manter `procedimentos` como identidade estável já usada por agenda e financeiro, acrescentando uma camada clínica versionada por RPC/RLS. O atendimento clínico novo será uma entidade própria (`clinical_treatments`), separada do legado `atendimentos`, para suportar atendimento com ou sem agendamento, estados clínicos, consentimento, versionamento e correção auditável. Documentos e assinaturas reaproveitam a infraestrutura privada da 6B, porém com finalização e PDF próprios da 6C. A interface usa um motor genérico por metadados, com campos específicos opcionais, sem criar um formulário de código diferente para cada procedimento.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Node 22 `node:test`, Supabase/PostgreSQL 17 com RLS/RPC, Supabase Storage privado, Supabase Edge Functions em Deno 2 + `pdf-lib`, Web Crypto SHA-256, GitHub Pages e GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-12-bc-gestao-fase6c-biblioteca-clinica-design.md`

## Global Constraints

- Repositório oficial: `bcesteticaavancada/bcesteticaavancada-alt`.
- Supabase correto: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Nunca tocar no projeto antigo `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`).
- Não alterar o legado `/admin/`; mudanças somente em `/gestao/`, migrations, funções e testes da Gestão.
- Nunca expor `service_role`, senha, secret key, UUID interno de profissional ou outro segredo no repositório, log ou UI.
- Toda escrita clínica sensível deve passar por RPC com autoridade server-side; o browser não define autoria, papel, versão final, permissão clínica nem snapshot profissional.
- `procedimentos` continua sendo a identidade estável para agenda/financeiro. Não substituir IDs já referenciados.
- O `atendimentos` legado continua funcional durante a transição. A 6C não o reutiliza como prontuário novo porque ele exige `agendamento_id` e possui vínculo histórico com o fluxo antigo.
- Catálogo inicial: 30 itens únicos precificados; `Hidratação Facial` é alias histórico de `Reset Glow™`, não item ativo separado.
- Classes documentais visíveis permanecem simples: `injetável` e `não injetável`; invasivos com agulha, cânula, fios de PDO ou inserção tecidual relevante usam o consentimento mais rigoroso da classe `injetável`.
- Protocolos compostos escalam para consentimento `injetável` quando qualquer componente efetivamente utilizado for dessa classe.
- Mel/admin e colaboradoras explicitamente autorizadas podem cadastrar/editar/publicar procedimentos. A capacidade administrativa de gerenciar a biblioteca é separada da autorização para executar o procedimento.
- Alice deve poder gerenciar/publicar procedimentos e executar injetáveis quando autorizada, sem virar admin.
- Somente Mel/admin desativa/arquiva procedimentos e concede/revoga permissão de execução.
- Procedimento já utilizado nunca é excluído; versões publicadas e prontuários finalizados são históricos imutáveis.
- Injetável/invasivo exige novo consentimento por sessão. Não injetável pode reutilizar consentimento dentro de protocolo/ciclo explicitamente vinculado; sem vínculo de ciclo, assinar por sessão é o fallback seguro.
- Cada sessão gera `clinical_treatment` próprio, mesmo no mesmo dia ou dentro de protocolo/pacote.
- Estado clínico: `rascunho -> pronto_para_iniciar -> em_atendimento -> finalizado`.
- Gate de início: Anamnese Geral válida quando exigida, confirmação de mudança clínica específica do atendimento, alertas ativos revisados, profissional autorizada, consentimento correto assinado e módulo específico obrigatório completo.
- Fase 6D continua responsável por fotos clínicas, produtos/lotes, equipamentos/parâmetros e intercorrências estruturadas. A 6C pode guardar apenas flags/referências futuras.
- Financeiro individual e comissões da Fase 5 permanecem intactos. A 6C guarda snapshot de preço base/final, mas integração financeira por paciente fica para 6E.
- Correção no mesmo dia clínico (`America/Sao_Paulo`) preserva versão anterior; após o dia, somente com reabertura temporária pela Mel/admin e correção pelo autor original.
- Não usar pacientes reais em testes/homologação. Dados sintéticos devem ser apagados/rollbackados ao final.
- Antes de criar/aplicar qualquer migration, consultar documentação/changelog atual do Supabase e confirmar compatibilidade com Postgres/RLS/Edge Functions usados no projeto.
- Toda migration nova deve ser criada em execução com `supabase migration new <nome>`; não inventar timestamp manualmente.

## Review Focus

1. **Gerenciar ≠ executar:** uma colaboradora com permissão de publicar procedimentos não pode executar um procedimento sem autorização clínica específica; uma profissional autorizada a executar não ganha automaticamente poder de editar a biblioteca.
2. **Histórico imutável:** publicar v2 ou arquivar um procedimento não pode alterar nome/preço/termo/campos vistos por um atendimento já finalizado em v1.
3. **Escalada de consentimento:** protocolo composto com pelo menos um componente `injetável` deve exigir o modelo rigoroso, independentemente da classe base do protocolo.
4. **Origem do atendimento:** criação por agendamento deve ser idempotente por `agendamento_id`; walk-in deve funcionar com `agendamento_id = null` sem reutilizar/quebrar o `atendimentos` legado.
5. **Integridade pós-finalização:** trava por dia clínico/reabertura deve preservar versões anteriores; falha/retry de PDF nunca pode apagar assinaturas ou dados já finalizados e precisa ser idempotente.

---

## File Structure

### Criar

- `gestao/js/procedure-domain.js` — normalização, validação, preço e derivação da classe documental.
- `gestao/js/procedure-api.js` — RPCs da Biblioteca Clínica e permissões.
- `gestao/js/procedure-panel.js` — gerenciamento da biblioteca em admin/colaboradora autorizada.
- `gestao/assets/procedure-library.css` — UI mobile-first da Biblioteca Clínica.
- `gestao/js/treatment-domain.js` — estados, validação e gate do atendimento.
- `gestao/js/treatment-api.js` — RPCs de criação, atualização, consentimento, início, finalização e correção.
- `gestao/js/treatment-panel.js` — fluxo clínico dentro da Pasta da Cliente.
- `gestao/assets/treatment.css` — UI da ficha e estados do atendimento.
- `supabase/functions/generate-procedure-pdf/index.ts` — endpoint JWT para documentos 6C.
- `supabase/functions/generate-procedure-pdf/pdf.ts` — renderer dos dois consentimentos e ficha final.
- `supabase/functions/generate-procedure-pdf/pdf_test.ts`.
- `supabase/functions/generate-procedure-pdf/deno.json`.
- `tests/gestao/procedure-domain.test.mjs`.
- `tests/gestao/procedure-api.test.mjs`.
- `tests/gestao/procedure-panel.test.mjs`.
- `tests/gestao/treatment-domain.test.mjs`.
- `tests/gestao/treatment-api.test.mjs`.
- `tests/gestao/treatment-panel.test.mjs`.
- `tests/gestao/phase6c-procedure-db-contract.test.mjs`.
- `tests/gestao/phase6c-treatment-db-contract.test.mjs`.
- `tests/gestao/phase6c-rpc-grants.test.mjs`.
- `tests/gestao/phase6c-catalog-seed.test.mjs`.
- `tests/gestao/phase6c-document-contract.test.mjs`.

### Modificar

- `gestao/js/auth.js` — carregar capacidade `pode_gerenciar_procedimentos` no perfil autenticado.
- `gestao/js/admin-agenda.js` — remover responsabilidade de cadastrar procedimento; manter somente leitura dos procedimentos ativos para agenda.
- `gestao/js/agenda-api.js` — retirar `createProcedure` após migração da UI; preservar `listActiveProcedures` e contratos da agenda.
- `gestao/admin/index.html` — substituir formulário simples por container da Biblioteca Clínica; inicializar `procedure-panel`.
- `gestao/colaborador/index.html` — adicionar área/menu de Procedimentos somente quando a capacidade estiver ativa; integrar entrada para ficha clínica a partir do agendamento.
- `gestao/js/clientes-folder.js` — adicionar aba `Atendimentos` e timeline clínica 6C sem financeiro.
- `gestao/js/clinical-folder-runtime.js` — hidratar atendimentos, procedimentos e documentos 6C.
- `gestao/js/clinical-documents-api.js` — APIs de consentimento/ficha/PDF 6C, preservando chamadas da anamnese.
- `gestao/assets/clientes-folder.css` — encaixe da nova aba e cards clínicos.
- `.github/workflows/site-ci.yml` — incluir teste Deno da nova Edge Function.
- `tests/gestao/clientes-folder.test.mjs` e testes de auth/agenda afetados.

### Migrations a criar durante a execução

Usar CLI, nesta ordem, e trabalhar no arquivo cujo nome real for retornado:

1. `supabase migration new bc_gestao_phase6c_procedure_library`
2. `supabase migration new bc_gestao_phase6c_catalog_seed`
3. `supabase migration new bc_gestao_phase6c_treatment_core`
4. `supabase migration new bc_gestao_phase6c_documents`
5. Migration corretiva adicional somente se testes/advisors demonstrarem necessidade; criar também via CLI.

## Interfaces principais

```js
normalizeProcedureDraft(input) -> ProcedureDraft
validateProcedureDraft(input) -> { valid, errors }
deriveConsentClass({ procedureVersion, componentVersions }) -> 'injetavel' | 'nao_injetavel'
formatProcedurePrice(procedureVersion) -> string
```

```js
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
canSameDayCorrect({ finalizedAt, now, authorUserId, currentUserId }) -> boolean
```

```js
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
createTreatmentReopenGrant({ client, treatmentId, reason, expiresAt }) // admin-only
correctReopenedTreatment({ client, treatmentId, patch })
```

## Modelo de dados alvo

### `procedimentos` — identidade estável

Manter colunas atuais e adicionar somente o necessário para a camada clínica:

- `current_version_id uuid null`;
- `archived_at timestamptz null`.

`nome`, `ativo` e `duracao_padrao` permanecem sincronizados com a versão publicada atual para não quebrar agenda/financeiro existentes.

### `procedure_versions`

- `id`, `procedimento_id`, `version`, `status` (`draft|published|superseded`);
- `classe_documental` (`injetavel|nao_injetavel`);
- `categoria`, `descricao`, `price_mode` (`fixed|starting_at`), `base_price`, `suggested_duration`;
- `requires_general_anamnesis`, `requires_return`, `return_interval_days`;
- `pre_guidance`, `post_guidance`, `consent_supplement`;
- `specific_schema jsonb`, `technical_schema jsonb`;
- `protocol_mode` (`simple|compound`);
- `requires_photo`, `requires_product_lot`, `requires_equipment` como flags futuras da 6D;
- autoria/publicação e timestamps.

Regras: uma versão `published` nunca é editada; mudança cria/atualiza draft e publicação gera nova versão histórica.

### `procedure_professional_permissions`

- `procedimento_id`, `professional_user_id`, `allowed`, `granted_by`, `granted_at`, `revoked_at`;
- chave única por procedimento/profissional.

### `procedure_version_components`

- `parent_version_id`, `component_version_id`, `required`, `sort_order`;
- mantém snapshot de composição por versão do protocolo.

### `procedure_aliases`

- `procedimento_id`, `alias`, `historical`, timestamps;
- seed: `Hidratação Facial -> Reset Glow™`.

### `staff_profiles`

Adicionar `pode_gerenciar_procedimentos boolean not null default false`.

Admin tem capacidade efetiva independentemente do flag. Alice é habilitada operacionalmente por RPC após resolver seu `user_id` no projeto correto; não gravar e-mail/UUID dela no código/migration.

### `consent_template_versions`

- `id`, `template_key` (`injetavel|nao_injetavel`), `version`, `status`, `title_pattern`, `body_json`, autoria/publicação/timestamps;
- dois templates mestres publicados inicialmente;
- atualização gera nova versão, nunca sobrescreve a usada em prontuário antigo.

### `clinical_treatments`

- identidade: `id`, `cliente_id`, `procedimento_id`, `procedure_version_id`, `profissional_user_id`;
- origem: `agendamento_id null`, único quando não nulo para impedir duplicação do mesmo agendamento;
- estado: `status` (`rascunho|pronto_para_iniciar|em_atendimento|finalizado`);
- snapshots comerciais: `price_mode`, `base_price`, `final_price`;
- clínico: `region`, `specific_data jsonb`, `technical_data jsonb`, `notes`, `post_guidance`, `return_recommended_at`;
- referências: `anamnese_id`, `consent_document_id`, `current_version`;
- autoria, início/finalização e timestamps.

### `clinical_treatment_components`

- `treatment_id`, `procedure_version_id`, `sort_order`;
- registra composição real da sessão para derivação do consentimento.

### `clinical_treatment_health_confirmations`

- `treatment_id` único, `anamnese_id`, `changed`, `details`, `confirmed_by`, `confirmed_at`;
- confirmação é por atendimento, não apenas por dia.

### `clinical_treatment_alert_reviews`

- snapshot dos alertas ativos no momento da confirmação;
- RPC deve copiar server-side todos os alertas ativos da cliente, impedindo o browser de omitir um alerta.

### `clinical_treatment_versions`

- snapshot imutável de cada finalização/correção: `treatment_id`, `version`, `snapshot_json`, `created_by`, `created_at`, `reason`;
- versão anterior nunca é sobrescrita.

### `clinical_treatment_reopen_grants`

- `treatment_id`, `authorized_by`, `authorized_for`, `reason`, `expires_at`, `used_at`, timestamps;
- somente admin cria; `authorized_for` deve ser o autor original do atendimento.

### `clinical_documents`

Ampliar `document_type` sem alterar comportamento da anamnese:

- `anamnese_geral` (existente);
- `procedure_consent`;
- `treatment_record`.

Consentimento e ficha final usam a mesma tabela privada, mas têm RPCs de finalização próprios para não acoplar o fluxo 6C à implementação específica de `bc_clinical_document_finalize` da anamnese.

## Conteúdo clínico e dois templates mestres

Durante a implementação, antes do seed definitivo dos textos:

- [ ] Pesquisar referências oficiais/atuais pertinentes, priorizando Anvisa, conselhos profissionais aplicáveis e instruções oficiais de produto/equipamento quando relevante.
- [ ] Usar os fluxos e definições fornecidos pela própria BC como fonte para Protocolos Exclusivos BC™.
- [ ] Não transformar copy comercial em instrução clínica automaticamente.
- [ ] Não inventar dose, concentração, profundidade, energia, contraindicação ou conduta.
- [ ] Seedar dois termos mestres com linguagem clara: `Injetável/Invasivo` e `Não injetável`.
- [ ] Inserir nome do procedimento dinamicamente no cabeçalho e anexar `consent_supplement` versionado quando existir.

---

### Task 1: Domínio RED/GREEN da Biblioteca Clínica

**Files:** `tests/gestao/procedure-domain.test.mjs`, `gestao/js/procedure-domain.js`.

- [ ] Escrever testes RED para normalização de `fixed`/`starting_at`, preço inválido, classe inválida, nome obrigatório e duração positiva.
- [ ] Testar `deriveConsentClass`: simples não injetável, simples injetável, protocolo composto não injetável e protocolo com um componente injetável escalando para `injetavel`.
- [ ] Testar formatação de `R$ 180,00` e `A partir de R$ 195,00`.
- [ ] Rodar `node --test tests/gestao/procedure-domain.test.mjs`; esperado RED por módulo inexistente.
- [ ] Implementar `procedure-domain.js` com funções puras, sem acesso ao Supabase.
- [ ] Rodar novamente; esperado GREEN.
- [ ] Rodar `npm run test:gestao` para regressão.
- [ ] Commit: `feat: define dominio da biblioteca clinica`.

### Task 2: Banco versionado da Biblioteca Clínica e permissões

**Files:** migration gerada por `supabase migration new bc_gestao_phase6c_procedure_library`; `tests/gestao/phase6c-procedure-db-contract.test.mjs`; `tests/gestao/phase6c-rpc-grants.test.mjs`; `gestao/js/auth.js` + teste de auth afetado.

- [ ] Antes da migration, verificar documentação/changelog Supabase atual para RLS, `security definer`, grants e Edge/Postgres 17.
- [ ] Escrever testes RED de contrato para `procedure_versions`, componentes, aliases, permissões, flag `pode_gerenciar_procedimentos`, imutabilidade de published e ausência de DML direto sensível.
- [ ] Rodar os testes de contrato e confirmar RED.
- [ ] Criar migration via CLI; adicionar tabelas/índices/constraints/RLS.
- [ ] Implementar helpers privados com `auth.uid()` e wrappers públicos `security invoker` para:
  - `bc_procedure_list`;
  - `bc_procedure_get`;
  - `bc_procedure_save_draft`;
  - `bc_procedure_publish`;
  - `bc_procedure_archive` (admin-only);
  - `bc_procedure_set_execution_permission` (admin-only);
  - `bc_staff_set_procedure_manager` (admin-only).
- [ ] Publicação deve sincronizar `procedimentos.nome`, `ativo`, `duracao_padrao`, `current_version_id` e superseder a versão anterior de forma transacional.
- [ ] Bloquear UPDATE/DELETE de versão publicada fora da rotina de publicação; impedir DELETE do procedimento quando houver qualquer versão/uso.
- [ ] Atualizar `auth.js` para selecionar `pode_gerenciar_procedimentos`; admin continua autorizado por papel mesmo com flag false.
- [ ] Testar que gestão da biblioteca e execução são capacidades independentes.
- [ ] Rodar `npm run test:gestao`.
- [ ] Commit: `feat: adiciona biblioteca clinica versionada`.

### Task 3: Seed oficial dos 30 itens e API da biblioteca

**Files:** migration gerada por `supabase migration new bc_gestao_phase6c_catalog_seed`; `tests/gestao/phase6c-catalog-seed.test.mjs`; `gestao/js/procedure-api.js`; `tests/gestao/procedure-api.test.mjs`.

- [ ] Escrever teste RED que cobre exatamente os 30 nomes/preços/modes aprovados e garante ausência de `Hidratação Facial` como item ativo separado.
- [ ] Cobrir alias `Hidratação Facial -> Reset Glow™`.
- [ ] Cobrir exemplos inequívocos de classe: Botox/Preenchimento/Skinbooster/Bioestimulador/Enzimas/Profhilo/Microagulhamento/Fort Hair Plus/Face Reset como modelo rigoroso; Limpeza/Sculpt Cryo/Reset Glow/Ultrassom como não injetáveis.
- [ ] Para protocolo cuja via dependa da composição real, configurar `protocol_mode='compound'` e exigir seleção de componentes antes de `pronto_para_iniciar`; não inventar via.
- [ ] Criar seed idempotente via migration CLI, sem IDs de staff reais no arquivo.
- [ ] Implementar `procedure-api.js` apenas via RPC para escrita.
- [ ] Testar que payload não envia `created_by`, `published_by` ou autorização clínica definida pelo navegador.
- [ ] Rodar `node --test tests/gestao/procedure-api.test.mjs tests/gestao/phase6c-catalog-seed.test.mjs`.
- [ ] Rodar `npm run test:gestao`.
- [ ] Commit: `feat: carrega catalogo clinico inicial da bc`.

### Task 4: Painel de Procedimentos para Mel e colaboradoras autorizadas

**Files:** `gestao/js/procedure-panel.js`, `gestao/assets/procedure-library.css`, `gestao/admin/index.html`, `gestao/colaborador/index.html`, `gestao/js/admin-agenda.js`, `gestao/js/agenda-api.js`, `tests/gestao/procedure-panel.test.mjs`, testes de agenda afetados.

- [ ] Escrever testes RED da UI: nome, classe, preço/mode, categoria, duração, Anamnese Geral, retorno, orientações, complemento opcional, protocolo simples/composto e publicação.
- [ ] Testar que colaboradora sem `pode_gerenciar_procedimentos` não recebe menu/área; Alice/capacidade true recebe.
- [ ] Testar que ação de arquivar e concessão de execução aparecem somente para admin.
- [ ] Implementar `initProcedurePanel({ client, profile, root })` compartilhado por admin e colaboradora autorizada.
- [ ] Substituir formulário simples do admin pelo novo painel.
- [ ] Remover criação de procedimento de `admin-agenda.js` e `createProcedure` de `agenda-api.js`, mas manter `listActiveProcedures` para os selects da agenda.
- [ ] Garantir que publicar/refrescar biblioteca atualiza os selects de agenda sem recarregar a página quando possível.
- [ ] No admin, incluir controle de `Pode gerenciar procedimentos` para profissionais e matriz de `Pode executar` por procedimento.
- [ ] Habilitar Alice operacionalmente pelo RPC/admin durante homologação, resolvendo `user_id` no banco sem gravar identificador pessoal no repo.
- [ ] Rodar testes específicos + `npm run test:gestao`.
- [ ] Commit: `feat: adiciona painel da biblioteca clinica`.

### Task 5: Consentimentos mestres, assinaturas e documentos 6C

**Files:** migration gerada por `supabase migration new bc_gestao_phase6c_documents`; `gestao/js/clinical-documents-api.js`; `tests/gestao/phase6c-document-contract.test.mjs`; testes de `clinical-documents`.

- [ ] Escrever testes RED para `consent_template_versions`, novos `document_type`, snapshot de template/procedimento e preservação do fluxo `anamnese_geral` existente.
- [ ] Pesquisar e consolidar os dois textos mestres conforme a seção “Conteúdo clínico” deste plano; registrar referências no comentário/documentação técnica do seed, sem copiar trechos extensos de terceiros.
- [ ] Criar os dois templates v1: `injetavel` e `nao_injetavel`.
- [ ] Ampliar constraint de `clinical_documents.document_type` de modo aditivo.
- [ ] Reutilizar `clinical_signatures` e paths privados existentes; não duplicar bucket ou pad de assinatura.
- [ ] Implementar RPC `bc_treatment_prepare_consent`: resolve classe server-side, versão de procedimento, template ativo, cabeçalho dinâmico e profissional responsável.
- [ ] Implementar RPC `bc_treatment_consent_finalize` separado da finalização da anamnese.
- [ ] Regra de assinatura: paciente/responsável + profissional; idade calculada na assinatura usando regra 6B.
- [ ] Consentimento `injetavel` é por sessão. Não injetável só pode reutilizar documento quando houver vínculo explícito de protocolo/ciclo e mesma versão de procedimento/template; caso contrário, novo documento.
- [ ] Atualizar `clinical-documents-api.js` com `finalizeTreatmentConsent` e `generateProcedurePdf`, preservando as funções existentes.
- [ ] Rodar contratos e regressão 6B.
- [ ] Commit: `feat: adiciona consentimentos clinicos da fase 6c`.

### Task 6: Core do atendimento clínico, gates e versionamento

**Files:** migration gerada por `supabase migration new bc_gestao_phase6c_treatment_core`; `gestao/js/treatment-domain.js`; `gestao/js/treatment-api.js`; `tests/gestao/treatment-domain.test.mjs`; `tests/gestao/treatment-api.test.mjs`; `tests/gestao/phase6c-treatment-db-contract.test.mjs`.

- [ ] Escrever testes RED dos quatro estados e de cada motivo de gate pendente.
- [ ] Cobrir criação com `appointmentId` e walk-in com `null`; mesmo agendamento não pode criar dois treatments.
- [ ] Cobrir preço: `fixed` usa snapshot base; `starting_at` exige `final_price >= 0` e registra valor final/diferença sem lançar movimento financeiro nesta fase.
- [ ] Criar tabelas `clinical_treatments`, componentes, health confirmations, alert reviews, versions e reopen grants.
- [ ] Implementar RPCs `bc_treatment_create`, `bc_treatment_get`, `bc_treatment_list_client`, `bc_treatment_update_draft`.
- [ ] Implementar `bc_treatment_confirm_health_change`; cada atendimento precisa de confirmação própria.
- [ ] Implementar `bc_treatment_confirm_alert_review` fazendo snapshot server-side de todos os alertas ativos naquele instante.
- [ ] Implementar `bc_treatment_mark_ready` recalculando server-side: Anamnese Geral, confirmação, alertas, consentimento, permissão profissional, composição e campos específicos.
- [ ] Implementar `bc_treatment_start`; somente profissional autorizada do treatment.
- [ ] Implementar `bc_treatment_finalize`: valida ficha, identidade profissional, cria snapshot `clinical_treatment_versions` e documento `treatment_record`.
- [ ] Implementar correção no mesmo dia pelo autor com nova versão; data clínica sempre `America/Sao_Paulo`.
- [ ] Implementar grant temporário de reabertura admin-only + correção apenas pelo autor original; consumir grant e auditar.
- [ ] Nenhum UPDATE direto das tabelas clínicas pelo browser.
- [ ] Rodar testes específicos e `npm run test:gestao`.
- [ ] Commit: `feat: adiciona ficha clinica versionada por sessao`.

### Task 7: Pasta da Cliente e fluxo clínico mobile-first

**Files:** `gestao/js/treatment-panel.js`, `gestao/assets/treatment.css`, `gestao/js/clientes-folder.js`, `gestao/js/clinical-folder-runtime.js`, `gestao/admin/index.html`, `gestao/colaborador/index.html`, `tests/gestao/treatment-panel.test.mjs`, `tests/gestao/clientes-folder.test.mjs`.

- [ ] Escrever testes RED para aba `Atendimentos`, lista histórica, botão `Novo atendimento`, entrada via agendamento e walk-in.
- [ ] Atualizar tabs da pasta para `Linha do tempo`, `Cadastro`, `Anamnese`, `Atendimentos`, `Documentos`; não misturar financeiro.
- [ ] Renderizar procedimento/versão, profissional, origem, estado e documentos sem expor preço na timeline clínica compartilhada; preço pode aparecer somente no contexto operacional permitido, não na timeline clínica.
- [ ] Criar wizard compacto: procedimento/componentes -> checagem de saúde/alertas -> consentimento/assinaturas -> ficha técnica -> finalizar.
- [ ] Reutilizar `signature-pad.js`; não criar segundo mecanismo de assinatura.
- [ ] Para procedimento compound, obrigar seleção dos componentes efetivamente usados e mostrar a classe documental resultante antes da assinatura.
- [ ] Permitir abrir atendimento a partir do detalhe do agendamento sem usar o formulário legado `atendimento-form.js` como prontuário 6C.
- [ ] Manter o fluxo legado visível/compatível enquanto a migração for gradual; não apagar histórico anterior.
- [ ] No estado `pronto_para_iniciar`, mostrar checklist dos gates; impedir avanço pela UI, mas confiar na RPC como autoridade.
- [ ] Finalização profissional gera ficha/documento e atualiza pasta/timeline.
- [ ] Rodar testes específicos + `npm run test:gestao`.
- [ ] Commit: `feat: integra atendimentos clinicos a pasta da cliente`.

### Task 8: PDF institucional de consentimento e ficha final

**Files:** `supabase/functions/generate-procedure-pdf/{index.ts,pdf.ts,pdf_test.ts,deno.json}`, `.github/workflows/site-ci.yml`, `gestao/js/clinical-documents-api.js`.

- [ ] Escrever `pdf_test.ts` primeiro para cabeçalho dinâmico, código/versão, identificação cliente, snapshot profissional, conteúdo do template/suplemento, assinatura e ficha técnica.
- [ ] Rodar `deno test --config supabase/functions/generate-procedure-pdf/deno.json supabase/functions/generate-procedure-pdf/pdf_test.ts`; esperado RED.
- [ ] Reutilizar linguagem visual do PDF da Anamnese 6B (BC, dourado/ink, A4, paginação) sem modificar `generate-anamnese-pdf`.
- [ ] Edge Function recebe somente `documentId`, exige JWT, resolve tudo server-side e verifica que `document_type` é 6C.
- [ ] Gerar paths privados separados, por exemplo `documentos/procedimentos/{clienteId}/{documentId}.pdf`.
- [ ] Calcular SHA-256 e marcar documento `emitido`; retry deve devolver/regenerar de modo idempotente sem duplicar assinatura/documento.
- [ ] Falha de PDF deve marcar `erro_pdf` e permitir retry; nunca desfazer consentimento assinado, treatment ou snapshot finalizado.
- [ ] Adicionar teste Deno da nova função ao Site CI.
- [ ] Rodar Deno tests + `npm test`.
- [ ] Commit: `feat: gera pdf de consentimento e atendimento clinico`.

### Task 9: Hardening, homologação sintética e entrega

**Files:** migrations corretivas somente se necessárias, testes de contrato, documentação operacional/PR.

- [ ] Rodar `npm test` completo.
- [ ] Rodar ambos os conjuntos Deno: Anamnese 6B e Procedure PDF 6C.
- [ ] Revisar grants de todas as RPCs 6C: `anon` sem acesso clínico; `authenticated` somente wrappers necessários.
- [ ] Rodar advisors de segurança/performance do Supabase e comparar com baseline conhecido; não “corrigir” avisos históricos não relacionados sem justificativa.
- [ ] Aplicar migrations somente no `bc-estetica-gestao` após confirmar ref `tpqsmerlxquyrzrjbogj`.
- [ ] Validar seed: 30 itens, preços, alias, sem duplicidade de Reset Glow/Hidratação Facial.
- [ ] Habilitar capacidade de gerenciamento para Alice por operação autenticada/administrativa no banco correto, sem persistir identificador pessoal no código.
- [ ] Configurar permissões iniciais de execução aprovadas, incluindo Botox para Mel + Alice; demais permissões somente conforme cadastro autorizado pela BC.
- [ ] Criar cliente/procedimentos/agendamento sintéticos; testar walk-in e agendado.
- [ ] Testar injetável: consentimento por sessão, duas assinaturas aplicáveis, gate, início, finalização e PDF.
- [ ] Testar não injetável e protocolo composto com componente injetável escalando consentimento.
- [ ] Testar publicação v2 sem alterar treatment v1; arquivar procedimento mantendo histórico.
- [ ] Testar correção same-day; testar bloqueio após dia clínico com grant de reabertura temporário admin-only.
- [ ] Testar falha/retry de PDF sem perda de assinatura/dados.
- [ ] Apagar/rollbackar todos os dados sintéticos e comprovar zero resíduo.
- [ ] Confirmar que projeto antigo e `/admin/` não sofreram alteração.
- [ ] Rodar Site CI no PR e só então solicitar code review final.
- [ ] Commit final apenas se hardening/documentação exigir: `chore: valida fase 6c integrada`.

## Definition of Done

- Biblioteca Clínica mostra os 30 itens iniciais e permite Mel/colaboradora autorizada criar, editar e publicar novo procedimento com mínimo de burocracia.
- Alice pode gerenciar a biblioteca sem papel admin e pode executar injetáveis apenas quando tiver permissão clínica específica.
- Mel/admin pode conceder execução, conceder gestão e arquivar procedimentos.
- Agenda antiga continua funcionando com `procedimentos.id`, `nome` e `duracao_padrao`.
- Dois modelos mestres geram o documento correto e o nome do procedimento aparece automaticamente no cabeçalho.
- Protocolos compostos usam composição real da sessão e escalam o consentimento corretamente.
- Cada sessão cria uma ficha clínica independente, com ou sem agendamento.
- Gate de início é imposto no backend; UI apenas apresenta o estado.
- Finalização cria snapshot imutável + documento; correções criam nova versão.
- PDFs e assinaturas permanecem privados e versionados.
- Fotos clínicas, lotes/equipamentos e intercorrências estruturadas continuam fora da 6C.
- Todos os testes Node/Deno e CI verdes; homologação sintética deixa zero dados residuais.
