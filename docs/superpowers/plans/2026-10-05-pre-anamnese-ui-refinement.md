# Pré-Anamnese UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar a experiência visual da pré-anamnese no site para parecer uma ficha BC personalizada, premium e responsiva, sem alterar regras clínicas, IDs de campos ou fluxo de envio.

**Architecture:** Manter o HTML e os módulos JS atuais como fonte de comportamento, concentrando a mudança em marcação estrutural mínima e `agendamento/anamnese.css`. Os oito passos, nomes/IDs dos inputs, condicionais, rubrica, validação e integração permanecem compatíveis com os testes existentes.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-05-bc-editorial-site-pre-anamnese-pdf-design.md`

## Global Constraints

- Exatamente 8 etapas conceituais continuam existindo.
- Não alterar IDs/names de campos consumidos por `agendamento/js/*.js`.
- Não mudar regras de obrigatoriedade, CPF, consentimentos, rubrica ou payload.
- Mobile first: sem overflow horizontal e sem controles pequenos demais para toque.
- Visual acessível premium: marfim, chocolate/preto quente, dourado sóbrio.
- A página de pré-anamnese prioriza privacidade e usabilidade, não SEO de aquisição.

## Review Focus

- Tela de 320–360 px: grids colapsam, containers têm `min-width:0`/largura fluida e não vazam lateralmente.
- Textos longos em labels/avisos: quebram linha com regra explícita de wrapping.
- Navegação por teclado: `:focus-visible` é claramente perceptível.
- `prefers-reduced-motion`: animação de troca de etapa é removida/reduzida.
- Estados de erro/sucesso: possuem contraste e pista estrutural (borda/ícone/texto), não só cor.

---

### Task 1: Travar o novo contrato visual em testes

**Files:**
- Modify: `tests/anamnese/layout.test.mjs`
- Test: `tests/anamnese/layout.test.mjs`

**Interfaces:**
- Tests read `agendamento/index.html` and `agendamento/anamnese.css` as text fixtures.
- New presentational landmarks: `data-ui="bc-form-header"` and `data-ui="bc-progress"`.

- [ ] **Step 1: Add failing tests**
  - exactly eight `data-step` sections remain;
  - `data-ui="bc-form-header"` exists inside the form shell;
  - `data-ui="bc-progress"` wraps stage/progress presentation;
  - CSS contains `:focus-visible` for actionable controls;
  - CSS contains `@media (prefers-reduced-motion: reduce)`;
  - mobile breakpoint at/below 700 px collapses `.grid`, `.options` and `.checkgrid` to one column;
  - fluid containers use `max-width`/`width:100%` and `min-width:0` where grid children could overflow;
  - labels/notices have explicit wrapping behavior;
  - error/success states include a non-color cue such as border or pseudo-element marker.

- [ ] **Step 2: Run test to verify new assertions fail**

Run: `node --test tests/anamnese/layout.test.mjs`
Expected: FAIL on new landmarks/accessibility/responsive requirements.

- [ ] **Step 3: Commit test contract**

`git commit -m "test: define premium pre-anamnese layout contract"`

### Task 2: Implementar o redesign visual sem tocar no comportamento

**Files:**
- Modify: `agendamento/index.html`
- Modify: `agendamento/anamnese.css`
- Verify unchanged behavior hooks in: `agendamento/js/main.js`, `conditional.js`, `review.js`, `validation.js`, `signature.js`, `finalize.js`.

**Interfaces:**
- Keep `#preAnamneseForm`, `#stage`, `#track`, `.step`, `.nav`, all field IDs/names and all `data-step` values unchanged.
- Add only the two `data-ui` landmarks defined in Task 1 plus presentation-only classes when needed.

- [ ] **Step 1: Add the two structural landmarks**

Wrap/mark the BC form identity area with `data-ui="bc-form-header"` and the progress area with `data-ui="bc-progress"`; do not move or rename JS hooks.

- [ ] **Step 2: Refine shell and section hierarchy**

Use layered paper/cream surfaces, restrained gold rules, stronger serif headings, denser but readable spacing, and clear grouping so the experience resembles a personalized BC document rather than a generic admin form.

- [ ] **Step 3: Refine interactive states**

Selected radios/checkboxes read as selected cards; conditionals look subordinate; summary cards are scan-friendly; signature area is clearly delimited; error/success states include structural cues in addition to color.

- [ ] **Step 4: Add responsive/accessibility rules**

Implement explicit text wrapping, `min-width:0` where needed, visible `:focus-visible`, reduced-motion handling, comfortable tap targets, stacked navigation when necessary, and no hover-only dependency.

- [ ] **Step 5: Run layout test**

Run: `node --test tests/anamnese/layout.test.mjs`
Expected: PASS.

- [ ] **Step 6: Run full frontend suite**

Run: `npm run test:frontend`
Expected: all PASS.

- [ ] **Step 7: Commit**

`git commit -m "feat: refine BC pre-anamnese interface"`

### Task 3: Fluxo completo e acabamento de regressão

**Files:**
- Modify only if a verified regression is found.

**Interfaces:**
- No API or payload contract changes.

- [ ] **Step 1: Manual browser verification**

Check widths near 360 px, 768 px and desktop; complete all eight steps; trigger conditionals; review answers; accept consents; draw/clear rubric; verify success/error panels.

- [ ] **Step 2: Verify keyboard flow**

Tab through controls, confirm focus visibility, Enter/Space behavior on choices, and no keyboard trap in any step.

- [ ] **Step 3: Run full suite again**

Run: `npm run test:frontend`
Expected: all PASS.

- [ ] **Step 4: Commit only if regression fixes were required**

`git commit -m "fix: polish pre-anamnese responsive flow"`
