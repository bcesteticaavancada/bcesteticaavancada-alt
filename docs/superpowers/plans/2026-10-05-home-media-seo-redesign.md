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
- Dados fixos consistentes: Rua Gávea, 358, Loja 02, 2º andar, Nova Suissa, Belo Horizonte/MG; WhatsApp `(31) 99518-4110`; terça a sábado, 09h às 18h.

## Review Focus

- Home em 320–360 px: nenhuma seção ou mídia causa overflow horizontal.
- Vídeos: nenhum download pesado inicia na primeira pintura; sem atributo `autoplay` no HTML inicial.
- JS do modal: abrir/fechar repetidamente não duplica eventos nem mantém áudio tocando.
- Schema/SEO: JSON-LD permanece JSON válido e dados locais batem com o conteúdo visível.
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
  - title contains service + Belo Horizonte and is 30–60 characters;
  - canonical exists and points to the GitHub Pages Home;
  - Open Graph includes title, description, image and URL;
  - exactly one H1 remains;
  - JSON-LD `LocalBusiness` parses as JSON and includes name/address/telephone/opening hours;
  - Home contains landmarks for method, pillars, media, environment, specialists, FAQ and final CTA;
  - every non-decorative image has `alt`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test tests/site/home.test.mjs`
Expected: FAIL because the current Home lacks required sections and SEO tags.

- [ ] **Step 3: Add the package script only after the failing test exists**

- [ ] **Step 4: Commit**

`git commit -m "test: define BC home editorial and SEO contract"`

### Task 2: Corrigir metadados e dados estruturados

**Files:**
- Modify: `index.html`
- Test: `tests/site/home.test.mjs`

**Interfaces:**
- No runtime API changes.

- [ ] **Step 1: Implement exact SEO head structure**

Use a descriptive title in the 30–60 character range, canonical `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`, Open Graph tags, and `LocalBusiness` JSON-LD with clinic address, phone and hours.

- [ ] **Step 2: Run SEO unit test**

Run: `npm run test:site`
Expected: SEO assertions PASS; editorial-section assertions may still fail.

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

Each image gets descriptive `alt`; no fake before/after or clinical claim.

- [ ] **Step 3: Add responsive editorial CSS**

Use existing design tokens; introduce no new color system. Desktop can use asymmetric grids; mobile collapses to a single readable flow.

- [ ] **Step 4: Run tests**

Run: `npm run test:site`
Expected: editorial and image-alt assertions PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: expand BC home editorial experience"`

### Task 4: Criar dois assets gerados exclusivamente decorativos

**Files:**
- Create: `assets/editorial/generated/bc-ivory-gold-texture.webp`
- Create: `assets/editorial/generated/bc-dark-gold-texture.webp`
- Modify: `styles.css` and/or `index.html` to use them only as decorative backgrounds.

**Interfaces:**
- Generated images have no people, clinic room, devices, procedures or patient results.

- [ ] **Step 1: Generate the ivory/gold texture**

Prompt intent: refined warm ivory paper, subtle organic light, restrained champagne-gold accents, luxury editorial beauty brand, no text, no objects, no people.

- [ ] **Step 2: Generate the dark/gold texture**

Prompt intent: deep warm chocolate-black background, soft directional glow, restrained brushed-gold abstract detail, premium editorial aesthetic, no text, no objects, no people.

- [ ] **Step 3: Optimize to WebP and keep decorative alt empty if used through `<img>`**

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
- One reusable dialog/modal owns the only active `<video>` element.
- Initial HTML contains no `autoplay` attribute and no eager MP4 `src` on cards.

- [ ] **Step 1: Add failing tests for lazy media behavior**
  - four media cards exist;
  - each has a poster and `data-video-src`;
  - no card contains eager `<video src="...mp4">`;
  - no `autoplay` attribute exists;
  - reusable modal/dialog markup exists.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm run test:site`
Expected: FAIL on video campaign assertions.

- [ ] **Step 3: Optimize source videos for web**

Target: H.264 MP4, `+faststart`, portrait dimensions preserved at web-appropriate resolution, bitrate/CRF chosen to materially reduce size without obvious mobile degradation. Preserve full duration unless source contains unusable lead/trailing frames.

- [ ] **Step 4: Extract representative poster frames**

Posters must show real BC work from each source video and be compressed WebP.

- [ ] **Step 5: Implement cards and lazy modal controller**

On open: set video source, load and play only after explicit user action. On close/Escape: pause, reset currentTime, clear `src`, call `load()`, restore focus to trigger.

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

- [ ] **Step 1: Add test that Home does not duplicate menu behavior inline and externally**

- [ ] **Step 2: Run test and confirm current duplication fails**

Run: `npm run test:site`
Expected: FAIL because Home currently has both `script.js` and inline fallback menu logic.

- [ ] **Step 3: Keep one canonical menu implementation**

Retain robust external behavior in `script.js`; remove inline duplicate only after verifying all selectors exist and tests cover open/close/Escape.

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

Check menu, images, cards, FAQ, CTAs, modal open/close/Escape, no overflow and no background audio.

- [ ] **Step 3: Run Grow My Website on the published Home**

Expected: previous failures for Open Graph, canonical, schema and thin content are resolved or materially improved.

- [ ] **Step 4: Check public page after GitHub Pages deployment**

Confirm final HTML/assets are reachable and the public version matches the tested commit.

- [ ] **Step 5: Commit only if final-audit fixes were required**

`git commit -m "fix: address final BC home audit findings"`
