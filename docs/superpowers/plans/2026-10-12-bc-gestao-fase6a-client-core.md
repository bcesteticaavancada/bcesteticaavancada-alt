# BC Gestão — Fase 6A: Cadastro ampliado e Pasta da Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a primeira fatia utilizável da Fase 6: cadastro ampliado e único da cliente, busca por nome/CPF/telefone, Pasta da Cliente com linha do tempo e checklist, foto de identificação privada por câmera/galeria e permissões coerentes com o BC Gestão existente.

**Architecture:** A Fase 6 será implementada em fatias independentes. A 6A amplia `clientes` de forma forward-safe, preserva os RPCs antigos durante a transição, adiciona RPCs v2 para o novo cadastro, cria uma camada de domínio/frontend comum para idade/menoridade/completude, transforma o painel atual em uma Pasta da Cliente e adiciona foto de identificação em Storage privado com histórico imutável. A leitura clínica continua compartilhada entre profissionais ativas; arquivamento continua exclusivo da Mel; nenhum dado financeiro novo entra nesta fatia.

**Tech Stack:** HTML/CSS/JavaScript ES modules, Node.js `node:test`, Supabase/PostgreSQL (RLS/RPC), Supabase Storage privado, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-11-bc-gestao-fase6-prontuario-clientes-design.md`

## Global Constraints

- Repositório oficial: `bcesteticaavancada/bcesteticaavancada-alt`.
- Projeto Supabase correto: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Não alterar `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`).
- Não alterar nem misturar o legado `/admin/` com `/gestao/admin/`.
- Não expor `service_role`, secret key, senha ou credencial no frontend, GitHub ou logs.
- Todo objeto/tabela nova em schema exposto deve usar RLS; segurança não pode depender de botão escondido.
- Cliente pertence à BC, não a uma profissional. Toda profissional ativa pode visualizar o prontuário clínico compartilhado conforme o desenho aprovado.
- Somente Mel/ADM arquiva ou reativa cliente.
- Financeiro permanece segregado e fora do escopo funcional da 6A; nenhuma colaboradora pode ganhar visão financeira cruzada por efeito colateral.
- Cadastro rápido obrigatório: nome completo, CPF, data de nascimento e telefone; e-mail opcional; responsável legal obrigatório quando a cliente for menor de 18 anos.
- Idade é derivada da data de nascimento e nunca persistida como coluna estática.
- CPF é único na BC; cadastro duplicado por CPF deve ser bloqueado no banco, não apenas na UI.
- Possível duplicidade por nome + nascimento + telefone deve ser avisada antes do cadastro, sem impedir a criação quando o CPF realmente for diferente.
- Endereço estruturado: CEP, logradouro, número, complemento, bairro, cidade e UF; pode ser completado depois.
- Foto de identificação pode vir de câmera ou galeria, fica em Storage privado e mantém histórico quando substituída.
- Cliente arquivado preserva cadastro, fotos, histórico e auditoria; não há exclusão destrutiva no fluxo normal.
- Fuso operacional: `America/Sao_Paulo`.
- Não usar paciente real em homologação técnica.
- Antes de qualquer alteração Supabase na execução: consultar changelog/documentação atual e criar migrations com `supabase migration new`; não inventar timestamp de migration manualmente.

## Roadmap da Fase 6

Esta spec cobre múltiplos subsistemas. Para reduzir risco, a execução fica dividida em planos separados:

1. **6A — Cadastro ampliado + Pasta da Cliente + foto de identificação privada** — este plano.
2. **6B — Anamnese Geral versionada + alertas clínicos + link remoto + assinatura dupla + PDF.**
3. **6C — Biblioteca Clínica + módulos específicos + termos + ciclo de Ficha de Atendimento.**
4. **6D — Fotos clínicas + produtos/equipamentos/lotes + intercorrências/evoluções.**
5. **6E — Planos/pacotes + retornos + pendências + financeiro por paciente integrado às permissões existentes.**
6. **6F — Exportação integral + entrega segura + filtros avançados + hardening/auditoria final.**

Cada fatia deve chegar a `main` apenas depois de TDD, revisão, CI e homologação fictícia sem resíduos.

## File Structure

### Novos arquivos da 6A

- `gestao/js/clientes-domain.js` — normalização de CPF, cálculo de idade/menoridade e completude do cadastro.
- `gestao/js/clientes-folder.js` — renderização/controle da Pasta da Cliente, cabeçalho, checklist e navegação interna.
- `gestao/js/clientes-photo-api.js` — upload privado, metadados, URL assinada e histórico de foto de identificação.
- `tests/gestao/clientes-domain.test.mjs` — regras puras do cadastro.
- `tests/gestao/clientes-folder.test.mjs` — contrato visual/funcional da Pasta da Cliente.
- `tests/gestao/clientes-photo-api.test.mjs` — contrato do Storage privado e foto atual/histórico.
- `tests/gestao/phase6a-database-contract.test.mjs` — contrato textual da migration/RLS/RPC.
- `tests/gestao/phase6a-rpc-grants.test.mjs` — grants de wrappers v2 e funções privadas.
- `supabase/migrations/<gerado>_bc_gestao_phase6a_client_core.sql` — criado durante execução por `supabase migration new bc_gestao_phase6a_client_core`.
- `supabase/migrations/<gerado>_bc_gestao_phase6a_client_photo.sql` — criado durante execução por `supabase migration new bc_gestao_phase6a_client_photo`.

### Arquivos modificados

- `gestao/js/clientes-api.js` — novo contrato v2 e busca por CPF/telefone sem remover imediatamente APIs antigas.
- `gestao/js/clientes-panel.js` — coordenação entre lista, cadastro rápido, pasta e foto.
- `gestao/admin/index.html` — estrutura do painel Clientes admin.
- `gestao/colaborador/index.html` — estrutura do painel Clientes colaboradora.
- `gestao/assets/gestao.css` — cards, pasta, tabs, checklist, campos responsivos e foto.
- `tests/gestao/clientes-api.test.mjs` — payload v2, busca e duplicidade.
- `tests/gestao/clientes-panel.test.mjs` — cadastro rápido, menor de idade, duplicidade e integração da pasta.
- `tests/gestao/admin-agenda.test.mjs` — preservação dos IDs/integração do painel admin.
- `tests/gestao/colaborador-clientes-integration.test.mjs` — preservação de permissões e painel colaboradora.
- `tests/gestao/agenda-api.test.mjs` — adaptar fixtures que criam cliente para o contrato v2 quando a UI deixar de usar o RPC legado.

## Interfaces canônicas da 6A

### Domínio frontend

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

### API de clientes

```js
createClientV2({ client, payload }) -> Promise<string>
updateClientV2({ client, clienteId, payload }) -> Promise<string>
findPotentialDuplicates({ client, cpf, nome, dataNascimento, telefone }) -> Promise<Array<ClientSummary>>
listClients({ client, search = '', includeArchived = false }) -> Promise<Array<ClientSummary>>
getClient({ client, clienteId }) -> Promise<ClientRecord>
```

`payload` aceita somente os campos cadastrais aprovados; autoria nunca vem do browser.

### API de foto de identificação

```js
uploadClientIdPhoto({ client, clienteId, file }) -> Promise<{ fotoId, storagePath }>
listClientIdPhotos({ client, clienteId }) -> Promise<Array<ClientIdPhoto>>
getClientIdPhotoUrl({ client, storagePath, expiresIn = 300 }) -> Promise<string>
setCurrentClientIdPhoto({ client, clienteId, fotoId }) -> Promise<string>
```

Bucket privado canônico da Fase 6: `bc-prontuario-private`.

### Pasta da Cliente

```js
renderClientFolder({ client, staffMap, canArchive, photoUrl }) -> string
renderClientFolderChecklist(client) -> string
renderClientTimeline(history, staffMap) -> string
initClientFolder({ supabase, profile, root, canArchive, onClientChanged }) -> Promise<...>
```

A primeira versão operacional da pasta expõe **Linha do tempo** e **Cadastro**. As áreas Anamnese, Procedimentos, Atendimentos, Fotos, Documentos e Financeiro serão adicionadas pelas fatias seguintes; não criar telas mortas fingindo funcionalidade pronta.

## Review Focus

1. **CPF com máscara/espaços e corrida de cadastro simultâneo** — normalizar no frontend e no backend; índice único no banco deve ser a autoridade e retornar erro amigável de duplicidade.
2. **Cliente legado sem CPF/nascimento** — migration não pode quebrar linhas existentes; campos novos começam nullable para legado, enquanto RPC v2 exige dados completos para novos cadastros.
3. **Menor de 18 anos na data exata do aniversário** — regra deve exigir responsável somente quando ainda não completou 18; testes com véspera, aniversário e dia seguinte.
4. **Foto privada em câmera/galeria com tipo/tamanho inválido ou URL expirada** — rejeitar arquivo fora do contrato, nunca tornar bucket público e regenerar URL assinada quando necessário.
5. **Cliente arquivado acessado por colaboradora** — leitura histórica permanece, mas atualização cadastral e uso operacional indevido devem seguir as restrições já homologadas; apenas Mel controla arquivar/reativar.

---

### Task 1: Congelar os contratos RED da Fase 6A

**Files:**
- Create: `tests/gestao/clientes-domain.test.mjs`
- Create: `tests/gestao/phase6a-database-contract.test.mjs`
- Create: `tests/gestao/phase6a-rpc-grants.test.mjs`
- Modify: `tests/gestao/clientes-api.test.mjs`
- Modify: `tests/gestao/clientes-panel.test.mjs`
- Modify: `tests/gestao/admin-agenda.test.mjs`
- Modify: `tests/gestao/colaborador-clientes-integration.test.mjs`

**Interfaces:**
- Consumes: comportamento atual de Clientes/Fase 4.
- Produces: testes RED que fixam o contrato da 6A antes de qualquer implementação.

- [ ] **Step 1: Escrever testes RED de domínio**

Cobrir em `clientes-domain.test.mjs`:

- `normalizeCpf('123.456.789-00') === '12345678900'`;
- `calculateAge()` não persiste idade e calcula corretamente antes/no/depois do aniversário;
- `isMinor()` diferencia 17/18 anos corretamente;
- `clientProfileChecklist()` só marca endereço completo quando os campos estruturados obrigatórios estão presentes.

- [ ] **Step 2: Escrever testes RED de API**

Em `clientes-api.test.mjs`, exigir:

- `createClientV2` chama `bc_cliente_create_v2` com `p_payload` e sem `created_by`/`user_id`;
- `updateClientV2` chama `bc_cliente_update_v2` com `clienteId` + payload;
- `findPotentialDuplicates` usa `bc_cliente_duplicate_candidates`;
- `listClients` aceita busca por nome, CPF ou telefone;
- o select inclui novos campos cadastrais necessários à pasta.

- [ ] **Step 3: Escrever testes RED do painel**

Em `clientes-panel.test.mjs`, exigir:

- cadastro rápido contém nome, CPF, nascimento, telefone e e-mail opcional;
- idade aparece como valor derivado;
- campos de responsável aparecem/viram obrigatórios para menor;
- duplicidade potencial oferece `Abrir prontuário existente`;
- lista mostra CPF mascarado ou telefone, idade derivada e estado arquivado sem expor controles admin à colaboradora.

- [ ] **Step 4: Escrever testes RED de contrato SQL**

`phase6a-database-contract.test.mjs` deve localizar a migration 6A por sufixo e exigir:

- colunas novas de cadastro estruturado;
- CPF normalizado com check de 11 dígitos quando não nulo;
- índice único parcial de CPF;
- wrappers públicos `security invoker` para create/update v2 e busca de duplicidade;
- implementação sensível no schema `private`, com `auth.uid()`/staff ativo;
- nenhuma concessão a `anon`;
- campos legados permanecem nullable para migração forward-safe.

- [ ] **Step 5: Escrever testes RED de grants**

`phase6a-rpc-grants.test.mjs` deve exigir `revoke all from public`, `revoke execute from anon` e `grant execute to authenticated` nos wrappers v2; funções privadas não devem ficar executáveis por `PUBLIC`.

- [ ] **Step 6: Rodar a suíte da gestão e confirmar RED somente da 6A**

Run: `npm run test:gestao`

Expected: testes existentes continuam verdes; novos testes 6A falham por módulos/RPCs/migration ainda inexistentes.

- [ ] **Step 7: Commit dos testes RED**

```bash
git add tests/gestao
git commit -m "test: define contratos da fase 6A de clientes"
```

---

### Task 2: Criar schema cadastral v2 e bloqueio real de CPF duplicado

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6a_client_core.sql`
- Modify: `tests/gestao/phase6a-database-contract.test.mjs` somente se a migration gerada exigir localizar por nome sem timestamp fixo.

