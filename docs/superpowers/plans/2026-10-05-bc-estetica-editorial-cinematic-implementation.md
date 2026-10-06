# BC Estética Editorial Luxury + Cinematic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o site oficial da BC Estética para uma experiência editorial premium e cinematográfica, incorporando a apresentação confirmada da Alice, mídia real otimizada, conteúdo público de procedimentos, SEO técnico e proteção contra regressões mobile.

**Architecture:** Manter o site estático multipágina em HTML/CSS/JavaScript puro no GitHub Pages. O redesign será incremental: primeiro blindar invariantes e criar os componentes visuais, depois adicionar assets reais e conteúdo editorial, e por fim aplicar SEO, performance e QA. Vídeos usam um módulo ESM pequeno com `IntersectionObserver`; a pré-anamnese e o gerador de PDF ficam fora deste trabalho.

**Tech Stack:** HTML5 estático, CSS custom properties/responsive CSS, JavaScript ES modules sem framework, Node.js `node:test`, ffmpeg para mídia, GitHub Pages/Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-bc-estetica-cinematic-luxury-redesign-design.md`

## Global Constraints

- Site público oficial: `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`.
- GitHub continua sendo a fonte oficial de produção; MagicPath/Figma/Replit/Hercules não substituem a publicação oficial.
- Menu continua com 11 opções; logo centralizado; botão de menu no topo direito; drawer sobreposto sem deslocamento horizontal.
- Home continua sendo apenas apresentação: Mel como fundo principal, uma única ocorrência visual do logo, sem catálogo de procedimentos/equipe/resultados/preços/protocolos.
- Rodapé da Home contém somente endereço, telefone e GPS; o JavaScript global não pode substituí-lo por rodapé institucional rico.
- Prioridade mobile-first; nenhum asset ou componente pode gerar overflow horizontal.
- Não publicar preços não confirmados, promessas de resultado, credenciais não fornecidas ou especializações inventadas.
- Usar retratos e vídeos reais da BC; não gerar Alice, Mel, pacientes, antes/depois ou evidência clínica por IA.
- Vídeos 9:16 sem distorção; autoplay somente mudo, `playsinline`, condicionado a visibilidade e `prefers-reduced-motion`; vídeo falado exige controles e legenda/transcrição.
- Pré-anamnese, Supabase, PDF e área de rubrica/assinatura não são alterados por este plano.
- Sem frameworks ou dependências de runtime novas.

## Review Focus

1. **Home em produção:** carregar `index.html` não pode disparar `ensureBCFooter()` para trocar o rodapé simples; teste no Task 1 fixa esse comportamento.
2. **Mídia ausente/falha:** poster e fallback visual devem manter proporção e layout mesmo se MP4 não carregar; teste no Task 4 cobre markup e política de mídia.
3. **Movimento reduzido:** `prefers-reduced-motion: reduce` deve impedir autoplay e transições essenciais; teste unitário no Task 4 cobre a decisão de playback.
4. **Viewport estreito (320–390 px):** menu permanece no topo direito, logo central, sem overflow horizontal; teste de shell/CSS no Task 1 e verificação final no Task 10.
5. **Vídeo falado WA0045:** não publicar enquanto a identidade atual da profissional e o texto de legenda não estiverem confirmados; teste no Task 4 garante que nenhuma página pública referencia esse arquivo.

---

### Task 1: Blindar shell, Home e testes de regressão do site

**Files:**
- Create: `tests/site/shell.test.mjs`
- Modify: `package.json`
- Modify: `index.html`
- Modify: `script.js`
- Create: `.github/workflows/site-ci.yml`

**Interfaces:**
- Consumes: HTML estático atual e `script.js` compartilhado.
- Produces: `npm run test:site`, marcador `data-bc-footer="home"` no rodapé da Home e shell protegido para todas as tarefas posteriores.

- [ ] **Step 1: Write the failing shell tests**

Create `tests/site/shell.test.mjs` with assertions that: Home has exactly 11 drawer links; `.brand` precedes `.header-cta` but `.menu-toggle` exists and CSS retains `justify-self:end`; Home contains one logo image reference; `.home-hero` uses `assets/01-mel-perfil.jpg`; Home has no `procedure-grid-bc`, `result-grid` or team profile blocks; Home footer has `data-bc-footer="home"`; `script.js` explicitly skips rich-footer replacement when that marker exists.

- [ ] **Step 2: Run the test and confirm the current regression is caught**

Run: `node --test tests/site/shell.test.mjs`

Expected: FAIL because the Home footer marker/skip does not yet exist.

- [ ] **Step 3: Implement the minimal shell fix and scripts**

In `index.html`, add `data-bc-footer="home"` to the existing simple footer without changing its three fields. In `script.js`, make `ensureBCFooter()` return immediately when `footer[data-bc-footer="home"]` exists. In `package.json`, add `test:site` as `node --test tests/site/*.test.mjs` and `test` as `npm run test:frontend && npm run test:site`. Add `.github/workflows/site-ci.yml` to run `npm test` on pushes/PRs touching public HTML/CSS/JS/assets/tests.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: all existing anamnese tests and new shell tests PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html script.js tests/site/shell.test.mjs .github/workflows/site-ci.yml
git commit -m "test: protect BC site shell and home invariants"
```

---

### Task 2: Refinar sistema visual Editorial Luxury compartilhado

**Files:**
- Create: `tests/site/visual-system.test.mjs`
- Modify: `styles.css`

**Interfaces:**
- Consumes: tokens atuais `--ink`, `--paper`, `--cream`, `--gold`, `--gold2`, `--muted`, `--dark`.
- Produces: classes reutilizáveis `.editorial-section`, `.editorial-split`, `.editorial-portrait`, `.cinematic-frame`, `.cinematic-copy`, `.editorial-quote`, `.treatment-collection`, `.treatment-entry`, `.bc-cta-band`.

- [ ] **Step 1: Write failing visual-system tests**

Assert the classes above exist; `.cinematic-frame` declares `aspect-ratio:9/16` or equivalent; mobile rules collapse split layouts to one column; `@media(prefers-reduced-motion:reduce)` remains present; header mobile grid keeps right-side menu column and `.menu-toggle{justify-self:end}`.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/site/visual-system.test.mjs`

Expected: FAIL because the new editorial component classes do not yet exist.

- [ ] **Step 3: Add the visual system to `styles.css`**

Keep the existing palette. Add editorial typography scale, wider vertical rhythm, low-opacity gold rules, premium portrait treatment, cinematic media containers, native `<details>` treatment styling, focus-visible styles, safe `overflow:hidden` only on component wrappers, and responsive 800/520 px behavior. Do not change the header coordinate contract or Home composition.

- [ ] **Step 4: Run site tests**

Run: `npm run test:site`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add styles.css tests/site/visual-system.test.mjs
git commit -m "feat: add BC editorial luxury visual system"
```

---

### Task 3: Publicar o retrato real e fechar a apresentação editorial da Alice

**Files:**
- Create binary: `assets/equipe/alice-rocha.jpg` from `/mnt/data/bcmedia/alice-rocha.jpg`
- Create: `tests/site/equipe.test.mjs`
- Modify: `equipe/index.html`

**Interfaces:**
- Consumes: classes editoriais do Task 2 e conteúdo confirmado da Alice.
- Produces: bloco editorial de Alice com asset real estável, sem `onerror` apontando para foto genérica da equipe.

- [ ] **Step 1: Write failing team-content tests**

Assert `equipe/index.html` references `../assets/equipe/alice-rocha.jpg`; contains `Alice Rocha`, `Biomédica Esteta`, `mais de 10 anos em Estética e Cosmetologia`, `4 anos em Biomedicina`, `19272`, `tatuagens`, `micropigmentação`, `estrias`, `cicatrizes`, `acne`, `M