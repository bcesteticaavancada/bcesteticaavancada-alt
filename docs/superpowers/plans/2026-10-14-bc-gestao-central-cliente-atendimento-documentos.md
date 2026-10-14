# BC Gestão — Central da Cliente, Atendimento Rápido, Documentos Externos e Bioestimulador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a Pasta da Cliente existente na entrada clínica principal do BC Gestão, com atendimento rápido vinculado à agenda, documentos externos privados, Relatório/Parecer obrigatório, TCLE externo revisável e TCLE específico de Bioestimulador.

**Architecture:** Evoluir os módulos atuais (`clientes`, agenda, anamnese, `clinical_documents`, `clinical_treatments` e 6D) sem criar prontuário paralelo. Arquivos externos vivem em `client_files`, mas aparecem junto dos documentos BC por um feed unificado; atendimento walk-in usa um RPC transacional agenda → tratamento; Relatório/Parecer entra no gate e no snapshot final do tratamento; a aba Fotos agrega identificação e fotos clínicas sem duplicar bytes ou metadados.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Node.js `node:test`, Supabase/PostgreSQL (RLS/RPC/Storage privado), Supabase Edge Functions para PDF, GitHub Actions/Pages.

**Spec:** `docs/superpowers/specs/2026-10-14-bc-gestao-central-cliente-atendimento-documentos-design.md`

## Global Constraints

- Repositório: `bcesteticaavancada/bcesteticaavancada-alt`.
- Supabase correto: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Nunca alterar `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`).
- Não alterar o legado `/admin/`; trabalhar em `/gestao/` e infraestrutura correspondente.
- Storage permanece no bucket privado `bc-prontuario-private`; nunca usar `getPublicUrl`.
- Preservar os IDs/contratos atuais da área Clientes (`clientsSearch`, `clientsList`, `clientCreateForm`, `clientEditor`, `clientHistoryTimeline`).
- Assinatura em tela continua sendo o fluxo padrão integrado.
- Documento externo não satisfaz gate de consentimento sem vínculo explícito e revisão profissional.
- Todo novo schema exposto deve ter RLS e grants explícitos; autoria vem de `auth.uid()`.
- Não criar banco separado por cliente; tudo continua vinculado por `cliente_id`.
- Não apagar fisicamente documento clínico registrado; usar anulação lógica.
- Implementação em TDD e validação apenas com dados fictícios.
- Backend de cada fatia deve estar aplicado e validado antes do frontend dependente ser publicado.

## File Structure

### Criar
- `gestao/js/client-files-api.js` — upload, registro, download e anulação de arquivos externos.
- `gestao/js/client-documents-panel.js` — feed unificado de documentos e ações por arquivo.
- `gestao/js/client-photos-panel.js` — identificação + fotos clínicas agregadas da cliente.
- `gestao/js/quick-visit-api.js` — criação idempotente de encaixe + tratamento.
- `gestao/js/quick-visit-panel.js` — fluxo curto `Novo atendimento` a partir da Central.
- `gestao/js/treatment-report-api.js` — leitura/gravação do Relatório/Parecer.
- `tests/gestao/client-files-api.test.mjs`
- `tests/gestao/client-documents-panel.test.mjs`
- `tests/gestao/client-photos-panel.test.mjs`
- `tests/gestao/quick-visit-api.test.mjs`
- `tests/gestao/quick-visit-panel.test.mjs`
- `tests/gestao/treatment-report-api.test.mjs`
- `tests/gestao/bioestimulador-consent.test.mjs`
- `tests/gestao/phase6e-client-central-read.test.mjs`
- `tests/gestao/phase6e-client-files-database.test.mjs`
- `tests/gestao/phase6e-quick-visit-database.test.mjs`
- `tests/gestao/phase6e-treatment-report-database.test.mjs`
- `tests/gestao/phase6e-external-consent-database.test.mjs`
- `supabase/migrations/20261014010000_bc_gestao_bioestimulador_consent.sql`
- `supabase/migrations/20261014010500_bc_gestao_client_central_read.sql`
- `supabase/migrations/20261014011000_bc_gestao_client_files.sql`
- `supabase/migrations/20261014012000_bc_gestao_quick_visit.sql`
- `supabase/migrations/20261014013000_bc_gestao_treatment_reports.sql`
- `supabase/migrations/20261014014000_bc_gestao_external_consents.sql`
- `supabase/migrations/20261014015000_bc_gestao_client_central_hardening.sql`
- `docs/superpowers/ledgers/2026-10-14-bc-gestao-central-cliente-progress.md`

