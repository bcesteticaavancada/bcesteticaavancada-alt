# BC Gestão — Fase 6A: Cadastro ampliado e Pasta da Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a primeira fatia utilizável da Fase 6: cadastro ampliado e único da cliente, Pasta da Cliente com linha do tempo e checklist, busca por nome/CPF/telefone e foto de identificação privada por câmera ou galeria.

**Architecture:** A 6A amplia `clientes` de forma forward-safe, sem quebrar registros legados, e adiciona RPCs v2 para criação/edição. Regras puras ficam em `clientes-domain.js`, a Pasta da Cliente em `clientes-folder.js` e a foto privada em `clientes-photo-api.js`. A leitura clínica continua compartilhada pela equipe ativa; arquivamento continua exclusivo da Mel; nenhum financeiro novo entra nesta fatia.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Node.js `node:test`, Supabase/PostgreSQL (RLS/RPC), Supabase Storage privado, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-11-bc-gestao-fase6-prontuario-clientes-design.md`

## Global Constraints

- Repositório: `bcesteticaavancada/bcesteticaavancada-alt`.
- Supabase correto: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Não alterar `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`).
- Não alterar o legado `/admin/`; trabalhar somente em `/gestao/` e infraestrutura correspondente.
- Nunca expor `service_role`, secret key, senha ou credencial.
- Todo recurso novo em schema exposto deve usar RLS e grants explícitos.
- Cliente pertence à BC; equipe ativa lê o histórico clínico compartilhado.
- Somente Mel/ADM arquiva ou reativa cliente.
- Cadastro rápido obrigatório: nome completo, CPF, data de nascimento e telefone; e-mail opcional.
- Responsável legal obrigatório quando a cliente ainda não completou 18 anos.
- Idade é sempre derivada da data de nascimento; não criar coluna `idade`.
- CPF é único no banco; a UI apenas antecipa o aviso.
- Endereço estruturado: CEP, logradouro, número, complemento, bairro, cidade e UF; pode ser completado depois.
- Foto de identificação: câmera ou galeria; Storage privado; histórico preservado; sem URL pública.
- Não usar paciente real em testes/homologação.
- Antes de executar qualquer mudança Supabase: consultar changelog/docs atuais e criar migrations com `supabase migration new`.

## Roadmap da Fase 6

A spec será executada em fatias:

1. **6A — Cadastro ampliado + Pasta da Cliente + foto privada** — este plano.
2. **6B — Anamnese Geral + alertas + link remoto + assinaturas + PDF.**
3. **6C — Biblioteca Clínica + módulos específicos + termos + Ficha de Atendimento.**
4. **6D — Fotos clínicas + produtos/equipamentos/lotes + intercorrências.**
5. **6E — Planos/pacotes + retornos + pendências + integração financeira por paciente.**
6. **6F — Exportação/entrega segura + filtros avançados + hardening final.**

## File Structure

### Criar
- `gestao/js/clientes-domain.js` — CPF, idade, menoridade e checklist.
- `gestao/js/clientes-folder.js` — Pasta da Cliente, cabeçalho, checklist e linha do tempo.
- `gestao/js/clientes-photo-api.js` — Storage privado, metadados e URLs assinadas.
- `tests/gestao/clientes-domain.test.mjs`
- `tests/gestao/clientes-folder.test.mjs`
- `tests/gestao/clientes-photo-api.test.mjs`
- `tests/gestao/phase6a-database-contract.test.mjs`
- `tests/gestao/phase6a-rpc-grants.test.mjs`
- `supabase/migrations/<gerado>_bc_gestao_phase6a_client_core.sql`
- `supabase/migrations/<gerado>_bc_gestao_phase6a_client_photo.sql`

### Modificar
- `gestao/js/clientes-api.js`
- `gestao/js/clientes-panel.js`
- `gestao/admin/index.html`
- `gestao/colaborador/index.html`
- `gestao/assets/gestao.css`
- `tests/gestao/clientes-api.test.mjs`
- `tests/gestao/clientes-panel.test.mjs`
- `tests/gestao/admin-agenda.test.mjs`
- `tests/gestao/colaborador-clientes-integration.test.mjs`
- `tests/gestao/agenda-api.test.mjs` se fixtures dependerem do RPC legado.

## Interfaces

### Domínio
```js
normalizeCpf(value) -> string
formatCpf(value) -> string
calculateAge(dataNascimento, referenceDate = new Date()) -> number | null
isMinor(dataNascimento, referenceDate = new Date()) -> boolean
clientProfileChecklist(client) -> {
  cadastroBasico: boolean,
  enderecoCompleto: boolean,
  fotoIdentificacao: boolean,
  anamnese: 'pendente'
}
```

### Clientes v2
```js
createClientV2({ client, payload }) -> Promise<string>
updateClientV2({ client, clienteId, payload }) -> Promise<string>
findPotentialDuplicates({ client, cpf, nome, dataNascimento, telefone }) -> Promise<Array<ClientSummary>>
listClients({ client, search = '', includeArchived = false }) -> Promise<Array<ClientSummary>>
getClient({ client, clienteId }) -> Promise<ClientRecord>
```

Backend:
- `public.bc_cliente_create_v2(p_payload jsonb) returns uuid`
- `public.bc_cliente_update_v2(p_cliente_id uuid, p_payload jsonb) returns uuid`
- `public.bc_cliente_duplicate_candidates(p_cpf text, p_nome text, p_data_nascimento date, p_telefone text)`

### Foto de identificação
```js
uploadClientIdPhoto({ client, clienteId, file }) -> Promise<{ fotoId, storagePath }>
listClientIdPhotos({ client, clienteId }) -> Promise<Array<ClientIdPhoto>>
getClientIdPhotoUrl({ client, storagePath, expiresIn = 300 }) -> Promise<string>
setCurrentClientIdPhoto({ client, clienteId, fotoId }) -> Promise<string>
```

Backend:
- `public.bc_cliente_register_id_photo(p_cliente_id uuid, p_storage_path text, p_mime_type text, p_tamanho_bytes bigint) returns uuid`
- `public.bc_cliente_set_current_id_photo(p_cliente_id uuid, p_foto_id uuid) returns uuid`

Bucket privado: `bc-prontuario-private`.

## Review Focus

1. CPF com máscara/espaços e corrida de cadastro simultâneo: normalizar nos dois lados; índice único é a autoridade.
2. Cliente legado sem CPF/nascimento: migration não pode quebrar registros existentes; RPC v2 exige os campos apenas para novos cadastros/edições v2.
3. Menor na data exata do aniversário: testar véspera, aniversário e dia seguinte.
4. Foto inválida, URL assinada expirada e metadado falsificado: validar arquivo; nunca usar URL pública; autoria/metadado sensível nasce no backend.
5. Cliente arquivado: leitura histórica continua, mas colaboradora não edita/reativa e não ganha acesso financeiro cruzado.

---

### Task 1: Criar os testes RED da 6A

**Files:**
- Create: `tests/gestao/clientes-domain.test.mjs`
- Create: `tests/gestao/phase6a-database-contract.test.mjs`
- Create: `tests/gestao/phase6a-rpc-grants.test.mjs`
- Modify: `tests/gestao/clientes-api.test.mjs`
- Modify: `tests/gestao/clientes-panel.test.mjs`
- Modify: `tests/gestao/admin-agenda.test.mjs`
- Modify: `tests/gestao/colaborador-clientes-integration.test.mjs`

**Interfaces:** produz contratos RED para todas as tarefas seguintes.

- [ ] **Step 1: Testar domínio puro**
  - CPF mascarado vira 11 dígitos.
  - idade calcula corretamente antes/no/depois do aniversário.
  - data futura retorna inválida.
  - menoridade muda exatamente ao completar 18.
  - checklist só considera endereço completo quando CEP/logradouro/número/bairro/cidade/UF existem.

- [ ] **Step 2: Testar API v2**
  - `createClientV2` usa `bc_cliente_create_v2` com `p_payload` e não envia autoria.
  - `updateClientV2` usa `bc_cliente_update_v2`.
  - `findPotentialDuplicates` usa RPC dedicado.
  - `listClients` aceita nome/CPF/telefone e preserva `includeArchived`.

- [ ] **Step 3: Testar painel**
  - cadastro rápido contém nome/CPF/nascimento/telefone/e-mail.
  - idade é derivada.
  - responsável aparece e fica obrigatório quando menor.
  - duplicidade oferece `Abrir prontuário existente`.
  - colaboradora não recebe controle de arquivar/reativar.

- [ ] **Step 4: Testar contrato SQL**
  - colunas novas existem.
  - CPF aceita apenas 11 dígitos quando preenchido.
  - índice único parcial de CPF.
  - wrappers públicos são `security invoker`.
  - implementações sensíveis ficam em `private` com `auth.uid()`/staff ativo.
  - `anon` não executa RPCs v2.

- [ ] **Step 5: Rodar RED**
  Run: `npm run test:gestao`
  Expected: testes antigos verdes; novos 6A falham por código/migrations inexistentes.

- [ ] **Step 6: Commit**
```bash
git add tests/gestao
git commit -m "test: define contratos da fase 6A"
```

---

### Task 2: Criar schema cadastral v2 e CPF único

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6a_client_core.sql`
- Test: `tests/gestao/phase6a-database-contract.test.mjs`
- Test: `tests/gestao/phase6a-rpc-grants.test.mjs`

