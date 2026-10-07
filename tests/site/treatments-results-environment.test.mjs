import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const procedimentos = readFileSync(new URL('../../procedimentos/index.html', import.meta.url), 'utf8');
const resultados = readFileSync(new URL('../../resultados/index.html', import.meta.url), 'utf8');
const protocolos = readFileSync(new URL('../../protocolos/index.html', import.meta.url), 'utf8');
const ambiente = readFileSync(new URL('../../ambiente/index.html', import.meta.url), 'utf8');

function expectNativeShell(html) {
  assert.match(html, /<link[^>]+href="\.\.\/editorial\.css"/);
  assert.match(html, /class="[^"]*editorial-section/);
  assert.match(html, /class="[^"]*bc-cta-band/);
  const start = html.indexOf('<nav class="drawer-nav"');
  const end = html.indexOf('</nav>', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.equal((html.slice(start, end).match(/<a\b/g) || []).length, 11);
}

test('Procedimentos becomes an editorial treatment collection without provisional prices or embedded base64', () => {
  expectNativeShell(procedimentos);
  assert.match(procedimentos, /treatment-collection/);
  for (const name of [
    'Limpeza de pele', 'Drenagem Linfática', 'Massagem modeladora', 'Face Reset',
    'Gluteo Max', 'Sculpt Crio', 'Massagem relaxante', 'Ultrassom microfocado',
    'Botox', 'Preenchimento Labial', 'Perfiloplastia', 'Bioestimulador de Colágeno',
    'Black peel', 'Remoção a laser', 'Terapia Capilar', 'Estrias'
  ]) assert.match(procedimentos, new RegExp(name));
  assert.doesNotMatch(procedimentos, /data:image/i);
  assert.doesNotMatch(procedimentos, /R\$\s*\d/);
});

test('Resultados preserves the five real portfolio assets and adds individualized-results context', () => {
  expectNativeShell(resultados);
  for (const image of [
    'bc-cellular-code-1-sessao.webp', 'bc-cryo-lift-pescoco.webp', 'bc-harmonizacao-labial.webp',
    'bc-sculpt-cryo-abdomen-masculino.webp', 'bc-sculpt-cryo-cintura-feminina.webp'
  ]) assert.match(resultados, new RegExp(image.replace('.', '\\.')));
  assert.match(resultados, /resultados individuais podem variar/i);
});

test('Protocolos presents the documented authorial protocol names without publishing provisional prices', () => {
  expectNativeShell(protocolos);
  for (const name of [
    'Refine 3D', 'Reset Glow', 'Melasma OFF', 'ACNE OFF', 'Protocolo Mônaco',
    'Skin Reset', 'Face Reset', 'Fort Hair', 'Fort Hair Plus'
  ]) assert.match(protocolos, new RegExp(name));
  assert.match(protocolos, /Harmonização Invisível/);
  assert.doesNotMatch(protocolos, /R\$\s*\d/);
});

test('Ambiente preserves all four real clinic images in Native storytelling', () => {
  expectNativeShell(ambiente);
  for (const image of [
    '03-recepcao-bc-estetica.jpg', '04-sala-massagem.jpg',
    '05-sala-procedimentos.jpg', '06-sala-atendimento.jpg'
  ]) assert.match(ambiente, new RegExp(image.replace('.', '\\.')));
  assert.match(ambiente, /cinematic-frame/);
});