### Modificar
- `gestao/js/clientes-folder.js` — Central, abas e ações de cabeçalho.
- `gestao/js/clientes-panel.js` — abertura/refresh da Central preservando contratos atuais.
- `gestao/js/clinical-folder-runtime.js` — lazy hydration dos módulos clínicos/documentais.
- `gestao/js/clinical-documents-api.js` — manter geração/download dos documentos BC e compartilhar helper de URL assinada quando aplicável.
- `gestao/js/agenda-treatment-bridge.js` — aceitar tratamento já criado pelo quick visit.
- `gestao/js/treatment-api.js` — wrappers de TCLE externo; relatório permanece em API dedicada.
- `gestao/js/treatment-panel.js` — parecer obrigatório, TCLE externo e estados de finalização.
- `gestao/assets/clientes-folder.css`
- `gestao/assets/treatment.css`
- `supabase/functions/generate-clinical-pdf/index.ts` — incluir Relatório/Parecer no PDF final.
- testes de regressão relevantes já existentes em `tests/gestao/`.

## Review Focus

1. **Duplo clique/retry no walk-in:** duas requisições com a mesma chave não podem criar dois encaixes/tratamentos; Task 5 fixa idempotência no backend.
2. **Arquivo externo órfão:** falha entre Storage e RPC não pode deixar objeto reaproveitável ou metadata apontando para arquivo inexistente; Task 2 testa registro e limpeza segura do upload ainda não registrado.
3. **TCLE externo da cliente errada ou versão errada:** backend rejeita mesmo com IDs válidos; Task 9 testa ambos.
4. **Finalização com parecer faltando:** `bc_treatment_finalize` retorna `parecer_pendente` sem criar documento final parcial; Task 7 testa o gate.
5. **Cliente/profissional/procedimento indisponível durante o encaixe:** o RPC falha atomicamente, sem agendamento ou tratamento residual; Task 5 testa cada classe principal.

---

### Task 1: Publicar TCLE específico de Bioestimulador

**Files:**
- Create: `supabase/migrations/20261014010000_bc_gestao_bioestimulador_consent.sql`
- Create: `tests/gestao/bioestimulador-consent.test.mjs`

**Interfaces:**
- Consumes: `procedimentos`, `procedure_versions`, versionamento/imutabilidade já usados para Botox e Preenchimento.
- Produces: nova versão publicada de `Bioestimulador` com `consent_supplement`, preservando a versão anterior como `superseded`.

- [ ] **Step 1: Escrever testes RED** exigindo nova versão publicada, versão anterior preservada, `classe_documental='injetavel'`, manutenção de `requires_general_anamnesis`, `requires_photo`, `requires_product_lot`, riscos tardios/nódulos/granulomas/rastreabilidade e ausência de promessa de reversão universal.
- [ ] **Step 2: Rodar RED**: `node --test tests/gestao/bioestimulador-consent.test.mjs`; esperado: FAIL por migration inexistente.
- [ ] **Step 3: Implementar migration aditiva e idempotente** copiando flags da versão atual e alterando apenas `consent_supplement`; o texto não presume equivalência entre produtos nem trata PMMA como bioestimulador genérico.
- [ ] **Step 4: Rodar GREEN**; esperado: PASS.
- [ ] **Step 5: Rodar `npm run test:gestao`**; esperado: PASS.
- [ ] **Step 6: Commit** `feat: adiciona consentimento específico de bioestimulador`.