**Interfaces:** produz os três RPCs v2 de cliente.

- [ ] **Step 1: Verificar docs/changelog Supabase atuais**
  Conferir Postgres/RLS/functions antes de escrever SQL.

- [ ] **Step 2: Criar migration pelo CLI**
```bash
supabase --version
supabase migration new bc_gestao_phase6a_client_core
```

- [ ] **Step 3: Adicionar colunas forward-safe**
  Em `public.clientes`: `cpf`, `data_nascimento`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `responsavel_nome`, `responsavel_cpf`, `responsavel_parentesco`, `responsavel_telefone`; todas nullable para legado.

- [ ] **Step 4: Adicionar invariantes**
  - CPF novo normalizado e com 11 dígitos.
  - `responsavel_cpf`, quando informado, também normalizado/validado.
  - índice único parcial em `cpf where cpf is not null`.
  - data de nascimento futura inválida.
  - responsável obrigatório no RPC v2 se ainda não completou 18.
  - não criar coluna `idade`.

- [ ] **Step 5: Implementar create/update v2**
  `private.bc_cliente_create_v2_impl(jsonb)` e `private.bc_cliente_update_v2_impl(uuid,jsonb)` extraem apenas campos permitidos e derivam autoria de `auth.uid()`. Colaboradora não atualiza cliente arquivado.

