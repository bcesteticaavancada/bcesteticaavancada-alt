import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const html = readFileSync(new URL('../../protocolos/index.html', import.meta.url), 'utf8');
test('Despigmentação has a selectable final video and its own matching poster', () => {
  const tag = html.match(/<a[^>]*data-protocol-video="despigmentacao"[^>]*>/)?.[0];
  assert.ok(tag);
  assert.match(tag, /href="\.\.\/assets\/procedimentos\/despigmentacao\.mp4"/);
  assert.match(tag, /data-poster="\.\.\/assets\/procedimentos\/despigmentacao\.webp"/);
  assert.equal(existsSync(new URL('../../assets/procedimentos/despigmentacao.mp4', import.meta.url)), true);
});
