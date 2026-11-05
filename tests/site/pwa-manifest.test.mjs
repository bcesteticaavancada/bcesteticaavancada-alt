import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const base of [
  'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/',
  'https://www.bcesteticaavancada.com.br/',
  'https://bcesteticaavancada.com.br/',
]) test(`installed app identity, shortcuts and assets resolve in their own base: ${base}`, () => {
  const manifest = JSON.parse(readFileSync(new URL('../../manifest.webmanifest', import.meta.url), 'utf8'));
  const manifestURL = base + 'manifest.webmanifest';
  const start = new URL(manifest.start_url, manifestURL);
  // Manifest IDs resolve against start_url's origin, unlike navigation URLs.
  const id = manifest.id ? new URL(manifest.id, start.origin) : start;
  assert.equal(id.href, base);
  assert.equal(start.href, base);
  assert.equal(new URL(manifest.scope, manifestURL).href, start.href);
  assert.deepEqual(manifest.shortcuts.map(item => new URL(item.url, manifestURL).href), [
    base + 'gestao/login/', base + 'procedimentos/', base + 'contato/',
  ]);
  for (const icon of manifest.icons) assert.ok(new URL(icon.src, manifestURL).href.startsWith(base + 'assets/app/'));
});