**Interfaces:**
- Consumes: `private.is_bc_active_staff()`, `private.is_bc_admin()`, `public.clientes`, `audit_log` e padrão wrapper público/private impl já existente.
- Produces:
  - `public.bc_cliente_create_v2(p_payload jsonb) returns uuid`;
  - `public.bc_cliente_update_v2(p_cliente_id uuid, p_payload jsonb) returns uuid`;
  - `public.bc_cliente_duplicate_candidates(p_cpf text, p_nome text, p_data_nascimento date, p_telefone text)` retornando apenas resumo suficiente para abrir cadastro existente.

- [ ] **Step 1: Verificar Supabase atual antes de escrever SQL**

Consultar `https://supabase.com/changelog.md` e docs atuais de RLS/functions; confirmar que não há breaking change relevante para Postgres/RLS/RPC usado no projeto.

- [ ] **Step 2: Criar migration pelo CLI, sem inventar timestamp**

Run:

```bash
supabase --version
supabase migration new bc_gestao_phase6a_client_core
```

Expected: CLI informa o caminho exato da nova migration.

- [ ] **Step 3: Adicionar colunas forward-safe em `public.clientes`**

Adicionar, nullable para preservar legado:

- `cpf text`;
- `data_nascimento date`;
- `cep text`;
- `logradouro text`;
- `numero text`;
- `complemento text`;
- `bairro text`;
- `cidade text`;
- `uf text`;
- `responsavel_nome text`;
- `responsavel_cpf text`;
- `responsavel_parentesco text`;
- `responsavel_telefone text`.

