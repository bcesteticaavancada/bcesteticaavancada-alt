# BC Gestão 1.0 — Fase 1 Fundação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a fundação técnica isolada do BC Gestão dentro da branch `feature/bc-gestao-1`, com rotas internas, identidade visual própria, testes e preparação para futura hospedagem separada, sem conectar ainda login real, banco, financeiro ou dados clínicos.

**Architecture:** A aplicação nasce em `gestao/` como um módulo independente do site institucional, usando HTML/CSS/JavaScript ES modules sem novas dependências de runtime. Quando hospedada separadamente com `gestao/` como root do projeto, suas rotas lógicas serão `/login/`, `/admin/` e `/colaborador/`. O Supabase existente de pré-anamnese permanece somente como referência; nenhuma tabela, policy ou usuário será alterado nesta fase.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Node.js 22 test runner, GitHub Actions, futuro deploy estático/Functions em Vercel.

**Spec:** `docs/superpowers/specs/2026-10-08-bc-gestao-design.md`

## Global Constraints

- Trabalhar exclusivamente em `feature/bc-gestao-1`.
- `main` não recebe código da Fase 1.
- `/admin/` atual da pré-anamnese não pode ser alterado.
- Nenhuma tabela, migration, RLS, usuário ou dado do Supabase será criado/alterado nesta fase.
- Nenhum segredo ou chave privilegiada será adicionado ao repositório.
- A Fase 1 não exibe dados reais de clientes, colaboradores ou pagamentos.
- O visual deve seguir a identidade BC: luxo editorial, chocolate/preto, dourado e creme, com prioridade mobile-first.
- A fundação deve continuar utilizável sem React, Next.js ou nova dependência de build; YAGNI para o MVP.
- O futuro backend poderá ser conectado sem reescrever a navegação básica.

## Review Focus

- A nova pasta `gestao/` não pode importar nem sobrescrever arquivos de `/admin/` da pré-anamnese.
- Links internos não podem expor acesso administrativo como se fossem autorização; nesta fase são apenas rotas de shell sem dados reais.
- Nenhuma string parecida com `service_role`, senha, token privado ou dado de paciente pode entrar nos arquivos novos.
- O pipeline de CI deve testar `tests/gestao/**` na branch de feature sem passar a publicar essa branch no GitHub Pages.
- A estrutura precisa funcionar tanto como diretório isolado no repositório quanto como root de um futuro projeto Vercel.

---

### Task 1: Teste RED da fundação e contrato de isolamento

**Files:**
- Create: `tests/gestao/foundation.test.mjs`
- Modify later: `package.json`

**Interfaces:**
- Consumes: estrutura aprovada de rotas da spec.
- Produces: contrato automatizado para `gestao/login/`, `gestao/admin/`, `gestao/colaborador/`, ausência de segredos e isolamento de `/admin/` existente.

- [ ] **Step 1: Criar teste que exige a nova estrutura antes dela existir**

O teste deve verificar:
- existência de `gestao/login/index.html`;
- existência de `gestao/admin/index.html`;
- existência de `gestao/colaborador/index.html`;
- existência de `gestao/assets/gestao.css`;
- existência de `gestao/js/routes.js`;
- cada página contém marca `BC Gestão` e viewport responsivo;
- nenhum arquivo em `gestao/` contém `service_role` ou segredo privado;
- `gestao/` não referencia `../admin/admin.js` nem `../admin/admin.css`.

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `node --test tests/gestao/foundation.test.mjs`
Expected: FAIL porque os arquivos `gestao/**` ainda não existem.

- [ ] **Step 3: Adicionar script `test:gestao` ao `package.json`**

Adicionar `"test:gestao": "node --test tests/gestao/*.test.mjs"` e fazer `test` executar frontend + site + gestao, preservando scripts existentes.

- [ ] **Step 4: Commitar apenas teste + script**

Commit esperado: `test: define contrato da fundação do BC Gestão`.

---

### Task 2: Criar shell visual e rotas estáticas

**Files:**
- Create: `gestao/index.html`
- Create: `gestao/login/index.html`
- Create: `gestao/admin/index.html`
- Create: `gestao/colaborador/index.html`
- Create: `gestao/assets/gestao.css`
- Create: `gestao/js/routes.js`
- Create: `gestao/js/shell.js`

**Interfaces:**
- Consumes: contrato da Task 1.
- Produces: `ROLE_DESTINATIONS`, `destinationForRole(role)`, três páginas internas e shell visual compartilhado.

- [ ] **Step 1: Implementar `gestao/js/routes.js`**

Exportar:
- `ROLE_DESTINATIONS = Object.freeze({ admin: '../admin/', colaborador: '../colaborador/' })` quando usado a partir de `/login/`;
- `destinationForRole(role)` que retorna a rota conhecida ou `null` para papel desconhecido.

- [ ] **Step 2: Criar `gestao/index.html` como entrada neutra**

Deve apresentar `BC Gestão` e apontar para `./login/`, sem autenticação falsa e sem dados de produção.

- [ ] **Step 3: Criar `gestao/login/index.html`**

Layout de login visual com campos de e-mail/senha desabilitados ou claramente marcados como fundação ainda não conectada nesta fase. Não implementar autenticação real ainda.

- [ ] **Step 4: Criar `gestao/admin/index.html`**

Shell do painel da Mel com blocos vazios/estado de preparação para Dashboard, Agenda, Clientes, Financeiro e Histórico, sem números fictícios tratados como dados reais.

- [ ] **Step 5: Criar `gestao/colaborador/index.html`**

Shell individual com áreas de Agenda de hoje, Próximos atendimentos e Histórico autorizado, sem valores financeiros.

