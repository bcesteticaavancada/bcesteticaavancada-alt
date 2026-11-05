import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the installed app uses the official domain root for identity, navigation and scope', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../manifest.webmanifest', import.meta.url), 'utf8'));
  const manifestURL = 'https://www.bcesteticaavancada.com.br/manifest.webmanifest';
  const start = new URL(manifest.start_url, manifestURL);
  // Manifest IDs resolve against start_url's origin, unlike navigation URLs.
  const id = manifest.id ? new URL(manifest.id, start.origin) : start;
  assert.equal(id.href, 'https://www.bcesteticaavancada.com.br/');
  assert.equal(start.href, 'https://www.bcesteticaavancada.com.br/');
  assert.equal(new URL(manifest.scope, manifestURL).href, start.href);
});
