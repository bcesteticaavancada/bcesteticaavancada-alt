import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pageUrl = new URL('../../protocolos/index.html', import.meta.url);
const cssUrl = new URL('../../protocolos/protocolos.css', import.meta.url);
const html = readFileSync(pageUrl, 'utf8');
const css = readFileSync(cssUrl, 'utf8');

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
    assert.match(html, new RegExp(`<article[^>]*id="${id}"[^>]*class="[^"]*protocol-family-card[^"]*"|<article[^>]*class="[^"]*protocol-family-card[^"]*"[^>]*id="${id}"`));
  }
});

test('Assinaturas BC keeps all eight authorial protocols', () => {
  assert.match(html, /Assinaturas BC/i);
  for (const name of ['Fort Hair', 'Fort Hair Plus', 'Fort Brow', 'Sculpt Cryo', 'Reset Glow', 'Monaco Glow', 'Skin Reset', 'Face Reset']) {
    assert.match(html, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('legacy page has not already implemented the 2.0 CSS contract', () => {
  assert.match(css, /\.protocol-video-rail/);
});
