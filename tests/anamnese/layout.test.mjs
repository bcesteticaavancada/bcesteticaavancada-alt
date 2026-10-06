import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../agendamento/index.html', import.meta.url);
const cssUrl = new URL('../../agendamento/anamnese.css', import.meta.url);

test('pre-anamnesis markup exposes exactly eight conceptual steps', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  const matches = html.match(/data-step="\d"/g) || [];
  assert.equal(matches.length, 8);
  assert.match(html, /id="step1"/);
  assert.match(html, /id="step8"/);
});

test('pre-anamnesis markup loads modular CSS and JS', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  assert.match(html, /href="\.\/anamnese\.css"/);
  assert.match(html, /src="\.\/js\/main\.js"/);
});

test('pre-anamnesis keeps branded hero, shell and progress landmarks', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  assert.match(html, /class="agendamento-hero"/);
  assert.match(html, /class="shell"/);
  assert.match(html, /class="bar"/);
  assert.match(html, /class="track"/);
  assert.match(html, /id="stage"/);
  assert.match(html, /id="track"/);
});

test('pre-anamnesis CSS defines fluid premium container and mobile grid collapse', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.shell\{[^}]*max-width:\s*980px/i);
  assert.match(css, /@media\(max-width:700px\)/i);
  assert.match(css, /\.grid,.options,.checkgrid\{grid-template-columns:1fr\}/i);
  assert.match(css, /min-width:\s*0/i);
  assert.match(css, /overflow-wrap:\s*anywhere/i);
});

test('pre-anamnesis CSS provides keyboard focus and reduced-motion treatment', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /:focus-visible/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/i);
  assert.match(css, /outline:/i);
});

test('interactive states remain visibly distinct without relying on color alone', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.opt input:checked\+label,.check input:checked\+label\{[^}]*box-shadow:/i);
  assert.match(css, /\.conditional,.module-block\{[^}]*border-left:/i);
  assert.match(css, /\.status-message\.error\{[^}]*border:/i);
  assert.match(css, /\.status-message\.success\{[^}]*border:/i);
  assert.match(css, /\.consent:has\(input:checked\)/i);
  assert.match(css, /\.signature-wrap:focus-within/i);
});