- [ ] **Step 6: Implementar busca de duplicidade**
  CPF exato é bloqueante; nome+nascimento+telefone gera candidato para aviso, não bloqueio automático.

- [ ] **Step 7: Atualizar auditoria com minimização de dados**
  Registrar ator/data e nomes dos campos alterados; não duplicar desnecessariamente CPF/endereço/responsável completos no `audit_log`.

- [ ] **Step 8: Fixar grants**
  `PUBLIC`/`anon` revogados; `authenticated` autorizado somente nos wrappers públicos; implementações privadas não ficam expostas ao `PUBLIC`.

- [ ] **Step 9: Rodar contratos SQL**
```bash
node --test tests/gestao/phase6a-database-contract.test.mjs tests/gestao/phase6a-rpc-grants.test.mjs
```
Expected: PASS.

- [ ] **Step 10: Commit**
```bash
git add supabase/migrations tests/gestao/phase6a-*.test.mjs
git commit -m "feat: amplia cadastro seguro de clientes"
```

---

### Task 3: Implementar domínio e API v2

**Files:**
- Create: `gestao/js/clientes-domain.js`
- Modify: `gestao/js/clientes-api.js`
- Test: `tests/gestao/clientes-domain.test.mjs`
- Test: `tests/gestao/clientes-api.test.mjs`

**Interfaces:** consome RPCs da Task 2 e produz as funções canônicas de domínio/API.

- [ ] **Step 1: Implementar `clientes-domain.js`**
  Criar exatamente `normalizeCpf`, `formatCpf`, `calculateAge`, `isMinor`, `clientProfileChecklist`.

- [ ] **Step 2: Expandir `CLIENT_SELECT`**
  Incluir os novos campos sem retirar os antigos.

- [ ] **Step 3: Implementar `createClientV2`, `updateClientV2`, `findPotentialDuplicates`**
  Nenhuma função envia autoria, papel ou outro identificador de autorização vindo do browser.