Não criar coluna `idade`.

- [ ] **Step 4: Adicionar invariantes de identidade**

A migration deve:

- normalizar CPF recebido para apenas dígitos nos RPCs v2;
- rejeitar CPF novo que não tenha exatamente 11 dígitos;
- criar índice único parcial para `cpf is not null`;
- rejeitar data de nascimento futura;
- exigir responsável no RPC v2 quando `data_nascimento` indicar menor de 18 anos;
- preservar registros legados incompletos.

- [ ] **Step 5: Implementar `private.bc_cliente_create_v2_impl(p_payload jsonb)`**

Validar staff ativo, extrair somente campos permitidos, exigir nome/CPF/nascimento/telefone, aplicar regra de menor, inserir `created_by = auth.uid()` no backend e traduzir violação de CPF único em erro de domínio `CPF já cadastrado na BC Estética.`.

- [ ] **Step 6: Implementar wrapper `public.bc_cliente_create_v2(p_payload jsonb)`**

Wrapper `language sql`, `security invoker`, `search_path` fixo; revogar `PUBLIC`/`anon` e conceder apenas a `authenticated`.

- [ ] **Step 7: Implementar update v2**

`private.bc_cliente_update_v2_impl(p_cliente_id uuid, p_payload jsonb)` deve manter a regra atual: staff ativa edita cliente ativo; colaboradora não edita cliente arquivado; Mel pode editar conforme regra administrativa. O CPF continua submetido ao índice único.

