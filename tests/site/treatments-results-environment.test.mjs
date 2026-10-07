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

test('Procedimentos publica apenas apresentações com mídia real enquanto o catálogo textual fica fora da página pública', () => {
  expectNativeShell(procedimentos);
  assert.doesNotMatch(procedimentos, /class="treatment-collection/);
  assert.doesNotMatch(procedimentos, /class="treatment-entry/);
  assert.equal((procedimentos.match(/<video\b/g) || []).length, 4);
  for (const video of [
    'bc-estetica-video-02.mp4',
    'bc-estetica-video-04.mp4',
    'bc-estetica-video-03.mp4',
    'BC-Estetica-Apresentacao-Glamourosa-Mobile-WEB.mp4'
  ]) assert.match(procedimentos, new RegExp(video.replace('.', '\\.')));
  assert.match(procedimentos, /class="laser-showcase"/);
  assert.match(procedimentos, /autoplay[^>]*muted[^>]*loop[^>]*playsinline/);
  assert.doesNotMatch(procedimentos, /data:image/i);
  assert.doesNotMatch(procedimentos, /R\$\s*\d/);
});

test('Resultados preserves the five real portfolio assets inside a numbered editorial casebook', () => {
  expectNativeShell(resultados);
  for (const image of [
    'bc-cellular-code-1-sessao.webp', 'bc-cryo-lift-pescoco.webp', 'bc-harmonizacao-labial.webp',
    'bc-sculpt-cryo-abdomen-masculino.webp', 'bc-sculpt-cryo-cintura-feminina.webp'
  ]) assert.match(resultados, new RegExp(image.replace('.', '\\.')));
  assert.match(resultados, /resultados individuais podem variar/i);
  assert.match(resultados, /class="results-casebook"/);
  assert.equal((resultados.match(/class="result-case\b/g) || []).length, 5);
  assert.match(resultados, /class="result-case result-case--hero"/);
  assert.match(resultados, /class="result-case__index">01<\/span>/);
  assert.match(resultados, /class="result-case__index">05<\/span>/);
  assert.match(resultados, /class="[^"]*\bresults-context\b[^"]*"/);
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
