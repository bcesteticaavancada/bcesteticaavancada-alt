import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html = readFileSync(new URL('../../protocolos/index.html', import.meta.url), 'utf8');
test('compact catalogue preserves every existing procedure anchor exactly once', () => {
  const ids = ['limpeza-de-pele','limpeza-de-pele-com-peeling','massagens','peeling','black-peel','despigmentacao','botox-terco-superior','botox-full-face','botox-nefertiti','skinbooster','bioestimulador-de-colageno','aplicacao-de-enzimas','profhilo','microagulhamento','ultrassom-microfocado','radiofrequencia-criofrequencia-fracionada','fort-hair','fort-hair-plus','fort-brow','sculpt-cryo','reset-glow','monaco-glow','skin-reset','face-reset','jato-de-plasma','harmonizacao-facial','lipo-de-papada','tratamento-para-estrias','tratamento-de-vasinhos','remocao-a-laser'];
  for (const id of ids) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
  assert.equal((html.match(/class="care-card"/g) || []).length, 11);
});
test('video is user-initiated and every local catalogue asset exists', () => {
  const videos = html.match(/<video\b[^>]*>/g) || [];
  assert.ok(videos.length >= 1 && videos.length <= 7);
  for (const video of videos) {
    assert.match(video, /controls/);
    assert.match(video, /preload="none"/);
    assert.doesNotMatch(video, /autoplay/);
  }
  assert.match(html, /Ler a explicação do vídeo/);
  for (const match of html.matchAll(/(?:src|poster)="(\.\.\/assets\/[^"?#]+)"/g)) {
    assert.ok(existsSync(new URL(`../../protocolos/${match[1]}`, import.meta.url)), match[1]);
  }
});
