# Maya V2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a segunda versão visual da Maya com expressões e movimentos acessíveis para avaliação de Fernando.

**Architecture:** Camadas no SVG atual e CSS derivados de `data-state`/`data-motion`. Reutilizar controle manual, preferência do sistema, visibilidade e proteção de sessão existentes. Prévia independente gerada para avaliação, sem Supabase.

**Tech Stack:** HTML, SVG, CSS, JavaScript, Node/linkedom e Playwright já existentes.

**Spec:** [Design](../specs/2026-10-28-maya-v2-expressoes-design.md).

## Global Constraints

- Não mesclar/publicar a V2 nesta etapa. Sem voz, microfone, modelo novo ou API paga.
- Não alterar respostas/manifesto da Mel, os 16 guias, perfis, banco, financeiro ou Drive.
- Movimento reduzido, pausa manual e página oculta param todas as animações; estados continuam legíveis.

## Review Focus

- Preferência de movimento muda durante consulta: nenhuma animação continua ou pausa manual se perde.
- Página fica oculta e retorna: parar respiração/piscada/cabeça, retomar somente se permitido.
- Falha de biblioteca/autorização: expressão neutra não anuncia conclusão ou sucesso.
- Limpeza ou interação antiga: nenhum sorriso/estado atrasado substitui uma interação nova.
- Tela de 320 px: avatar em movimento não cobre controles nem cria rolagem horizontal.

### Task 1: Expressões e movimentos renderizados

**Files:** Modify `gestao/maya-beta/index.html`, `scripts/test-maya-browser.mjs`.

**Interfaces:** Consome os estados existentes `ready`, `thinking`, `answered`, `unavailable` e `data-motion=on|off`; produz camadas `.maya-body`, `.maya-mouth-neutral`, `.maya-smile` e animações limitadas por esses atributos. Não alterar o fluxo de respostas/autorização.

- [ ] Escrever regressões de navegador que meçam respiração/piscadas ativas, boca neutra na espera/falha, sorriso na resposta, pausa/redução/visibilidade e largura; executar e observar falha na V1.
- [ ] Acrescentar camadas SVG e animações CSS locais conforme o design, preservando forma/cores e controle atual.
- [ ] Executar navegador Chromium/WebKit e `npm test`; todas as regressões existentes e novas devem passar. Inspecionar imagens finais.
- [ ] Commitar implementação e evidências de testes.

### Task 2: Prévia, revisão e entrega

**Files:** Create `docs/bc-gestao/maya-v2-expressoes-2026-10-28.md`; prévia independente como artefato de avaliação fora do código da produção.

**Interfaces:** A prévia reproduz CSS/SVG da V2 e troca somente estados fictícios e movimento. Não autentica nem acessa APIs, arquivos ou dados pessoais.

- [ ] Criar prévia móvel/desktop com controles de estados, pausa e indicação de demonstração visual; validar funcionamento e ausência de requisições externas.
- [ ] Fazer revisão independente única do diff e corrigir problemas importantes com regressão reproduzida.
- [ ] Atualizar branch/PR em rascunho e confirmar CI do commit final; manter a principal intacta.
- [ ] Entregar prévia e resumo do que mudou, testes e pendências de aceite/publicação.