### Task 2: Criar backend seguro de documentos externos

**Files:**
- Create: `supabase/migrations/20261014011000_bc_gestao_client_files.sql`
- Create: `tests/gestao/phase6e-client-files-database.test.mjs`
- Create: `gestao/js/client-files-api.js`
- Create: `tests/gestao/client-files-api.test.mjs`

**Interfaces:**
- Produces SQL:
  - `public.bc_client_file_register(p_cliente_id uuid,p_title text,p_category text,p_origin text,p_document_date date,p_storage_path text,p_mime_type text,p_size_bytes bigint,p_sha256 text) returns uuid`
  - `public.bc_client_file_void(p_file_id uuid,p_reason text) returns uuid`
- Produces JS:
  - `uploadClientFile({client,clienteId,file,title,category,origin,documentDate}) -> Promise<{id,storagePath}>`
  - `getClientFileUrl({client,storagePath,downloadFilename,expiresIn=300}) -> Promise<string>`
  - `voidClientFile({client,fileId,reason}) -> Promise<string>`

- [ ] **Step 1: Escrever testes RED de banco** para `client_files`, RLS, categorias/origens, MIME `pdf/jpeg/png/webp`, máximo 8 MiB, caminho `arquivos-clientes/{cliente_id}/...`, SHA-256, autoria `auth.uid()`, anulação lógica e grants sem `anon`.
- [ ] **Step 2: Escrever testes RED de Storage**: INSERT apenas em `arquivos-clientes`, DELETE somente para objeto do próprio usuário ainda não registrado em `client_files`, nenhum update/overwrite de arquivo registrado.
- [ ] **Step 3: Escrever teste RED da API** garantindo que browser não envia `uploaded_by`, calcula hash, usa `upsert:false`, nunca chama `getPublicUrl` e tenta remover somente o objeto recém-enviado se o registro RPC falhar.
- [ ] **Step 4: Rodar RED** nos testes desta Task; esperado: FAIL.
- [ ] **Step 5: Implementar migration** validando no backend que `storage.objects` existe no bucket correto, caminho pertence à cliente, MIME/tamanho batem e metadata ainda não foi registrada.
- [ ] **Step 6: Implementar `client-files-api.js`** com validação local + upload + hash + registro RPC + compensação restrita ao upload ainda órfão.
- [ ] **Step 7: Rodar GREEN**; esperado: PASS.
- [ ] **Step 8: Commit** `feat: adiciona arquivos externos privados por cliente`.

### Task 3: Unificar feed documental e downloads individuais

**Files:**
- Modify: `supabase/migrations/20261014011000_bc_gestao_client_files.sql`
- Create: `gestao/js/client-documents-panel.js`
- Create: `tests/gestao/client-documents-panel.test.mjs`
- Modify: `gestao/js/clinical-folder-runtime.js`
- Modify: `gestao/js/clientes-folder.js`

**Interfaces:**
- Produces SQL: `public.bc_client_document_feed(p_cliente_id uuid) returns table(source_kind text,source_id uuid,title text,category text,origin text,status text,document_date date,created_at timestamptz,storage_path text,mime_type text,downloadable boolean)`.
- Produces JS:
  - `listClientDocumentFeed({client,clienteId}) -> Promise<Array<DocumentFeedItem>>`
  - `renderClientDocuments(items) -> string`
  - `initClientDocumentsPanel({client,root,getClientRecord,refresh}) -> Controller`

