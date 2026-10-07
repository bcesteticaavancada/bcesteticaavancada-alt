import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const equipe = readFileSync(new URL('../../equipe/index.html', import.meta.url), 'utf8');
const mel = readFileSync(new URL('../../mel/index.html', import.meta.url), 'utf8');

function expectEditorialPage(html) {
  assert.match(html, /<link[^>]+href="\.\.\/editorial\.css"/);
  for (const className of ['editorial-section', 'editorial-split', 'cinematic-frame', 'editorial-quote', 'bc-cta-band']) {
    assert.match(html, new RegExp(`class="[^"]*\\b${className}\\b`), `missing ${className}`);
  }
  const start = html.indexOf('<nav class="drawer-nav"');
  const end = html.indexOf('</nav>', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.equal((html.slice(start, end).match(/<a\b/g) || []).length, 11);
}

test('Nossa Equipe uses Native editorial structure and verified professional data', () => {
  expectEditorialPage(equipe);
  assert.match(equipe, /Maria Luisa Franco de Assis/);
  assert.match(equipe, /00544/);
  assert.match(equipe, /Alice Izabel Rocha/);
  assert.match(equipe, /19272/);
  assert.match(equipe, /Cosmetologia e Estética \+ Biomedicina/);
  assert.match(equipe, /alice-rocha\.jpg/);
});

test('Mel page uses Native editorial structure and documented positioning', () => {
  expectEditorialPage(mel);
  assert.match(mel, /Maria Luisa Franco de Assis/);
  assert.match(mel, /aproximadamente 10 anos/);
  assert.match(mel, /00544/);
  assert.match(mel, /Harmonização Invisível/);
  assert.match(mel, /identidade/);
  assert.match(mel, /01-mel-perfil\.jpg/);
});