- [ ] **Step 8: Implementar busca de duplicidade potencial**

`public.bc_cliente_duplicate_candidates(...)` deve retornar no máximo candidatos por:

1. CPF exato normalizado;
2. ou combinação de nome normalizado + nascimento + telefone normalizado.

A função é apenas para equipe autenticada e não substitui o índice único.

- [ ] **Step 9: Atualizar auditoria sem duplicar dados sensíveis desnecessariamente**

Para novos campos, registrar quais campos cadastrais mudaram e ator/data, sem criar uma segunda cópia integral de CPF/endereço/responsável no `audit_log` quando isso não for necessário para rastreabilidade.

- [ ] **Step 10: Rodar contratos SQL**

Run:

```bash
node --test tests/gestao/phase6a-database-contract.test.mjs tests/gestao/phase6a-rpc-grants.test.mjs
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations tests/gestao/phase6a-*.test.mjs
git commit -m "feat: amplia cadastro seguro de clientes na fase 6A"
```

---

### Task 3: Implementar domínio de cadastro e API v2 no frontend

**Files:**
- Create: `gestao/js/clientes-domain.js`
- Modify: `gestao/js/clientes-api.js`
- Test: `tests/gestao/clientes-domain.test.mjs`
- Test: `tests/gestao/clientes-api.test.mjs`

**Interfaces:**
- Consumes: RPCs v2 da Task 2.
- Produces: funções canônicas definidas em `Interfaces canônicas da 6A`.

- [ ] **Step 1: Implementar `clientes-domain.js` mínimo para os testes**

Criar exatamente:

```js
export function normalizeCpf(value) {}
export function formatCpf(value) {}
export function calculateAge(dataNascimento, referenceDate = new Date()) {}
export function isMinor(dataNascimento, referenceDate = new Date()) {}
export function clientProfileChecklist(client) {}
```

`calculateAge` deve retornar `null` para data ausente/inválida e nunca aceitar data futura como idade válida.

- [ ] **Step 2: Rodar teste de domínio**

Run: `node --test tests/gestao/clientes-domain.test.mjs`

Expected: PASS.

- [ ] **Step 3: Expandir `CLIENT_SELECT` sem remover campos existentes**

Incluir CPF, nascimento, endereço e responsável. Manter campos atuais para compatibilidade com agenda e histórico.

- [ ] **Step 4: Implementar API v2**

Adicionar:

```js
export async function createClientV2({ client, payload }) {}
export async function updateClientV2({ client, clienteId, payload }) {}
export async function findPotentialDuplicates({ client, cpf, nome, dataNascimento, telefone }) {}
```

Nenhuma função envia autoria ou papel de usuário no payload.

- [ ] **Step 5: Ampliar busca de `listClients`**

