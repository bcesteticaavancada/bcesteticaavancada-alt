import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../agendamento/index.html', import.meta.url);

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
