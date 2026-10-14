# BC Estética Protocolos 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular `/protocolos/` como uma vitrine mobile-first, curta e premium, com 7 temas visuais, famílias de tratamentos agrupadas, detalhes acessíveis e uma faixa própria para os protocolos autorais BC.

**Architecture:** Manter o site estático em HTML/CSS/JavaScript puro no GitHub Pages. O conteúdo essencial fica no HTML e usa `<details>` para expansão sem depender de JavaScript; o JS específico da página cuida somente de hidratação/lazy-load e autoplay seguro de vídeos reais. CSS scroll-snap resolve os carrosséis sem biblioteca externa.

**Tech Stack:** HTML5 estático, CSS responsivo, JavaScript ES module sem framework, Node.js 22 + `node:test`, GitHub Pages/Actions; ffmpeg apenas quando houver vídeo aprovado para otimizar.

**Spec:** `docs/superpowers/specs/2026-10-14-protocolos-2-0-design.md`

## Global Constraints

- Mobile-first; validar 360 px, tablet e desktop.
- Não adicionar frameworks ou dependências de runtime.
- Manter o canonical `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/protocolos/`.
- Manter header, drawer, botão `Agendar`, WhatsApp e footer funcionando.
- Exatamente 7 temas principais, nesta ordem: Botox; Harmonização/Preenchimento; Bioestimulador; Skinbooster/Biorremodelação; Microagulhamento/Renovação; Ultrassom/Firmeza; Contorno Corporal/Sculpt Cryo.
- Navegação por objetivo: Rosto, Pele, Colágeno, Corpo, Capilar e Bem-estar.
- Agrupamento visual nunca pode afirmar equivalência clínica entre procedimentos diferentes.
- Copy prudente: preferir `pode ajudar`, `busca`, `pode favorecer`, `conforme avaliação`; evitar `garante`, `elimina`, `resultado certo`, `sem risco`, `definitivo` e promessas absolutas.
- `Assinaturas BC` contém: Fort Hair™, Fort Hair Plus™, Fort Brow™, Sculpt Cryo™, Reset Glow™, Monaco Glow™, Skin Reset™, Face Reset™.
- Imagens abaixo da dobra: WebP existente quando possível, `loading="lazy"`, dimensões definidas e `decoding="async"`.
- Vídeos reais: 9:16 preferencial, `muted`, `playsinline`, `preload="none"`; não baixar os sete MP4s no load inicial.
- Tema sem MP4 aprovado: poster/fallback estável e nenhum caminho para arquivo inexistente.
- Respeitar `prefers-reduced-motion`; conteúdo essencial legível sem JavaScript.
- Preservar `docs/catalogo-procedimentos-em-espera.md`.

## Review Focus

1. **Mídia ausente/falha:** poster e copy permanecem estáveis, sem 404 ou quebra de proporção.
2. **Viewport de 360 px:** rails rolam dentro do componente sem overflow horizontal da página.
3. **Movimento reduzido:** nenhum autoplay quando `prefers-reduced-motion: reduce`.
4. **Sem JS/IntersectionObserver:** famílias, `<details>`, chips e CTA continuam utilizáveis.
5. **Copy agrupada:** Skinbooster/Profhilo e tecnologias relacionadas permanecem descritos como procedimentos distintos.

---

### Task 1: Criar o contrato de regressão da Protocolos 2.0

**Files:**
- Create: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Consumes: `protocolos/index.html`, `protocolos/protocolos.css`; lê `protocolos/protocolos.js` somente nos testes adicionados após Task 4.
- Produces: contrato incluído automaticamente em `npm run test:site` e Site CI.

- [ ] **Step 1: Write the failing structure tests**

Create `tests/site/protocolos-2.test.mjs` with `node:test`, `assert/strict`, `readFileSync` and `existsSync`. Assert: canonical mantido; 7 `data-protocol-video` com slugs `botox`, `harmonizacao`, `bioestimulador`, `biorremodelacao`, `renovacao`, `firmeza`, `contorno-corporal`; 6 `.protocol-objective-chip` apontando para `#rosto`, `#pele`, `#colageno`, `#corpo`, `#capilar`, `#bem-estar`; 10 `.protocol-family-card` com IDs `toxina-botulinica`, `limpeza-renovacao`, `hidratacao-qualidade`, `colageno-textura`, `harmonizacao-facial`, `tecnologias-firmeza`, `contorno-corporal`, `massagens-bem-estar`, `capilar-sobrancelhas`, `cuidados-especificos`; `Assinaturas BC` com os 8 nomes; CTA `../agendamento/`; WhatsApp preservado; catálogo em espera existente.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL porque o catálogo antigo ainda não possui a arquitetura 2.0.

- [ ] **Step 3: Commit**

```bash
git add tests/site/protocolos-2.test.mjs
git commit -m "test: define Protocolos 2.0 contract"
```