Normalizar o termo. Nome usa busca textual; CPF/telefone usam dígitos normalizados. Preservar `includeArchived` e ordenação por nome.

- [ ] **Step 6: Rodar testes de API**

Run: `node --test tests/gestao/clientes-api.test.mjs tests/gestao/clientes-domain.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add gestao/js/clientes-domain.js gestao/js/clientes-api.js tests/gestao/clientes-*.test.mjs
git commit -m "feat: adiciona dominio e API v2 de clientes"
```

---

### Task 4: Entregar cadastro rápido com idade automática e responsável legal

**Files:**
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/assets/gestao.css`
- Test: `tests/gestao/clientes-panel.test.mjs`
- Test: `tests/gestao/admin-agenda.test.mjs`
- Test: `tests/gestao/colaborador-clientes-integration.test.mjs`

**Interfaces:**
- Consumes: `calculateAge`, `isMinor`, `createClientV2`, `findPotentialDuplicates`.
- Produces: formulário compartilhado com os mesmos IDs nas duas áreas e fluxo de abertura do cadastro existente.

- [ ] **Step 1: Preservar IDs estruturais existentes**

Manter `clientsSearch`, `clientsList`, `clientCreateForm`, `clientEditor` e `clientHistoryTimeline` enquanto a pasta é introduzida incrementalmente, para não quebrar integração da agenda/testes existentes.

- [ ] **Step 2: Expandir formulário de novo cliente nas duas páginas**

Campos:

- `nome` required;
- `cpf` required;
- `data_nascimento` required;
- idade somente leitura/derivada;
- `telefone` required;
- `email` opcional;
- bloco de responsável legal inicialmente oculto.

Não exigir endereço no cadastro rápido.

- [ ] **Step 3: Exibir idade e responsável condicionalmente**

Ao alterar nascimento:

- atualizar idade;
- se menor, exibir e exigir `responsavel_nome`, `responsavel_cpf`, `responsavel_parentesco`, `responsavel_telefone`;
- se maior, remover obrigatoriedade e limpar apenas o estado visual, sem apagar dados já persistidos durante edição existente.

- [ ] **Step 4: Checar duplicidade antes do create**

Antes de `createClientV2`, consultar candidatos. Se CPF já existir, bloquear criação e renderizar botão `Abrir prontuário existente`. Se apenas combinação nome+nascimento+telefone coincidir, mostrar aviso e permitir continuar explicitamente.

- [ ] **Step 5: Tratar corrida de CPF duplicado**

Mesmo após aviso prévio, se o banco retornar conflito de CPF, não exibir sucesso falso; recarregar candidato e oferecer abrir o prontuário existente.

- [ ] **Step 6: Estilizar mobile-first**

Campos em uma coluna no celular; idade como informação auxiliar; bloco de responsável com borda/legenda discreta; manter chocolate/dourado/creme e toque mínimo confortável.

- [ ] **Step 7: Rodar testes do painel/integração**

Run:

```bash
node --test tests/gestao/clientes-panel.test.mjs tests/gestao/admin-agenda.test.mjs tests/gestao/colaborador-clientes-integration.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add gestao/admin/index.html gestao/colaborador/index.html gestao/js/clientes-panel.js gestao/assets/gestao.css tests/gestao
git commit -m "feat: amplia cadastro rapido de clientes"
```

---

### Task 5: Transformar o detalhe atual em Pasta da Cliente

**Files:**
- Create: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/clientes-folder.test.mjs`
- Modify: `tests/gestao/clientes-panel.test.mjs`

**Interfaces:**
- Consumes: `getClient`, `listClientHistory`, `clientProfileChecklist`, `formatClinicDateTime`, staff map.
- Produces: Pasta da Cliente com cabeçalho, checklist, linha do tempo principal e edição cadastral completa.

- [ ] **Step 1: Escrever/confirmar RED da pasta**

`clientes-folder.test.mjs` deve exigir:

- cabeçalho com nome, idade e status;
- espaço de foto/placeholder;
- checklist de cadastro básico, endereço, foto e anamnese;
- Linha do tempo como visão inicial;
- aba Cadastro operacional;
- nenhum valor financeiro renderizado na linha do tempo clínica.

- [ ] **Step 2: Implementar `renderClientFolderChecklist(client)`**

Usar apenas `clientProfileChecklist`; `anamnese` aparece como `Pendente` nesta fatia porque a 6B ainda não existe.

- [ ] **Step 3: Implementar `renderClientTimeline(history, staffMap)`**

Reaproveitar o histórico unificado já existente, mantendo procedimento, profissional, data/hora e campos clínicos; não incluir valores.

- [ ] **Step 4: Implementar `renderClientFolder(...)`**