- [ ] **Step 4: Ampliar `listClients`**
  Nome usa busca textual; CPF/telefone usam termo normalizado; preservar ativos/arquivados e ordenação.

- [ ] **Step 5: Rodar testes**
```bash
node --test tests/gestao/clientes-domain.test.mjs tests/gestao/clientes-api.test.mjs
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add gestao/js/clientes-domain.js gestao/js/clientes-api.js tests/gestao/clientes-domain.test.mjs tests/gestao/clientes-api.test.mjs
git commit -m "feat: adiciona dominio e API v2 de clientes"
```

---

### Task 4: Entregar cadastro rápido com idade automática

**Files:**
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/assets/gestao.css`
- Test: `tests/gestao/clientes-panel.test.mjs`
- Test: `tests/gestao/admin-agenda.test.mjs`
- Test: `tests/gestao/colaborador-clientes-integration.test.mjs`

**Interfaces:** consome domínio/API v2 e produz o formulário compartilhado.

- [ ] **Step 1: Preservar IDs atuais**
  Manter `clientsSearch`, `clientsList`, `clientCreateForm`, `clientEditor`, `clientHistoryTimeline` para não quebrar agenda/integrações durante a transição.

- [ ] **Step 2: Expandir o formulário**
  Nome, CPF, nascimento, idade somente leitura, telefone, e-mail opcional e bloco de responsável legal inicialmente oculto.

- [ ] **Step 3: Ligar menoridade ao responsável**
  Ao alterar nascimento, atualizar idade; se menor, exigir nome/CPF/parentesco/telefone do responsável.

- [ ] **Step 4: Checar duplicidade antes do create**
  CPF encontrado: bloquear e oferecer abrir prontuário existente. Nome+nascimento+telefone coincidente: avisar e permitir continuar se o CPF for distinto.

- [ ] **Step 5: Tratar corrida de CPF duplicado**
  Se o banco rejeitar por unicidade, não exibir sucesso; recarregar candidato e oferecer abrir o cadastro existente.

- [ ] **Step 6: Estilizar mobile-first**
  Uma coluna no celular; identidade chocolate/dourado/creme; sem página longa desnecessária.

- [ ] **Step 7: Rodar testes e commit**
```bash
node --test tests/gestao/clientes-panel.test.mjs tests/gestao/admin-agenda.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs
git add gestao/admin/index.html gestao/colaborador/index.html gestao/js/clientes-panel.js gestao/assets/gestao.css tests/gestao
git commit -m "feat: amplia cadastro rapido de clientes"
```

---

### Task 5: Criar a Pasta da Cliente

**Files:**
- Create: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/clientes-folder.test.mjs`

**Interfaces:** produz cabeçalho, checklist, linha do tempo e aba Cadastro.

- [ ] **Step 1: Escrever/confirmar RED da pasta**
  Cabeçalho com nome/idade/status/foto-placeholder; checklist; linha do tempo como tela inicial; aba Cadastro; nenhum valor financeiro na timeline.

- [ ] **Step 2: Implementar checklist**
  `cadastroBasico`, `enderecoCompleto`, `fotoIdentificacao`; `anamnese` aparece como `Pendente` até a 6B.

- [ ] **Step 3: Migrar histórico existente para `renderClientTimeline`**
  Procedimento, profissional, data/hora, queixa, observações, reações, intercorrências, feedback, orientações e próxima sessão continuam visíveis.

- [ ] **Step 4: Implementar `renderClientFolder`**
  Nesta entrega apenas `Linha do tempo` e `Cadastro` ficam operacionais. Não criar tabs falsas para áreas ainda não implementadas.

- [ ] **Step 5: Implementar edição cadastral completa**
  Nome, CPF, nascimento, telefone, e-mail, CEP, logradouro, número, complemento, bairro, cidade, UF e responsável quando aplicável; salvar via `updateClientV2`.

- [ ] **Step 6: Integrar `openClient()`**
  `clientes-panel.js` passa a abrir a Pasta da Cliente e manter `notifyClientsChanged` para agenda.

- [ ] **Step 7: Rodar testes e commit**
```bash
node --test tests/gestao/clientes-folder.test.mjs tests/gestao/clientes-panel.test.mjs
git add gestao/js/clientes-folder.js gestao/js/clientes-panel.js gestao/admin/index.html gestao/colaborador/index.html gestao/assets/gestao.css tests/gestao/clientes-folder.test.mjs tests/gestao/clientes-panel.test.mjs
git commit -m "feat: cria pasta da cliente"
```

