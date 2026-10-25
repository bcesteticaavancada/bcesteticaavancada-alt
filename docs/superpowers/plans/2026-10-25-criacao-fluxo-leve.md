# Área de criação — fluxo leve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para executar as tarefas nesta sessão.

**Goal:** reduzir esforço de navegação e preservar contexto na área de Fernando.

**Architecture:** refinar a página e o controlador existentes. Estado de filtros em memória, uma consulta RPC por ação, atualização discreta sem substituir detalhes desnecessariamente.

**Tech Stack:** HTML/CSS/JavaScript nativos, Node test, Linkedom e Playwright existentes.

**Spec:** docs/superpowers/specs/2026-10-25-criacao-fluxo-leve-design.md

## Global Constraints

- Paginação de 50 e RPC bc_creation_list existentes.
- Sem acesso financeiro, mutações de negócio, alterações de conta ou migrações.
- Sem dados pessoais persistidos no navegador; API fictícia nos testes de interface.
- Não carregar as dezesseis áreas em paralelo.

## Review Focus

- Resposta lenta de uma área não deve substituir a área seguinte.
- Atualização discreta descartada deve manter contagem e navegação utilizáveis.
- Voltar a uma área deve restaurar busca e página, sem mistura com outra consulta.
- Navegação por teclado, histórico e áreas secundárias precisa coincidir com título e seletor.
- Textos longos e erros não devem transbordar a tela nem bloquear a navegação.

### Task 1: Interface e contexto de consulta

**Files:** gestao/criacao/index.html, gestao/js/creation-panel.js, gestao/assets/creation.css, tests/gestao/creation-admin.test.mjs.

**Interfaces:** manter initCreationPanel({client,root,view}) → {refresh,openSection}; refresh aceita quiet/canApply. Consumir somente bc_creation_list com projeções existentes.

- [x] Escrever regressões de atalhos com retorno a busca/página e de atualização discreta que preserva detalhes/contagem. Testar também limpar busca e resultado descartado.
- [x] Rodar node --test tests/gestao/creation-admin.test.mjs. Expected: novas regressões falham pelos comportamentos ausentes.
- [x] Implementar navegação, estado, indicadores de carga e apresentação compacta conforme spec.
- [x] Rodar o mesmo comando. Expected: todas aprovadas, inclusive concorrência preexistente.
- [x] Commit da interface e regressões.

### Task 2: Verificação em navegador e publicação

**Files:** scripts/test-creation-dashboard-browser.mjs, .github/workflows/site-ci.yml, docs/superpowers/ledgers/2026-10-25-criacao-fluxo-leve.md.

**Interfaces:** testar HTML/controlador reais da Task1 com RPC fictícia; adicionar execução ao Site CI e capturas ao artefato existente.

- [x] Exercitar Chromium/WebKit em 320 e 768px: atalhos, secundárias, histórico, retorno de filtro/página, detalhes após refresh, erro e recuperação, nomes longos e nenhuma consulta financeira.
- [x] Rodar npm test e node scripts/test-creation-dashboard-browser.mjs. Expected: aprovação e nenhuma exceção/overflow. Navegadores executados pelo CI, conforme limitação local registrada.
- [x] Commit; revisão independente única da alteração inteira; corrigir achados relevantes com regressão.
- [x] Abrir PR, verificar Site CI, integrar e confirmar versão publicada. Registrar evidências no ledger.
