import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pageUrl = new URL('../../protocolos/index.html', import.meta.url);
const cssUrl = new URL('../../protocolos/protocolos.css', import.meta.url);
const jsUrl = new URL('../../protocolos/protocolos.js', import.meta.url);
const mediaReadmeUrl = new URL('../../assets/procedimentos/README.md', import.meta.url);
const rootReadmeUrl = new URL('../../README.md', import.meta.url);
const workflowUrl = new URL('../../.github/workflows/site-ci.yml', import.meta.url);
const html = readFileSync(pageUrl, 'utf8');
const css = readFileSync(cssUrl, 'utf8');
const js = existsSync(jsUrl) ? readFileSync(jsUrl, 'utf8') : '';
const mediaReadme = readFileSync(mediaReadmeUrl, 'utf8');
const rootReadme = readFileSync(rootReadmeUrl, 'utf8');
const workflow = readFileSync(workflowUrl, 'utf8');

const canonical = 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/protocolos/';
const videoSlugs = [
  'botox',
  'harmonizacao',
  'bioestimulador',
  'biorremodelacao',
  'renovacao',
  'firmeza',
  'contorno-corporal',
];
const familyIds = [
  'toxina-botulinica',
  'limpeza-renovacao',
  'hidratacao-qualidade',
  'colageno-textura',
  'harmonizacao-facial',
  'tecnologias-firmeza',
  'contorno-corporal',
  'massagens-bem-estar',
  'capilar-sobrancelhas',
  'cuidados-especificos',
];

function countMatches(text, re) {
  return (text.match(re) || []).length;
}

function articleById(id) {
  const match = html.match(new RegExp(`<article[^>]*id="${id}"[\\s\\S]*?<\\/article>`));
  assert.ok(match, `missing article #${id}`);
  return match[0];
}

test('Protocolos 2.0 keeps canonical, shell actions and reference catalogue', () => {
  assert.match(html, new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /href="\.\.\/agendamento\/"[^>]*>Agendar/i);
  assert.match(html, /https:\/\/wa\.me\/5531995184110/);
  assert.equal(existsSync(new URL('../../docs/catalogo-procedimentos-em-espera.md', import.meta.url)), true);
});

test('Protocolos 2.0 exposes exactly seven approved visual themes in order', () => {
  assert.equal(countMatches(html, /data-protocol-video=/g), 7);
  let last = -1;
  for (const slug of videoSlugs) {
    const index = html.indexOf(`data-protocol-video="${slug}"`);
    assert.ok(index > last, `${slug} should exist in the approved order`);
    last = index;
  }
});

test('Protocolos 2.0 exposes six objective chips', () => {
  assert.equal(countMatches(html, /class="[^"]*protocol-objective-chip[^"]*"/g), 6);
  for (const target of ['rosto', 'pele', 'colageno', 'corpo', 'capilar', 'bem-estar']) {
    assert.match(html, new RegExp(`class="[^"]*protocol-objective-chip[^"]*"[^>]*href="#${target}"|href="#${target}"[^>]*class="[^"]*protocol-objective-chip[^"]*"`));
  }
});

test('Protocolos 2.0 exposes ten compact treatment families', () => {
  assert.equal(countMatches(html, /class="[^"]*protocol-family-card[^"]*"/g), 10);
  for (const id of familyIds) {
    const article = articleById(id);
    assert.match(article, /class="[^"]*protocol-family-card[^"]*"/);
    assert.match(article, /<details\b/);
    assert.match(article, /<summary\b/);
  }
  assert.match(html, /conforme avaliação/i);
});

test('pending video themes use poster images without nonexistent eager sources', () => {
  const pending = [...html.matchAll(/<article[^>]*data-video-state="pending"[\s\S]*?<\/article>/g)].map((match) => match[0]);
  assert.ok(pending.length >= 1, 'at least one theme should remain pending until approved media exists');
  for (const card of pending) {
    assert.match(card, /<img\b[^>]*>/i);
    assert.doesNotMatch(card, /<source\b[^>]*\ssrc=/i);
  }
});