---

### Task 2: Reestruturar o HTML em temas, objetivos e famílias

**Files:**
- Modify: `protocolos/index.html`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Produces classes `.protocol-video-showcase`, `.protocol-video-rail`, `.protocol-video-card`, `.protocol-objective-nav`, `.protocol-family-grid`, `.protocol-family-card`, `.protocol-signatures`, `.protocol-signature-rail`.
- Cada tema usa `data-protocol-video="<slug>"` e `data-video-state="ready|pending"`.

- [ ] **Step 1: Extend the failing test for semantic fallback**

Assert every family card contains native `<details>` + `<summary>`; family details preserve individual procedure names and at least one `conforme avaliação`; pending video cards contain a poster `<img>` and no `<source src>`; below-fold family images use `loading="lazy"`.

- [ ] **Step 2: Run targeted test**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Replace the old 30-card main content**

Preserve header/drawer. Rebuild `<main>` in this order: compact hero + three rooms; seven-topic showcase; six objective chips; ten family cards; `Assinaturas BC`; disclaimer; final CTA; existing footer/WhatsApp.

Use these confirmed initial fallback visuals, without inventing clinical media:
- Botox: `../assets/procedimentos/catalogo/07-botox-terco-superior.webp`
- Harmonização/Preenchimento: `../assets/tres-salas.webp` (neutral clinic fallback until approved treatment media exists)
- Bioestimulador: `../assets/procedimentos/catalogo/11-bioestimulador-de-colageno.webp`
- Skinbooster/Biorremodelação: `../assets/procedimentos/catalogo/10-skinbooster.webp`
- Microagulhamento/Renovação: `../assets/procedimentos/catalogo/14-microagulhamento.webp`
- Ultrassom/Firmeza: `../assets/tres-salas.webp` (neutral clinic fallback until approved treatment media exists)
- Contorno Corporal/Sculpt Cryo: `../assets/procedimentos/catalogo/12-aplicacao-de-enzimas.webp`

Each family `<details>` lists procedures separately; no text says procedures in the same family are interchangeable. Add `Agendar avaliação` inside or immediately after expanded content.

- [ ] **Step 4: Run targeted test**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: structural and semantic assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add protocolos/index.html tests/site/protocolos-2.test.mjs
git commit -m "feat: restructure Protocolos into treatment families"
```

---

### Task 3: Construir o layout mobile-first e os rails

**Files:**
- Modify: `protocolos/protocolos.css`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Consumes class names from Task 2.
- Produces 9:16 media frame, CSS scroll-snap, compact family grid, premium `Assinaturas BC`, styled native `<details>`, visible focus states.

- [ ] **Step 1: Add failing CSS contract assertions**

Assert rules for `.protocol-video-rail`, `.protocol-video-card`, `.protocol-objective-nav`, `.protocol-family-grid`, `.protocol-family-card`, `.protocol-signature-rail`; also `scroll-snap-type`, `overflow-x:auto`, `aspect-ratio:9/16` (allow whitespace), `:focus-visible`, `min-width:0`, `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL on new CSS contract.

- [ ] **Step 3: Rewrite `protocolos/protocolos.css`**

Requirements: hero shorter on mobile while preserving three-room image; video/objective/signature rails horizontal with snap on mobile; family grid 1 column small, 2 tablet, up to 3 wide; no page-level overflow; `<summary>` minimum 44 px touch target; dark/gold signatures section; `object-fit:cover` only where intentional; reduced-motion disables nonessential smooth motion.

- [ ] **Step 4: Run site tests**