- [ ] **Step 6: Criar `gestao/assets/gestao.css`**

Design mobile-first, luxo editorial BC, sem depender de CSS do site institucional nem do `/admin/` antigo.

- [ ] **Step 7: Criar `gestao/js/shell.js`**

Somente comportamento de interface não sensível: ano, navegação visual e estados vazios. Nenhuma autenticação ou acesso a banco.

- [ ] **Step 8: Rodar o teste da fundação**

Run: `node --test tests/gestao/foundation.test.mjs`
Expected: PASS.

- [ ] **Step 9: Rodar suíte completa**

Run: `npm test`
Expected: todos os testes existentes + gestao verdes.

- [ ] **Step 10: Commitar shell**

Commit esperado: `feat: cria fundação isolada do BC Gestão`.

---

### Task 3: Testar contrato de roteamento por papel

**Files:**
- Create: `tests/gestao/routes.test.mjs`
- Modify only if RED requires: `gestao/js/routes.js`

**Interfaces:**
- Consumes: `destinationForRole(role)` da Task 2.
- Produces: contrato de roteamento que a futura autenticação Supabase usará sem duplicar regras.

- [ ] **Step 1: Escrever testes de papel**

Asserções:
- `destinationForRole('admin') === '../admin/'`;
- `destinationForRole('colaborador') === '../colaborador/'`;
- papel vazio, desconhecido, `null` e `undefined` retornam `null`.

- [ ] **Step 2: Rodar RED se houver lacuna**

Run: `node --test tests/gestao/routes.test.mjs`
Expected: PASS se Task 2 já satisfaz integralmente o contrato; se passar de primeira, registrar que o teste caracteriza comportamento já criado e não alterar código desnecessariamente.

- [ ] **Step 3: Rodar suíte da gestão**

Run: `npm run test:gestao`
Expected: PASS.

- [ ] **Step 4: Commitar teste**

Commit esperado: `test: cobre roteamento de perfis do BC Gestão`.

---

### Task 4: Preparar CI e futuro deploy sem publicar nada

**Files:**
- Modify: `.github/workflows/site-ci.yml`
- Create: `gestao/vercel.json`
- Create: `gestao/README.md`
- Test: `tests/gestao/foundation.test.mjs`

**Interfaces:**
- Consumes: estrutura `gestao/` pronta.
- Produces: CI para feature branch e configuração estática segura para futura conexão à Vercel.

- [ ] **Step 1: Estender CI para a branch de trabalho**

Adicionar `'feature/**'` ao trigger de `push`, adicionar `gestao/**` e `tests/gestao/**` aos paths e executar `npm run test:gestao` no job.

- [ ] **Step 2: Criar `gestao/vercel.json`**

Somente configuração estática e headers defensivos básicos:
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `X-Frame-Options: DENY`;
- `Permissions-Policy` restritiva para recursos não utilizados.

Não criar redirects para o site público e não conectar projeto Vercel nesta fase.

- [ ] **Step 3: Criar `gestao/README.md`**

Documentar:
- propósito;
- rotas;
- limites da Fase 1;
- proibição de secrets no cliente;
- Supabase ainda não conectado;
- futuro rootDirectory Vercel = `gestao`;
- `/admin/` antigo permanece separado.

- [ ] **Step 4: Rodar suíte completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verificar diff contra `main`**

Esperado: somente documentação da Fase 0/1, `gestao/**`, `tests/gestao/**`, `package.json` e CI; nenhum arquivo do `/admin/` antigo, Home, Procedimentos, agendamento ou pré-anamnese modificado.

- [ ] **Step 6: Commitar preparação**

Commit esperado: `ci: prepara validação isolada do BC Gestão`.

---

### Task 5: Gate da Fase 1

**Files:**
- Read-only verification of `main`, `feature/bc-gestao-1`, `/admin/`, `gestao/`, CI and Supabase project inventory.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: evidência para iniciar a Fase 2 sem risco conhecido ao site público.

- [ ] **Step 1: Revalidar `main` e `/admin/`**

Confirmar que os SHAs do `/admin/` no `main` continuam iguais ao manifesto da Fase 0, salvo alteração paralela legítima que deve ser reportada.

- [ ] **Step 2: Confirmar isolamento de deploy**

GitHub Pages continua publicando `main`; nenhum deploy Vercel foi criado pela Fase 1.

- [ ] **Step 3: Confirmar ausência de mutação Supabase**

Projeto existente observado antes da Fase 1: `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`), região `sa-east-1`. Fase 1 não executa SQL, migration, RLS ou criação de usuários/projeto.

- [ ] **Step 4: Registrar decisão para Fase 2**

Antes de criar backend novo, pedir ao usuário que escolha explicitamente a organização Supabase e apresentar custo se a opção escolhida for um projeto/branch adicional, conforme exigência da plataforma.

- [ ] **Step 5: Conclusão técnica**

Critério: shell isolado funcional, testes verdes, nenhuma dependência de dados reais, nenhum impacto no site público e fronteira clara para conectar Auth/banco depois.

## Self-review

- **Spec coverage:** Fase 1 cobre apenas fundação, rotas, visual, testes e isolamento; Auth, banco, agenda, histórico e financeiro permanecem para fases seguintes.
- **Step scan:** cada task possui resultado verificável e commits pequenos.
- **Type consistency:** `ROLE_DESTINATIONS` e `destinationForRole(role)` são definidos uma única vez e consumidos pela futura autenticação.
- **Review Focus:** os riscos de colisão com `/admin/`, secrets, CI e futura Vercel estão cobertos.
- **Proportion:** o plano evita framework novo e não antecipa backend que ainda precisa de decisão explícita de organização/custo.