test('ready video themes can only reference files that exist in the repository', () => {
  const readyCards = [...html.matchAll(/<article[^>]*data-video-state="ready"[\s\S]*?<\/article>/g)].map((match) => match[0]);
  for (const card of readyCards) {
    const sources = [...card.matchAll(/<source[^>]*data-src="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(sources.length >= 1, 'ready card must expose a lazy source');
    for (const source of sources) {
      assert.match(source, /^\.\.\/assets\//);
      assert.equal(existsSync(new URL(source.replace(/^\.\.\//, '../../'), import.meta.url)), true, source);
    }
  }
});

test('approved Botox media is wired as the first ready video theme', () => {
  const match = html.match(/<article[^>]*data-protocol-video="botox"[\s\S]*?<\/article>/);
  assert.ok(match, 'missing Botox video theme');
  const card = match[0];
  assert.match(card, /data-video-state="ready"/);
  assert.match(card, /<video\b[^>]*poster="\.\.\/assets\/procedimentos\/botox\.webp"[^>]*muted[^>]*playsinline[^>]*preload="none"/i);
  assert.match(card, /<source[^>]*data-src="\.\.\/assets\/procedimentos\/botox\.mp4"[^>]*type="video\/mp4"/i);
  assert.equal(existsSync(new URL('../../assets/procedimentos/botox.mp4', import.meta.url)), true);
  assert.equal(existsSync(new URL('../../assets/procedimentos/botox.webp', import.meta.url)), true);
});

test('family images below the hero lazy-load', () => {
  for (const id of familyIds) {
    const article = articleById(id);
    assert.match(article, /<img\b[^>]*loading="lazy"/i);
  }
});

test('Assinaturas BC keeps all eight authorial protocols', () => {
  assert.match(html, /Assinaturas(?:\s|<[^>]+>)*BC/i);
  for (const name of ['Fort Hair', 'Fort Hair Plus', 'Fort Brow', 'Sculpt Cryo', 'Reset Glow', 'Monaco Glow', 'Skin Reset', 'Face Reset']) {
    assert.match(html, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('Protocolos 2.0 CSS provides responsive rails, compact cards and motion safety', () => {
  for (const selector of [
    '.protocol-video-rail',
    '.protocol-video-card',
    '.protocol-objective-nav',
    '.protocol-family-grid',
    '.protocol-family-card',
    '.protocol-signature-rail',
  ]) assert.match(css, new RegExp(selector.replace('.', '\\.')));

  assert.match(css, /scroll-snap-type\s*:/i);
  assert.match(css, /overflow-x\s*:\s*auto/i);
  assert.match(css, /aspect-ratio\s*:\s*9\s*\/\s*16/i);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-width\s*:\s*0/i);
  assert.match(css, /@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce[^)]*\)/i);
});

test('Protocolos video module progressively hydrates only approved ready media', () => {
  assert.equal(existsSync(jsUrl), true, 'protocolos.js should exist');
  assert.match(html, /<script[^>]*type="module"[^>]*src="protocolos\.js"|<script[^>]*src="protocolos\.js"[^>]*type="module"/i);
  assert.match(js, /export function hydrateProtocolVideo/);
  assert.match(js, /export function canAutoplayProtocolVideo/);
  assert.match(js, /export function initProtocolVideos/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(js, /from\s+['"][^.'"]/i);
});

test('public copy stays client-facing and clinically prudent', () => {
  assert.doesNotMatch(html, /\b(garante|sem risco|resultado certo|definitivo)\b/i);
  assert.doesNotMatch(html, /os vídeos entram|mídia de cada tema é aprovada/i);
  assert.match(html, /Não é o mesmo procedimento que Skinbooster/i);
  assert.match(html, /mecanismos e indicações diferentes/i);
});

test('procedure media library documents ready and pending policy', () => {
  assert.match(mediaReadme, /videos\//i);
  assert.match(mediaReadme, /posters\//i);
  assert.match(mediaReadme, /data-video-state/i);
  assert.match(mediaReadme, /ready/i);
  assert.match(mediaReadme, /pending/i);
});

test('Protocolos keeps semantic SEO text and accessible media', () => {
  for (const term of ['toxina botulínica', 'bioestimulador', 'faciais', 'corporais', 'Belo Horizonte', 'avaliação']) {
    assert.match(html, new RegExp(term, 'i'));
  }

  const mainMatch = html.match(/<main\b[\s\S]*?<\/main>/i);
  assert.ok(mainMatch, 'main content must exist');
  const images = [...mainMatch[0].matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  assert.ok(images.length > 0);
  for (const image of images) assert.match(image, /\balt="[^"]+"/i);

  const videos = [...mainMatch[0].matchAll(/<video\b[^>]*>/gi)].map((match) => match[0]);
  for (const video of videos) assert.match(video, /\bplaysinline\b/i);
});

test('project documentation describes Protocolos 2.0 instead of the old 30-card catalogue', () => {
  assert.match(rootReadme, /Protocolos 2\.0/i);
  assert.match(rootReadme, /7 temas/i);
  assert.match(rootReadme, /Assinaturas BC/i);
  assert.doesNotMatch(rootReadme, /catálogo de 30 procedimentos/i);
});

test('Site CI watches page-specific JavaScript modules', () => {
  assert.match(workflow, /['"]\*\*\/\*\.js['"]/);
});