- [ ] **Step 1: Escrever testes RED** para união de `clinical_documents` + `client_files`, ocultação de arquivos anulados e botão `Baixar` individual em cada item baixável.
- [ ] **Step 2: Rodar RED**; esperado: FAIL.
- [ ] **Step 3: Implementar RPC do feed** sem copiar bytes nem URLs assinadas para o banco.
- [ ] **Step 4: Implementar painel documental** com `Anexar documento`, preview/download por URL assinada curta e anulação com motivo.
- [ ] **Step 5: Integrar lazy hydration** no painel `documentos`; remover renderização documental duplicada de `clientes-folder.js`/`clinical-folder-runtime.js` em favor do módulo único.
- [ ] **Step 6: Rodar `client-documents-panel.test.mjs` + `clinical-documents-runtime-6c.test.mjs`**; esperado: PASS.
- [ ] **Step 7: Commit** `feat: unifica documentos da pasta da cliente`.

### Task 4: Transformar Pasta da Cliente em Central e agregar Fotos

**Files:**
- Create: `supabase/migrations/20261014010500_bc_gestao_client_central_read.sql`
- Create: `tests/gestao/phase6e-client-central-read.test.mjs`
- Create: `gestao/js/client-photos-panel.js`
- Create: `tests/gestao/client-photos-panel.test.mjs`
- Modify: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/js/clinical-folder-runtime.js`
- Modify: `gestao/assets/clientes-folder.css`
- Modify: `tests/gestao/clientes-folder.test.mjs`
- Modify: `tests/gestao/clientes-panel.test.mjs`

**Interfaces:**
- Produces SQL: `public.bc_client_clinical_photo_list(p_cliente_id uuid) returns jsonb` com fotos clínicas não anuladas, tratamento/procedimento e metadados necessários para exibição.
- Produces JS: `initClientPhotosPanel({client,root,getClientRecord})`.
- Produces no topo: `[data-client-new-treatment]`, `[data-client-schedule]`, `[data-client-upload-document]`, `[data-client-edit]`.
- Mantém IDs existentes da área Clientes.

- [ ] **Step 1: Escrever testes RED do RPC de fotos**: mesma cliente, apenas equipe ativa, sem objetos anulados, sem URL pública.
- [ ] **Step 2: Escrever testes RED da UI** para cabeçalho compacto e abas `resumo|atendimentos|anamnese|fotos|documentos` com lazy loading.
- [ ] **Step 3: Escrever teste da aba Fotos** exigindo foto de identificação atual/histórica + fotos clínicas agregadas com URLs assinadas.
- [ ] **Step 4: Testar preservação** de `clientsSearch`, `clientsList`, `clientCreateForm`, `clientEditor`, `clientHistoryTimeline`.
- [ ] **Step 5: Rodar RED**; esperado: FAIL somente nos novos contratos.
- [ ] **Step 6: Implementar RPC e `client-photos-panel.js`** reutilizando `getTreatmentPhotoUrl` e APIs de foto de identificação; nenhum byte é duplicado.
- [ ] **Step 7: Refatorar `renderClientFolder` e runtime** para a Central e lazy hydration.
- [ ] **Step 8: Ajustar CSS mobile-first** sem tabelas largas e com alertas visíveis.
- [ ] **Step 9: Rodar testes de clientes/fotos + `npm run test:gestao`**; esperado: PASS.
- [ ] **Step 10: Commit** `feat: transforma pasta em central da cliente`.

### Task 5: Criar quick visit idempotente e transacional no backend

**Files:**
- Create: `supabase/migrations/20261014012000_bc_gestao_quick_visit.sql`
- Create: `tests/gestao/phase6e-quick-visit-database.test.mjs`
- Create: `gestao/js/quick-visit-api.js`
- Create: `tests/gestao/quick-visit-api.test.mjs`

**Interfaces:**
- Consumes: `private.bc_agendamento_create_impl(uuid,uuid,uuid,timestamptz,timestamptz,text)` e `private.bc_treatment_create_impl(uuid,uuid,uuid,uuid[],text[])`.
- Adds forward-safe columns to `agendamentos`: `origem text not null default 'agenda'` (`agenda|encaixe`) e `request_key uuid null` com índice único parcial.
- Produces SQL: `public.bc_quick_visit_create(p_request_key uuid,p_cliente_id uuid,p_profissional_user_id uuid,p_procedimento_id uuid,p_inicio timestamptz,p_fim timestamptz,p_observacao text,p_component_version_ids uuid[],p_component_keys text[]) returns jsonb` com `{appointment_id,treatment_id}`.
- Produces JS: `createQuickVisit({client,requestKey,clienteId,profissionalUserId,procedimentoId,inicioIso,fimIso=null,observacao=null,componentVersionIds=[],componentKeys=[]}) -> Promise<{appointment_id,treatment_id}>`.

- [ ] **Step 1: Escrever testes RED** para cliente inativa, profissional sem `atende_clientes`, procedimento não executável, conflito de agenda, autoria derivada do backend e rollback integral.
- [ ] **Step 2: Escrever teste de idempotência**: repetir a mesma `request_key` com o mesmo contexto retorna o mesmo `{appointment_id,treatment_id}`; reutilizar a chave com payload incompatível é rejeitado.
- [ ] **Step 3: Rodar RED**; esperado: FAIL.
- [ ] **Step 4: Implementar RPC privado+público** reutilizando os helpers existentes dentro da mesma transação; marcar `origem='encaixe'` sem confiar em autoria enviada pelo browser.
- [ ] **Step 5: Implementar `quick-visit-api.js`** como wrapper mínimo; a UI gera uma `requestKey` por tentativa e a reutiliza enquanto a submissão está em retry.
- [ ] **Step 6: Rodar GREEN + regressão de agenda/tratamento**; esperado: PASS.
- [ ] **Step 7: Commit** `feat: adiciona atendimento rápido com encaixe atômico`.

### Task 6: Integrar Novo atendimento na Central e agenda

**Files:**
- Create: `gestao/js/quick-visit-panel.js`
- Create: `tests/gestao/quick-visit-panel.test.mjs`
- Modify: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clinical-folder-runtime.js`
- Modify: `gestao/js/agenda-treatment-bridge.js`
- Modify: `gestao/js/treatment-panel.js`
- Modify: `gestao/assets/clientes-folder.css`

