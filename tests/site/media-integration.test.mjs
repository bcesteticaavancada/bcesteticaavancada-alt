import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const equipe = readFileSync(new URL('../../equipe/index.html', import.meta.url), 'utf8');
const procedimentos = readFileSync(new URL('../../procedimentos/index.html', import.meta.url), 'utf8');
const ambiente = readFileSync(new URL('../../ambiente/index.html', import.meta.url), 'utf8');
const editorialCss = readFileSync(new URL('../../editorial.css', import.meta.url), 'utf8');

test('approved media assets exist on the Native branch', () => {
  for (const path of [
    '../../assets/alice-rocha.jpg',
    '../../assets/videos/bc-estetica-video-01.mp4',
    '../../assets/videos/bc-estetica-video-02.mp4',
    '../../assets/videos/bc-estetica-video-03.mp4',
    '../../assets/videos/bc-estetica-video-04.mp4',
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), true, path);
});

test('Home stays presentation-only and has no video element', () => {
  assert.doesNotMatch(home, /<video\b/i);
});

test('Alice profile uses the real approved portrait', () => {
  assert.match(equipe, /\.\.\/assets\/alice-rocha\.jpg/);
  assert.match(equipe, /Alice Rocha/);
  assert.match(equipe, /Biomédica Esteta/);
});

test('approved cinematic videos are used only on internal pages', () => {
  assert.match(ambiente, /\.\.\/assets\/videos\/bc-estetica-video-01\.mp4/);
  assert.match(procedimentos, /\.\.\/assets\/videos\/bc-estetica-video-02\.mp4/);
  assert.match(procedimentos, /\.\.\/assets\/videos\/bc-estetica-video-03\.mp4/);
  assert.match(procedimentos, /\.\.\/assets\/videos\/bc-estetica-video-04\.mp4/);
  const combined = `${home}\n${equipe}\n${procedimentos}\n${ambiente}`;
  assert.doesNotMatch(combined, /WA0045|Aline esteticista/i);
});

test('cinematic video component is responsive, lazy and respects reduced-motion', () => {
  assert.match(editorialCss, /\.cinematic-video/);
  assert.match(editorialCss, /\.cinematic-video\s+video/);
  assert.match(editorialCss, /prefers-reduced-motion/);
  assert.match(procedimentos, /preload="none"/);
  assert.match(procedimentos, /data-bc-cinematic/);
  assert.match(procedimentos, /IntersectionObserver/);
  assert.match(ambiente, /preload="none"/);
  assert.match(ambiente, /data-bc-cinematic/);
});