Estrutura mínima operacional:

- cabeçalho da cliente;
- checklist;
- navegação interna `Linha do tempo` / `Cadastro`;
- controles de arquivar/reativar somente quando `canArchive === true`;
- marcador de áreas futuras apenas no roadmap, não como tabs falsas na UI.

- [ ] **Step 5: Implementar formulário de cadastro completo**

Na aba Cadastro permitir editar:

- nome, CPF, nascimento, telefone, e-mail;
- CEP, logradouro, número, complemento, bairro, cidade, UF;
- responsável legal quando aplicável.

Salvar via `updateClientV2`.

- [ ] **Step 6: Integrar `openClient()` ao novo folder**

`clientes-panel.js` passa a montar a Pasta da Cliente sem duplicar lógica de renderização de timeline/editor.

- [ ] **Step 7: Garantir responsividade e identidade visual**

No celular, cabeçalho compacto e tabs internas roláveis apenas se necessário; no desktop, painel com largura confortável e sem voltar ao padrão de página longa empilhada.

- [ ] **Step 8: Rodar testes**

Run:

```bash
node --test tests/gestao/clientes-folder.test.mjs tests/gestao/clientes-panel.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add gestao/js/clientes-folder.js gestao/js/clientes-panel.js gestao/admin/index.html gestao/colaborador/index.html gestao/assets/gestao.css tests/gestao/clientes-folder.test.mjs tests/gestao/clientes-panel.test.mjs
git commit -m "feat: cria pasta da cliente no BC Gestao"
```

---

### Task 6: Adicionar foto de identificação privada com câmera, galeria e histórico