**Interfaces:**
- Produces: `initQuickVisitPanel({client,root,getClientRecord,openTreatment,refresh})`.
- Consumes: `createQuickVisit(...)`, `listProcedures(...)`, `listStaffDirectory(...)`, controller atual de tratamento.

- [ ] **Step 1: Escrever testes RED** para clique `Novo atendimento`, seleção procedimento/profissional/horário, erro de conflito e abertura imediata do `treatment_id` retornado.
- [ ] **Step 2: Testar `can_execute`**: procedimento restrito não aparece como executável para profissional sem acesso.
- [ ] **Step 3: Rodar RED**; esperado: FAIL.
- [ ] **Step 4: Implementar painel curto** mostrando somente cliente, procedimento, profissional e horário necessários ao encaixe.
- [ ] **Step 5: Integrar com `initTreatmentController.openTreatment(treatmentId)`**; não criar segundo wizard clínico.
- [ ] **Step 6: Ajustar `agenda-treatment-bridge.js`** para reconhecer `existing_treatment_id` criado pelo encaixe e nunca duplicá-lo.
- [ ] **Step 7: Rodar testes do quick visit, agenda bridge e treatment panel**; esperado: PASS.
- [ ] **Step 8: Commit** `feat: integra novo atendimento à central da cliente`.

### Task 7: Criar Relatório/Parecer e torná-lo gate de finalização

**Files:**
- Create: `supabase/migrations/20261014013000_bc_gestao_treatment_reports.sql`
- Create: `tests/gestao/phase6e-treatment-report-database.test.mjs`
- Create: `gestao/js/treatment-report-api.js`
- Create: `tests/gestao/treatment-report-api.test.mjs`

**Interfaces:**
- Produces table `clinical_treatment_reports` 1:1 com `treatment_id`.
- Produces SQL:
  - `public.bc_treatment_report_get(p_treatment_id uuid) returns jsonb`
  - `public.bc_treatment_report_upsert(p_treatment_id uuid,p_payload jsonb) returns uuid`
- Produces JS:
  - `getTreatmentReport({client,treatmentId}) -> Promise<object|null>`
  - `saveTreatmentReport({client,treatmentId,payload}) -> Promise<string>`
- Extends `private.bc_treatment_finalization_gate(uuid)` with `parecer_pendente` through `create or replace` na nova migration.

- [ ] **Step 1: Escrever testes RED** para campos mínimos, autoria profissional, tratamento editável e imutabilidade após finalização.
- [ ] **Step 2: Escrever teste RED do gate**: sem parecer completo retorna `parecer_pendente` e `bc_treatment_finalize` não cria `pending_document_id` parcial.
- [ ] **Step 3: Rodar RED**; esperado: FAIL.
- [ ] **Step 4: Implementar migration aditiva** substituindo helpers/finalização apenas via `create or replace` nesta migration nova; não editar migration histórica 6D.
- [ ] **Step 5: Incluir referência ao parecer no snapshot final** sem duplicar bytes/URLs.
- [ ] **Step 6: Implementar API JS e rodar GREEN**.
- [ ] **Step 7: Commit** `feat: exige parecer clínico na finalização`.

### Task 8: Renderizar parecer no tratamento e no PDF clínico

**Files:**
- Modify: `gestao/js/treatment-panel.js`
- Modify: `gestao/assets/treatment.css`
- Modify: `tests/gestao/treatment-panel.test.mjs`
- Modify: `supabase/functions/generate-clinical-pdf/index.ts`
- Modify: `tests/gestao/generate-clinical-pdf.test.mjs`

**Interfaces:**
- Consumes: `getTreatmentReport` / `saveTreatmentReport`.
- Produces UI `[data-treatment-report-form]` e seção PDF `Relatório / Parecer do Atendimento`.

- [ ] **Step 1: Escrever testes RED da UI** para campos estruturados, bloqueio de finalização sem parecer e estado somente leitura após finalização.
- [ ] **Step 2: Escrever teste RED do PDF** exigindo procedimento, profissional, data, parecer e referência documental, sem incluir bytes de fotos/arquivos externos.
- [ ] **Step 3: Rodar RED**; esperado: FAIL.
- [ ] **Step 4: Implementar formulário no wizard existente** e persistência via API dedicada.
- [ ] **Step 5: Atualizar Edge Function de PDF** mantendo Storage/hash e sem expor service key ao navegador.
- [ ] **Step 6: Rodar testes de UI/PDF + `npm run test:gestao`**; esperado: PASS.
- [ ] **Step 7: Commit** `feat: adiciona parecer final ao atendimento e PDF`.

### Task 9: Vincular TCLE externo com revisão profissional

**Files:**
- Create: `supabase/migrations/20261014014000_bc_gestao_external_consents.sql`
- Create: `tests/gestao/phase6e-external-consent-database.test.mjs`
- Modify: `gestao/js/client-documents-panel.js`
- Modify: `gestao/js/treatment-api.js`
- Modify: `gestao/js/treatment-panel.js`
- Modify: `tests/gestao/treatment-panel.test.mjs`

**Interfaces:**
- Produces table `treatment_external_consents`.
- Produces SQL:
  - `public.bc_treatment_external_consent_link(p_treatment_id uuid,p_client_file_id uuid) returns uuid`
  - `public.bc_treatment_external_consent_get(p_treatment_id uuid) returns jsonb`
- Produces JS:
  - `linkExternalConsent({client,treatmentId,clientFileId}) -> Promise<string>`
  - `getExternalConsent({client,treatmentId}) -> Promise<object|null>`

- [ ] **Step 1: Escrever testes RED** para mesma cliente, `category='tcle_externo'`, arquivo não anulado, profissional ativa autorizada e snapshot da `procedure_version_id` + template/classe esperados no momento da revisão.
- [ ] **Step 2: Escrever testes de rejeição** para cliente diferente, arquivo anulado, versão incompatível e usuário não clínico.
- [ ] **Step 3: Escrever teste do gate de início**: arquivo solto continua `consentimento_pendente`; relação revisada e compatível satisfaz o gate sem alterar o arquivo original.
- [ ] **Step 4: Rodar RED**; esperado: FAIL.
- [ ] **Step 5: Implementar migration** criando helper canônico `private.bc_treatment_consent_satisfied(uuid)` consumido por `private.bc_treatment_gate(uuid)`; consentimentos internos existentes continuam válidos sem mudança de semântica.
- [ ] **Step 6: Implementar UI** `Vincular como TCLE externo` a partir do documento e confirmação profissional dentro do tratamento.
- [ ] **Step 7: Rodar GREEN + regressão de assinatura integrada**; esperado: PASS.
- [ ] **Step 8: Commit** `feat: permite TCLE externo revisado por atendimento`.

### Task 10: Hardening, regressão e preparação de publicação

**Files:**
- Create: `supabase/migrations/20261014015000_bc_gestao_client_central_hardening.sql`
- Create: `docs/superpowers/ledgers/2026-10-14-bc-gestao-central-cliente-progress.md`
- Modify: testes de segurança/regressão relevantes em `tests/gestao/`.

**Interfaces:**
- Consumes todos os contratos anteriores.
- Produces RLS/grants finais, índices demonstradamente necessários, auditoria mínima e checklist de rollout.

- [ ] **Step 1: Escrever testes de segurança** para `anon` sem execute, RLS ativo, URLs apenas assinadas, impossibilidade de falsificar autoria/cliente e ausência de `getPublicUrl`.
- [ ] **Step 2: Rodar advisors Supabase** em ambiente de validação e classificar avisos novos versus avisos RPC-only já conhecidos; não remover índices/policies cegamente.
- [ ] **Step 3: Aplicar hardening mínimo** apenas para problemas demonstrados pelos testes/advisors.
- [ ] **Step 4: Rodar suíte completa**: `npm run test:gestao`, pré-anamnese, testes das Edge Functions e workflows do repositório.
- [ ] **Step 5: Smoke test com dados fictícios**: pesquisar cliente → abrir Central → conferir Fotos → criar encaixe → assinar na tela → iniciar → preencher parecer → finalizar → gerar/baixar PDF → anexar PDF externo → baixar arquivo → vincular TCLE externo em tratamento fictício compatível.
- [ ] **Step 6: Verificar nenhuma escrita** no projeto `vniyooppvxpdykausdvc` e nenhuma alteração em `/admin/` legado.
- [ ] **Step 7: Atualizar ledger** com commits, migrations, CI, Edge Function e validações executadas.
- [ ] **Step 8: Commit** `chore: endurece central clínica e fecha regressão`.
- [ ] **Step 9: Somente após CI verde e revisão final**, aplicar migrations ao projeto `tpqsmerlxquyrzrjbogj`, publicar Edge Function atualizada, mergear PR com SHA travado e verificar GitHub Pages.

## Self-Review Summary

- **Spec coverage:** Bioestimulador (Task 1), documentos externos/feed (2–3), Central + Fotos (4), encaixe (5–6), parecer/PDF (7–8), TCLE externo (9), segurança/rollout (10).
- **Step scan:** removidas decisões vagas e qualquer orientação para editar migrations históricas; cada tarefa fixa entregável/teste/commit.
- **Type consistency:** nomes JS/SQL acima são canônicos para a implementação; tarefas posteriores devem consumi-los exatamente.
- **Review Focus:** os cinco riscos listados possuem testes explícitos nas Tasks 2, 5, 7 e 9.
- **Proportion:** o plano fixa interfaces, arquivos e testes sem transcrever corpos completos de implementação.