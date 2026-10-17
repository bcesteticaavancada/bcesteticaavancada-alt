import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const page = new URL('../../protocolos/index.html', import.meta.url);
const html = readFileSync(page, 'utf8');
test('Black Peel has a selectable final video and its own matching poster', () => {
  const tag = html.match(/<a[^>]*data-protocol-video="black-peel"[^>]*>/)?.[0];
  assert.ok(tag);
  assert.match(tag, /href="\.\.\/assets\/procedimentos\/black-peel\.mp4"/);
  assert.match(tag, /data-poster="\.\.\/assets\/procedimentos\/black-peel\.webp"/);
  assert.equal(existsSync(new URL('../../assets/procedimentos/black-peel.mp4', import.meta.url)), true);
});
