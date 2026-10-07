import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../clinica/index.html', import.meta.url), 'utf8');

function navBlock(source) {
  const start = source.indexOf('<nav class="drawer-nav"');
  const end = source.indexOf('</nav>', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('A Clinica loads the isolated editorial module', () => {
  assert.match(html, /<link[^>]+href="\.\.\/editorial\.css"/);
});

test('A Clinica uses the Native editorial storytelling primitives', () => {
  for (const className of ['editorial-section', 'editorial-split', 'cinematic-frame', 'editorial-quote', 'bc-cta-band']) {
    assert.match(html, new RegExp(`class="[^"]*\\b${className}\\b`), `missing ${className}`);
  }
});

test('A Clinica preserves official identity and location facts', () => {
  assert.match(html, /Beleza &amp; Companhia Estética Avançada/);
  assert.match(html, />2025</);
  assert.match(html, /Rua Gávea, 358/);
  assert.match(html, /Nova Suissa/);
  assert.match(html, /Terça a sábado, 09h às 18h/);
  assert.match(html, /Menos achismo\. Mais ciência\./);
});

test('A Clinica keeps all four real environment images', () => {
  for (const image of [
    '03-recepcao-bc-estetica.jpg',
    '04-sala-massagem.jpg',
    '05-sala-procedimentos.jpg',
    '06-sala-atendimento.jpg',
  ]) {
    assert.match(html, new RegExp(image.replace('.', '\\.')));
  }
});

test('A Clinica keeps the eleven-item navigation shell', () => {
  const nav = navBlock(html);
  assert.equal((nav.match(/<a\b/g) || []).length, 11);
});
