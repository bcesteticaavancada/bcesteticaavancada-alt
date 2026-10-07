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
    '../../assets/video/clinical-detail.mp4',
    '../../assets/video/wellbeing-massage.mp4',
    '../../assets/video/body-care.mp4',
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

test('approved cinematic loops are used only on internal pages', () => {
  assert.match(procedimentos, /\.\.\/assets\/video\/clinical-detail\.mp4/);
  assert.match(procedimentos, /\.\.\/assets\/video\/body-care\.mp4/);
  assert.match(ambiente, /\.\.\/assets\/video\/wellbeing-massage\.mp4/);
  const combined = `${home}\n${equipe}\n${procedimentos}\n${ambiente}`;
  assert.doesNotMatch(combined, /WA0045|Aline esteticista/i);
});

test('cinematic video component is responsive and respects reduced-motion', () => {
  assert.match(editorialCss, /\.cinematic-video/);
  assert.match(editorialCss, /\.cinematic-video\s+video/);
  assert.match(editorialCss, /prefers-reduced-motion/);
});
