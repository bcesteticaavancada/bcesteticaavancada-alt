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

- Tela de 320–360 px: campos, opções e botões não vazam lateralmente.
- Textos longos em labels/avisos: quebram linha sem encobrir controles.
- Navegação por teclado: foco sempre visível em inputs, radios, checkboxes e botões.
- `prefers-reduced-motion`: transições não impedem leitura/navegação.
- Estados de erro/sucesso: contraste suficiente e sem depender só de cor.

---

### Task 1: Travar a estrutura visual esperada em testes

**Files:**
- Modify: `tests/anamnese/layout.test.mjs`
- Test: `tests/anamnese/layout.test.mjs`

**Interfaces:**
- Consumes: current `agendamento/index.html` and `agendamento/anamnese.css` as text fixtures.
- Produces: regression contract for visual landmarks and responsiveness.

- [ ] **Step 1: Add failing tests**
  - HTML still exposes exactly eight `data-step` sections.
  - shell contains branded intro/header landmark and progress landmark.
  - CSS contains explicit focus-visible styling.
  - CSS contains mobile breakpoint at or below 700 px and reduced-motion handling.
  - form container has a max width and no fixed viewport width.

- [ ] **Step 2: Run test to verify new assertions fail**

Run: `node --test tests/anamnese/layout.test.mjs`
Expected: FAIL on newly required landmarks/styles.

- [ ] **Step 3: Commit test contract**

`git commit -m "test: define premium pre-anamnese layout contract"`

### Task 2: Refinar cabeçalho, shell e hierarquia dos passos

**Files:**
- Modify: `agendamento/index.html`
- Modify: `agendamento/anamnese.css`

**Interfaces:**
- Keep all existing field IDs/names and `data-step` values unchanged.
- Keep `#stage`, `#track`, `.step`, `.nav`, validation containers and form ID unchanged.

- [ ] **Step 1: Implement minimal markup additions**

Add only presentational wrappers/labels needed for: BC identity strip, personalized-card feel, clearer section metadata, and a more editorial progress header. Do not rename behavior hooks.

- [ ] **Step 2: Implement shell and card styling**

Use layered paper/cream surfaces, restrained gold rules, stronger serif headings, denser but readable spacing, and clear section grouping. Remove any visual treatment that makes the form look like a generic admin panel.

- [ ] **Step 3: Run layout test**

Run: `node --test tests/anamnese/layout.test.mjs`
Expected: PASS.

- [ ] **Step 4: Run full frontend suite**

Run: `npm run test:frontend`
Expected: all PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: refine pre-anamnese visual hierarchy"`

### Task 3: Melhorar opções, campos, condicionais e resumo

**Files:**
- Modify: `agendamento/anamnese.css`
- Modify: `agendamento/index.html` only where a semantic wrapper/class is required.
- Verify: `agendamento/js/conditional.js`, `review.js`, `validation.js` remain behavior-compatible.

**Interfaces:**
- Existing JS selectors must continue matching.

- [ ] **Step 1: Add failing static assertions for state classes**

Extend `tests/anamnese/layout.test.mjs` to require visible styles for checked options, conditionals, summary cards, errors, success state, and signature area.

- [ ] **Step 2: Run test and confirm failure**

Run: `node --test tests/anamnese/layout.test.mjs`
Expected: FAIL on missing state styling assertions.

- [ ] **Step 3: Implement refined state styling**

Checked radios/checkboxes must read as selected cards; conditionals must look subordinate, not detached; summary cards must be scan-friendly; error/success blocks must carry icon/text or border cues in addition to color.

- [ ] **Step 4: Run frontend tests**

Run: `npm run test:frontend`
Expected: all PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: polish pre-anamnese interactive states"`

### Task 4: Responsividade, acessibilidade e acabamento mobile

**Files:**
- Modify: `agendamento/anamnese.css`
- Modify: `tests/anamnese/layout.test.mjs`

**Interfaces:**
- No JS API changes.

- [ ] **Step 1: Add failing assertions for accessibility CSS**
  - `:focus-visible` present for actionable controls;
  - `prefers-reduced-motion: reduce` present;
  - mobile layout collapses grids to one column;
  - signature canvas remains width 100%.

- [ ] **Step 2: Run test to verify failure**

Run: `node --test tests/anamnese/layout.test.mjs`
Expected: FAIL until all rules exist.

- [ ] **Step 3: Implement mobile/accessibility rules**

Ensure tap targets are at least visually comfortable, navigation buttons can stack when necessary, and no section depends on hover.

- [ ] **Step 4: Run complete frontend suite**

Run: `npm run test:frontend`
Expected: all PASS.

- [ ] **Step 5: Manual browser verification**

Check widths near 360 px, 768 px and desktop; complete all eight steps; verify conditionals, review, consent, rubric and final submission UI remain intact.

- [ ] **Step 6: Commit**

`git commit -m "fix: harden pre-anamnese responsive accessibility"`
