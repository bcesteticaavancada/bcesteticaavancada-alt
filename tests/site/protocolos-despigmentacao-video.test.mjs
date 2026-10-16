import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pageUrl = new URL('../../protocolos/index.html', import.meta.url);
const html = readFileSync(pageUrl, 'utf8');

test('Despigmentacao is wired as the ready video for theme 06', () => {
  const match = html.match(/<article[^>]*data-protocol-video="despigmentacao"[\s\S]*?<\/article>/);
  assert.ok(match, 'missing despigmentacao video theme');
  const card = match[0];

  assert.match(card, /data-video-state="ready"/);
  assert.match(card, /<h3>Despigmenta(?:ç|c)ão<\/h3>/i);
  assert.match(card, /<video\b[^>]*poster="\.\.\/assets\/procedimentos\/catalogo\/06-despigmentacao\.webp"[^>]*muted[^>]*playsinline[^>]*preload="none"[^>]*controls/i);
  assert.match(card, /<source[^>]*data-src="\.\.\/assets\/procedimentos\/despigmentacao\.mp4"[^>]*type="video\/mp4"/i);
  assert.equal(existsSync(new URL('../../assets/procedimentos/despigmentacao.mp4', import.meta.url)), true);
});
