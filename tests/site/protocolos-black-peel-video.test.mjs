import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pageUrl = new URL('../../protocolos/index.html', import.meta.url);
const html = readFileSync(pageUrl, 'utf8');

test('Black Peel is wired as the ready video for theme 05', () => {
  const match = html.match(/<article[^>]*data-protocol-video="renovacao"[\s\S]*?<\/article>/);
  assert.ok(match, 'missing renovation video theme');
  const card = match[0];

  assert.match(card, /data-video-state="ready"/);
  assert.match(card, /<h3>Black Peel<\/h3>/i);
  assert.match(card, /<video\b[^>]*poster="\.\.\/assets\/procedimentos\/catalogo\/14-microagulhamento\.webp"[^>]*muted[^>]*playsinline[^>]*preload="none"[^>]*controls/i);
  assert.match(card, /<source[^>]*data-src="\.\.\/assets\/procedimentos\/black-peel\.mp4"[^>]*type="video\/mp4"/i);
  assert.equal(existsSync(new URL('../../assets/procedimentos/black-peel.mp4', import.meta.url)), true);
});