**Files:**
- Create: `supabase/migrations/<gerado>_bc_gestao_phase6a_client_photo.sql`
- Create: `gestao/js/clientes-photo-api.js`
- Modify: `gestao/js/clientes-folder.js`
- Modify: `gestao/js/clientes-panel.js`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/clientes-photo-api.test.mjs`
- Modify: `tests/gestao/clientes-folder.test.mjs`
- Modify: `tests/gestao/phase6a-database-contract.test.mjs`

**Interfaces:**
- Consumes: cliente ativo/arquivado, staff ativo, Supabase Storage autenticado.
- Produces: bucket privado `bc-prontuario-private`, metadados históricos e foto atual por cliente.

- [ ] **Step 1: Consultar docs atuais de Supabase Storage/RLS**

Verificar sintaxe atual de políticas em `storage.objects`, `storage.foldername()`/equivalente documentado e URLs assinadas antes da implementação.

- [ ] **Step 2: Criar migration de foto pelo CLI**

Run:

```bash
supabase migration new bc_gestao_phase6a_client_photo
```

Expected: caminho da migration retornado pelo CLI.

- [ ] **Step 3: Criar bucket privado e tabela de metadados**

Bucket: `bc-prontuario-private`, `public = false`.

Tabela conceitual `cliente_identificacao_fotos`:

- `id uuid`;
- `cliente_id uuid` FK;
- `storage_path text unique`;
- `mime_type text`;
- `tamanho_bytes bigint`;
- `atual boolean`;
- `created_by uuid`;
- `created_at timestamptz`;
- `substituida_at timestamptz`.

Índice único parcial: no máximo uma `atual = true` por cliente.

- [ ] **Step 4: Criar políticas de Storage e metadados**

Equipe ativa pode ler fotos clínicas compartilhadas. Upload exige autenticação/staff ativo e caminho canônico `identificacao/<cliente_id>/<uuid>.<ext>`. Nenhuma colaboradora recebe permissão de delete destrutivo. Bucket não pode ser público.

- [ ] **Step 5: Criar RPC transacional de foto atual**

`public.bc_cliente_set_current_id_photo(p_cliente_id uuid, p_foto_id uuid)` deve:

- validar staff ativo;
- validar que a foto pertence à cliente;
- marcar foto atual anterior como substituída;
- marcar a nova como atual;
- preservar ambos os registros.

- [ ] **Step 6: Implementar `clientes-photo-api.js`**

Contrato:

```js
uploadClientIdPhoto({ client, clienteId, file })
listClientIdPhotos({ client, clienteId })
getClientIdPhotoUrl({ client, storagePath, expiresIn = 300 })
setCurrentClientIdPhoto({ client, clienteId, fotoId })
```

Aceitar inicialmente JPEG, PNG e WebP até 8 MB; rejeitar outros tipos/tamanhos antes do upload.

- [ ] **Step 7: Adicionar câmera e galeria à Pasta da Cliente**

Renderizar dois controles claros:

- `Tirar foto` com `<input type="file" accept="image/*" capture="environment">`;
- `Escolher da galeria` com `<input type="file" accept="image/*">` sem `capture`.

Após upload bem-sucedido, definir como atual e recarregar cabeçalho/checklist.

- [ ] **Step 8: Exibir histórico sem deleção**

A aba Cadastro/área de foto pode mostrar miniaturas históricas com data e indicador `Atual`/`Anterior`, usando URLs assinadas temporárias.

- [ ] **Step 9: Testar URL privada e erros**

`clientes-photo-api.test.mjs` deve provar:

- bucket chamado é `bc-prontuario-private`;
- upload usa caminho por cliente;
- arquivo inválido não chama Storage;
- URL vem de `createSignedUrl`, nunca `getPublicUrl`;
- troca de foto atual usa RPC e preserva histórico.

- [ ] **Step 10: Rodar testes**

Run:

```bash
node --test tests/gestao/clientes-photo-api.test.mjs tests/gestao/clientes-folder.test.mjs tests/gestao/phase6a-database-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations gestao/js/clientes-photo-api.js gestao/js/clientes-folder.js gestao/js/clientes-panel.js gestao/assets/gestao.css tests/gestao
git commit -m "feat: adiciona foto privada ao prontuario da cliente"
```

---

### Task 7: Endurecer permissões, integração com Agenda e auditoria

**Files:**
- Modify: migrations 6A apenas por nova migration corretiva se algo já tiver sido aplicado; nunca editar migration aplicada remotamente.
- Modify: `tests/gestao/admin-agenda.test.mjs`
- Modify: `tests/gestao/colaborador-clientes-integration.test.mjs`
- Modify: `tests/gestao/phase6a-database-contract.test.mjs`
- Modify: `tests/gestao/phase6a-rpc-grants.test.mjs`

**Interfaces:**
- Consumes: cliente v2 e foto privada completos.
- Produces: prova automatizada de que 6A não afrouxou segurança da Fase 4/5.

- [ ] **Step 1: Testar colaboradora**

Garantir que profissional ativa:

- pesquisa e abre cliente compartilhada;
- vê cadastro clínico/foto compartilhada;
- cria cliente;
- atualiza cliente ativo;
- não arquiva/reativa;
- não edita cliente arquivado;
- não ganha acesso a financeiro alheio.

- [ ] **Step 2: Testar Mel/ADM**

Garantir que Mel:

- vê clientes ativos/arquivados;
- edita cadastro;
- arquiva/reativa;
- acessa histórico de foto;
- continua com integrações administrativas existentes.

- [ ] **Step 3: Testar atualização do seletor da Agenda**

Criação/edição/arquivamento/reativação continua chamando `notifyClientsChanged(onClientsChanged)` e não quebra seletores de agenda.

- [ ] **Step 4: Testar ausência de vazamento financeiro**

Os novos selects/RPCs de cliente/foto não devem incluir tabelas privadas de comissão, livros, repasses ou payloads financeiros.

- [ ] **Step 5: Rodar suíte completa da gestão**

Run: `npm run test:gestao`

Expected: PASS total.

- [ ] **Step 6: Commit**

```bash
git add tests/gestao
git commit -m "test: endurece permissoes da fase 6A"
```

---

### Task 8: Aplicar no Supabase correto e homologar sem paciente real

**Files:**
- No novo código de produto, salvo migration corretiva criada via CLI se a verificação encontrar problema.

**Interfaces:**
- Consumes: migrations 6A verdes localmente.
- Produces: schema/RLS/RPC/Storage verificados no projeto `tpqsmerlxquyrzrjbogj` sem resíduo de paciente de teste.

- [ ] **Step 1: Confirmar alvo antes da mudança**

Verificar explicitamente que a conexão aponta para `bc-estetica-gestao` / `tpqsmerlxquyrzrjbogj`. Abort if ref divergir.

- [ ] **Step 2: Rodar advisors antes de commit remoto**

Usar Supabase MCP `get_advisors` ou CLI suportada. Corrigir achados relevantes de security/performance antes de prosseguir.

- [ ] **Step 3: Aplicar migrations 6A pelo fluxo suportado**

Aplicar somente as migrations da 6A no projeto correto. Não tocar no projeto antigo.

- [ ] **Step 4: Verificar RLS, grants e bucket privado**

Confirmar:

- RLS true em nova tabela;
- wrappers v2 executáveis somente por `authenticated`;
- `anon` sem execute;
- bucket `bc-prontuario-private` não público;
- policies de Storage exigem staff ativo;
- uma foto atual por cliente.

- [ ] **Step 5: Homologar cadastro dentro de transação com rollback**

Usar dados obviamente fictícios e executar em transação SQL quando possível:

- maior de idade;
- menor sem responsável deve falhar;
- menor com responsável deve passar;
- CPF duplicado deve falhar;
- colaboradora não arquiva;
- Mel arquiva/reativa.

Finalizar com `ROLLBACK` e confirmar zero linha residual.

- [ ] **Step 6: Homologar Storage com objeto fictício e limpeza explícita**

Upload de arquivo de teste sem dados pessoais em caminho de homologação; confirmar URL assinada, ausência de URL pública e leitura por staff autenticado. Remover o objeto fictício ao fim somente por rotina administrativa de homologação e confirmar zero resíduo.

- [ ] **Step 7: Rodar advisors novamente**

Expected: nenhum alerta novo relevante introduzido pela 6A.

---

### Task 9: Verificação final, PR e publicação da 6A

**Files:**
- Modify: documentação/handoff somente se necessário refletir status real.

**Interfaces:**
- Consumes: todas as Tasks 1–8 concluídas.
- Produces: branch pronta para revisão, CI e deploy.

- [ ] **Step 1: Rodar todas as suítes**

Run:

```bash
npm test
```

Expected: todas as suítes `frontend`, `site` e `gestao` PASS.

- [ ] **Step 2: Fazer revisão de segurança específica**

Checar manualmente:

- nenhum secret/service_role;
- nenhum bucket público;
- nenhum `getPublicUrl` para prontuário;
- nenhum `TO authenticated` sem predicado/autorização apropriada em recurso sensível;
- wrappers sensíveis com grants explícitos;
- nenhuma query nova de cliente inclui financeiro privado.

- [ ] **Step 3: Verificar diff contra `main`**

Confirmar que `/admin/` legado não mudou e que alterações se concentram em `/gestao/`, migrations, testes e docs da Fase 6A.

- [ ] **Step 4: Abrir PR**

Título sugerido:

`feat: inicia prontuario com cadastro ampliado e pasta da cliente`

Body deve listar:

- cadastro v2;
- CPF único/duplicidade;
- idade/menor responsável;
- endereço estruturado;
- Pasta da Cliente;
- foto privada câmera/galeria;
- RLS/RPC/Storage;
- testes e homologação fictícia;
- zero alteração de pacientes reais.

- [ ] **Step 5: Aguardar CI e revisar logs se necessário**

Expected: Site CI e GitHub Pages/checagens pertinentes verdes.

- [ ] **Step 6: Revisão final da branch antes do merge**

Executar a revisão prevista pelo método de execução escolhido. Não declarar concluído antes de evidência de testes/CI.

- [ ] **Step 7: Merge e pós-merge somente após revisão verde**

Após merge, confirmar workflow da `main` e publicação do GitHub Pages. Registrar SHA de merge e runs relevantes no handoff.

---

## Self-Review do plano

### Cobertura da spec nesta fatia

Coberto pela 6A:

- cadastro rápido obrigatório;
- CPF único + duplicidade potencial;
- nascimento/idade automática;
- responsável legal para menor;
- endereço estruturado;
- cliente único da BC;
- leitura clínica compartilhada;
- arquivar/reativar admin-only;
- Pasta da Cliente e linha do tempo clínica existente;
- checklist inicial;
- foto de identificação via câmera/galeria;
- Storage privado + histórico de foto;
- auditoria sem exclusão destrutiva;
- integração com agenda;
- preservação da segregação financeira.

Deliberadamente adiado para planos próprios:

- Anamnese Geral/módulos/alertas/assinaturas/PDF/link remoto → 6B;
- Biblioteca Clínica/termos/ficha de atendimento completa → 6C;
- fotos clínicas/produtos/equipamentos/intercorrências → 6D;
- planos/pacotes/retornos/financeiro por paciente → 6E;
- exportação/compartilhamento/filtros avançados/hardening final → 6F.

### Consistência de interfaces

- `clientes-panel.js` continua coordenador; regras puras ficam em `clientes-domain.js`.
- Pasta fica isolada em `clientes-folder.js`.
- Storage/foto fica isolado em `clientes-photo-api.js`.
- RPCs v2 evitam quebrar imediatamente chamadas legadas e permitem migração incremental.
- A autoria continua derivada no backend.

### Critério de pronto da 6A

A 6A só pode ser considerada pronta quando uma profissional autenticada consegue cadastrar uma cliente fictícia com identidade completa, abrir sua Pasta, editar endereço, tirar/escolher foto privada e consultar o histórico clínico existente; CPF duplicado é bloqueado pelo banco; menor exige responsável; colaboradora não arquiva; Mel arquiva/reativa; nenhum dado financeiro alheio aparece; testes completos, advisors, CI e deploy estão verdes; homologação não deixou paciente/arquivo fictício residual.