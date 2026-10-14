# BC Estética Protocolos 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular `/protocolos/` como uma vitrine mobile-first, curta e premium, com 7 temas de vídeo, famílias de tratamentos agrupadas, detalhes acessíveis e uma faixa própria para os protocolos autorais BC.

**Architecture:** Manter o site estático em HTML/CSS/JavaScript puro no GitHub Pages. O conteúdo essencial fica no HTML e usa `<details>` para expansão sem depender de JavaScript; o JS específico da página cuida somente de hidratação/lazy-load e autoplay seguro de vídeos reais. CSS scroll-snap resolve os carrosséis sem biblioteca externa.

**Tech Stack:** HTML5 estático, CSS responsivo, JavaScript ES module sem framework, Node.js 22 + `node:test`, GitHub Pages/Actions; ffmpeg apenas quando houver vídeo aprovado para otimizar.

**Spec:** `docs/superpowers/specs/2026-10-14-protocolos-2-0-design.md`

## Global Constraints

- Mobile-first; validar 360 px, tablet e desktop.
- Não adicionar frameworks ou dependências de runtime.
- Manter o canonical `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/protocolos/`.
- Manter header, drawer, botão `Agendar`, WhatsApp e footer institucional funcionando.
- A página deve conter exatamente 7 temas visuais principais: Botox; Harmonização/Preenchimento; Bioestimulador; Skinbooster/Biorremodelação; Microagulhamento/Renovação; Ultrassom/Firmeza; Contorno Corporal/Sculpt Cryo.
- Navegação por objetivo: Rosto, Pele, Colágeno, Corpo, Capilar e Bem-estar.
- Agrupamento visual nunca pode afirmar equivalência clínica entre procedimentos diferentes.
- Usar linguagem prudente: `pode ajudar`, `busca`, `pode favorecer`, `conforme avaliação`; evitar `garante`, `elimina`, `sem risco`, `definitivo` e promessas absolutas.
- Os 8 protocolos autorais ficam em `Assinaturas BC`: Fort Hair™, Fort Hair Plus™, Fort Brow™, Sculpt Cryo™, Reset Glow™, Monaco Glow™, Skin Reset™, Face Reset™.
- Usar WebP existente sempre que possível; abaixo da dobra, `loading="lazy"`, dimensões definidas e `decoding="async"`.
- Vídeos reais: 9:16 preferencial, `muted`, `playsinline`, `preload="none"` antes de entrar perto da viewport; nunca carregar sete MP4s no load inicial.
- Se o MP4 aprovado de um tema ainda não estiver no repositório, renderizar poster/fallback estável e nunca apontar para arquivo inexistente.
- Respeitar `prefers-reduced-motion`; conteúdo essencial deve permanecer legível sem JavaScript.
- Preservar `docs/catalogo-procedimentos-em-espera.md`; não apagar histórico de tratamentos ao encurtar a vitrine.

## Review Focus

1. **Mídia ausente ou falha:** um tema sem MP4 deve mostrar poster e copy sem quebrar proporção, navegação ou gerar 404; Task 2/4 fixa o contrato.
2. **Viewport estreito (360 px):** rails horizontais devem rolar dentro do componente sem overflow da página; Task 3 testa `min-width:0`, `overflow-x:auto` e scroll-snap.
3. **Movimento reduzido:** nenhuma tentativa de autoplay quando `prefers-reduced-motion: reduce`; Task 4 cobre a política de playback.
4. **Sem JavaScript/IntersectionObserver:** famílias, detalhes, links por objetivo e CTA continuam utilizáveis; Task 2 mantém HTML semântico e Task 4 usa progressive enhancement.
5. **Copy clínica agrupada:** Skinbooster/Profhilo, tecnologias de firmeza e demais famílias relacionadas não podem ser descritas como procedimentos equivalentes; Task 5 adiciona regressões de texto.

---

### Task 1: Criar o contrato de regressão da Protocolos 2.0

**Files:**
- Create: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Consumes: `protocolos/index.html`, `protocolos/protocolos.css`, `protocolos/protocolos.js` quando criado.
- Produces: contrato executado automaticamente por `npm run test:site` e pelo Site CI existente.

- [ ] **Step 1: Write the failing structure tests**

Create `tests/site/protocolos-2.test.mjs` using `node:test`, `assert/strict` and `readFileSync`. Assert:
- canonical de `/protocolos/` permanece presente;
- existem 7 ocorrências de `data-protocol-video` com os sete slugs `botox`, `harmonizacao`, `bioestimulador`, `biorremodelacao`, `renovacao`, `firmeza`, `contorno-corporal`;
- existem exatamente 6 links `.protocol-objective-chip` para `#rosto`, `#pele`, `#colageno`, `#corpo`, `#capilar`, `#bem-estar`;
- existem 10 cards `.protocol-family-card` com IDs `toxina-botulinica`, `limpeza-renovacao`, `hidratacao-qualidade`, `colageno-textura`, `harmonizacao-facial`, `tecnologias-firmeza`, `contorno-corporal`, `massagens-bem-estar`, `capilar-sobrancelhas`, `cuidados-especificos`;
- `Assinaturas BC` contém os 8 nomes autorais;
- o CTA aponta para `../agendamento/` e o WhatsApp existente continua presente;
- `docs/catalogo-procedimentos-em-espera.md` existe.

- [ ] **Step 2: Run the test and verify it fails on the old catalogue**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL porque a página atual ainda não possui a arquitetura 2.0.

- [ ] **Step 3: Commit the failing contract**

```bash
git add tests/site/protocolos-2.test.mjs
git commit -m "test: define Protocolos 2.0 contract"
```

---

### Task 2: Reestruturar o HTML em vídeos, objetivos e famílias

**Files:**
- Modify: `protocolos/index.html`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Produces: `.protocol-video-showcase`, `.protocol-video-rail`, `.protocol-video-card`, `.protocol-objective-nav`, `.protocol-family-grid`, `.protocol-family-card`, `.protocol-signatures`, `.protocol-signature-rail`.
- Produces media state contract: each video card uses `data-protocol-video="<slug>"` and `data-video-state="ready|pending"`.

- [ ] **Step 1: Extend the failing test for semantic/fallback behavior**

Add assertions that every family card contains a native `<details>` and `<summary>`; at least one family detail contains `conforme avaliação`; video cards marked `pending` contain a poster `<img>` and do not contain a nonexistent `<source src=...>`; all below-fold family images use `loading="lazy"`.

- [ ] **Step 2: Run the targeted test**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Replace the old 30-card main content with the approved sequence**

In `protocolos/index.html`, preserve the existing header/drawer and rebuild `<main>` in this order:
1. compact hero + three rooms;
2. video showcase with seven cards;
3. objective chips;
4. ten family cards;
5. `Assinaturas BC` dark rail;
6. disclaimer;
7. final CTA;
8. existing footer/WhatsApp.

Use existing catalogue WebPs as initial posters/family art instead of creating fake media. Suggested initial poster mapping: Botox `07-botox-terco-superior.webp`, Harmonização use the closest approved harmonization asset if present or a neutral existing family image, Bioestimulador `11-bioestimulador-de-colageno.webp`, Biorremodelação `10-skinbooster.webp`/`13-profhilo.webp`, Renovação `14-microagulhamento.webp` or `04-peeling.webp`; only reference files confirmed to exist.

Each family `<details>` must list the individual procedures and retain their distinction. Keep definitions concise and add `Agendar avaliação` inside or immediately after the expanded content.

- [ ] **Step 4: Run the targeted test**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: structural/semantic assertions PASS; CSS/JS assertions added later may still be absent.

- [ ] **Step 5: Commit**

```bash
git add protocolos/index.html tests/site/protocolos-2.test.mjs
git commit -m "feat: restructure Protocolos into treatment families"
```

---

### Task 3: Construir o layout mobile-first e os rails visuais

**Files:**
- Modify: `protocolos/protocolos.css`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Consumes: class names from Task 2.
- Produces: 9:16 media frame, CSS scroll-snap rails, compact family grid, premium `Assinaturas BC`, styled native `<details>` and visible focus states.

- [ ] **Step 1: Add failing CSS contract assertions**

Assert CSS contains rules for `.protocol-video-rail`, `.protocol-video-card`, `.protocol-objective-nav`, `.protocol-family-grid`, `.protocol-family-card`, `.protocol-signature-rail`; contains `scroll-snap-type`, `overflow-x:auto`, `aspect-ratio:9/16` (or whitespace-equivalent), `:focus-visible`, `min-width:0`, and `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL on new CSS selectors.

- [ ] **Step 3: Rewrite `protocolos/protocolos.css` around the new component system**

Keep BC palette/tokens from shared CSS. Requirements:
- hero shorter than current mobile presentation while preserving the three-room image;
- video rail: horizontal snap on mobile, first card visually dominant, 2–4 items on wider screens without forcing page overflow;
- objective chips: one-line horizontal rail on small screens, wrap/grid allowed on desktop;
- family grid: one column on small screens, two on tablet, up to three on wide desktop;
- media `object-fit:cover` only where crop is intentional; preserve faces/procedure context;
- `<details>` summary has at least 44 px touch target and strong focus-visible state;
- signatures rail uses dark background, gold accents and horizontal snap on mobile;
- reduced motion disables smooth scrolling/transitions that are not essential.

- [ ] **Step 4: Run site tests**

Run: `npm run test:site`

Expected: PASS for all site tests.

- [ ] **Step 5: Commit**

```bash
git add protocolos/protocolos.css tests/site/protocolos-2.test.mjs
git commit -m "feat: add mobile-first Protocolos 2.0 layout"
```

---

### Task 4: Adicionar lazy-load progressivo dos vídeos sem quebrar fallback

**Files:**
- Create: `protocolos/protocolos.js`
- Modify: `protocolos/index.html`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- `hydrateProtocolVideo(video: HTMLVideoElement): void` — copies each child `<source data-src>` into `src`, removes `data-src`, calls `video.load()` once.
- `canAutoplayProtocolVideo(reducedMotion: boolean, video: HTMLVideoElement): boolean` — true only when motion is allowed and video is muted.
- `initProtocolVideos(root: Document | Element = document): void` — observes only cards with `data-video-state="ready"`, hydrates near viewport and attempts muted playback only while visible; pending cards are ignored.

- [ ] **Step 1: Add failing media-policy tests**

Assert `protocolos/index.html` loads `protocolos.js` with `type="module"`; ready videos use `muted`, `playsinline`, `preload="none"`, `poster`, and `<source data-src>` rather than eager `src`; JS contains `IntersectionObserver`, `matchMedia('(prefers-reduced-motion: reduce)')` and no third-party carousel import.

- [ ] **Step 2: Run targeted tests**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL because module does not exist yet.

- [ ] **Step 3: Implement the module as progressive enhancement**

Use the three functions above. Observer policy: hydrate when a ready card is within approximately 300 px of viewport; autoplay only when intersecting and muted; pause when leaving; if `IntersectionObserver` is absent, hydrate ready videos but do not force autoplay. Never touch pending cards. Native video controls remain available on real videos so sound/pause is accessible without custom control UI.

- [ ] **Step 4: Run site tests**

Run: `npm run test:site`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add protocolos/protocolos.js protocolos/index.html tests/site/protocolos-2.test.mjs
git commit -m "feat: lazy-load Protocolos videos safely"
```

---

### Task 5: Integrar somente mídia aprovada e blindar a copy clínica

**Files:**
- Modify if asset available: `assets/procedimentos/videos/botox.mp4`
- Create if asset available: `assets/procedimentos/posters/botox.webp`
- Modify: `protocolos/index.html`
- Modify: `assets/procedimentos/README.md`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- A video is publishable only when the referenced file actually exists in the repository.
- Pending topics remain poster-only using `data-video-state="pending"`; ready topics use `data-video-state="ready"` and a lazy `<source data-src="...">`.

- [ ] **Step 1: Add media/copy regression assertions**

Use `existsSync` for every local file referenced by a ready video. Assert public HTML does not contain the banned absolute phrases `garante`, `sem risco`, `resultado certo` or `definitivo`. Assert the Biorremodelação family explicitly distinguishes Skinbooster and Profhilo® rather than calling them the same procedure; the Firmeza family states that technologies have different indications/mecanisms or equivalent cautionary wording.

- [ ] **Step 2: Run tests and confirm they catch missing/bad references**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL if a ready media path is absent or copy violates the contract.

- [ ] **Step 3: Integrate the approved Botox video when its exact source is available**

If the approved MP4 is available, optimize to H.264/AAC MP4 suitable for web, save as `assets/procedimentos/videos/botox.mp4`, generate a WebP poster under `assets/procedimentos/posters/botox.webp`, mark only the Botox card `ready`, and reference it via `data-src`. If the approved MP4 is not available in the execution environment, keep Botox as a poster card and do not invent or substitute another clinic video; this does not block the structural 2.0 release.

Update `assets/procedimentos/README.md` with `videos/` and `posters/` conventions and the rule that only approved media becomes `ready`.

- [ ] **Step 4: Normalize all family copy against the safety rules**

Keep each card to 1–2 short public lines plus `<details>`; preserve individual procedure names and evaluation language. Do not duplicate the long old-card paragraphs unless they add a distinct clinical difference.

- [ ] **Step 5: Run site tests**

Run: `npm run test:site`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add protocolos/index.html assets/procedimentos/README.md tests/site/protocolos-2.test.mjs assets/procedimentos/videos assets/procedimentos/posters
git commit -m "feat: integrate approved Protocolos media and clinical copy"
```

If video/poster directories were not created because no new binary was available, omit them from `git add`.

---

### Task 6: Fechar SEO, documentação e regressão completa

**Files:**
- Modify: `protocolos/index.html`
- Modify: `README.md`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Produces: final public copy and documentation describing Protocolos 2.0 instead of the old 30-card layout.

- [ ] **Step 1: Add final SEO/accessibility assertions**

Assert HTML still contains semantic text for `toxina botulínica`, `bioestimulador`, `procedimentos faciais`, `procedimentos corporais`, `Belo Horizonte` and `avaliação`; every `<img>` in the Protocolos main section has non-empty `alt`; no `<video>` lacks `playsinline`; links/chips use actual anchors rather than JS-only controls.

- [ ] **Step 2: Update metadata and project documentation**

Keep the current canonical. Refine title/description only as needed to describe the grouped visual experience. In `README.md`, replace the statement that `/protocolos/` is a 30-card catalogue with the 2.0 architecture: 7 visual themes, compact families, Assinaturas BC and progressive media.

- [ ] **Step 3: Run the complete regression suite**

Run: `npm test`

Expected: all frontend, site and BC Gestão tests PASS.

- [ ] **Step 4: Verify the page without relying on JS**

Serve the repository with a simple static server and load `/protocolos/` with JavaScript disabled. Confirm hero, seven topic posters, six objective anchors, ten family cards/details, Assinaturas BC, disclaimer and CTA remain readable/navigation-capable.

- [ ] **Step 5: Verify responsive acceptance**

Check at 360 px, ~768 px and >=1280 px: no page-level horizontal overflow; rails scroll independently; first screen is shorter than old catalogue; details are tappable; menu/drawer/Agendar still work; no layout jump from missing media.

- [ ] **Step 6: Commit**

```bash
git add protocolos/index.html README.md tests/site/protocolos-2.test.mjs
git commit -m "docs: finalize Protocolos 2.0 SEO and acceptance"
```

---

## Final Verification

- [ ] `npm test` PASS.
- [ ] Site CI PASS on the implementation branch/PR.
- [ ] No ready video references a missing file.
- [ ] No page-level horizontal overflow at 360 px.
- [ ] Seven visual themes and six objective chips are present.
- [ ] Botox is one family, not three giant cards.
- [ ] Ten family cards preserve individual treatment distinctions via `<details>`.
- [ ] Eight `Assinaturas BC` entries appear in the premium rail.
- [ ] `docs/catalogo-procedimentos-em-espera.md` remains untouched/preserved.
- [ ] Published `/protocolos/` keeps canonical, CTA, menu and WhatsApp working.
