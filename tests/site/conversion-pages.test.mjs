import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const valores = readFileSync(new URL('../../valores/index.html', import.meta.url), 'utf8');
const agendamento = readFileSync(new URL('../../agendamento/index.html', import.meta.url), 'utf8');
const agendamentoCss = readFileSync(new URL('../../agendamento/anamnese.css', import.meta.url), 'utf8');
const contato = readFileSync(new URL('../../contato/index.html', import.meta.url), 'utf8');

function expectElevenLinks(html) {
  const start = html.indexOf('<nav class="drawer-nav"');
  const end = html.indexOf('</nav>', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.equal((html.slice(start, end).match(/<a\b/g) || []).length, 11);
}

test('Valores uses the Native editorial system without publishing provisional prices', () => {
  expectElevenLinks(valores);
  assert.match(valores, /href="\.\.\/editorial\.css"/);
  assert.match(valores, /editorial-section/);
  assert.match(valores, /bc-cta-band/);
  assert.doesNotMatch(valores, /R\$\s*\d/);
  assert.match(valores, /valor atualizado/i);
});

test('Contato presents the official contact, address, hours and GPS in Native layout', () => {
  expectElevenLinks(contato);
  assert.match(contato, /href="\.\.\/editorial\.css"/);
  assert.match(contato, /bc-cta-band/);
  assert.match(contato, /\(31\) 99518-4110/);
  assert.match(contato, /bcesteticaav@gmail\.com/);
  assert.match(contato, /Rua Gávea, 358/);
  assert.match(contato, /Nova Suissa/);
  assert.match(contato, /Terça a sábado, 09h às 18h/);
  assert.match(contato, /share\.google\/eh2hDmG6O5gNHK10i/);
});

test('Agendamento keeps the complete pre-anamnese flow and current accessibility refinements', () => {
  expectElevenLinks(agendamento);
  assert.match(agendamento, /id="preAnamneseForm"/);
  for (let i = 1; i <= 8; i++) assert.match(agendamento, new RegExp(`id="step${i}"`));
  assert.match(agendamento, /id="signatureMount"/);
  assert.match(agendamento, /FINALIZAR E GERAR PDF/i);
  assert.match(agendamentoCss, /\.agendamento-hero/);
  assert.match(agendamentoCss, /\.signature-wrap/);
  assert.match(agendamentoCss, /min-width:\s*0/i);
  assert.match(agendamentoCss, /:focus-visible/i);
  assert.match(agendamentoCss, /prefers-reduced-motion/i);
  assert.match(agendamentoCss, /\.conditional,.module-block\{[^}]*border-left:3px solid var\(--gold\)/i);
});