---

### Task 6: Foto de identificação privada com câmera/galeria

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6a_client_photo.sql`
- Create: `gestao/js/clientes-photo-api.js`
- Modify: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/clientes-photo-api.test.mjs`
- Modify: `tests/gestao/clientes-folder.test.mjs`
- Modify: `tests/gestao/phase6a-database-contract.test.mjs`
- Modify: `tests/gestao/phase6a-rpc-grants.test.mjs`

**Interfaces:** produz bucket `bc-prontuario-private`, metadados imutáveis e foto atual.

- [ ] **Step 1: Verificar docs atuais de Storage/RLS e criar migration pelo CLI**
```bash
supabase migration new bc_gestao_phase6a_client_photo
```

- [ ] **Step 2: Criar bucket privado e tabela de metadados**
  `cliente_identificacao_fotos(id, cliente_id, storage_path unique, mime_type, tamanho_bytes, atual, created_by, created_at, substituida_at)`; RLS habilitada; no máximo uma foto atual por cliente.

- [ ] **Step 3: Proteger Storage**
  Equipe ativa pode ler; upload somente autenticado/staff ativo no prefixo `identificacao/<cliente_id>/...`; bucket `public=false`; nenhuma deleção destrutiva pela UI comum.

- [ ] **Step 4: Criar RPC de registro de metadado**
  `private.bc_cliente_register_id_photo_impl(...)` valida staff ativo, caminho/bucket/prefixo e grava `created_by = auth.uid()`. Wrapper público invoker só para `authenticated`.

- [ ] **Step 5: Criar RPC de troca da foto atual**
  Validar que a foto pertence à cliente; marcar a anterior como substituída; marcar a nova como atual; preservar histórico.

- [ ] **Step 6: Implementar `clientes-photo-api.js`**
  JPEG/PNG/WebP até 8 MB. Fluxo: validar arquivo → upload privado → registrar metadado via RPC → definir atual. Se o registro falhar após upload, não tornar o objeto público; registrar erro e deixar caminho para limpeza administrativa, sem fingir sucesso.

- [ ] **Step 7: Adicionar controles de câmera e galeria**
  - câmera: `<input type="file" accept="image/*" capture="environment">`
  - galeria: `<input type="file" accept="image/*">`

- [ ] **Step 8: Exibir foto atual e histórico**
  Usar somente `createSignedUrl(..., 300)`; nunca `getPublicUrl`. Histórico mostra `Atual`/`Anterior` e data.

- [ ] **Step 9: Testar autoria e privacidade**
  Testes devem provar que o frontend nunca envia `created_by`, que metadados nascem via RPC, que URL é assinada e que arquivo inválido não chama Storage.

- [ ] **Step 10: Rodar testes e commit**
```bash
node --test tests/gestao/clientes-photo-api.test.mjs tests/gestao/clientes-folder.test.mjs tests/gestao/phase6a-database-contract.test.mjs tests/gestao/phase6a-rpc-grants.test.mjs
git add supabase/migrations gestao/js/clientes-photo-api.js gestao/js/clientes-folder.js gestao/js/clientes-panel.js gestao/assets/gestao.css tests/gestao
git commit -m "feat: adiciona foto privada ao prontuario"
```

---

### Task 7: Endurecer permissões e integrações existentes

**Files:**
- Modify: `tests/gestao/admin-agenda.test.mjs`
- Modify: `tests/gestao/colaborador-clientes-integration.test.mjs`
- Modify: `tests/gestao/phase6a-database-contract.test.mjs`
- Modify: `tests/gestao/phase6a-rpc-grants.test.mjs`

**Interfaces:** prova que a 6A não afrouxa Fase 4/5.

- [ ] **Step 1: Testar colaboradora**
  Lê cadastro/foto/histórico compartilhado; cria e edita cliente ativo; não arquiva/reativa; não edita cliente arquivado; não recebe financeiro alheio.

- [ ] **Step 2: Testar Mel**
  Vê ativos/arquivados; edita; arquiva/reativa; acessa foto/histórico.

