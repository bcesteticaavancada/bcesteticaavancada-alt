import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shellStyles = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const editorial = readFileSync(new URL('../../editorial.css', import.meta.url), 'utf8');

const requiredClasses = [
  'editorial-section',
  'editorial-split',
  'editorial-portrait',
  'cinematic-frame',
  'cinematic-copy',
  'editorial-quote',
  'treatment-collection',
  'treatment-entry',
  'bc-cta-band',
];

test('shared editorial luxury component classes exist', () => {
  for (const name of requiredClasses) {
    assert.match(editorial, new RegExp(`\\.${name}\\b`), `missing .${name}`);
  }
});

test('cinematic media preserves portrait aspect ratio', () => {
  assert.match(editorial, /\.cinematic-frame\s*\{[^}]*aspect-ratio\s*:\s*9\s*\/\s*16/s);
});

test('editorial layouts collapse safely on mobile', () => {
  assert.match(editorial, /@media\s*\(max-width:\s*800px\)[\s\S]*?\.editorial-split[^}]*grid-template-columns\s*:\s*1fr/);
  assert.match(editorial, /@media\s*\(max-width:\s*520px\)/);
});

test('motion accessibility and header coordinate contract remain intact', () => {
  assert.match(shellStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(shellStyles, /\.menu-toggle\s*\{[^}]*justify-self\s*:\s*end/s);
  assert.match(shellStyles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.header-inner\s*\{[^}]*grid-template-columns\s*:\s*86px\s+1fr\s+48px/s);
});

test('editorial controls have keyboard-visible focus styles', () => {
  assert.match(editorial, /:focus-visible/);
});
