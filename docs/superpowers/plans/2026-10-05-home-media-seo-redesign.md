# Home, Media & SEO Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir a Home da BC para uma experiência editorial premium, completar lacunas visuais com material real e elementos gerados seguros, integrar mídia de procedimentos com carregamento sob demanda e corrigir os principais problemas técnicos de SEO já identificados.

**Architecture:** Manter o site estático em GitHub Pages, preservando `index.html`, `styles.css` e `script.js` como base. A Home ganha seções editoriais sem introduzir framework novo; o JavaScript adiciona apenas comportamento leve de vídeo/modal e mantém o menu existente. Mídia real da BC tem prioridade; geração de imagem é limitada a fundos/texturas sem pessoas nem resultados clínicos.

**Tech Stack:** HTML, CSS, JavaScript, GitHub Pages, Node built-in test runner, assets WebP/JPEG/MP4 otimizados.

**Spec:** `docs/superpowers/specs/2026-10-05-bc-editorial-site-pre-anamnese-pdf-design.md`

## Global Constraints

- GitHub continua como fonte oficial de publicação.
- Não migrar hospedagem nem introduzir custo recorrente.
- Preservar menu hamburger e CTAs existentes.
- Fotografias/vídeos reais da BC têm prioridade sobre IA.
- IA não pode inventar paciente, antes/depois, resultado clínico, profissional real ou ambiente falso apresentado como real.
- Conteúdo clínico sem promessas absolutas; usar linguagem prudente e avaliação profissional.
- Dados fixos consistentes: Rua Gávea, 358, Loja 02, 2º andar, Nova Suissa, Belo Horizonte/MG; telefone `+55 31 99518-4110`; terça a sábado, 09h às 18h.
- Título SEO da Home: `BC Estética Avançada | Belo Horizonte`.
- Canonical: `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`.
- Open Graph image: `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/assets/02-equipe-bc-estetica.jpg`.

## Review Focus

- Home em 320–360 px: CSS contém regra de colapso para grids, `overflow-x:hidden` e containers fluidos sem largura fixa de viewport.
- Vídeos: nenhum MP4 é carregado no HTML inicial e nenhum `autoplay` existe.
- JS do modal: existe guard `window.BCVideoReady`, fechamento pausa vídeo, remove `src`, chama `load()` e restaura foco.
- Schema/SEO: JSON-LD é JSON válido e dados locais batem com o conteúdo visível.
- Imagens: todos os `<img>` novos têm `alt` útil ou `alt=""` quando puramente decorativos.

---

### Task 1: Criar contrato de teste para Home editorial e SEO

**Files:**
- Create: `tests/site/home.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Tests read `index.html`, `styles.css`, `script.js` and media paths from disk.
- Add script: `test:site` -> `node --test tests/site/*.test.mjs`.

- [ ] **Step 1: Write failing tests**
  - `<title>` equals `BC Estética Avançada | Belo Horizonte`;
  - canonical equals the exact URL in Global Constraints;
  - Open Graph includes `og:title`, `og:description`, exact `og:image` and `og:url`;
  - exactly one H1 remains;
  - JSON-LD parses as JSON, has `@type: "LocalBusiness"`, name `BC Estética Avançada`, telephone `+5531995184110`, address fields for Rua Gávea 358 / Nova Suissa / Belo Horizonte / MG, and opening hours Tuesday–Saturday 09:00–18:00;
  - Home contains landmarks for method, pillars, media, environment, specialists, FAQ and final CTA;
  - every non-decorative image has `alt`;
  - CSS includes `overflow-x:hidden`, responsive one-column fallback and fluid media containers.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/site/home.test.mjs`
Expected: FAIL because current Home lacks the required metadata/sections.

- [ ] **Step 3: Add the package script**

Add `"test:site": "node --test tests/site/*.test.mjs"` to `package.json` without changing `test:frontend`.

- [ ] **Step 4: Commit**

`git commit -m "test: define BC home editorial and SEO contract"`

### Task 2: Corrigir metadados e dados estruturados

**Files:**
- Modify: `index.html`
- Test: `tests/site/home.test.mjs`

**Interfaces:**
- No runtime API changes.

- [ ] **Step 1: Implement exact SEO head structure**

Use the exact title, canonical and Open Graph image from Global Constraints. Add `og:title`, `og:description`, `og:image`, `og:url` and JSON-LD `LocalBusiness` with the exact local data pinned in Task 1.

- [ ] **Step 2: Run site tests**

Run: `npm run test:site`
Expected: SEO assertions PASS; editorial/media assertions may still FAIL.

- [ ] **Step 3: Commit**

`git commit -m "feat: add BC home SEO metadata and schema"`

### Task 3: Expandir a Home com narrativa editorial e assets reais

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Use existing: `assets/01-mel-perfil.jpg`, `assets/02-equipe-bc-estetica.jpg`, `assets/03-recepcao-bc-estetica.jpg`, `assets/04-sala-massagem.jpg`, `assets/05-sala-procedimentos.jpg`, `assets/06-sala-atendimento.jpg`.
- Test: `tests/site/home.test.mjs`

**Interfaces:**
- Preserve current header, drawer IDs and CTA URLs.
- Section landmarks use stable IDs: `metodo-bc`, `pilares`, `tratamentos`, `protocolos`, `tecnologia`, `ambiente`, `especialistas`, `resultados`, `avaliacao`, `faq`, `cta-final`.

- [ ] **Step 1: Add editorial sections in this order**
  1. Hero;
  2. Método BC;
  3. três pilares;
  4. tratamentos estratégicos;
  5. protocolos assinatura;
  6. tecnologia com propósito;
  7. ambiente real;
  8. especialistas;
  9. resultados/portfólio link;
  10. como funciona a avaliação;
  11. FAQ;
  12. CTA final.

- [ ] **Step 2: Use real BC imagery before generated imagery**

Each real image gets descriptive `alt`; no fake before/after or clinical claim.

- [ ] **Step 3: Add responsive editorial CSS**

Use existing design tokens; introduce no new color system. Desktop may use asymmetric grids; mobile collapses to a single readable flow with fluid images and no horizontal overflow.

- [ ] **Step 4: Run tests**

Run: `npm run test:site`
Expected: SEO, editorial-landmark, responsive-CSS and image-alt assertions PASS; media campaign assertions remain pending until Task 5.

- [ ] **Step 5: Commit**

`git commit -m "feat: expand BC home editorial experience"`

### Task 4: Criar dois assets gerados exclusivamente decorativos

**Files:**
- Create: `assets/editorial/generated/bc-ivory-gold-texture.webp`
- Create: `assets/editorial/generated/bc-dark-gold-texture.webp`
- Modify: `styles.css` and/or `index.html` to use them only as decorative backgrounds.

**Interfaces:**
- Generated images contain no people, clinic room, devices, procedures or patient results.

- [ ] **Step 1: Generate the ivory/gold texture**

Intent: refined warm ivory paper, subtle organic light, restrained champagne-gold accents, luxury editorial beauty brand, no text, no objects, no people.

- [ ] **Step 2: Generate the dark/gold texture**

Intent: deep warm chocolate-black background, soft directional glow, restrained brushed-gold abstract detail, premium editorial aesthetic, no text, no objects, no people.

- [ ] **Step 3: Optimize to WebP**

If rendered as `<img>`, use `alt=""`; if CSS background, expose no semantic image role.

- [ ] **Step 4: Verify they do not visually impersonate real BC environments**

- [ ] **Step 5: Commit**

`git commit -m "assets: add BC editorial generated textures"`

### Task 5: Integrar campanha de quatro vídeos com carregamento sob demanda

**Files:**
- Create: `assets/videos/botox.mp4`
- Create: `assets/videos/massagem.mp4`
- Create: `assets/videos/peeling-coreano.mp4`
- Create: `assets/videos/tecnologia-corporal.mp4`
- Create: `assets/videos/posters/botox.webp`
- Create: `assets/videos/posters/massagem.webp`
- Create: `assets/videos/posters/peeling-coreano.webp`
- Create: `assets/videos/posters/tecnologia-corporal.webp`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `script.js`
- Modify: `tests/site/home.test.mjs`

**Interfaces:**
- Video cards expose `data-video-src` and `data-video-title`.
- One reusable `<dialog id="bcVideoDialog">` owns the only active `<video id="bcVideoPlayer">` element.
- `window.BCVideoReady` prevents duplicate initialization.
- Initial HTML contains no `autoplay` and the player starts without MP4 `src`.

- [ ] **Step 1: Add failing tests for lazy media behavior**
  - four media cards exist;
  - each has a poster and `data-video-src`;
  - no card contains eager `<video src="...mp4">`;
  - no `autoplay` attribute exists;
  - `#bcVideoDialog` and `#bcVideoPlayer` exist;
  - `script.js` contains `window.BCVideoReady` guard, `pause()`, `removeAttribute("src")`, `load()` and focus restoration.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm run test:site`
Expected: FAIL on media assertions.

- [ ] **Step 3: Optimize source videos for web**

Target: H.264 MP4, `+faststart`, portrait dimensions preserved at web-appropriate resolution, materially smaller files without obvious mobile degradation. Preserve full duration unless source contains unusable lead/trailing frames.

- [ ] **Step 4: Extract representative poster frames**

Posters show real BC work from each source video and are compressed WebP.

- [ ] **Step 5: Implement cards and lazy dialog controller**

On open: set `src`, call `load()` and play only after explicit user action. On close/Escape: pause, reset `currentTime`, remove `src`, call `load()`, close dialog and restore focus to the trigger.

- [ ] **Step 6: Run tests**

Run: `npm run test:site`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -m "feat: add lazy BC procedure video campaign"`

### Task 6: Consolidar menu/footer e remover duplicação defensiva da Home

**Files:**
- Modify: `index.html`
- Modify: `script.js`
- Modify: `tests/site/home.test.mjs`

**Interfaces:**
- `window.BCMenuReady` remains the compatibility flag.

- [ ] **Step 1: Add failing test for duplicate menu implementation**

Assert Home loads `script.js` but contains no second inline block that binds `#menuToggle`/`#siteDrawer` listeners.

- [ ] **Step 2: Run test and confirm current duplication fails**

Run: `npm run test:site`
Expected: FAIL because current Home has both external and inline menu logic.

- [ ] **Step 3: Keep one canonical menu implementation**

Retain robust external behavior in `script.js`; remove the inline duplicate only after tests cover menu markup and Escape-close behavior source markers.

- [ ] **Step 4: Run site tests**

Run: `npm run test:site`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "refactor: consolidate BC home interactions"`

### Task 7: Auditoria final, performance e publicação

**Files:**
- Modify only if audit/test finds a concrete issue.

**Interfaces:**
- Public URL remains `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`.

- [ ] **Step 1: Run all frontend suites**

Run: `npm run test:frontend && npm run test:site`
Expected: all PASS.

- [ ] **Step 2: Verify Home manually at mobile/tablet/desktop widths**

Check menu, images, cards, FAQ, CTAs, dialog open/close/Escape, no overflow and no background audio.

- [ ] **Step 3: Run Grow My Website on the published Home**

Expected: previous failures for Open Graph, canonical, schema and thin content are resolved or materially improved.

- [ ] **Step 4: Check public page after GitHub Pages deployment**

Confirm final HTML/assets are reachable and the public version matches the tested commit.

- [ ] **Step 5: Commit only if final-audit fixes were required**

`git commit -m "fix: address final BC home audit findings"`
