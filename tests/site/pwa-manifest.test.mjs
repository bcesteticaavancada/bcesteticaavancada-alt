import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the installed app retains the GitHub Pages project identity instead of claiming the account root', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../manifest.webmanifest', import.meta.url), 'utf8'));
  const manifestURL = 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/manifest.webmanifest';
  const start = new URL(manifest.start_url, manifestURL);
  // Manifest IDs resolve against start_url's origin, unlike navigation URLs.
  const id = manifest.id ? new URL(manifest.id, start.origin) : start;
  assert.equal(id.href, 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/');
  assert.equal(start.href, 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/');
  assert.equal(new URL(manifest.scope, manifestURL).href, start.href);
});
