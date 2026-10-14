import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pageUrl = new URL('../../protocolos/index.html', import.meta.url);
const cssUrl = new URL('../../protocolos/protocolos.css', import.meta.url);
const jsUrl = new URL('../../protocolos/protocolos.js', import.meta.url);
const html = readFileSync(pageUrl, 'utf8');
const css = readFileSync(cssUrl, 'utf8');
const js = existsSync(jsUrl) ? readFileSync(jsUrl, 'utf8') : '';

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