- [ ] **Step 3: Testar agenda**
  Criação/edição/arquivamento/reativação continuam disparando `notifyClientsChanged(onClientsChanged)`.

- [ ] **Step 4: Testar ausência de vazamento financeiro**
  Nenhum select/RPC novo de cliente/foto inclui comissão, livros, repasses ou consolidado.

- [ ] **Step 5: Rodar `npm run test:gestao` e commit**
```bash
npm run test:gestao
git add tests/gestao
git commit -m "test: endurece permissoes da fase 6A"
```

---

### Task 8: Aplicar no Supabase correto e homologar sem paciente real

**Files:** nenhuma alteração de produto, salvo migration corretiva criada por `supabase migration new` se realmente necessária.

**Interfaces:** produz evidência real de schema/RLS/RPC/Storage no projeto correto.

- [ ] **Step 1: Confirmar alvo**
  Conferir explicitamente `tpqsmerlxquyrzrjbogj`; abortar se divergir.

- [ ] **Step 2: Rodar advisors antes da aplicação**
  Usar MCP/CLI suportado e corrigir achados relevantes.

- [ ] **Step 3: Aplicar somente migrations 6A**
  Não tocar no projeto antigo.

- [ ] **Step 4: Verificar**
  RLS true; grants corretos; `anon` sem execute; bucket privado; políticas de Storage; uma foto atual por cliente.

- [ ] **Step 5: Homologar cadastro em transação com rollback**
  Maior válido; menor sem responsável falha; menor com responsável passa; CPF duplicado falha; colaboradora não arquiva; Mel arquiva/reativa; `ROLLBACK`; zero linha residual.

- [ ] **Step 6: Homologar Storage com arquivo fictício**
  Sem dados pessoais; URL assinada funciona; URL pública não existe; remover o objeto de homologação por rotina administrativa ao final; confirmar zero resíduo.

- [ ] **Step 7: Rodar advisors novamente**
  Nenhum alerta novo relevante introduzido pela 6A.

---

### Task 9: Verificação final, PR e publicação

**Files:** docs/handoff apenas se necessário refletir o status real.

- [ ] **Step 1: Rodar suíte completa**
```bash
npm test
```
Expected: frontend/site/gestao PASS.

- [ ] **Step 2: Revisão de segurança**
  Sem secrets; sem bucket público; sem `getPublicUrl`; sem grants amplos; sem query financeira nova; `/admin/` legado intocado.

- [ ] **Step 3: Comparar com `main`**
  Diff concentrado em `/gestao/`, migrations, testes e docs da 6A.

- [ ] **Step 4: Abrir PR**
  Título: `feat: inicia prontuario com cadastro ampliado e pasta da cliente`

- [ ] **Step 5: Aguardar CI e revisar a branch**
  Não declarar pronto sem evidência de testes/CI.

- [ ] **Step 6: Merge e pós-merge somente após revisão verde**
  Confirmar workflow da `main`, GitHub Pages, SHA de merge e runs no handoff.

---

## Self-Review

### Cobertura da 6A
Inclui: cadastro rápido, CPF único, duplicidade potencial, nascimento/idade, responsável legal, endereço estruturado, cliente único da BC, Pasta da Cliente, timeline clínica existente, checklist, foto câmera/galeria privada, histórico de foto, RLS/RPC, auditoria mínima, integração com agenda e preservação da segregação financeira.

### Deliberadamente fora da 6A
- 6B: anamnese, alertas, link remoto, assinatura dupla, PDF.
- 6C: biblioteca clínica, módulos específicos, termos e ficha completa.
- 6D: fotos clínicas, produtos/equipamentos/lotes e intercorrências.
- 6E: planos/pacotes, retornos, pendências e integração financeira por paciente.
- 6F: exportação, entrega segura, filtros avançados e hardening final.

### Critério de pronto
A 6A só está pronta quando uma profissional autenticada consegue cadastrar uma cliente fictícia, abrir sua Pasta, editar endereço, tirar/escolher foto privada e consultar histórico existente; CPF duplicado é bloqueado pelo banco; menor exige responsável; colaboradora não arquiva; Mel arquiva/reativa; nenhum financeiro alheio aparece; testes, advisors, CI e deploy estão verdes; homologação deixa zero resíduo fictício.