Run: `npm run test:site`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add protocolos/protocolos.css tests/site/protocolos-2.test.mjs
git commit -m "feat: add mobile-first Protocolos 2.0 layout"
```

---

### Task 4: Adicionar lazy-load progressivo dos vídeos

**Files:**
- Create: `protocolos/protocolos.js`
- Modify: `protocolos/index.html`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- `hydrateProtocolVideo(video: HTMLVideoElement): void` — copies child `<source data-src>` to `src`, removes `data-src`, calls `load()` once.
- `canAutoplayProtocolVideo(reducedMotion: boolean, video: HTMLVideoElement): boolean` — true only when motion is allowed and video is muted.
- `initProtocolVideos(root: Document | Element = document): void` — observes only `data-video-state="ready"`, hydrates near viewport, plays muted while visible and pauses when leaving.

- [ ] **Step 1: Add failing media-policy tests**

Now read `protocolos/protocolos.js` in the test. Assert HTML loads it with `type="module"`; ready videos have `muted`, `playsinline`, `preload="none"`, `poster` and `<source data-src>` instead of eager `src`; JS contains `IntersectionObserver`, `matchMedia('(prefers-reduced-motion: reduce)')`; no third-party carousel import.

- [ ] **Step 2: Run targeted test**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL because module is not implemented.

- [ ] **Step 3: Implement progressive enhancement**

Use the three signatures above. Observer root margin: `300px 0px`; visibility threshold approximately `0.4`. If `IntersectionObserver` is absent, hydrate ready videos but do not force autoplay. Pending cards are ignored. Keep native video controls on real videos for accessible sound/pause.

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
- Create if source is available: `assets/procedimentos/videos/botox.mp4`
- Create if source is available: `assets/procedimentos/posters/botox.webp`
- Modify: `protocolos/index.html`
- Modify: `assets/procedimentos/README.md`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Vídeo só vira `ready` quando o arquivo referenciado existe no repositório.
- Tema sem MP4 permanece `pending`, poster-only.

- [ ] **Step 1: Add media/copy regression assertions**

Use `existsSync` for every local file referenced by a ready video. Assert public HTML does not contain `garante`, `sem risco`, `resultado certo`, `definitivo`. Assert Biorremodelação explicitly distinguishes Skinbooster and Profhilo®; Firmeza explicitly says tecnologias têm indicações/atuações diferentes ou wording equivalente.

- [ ] **Step 2: Run and verify failures for bad references/copy**

Run: `node --test tests/site/protocolos-2.test.mjs`

Expected: FAIL if a ready path is absent or copy violates contract.

- [ ] **Step 3: Integrate approved Botox MP4 only if the exact approved source is available**

When available, optimize for web H.264 MP4, save as `assets/procedimentos/videos/botox.mp4`, create `assets/procedimentos/posters/botox.webp`, mark Botox `ready`, reference MP4 only via `<source data-src>`. If the approved source is unavailable in the execution environment, leave Botox `pending` with the confirmed catalogue poster; do not substitute another clinic video. The structural Protocolos 2.0 release remains valid because the approved spec permits poster-first topics.

- [ ] **Step 4: Update media conventions and copy**

Document `videos/` and `posters/` in `assets/procedimentos/README.md`, including `ready` only for approved existing files. Keep cards to 1–2 lines plus `<details>` and preserve individual indications.

- [ ] **Step 5: Run site tests**

Run: `npm run test:site`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add protocolos/index.html assets/procedimentos/README.md tests/site/protocolos-2.test.mjs
git add assets/procedimentos/videos/botox.mp4 assets/procedimentos/posters/botox.webp 2>/dev/null || true
git commit -m "feat: integrate approved Protocolos media and clinical copy"
```

---

### Task 6: Fechar SEO, documentação e aceitação

**Files:**
- Modify: `protocolos/index.html`
- Modify: `README.md`
- Test: `tests/site/protocolos-2.test.mjs`

**Interfaces:**
- Produces final public copy and README describing Protocolos 2.0 instead of the old 30-card presentation.

- [ ] **Step 1: Add final SEO/accessibility assertions**

Assert semantic text includes `toxina botulínica`, `bioestimulador`, `procedimentos faciais`, `procedimentos corporais`, `Belo Horizonte`, `avaliação`; every `<img>` inside the Protocolos main section has non-empty `alt`; every real `<video>` has `playsinline`; chips are anchors, not JS-only buttons.

- [ ] **Step 2: Update metadata and README**

Keep canonical. Refine title/description only if needed. In README, replace the old statement `catálogo de 30 procedimentos` with: 7 visual themes, compact families, `Assinaturas BC`, progressive media.

- [ ] **Step 3: Run complete regression suite**

Run: `npm test`

Expected: all frontend, site and BC Gestão tests PASS.

- [ ] **Step 4: Verify no-JS acceptance**

Serve statically and load `/protocolos/` with JavaScript disabled. Confirm hero, seven topic posters, six objective anchors, ten family cards/details, Assinaturas BC, disclaimer and CTA remain readable.

- [ ] **Step 5: Verify responsive acceptance**

Check 360 px, ~768 px and >=1280 px: no page-level horizontal overflow; rails scroll independently; first screen is shorter than old catalogue; details are tappable; menu/drawer/Agendar work; no layout jump from missing media.

- [ ] **Step 6: Commit**

```bash
git add protocolos/index.html README.md tests/site/protocolos-2.test.mjs
git commit -m "docs: finalize Protocolos 2.0 SEO and acceptance"
```

---

## Final Verification

- [ ] `npm test` PASS.
- [ ] Site CI PASS.
- [ ] No `ready` video references a missing file.
- [ ] No page-level horizontal overflow at 360 px.
- [ ] Seven visual themes + six objective chips present.
- [ ] Botox is one family, not three giant cards.
- [ ] Ten family cards preserve individual treatment distinctions via `<details>`.
- [ ] Eight `Assinaturas BC` entries present.
- [ ] `docs/catalogo-procedimentos-em-espera.md` preserved.
- [ ] Published `/protocolos/` keeps canonical, CTA, menu and WhatsApp working.
