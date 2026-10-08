import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../../index.html', import.meta.url);

test('mobile home moves only the hero eyebrow, title and description 10vh upward', async () => {
  const html = await readFile(indexUrl, 'utf8');

  assert.match(
    html,
    /@media\(max-width:700px\)[\s\S]*?\.home-hero \.hero-copy \.eyebrow,[\s\S]*?\.home-hero \.hero-copy h1,[\s\S]*?\.home-hero \.hero-copy p\s*\{[\s\S]*?transform:\s*translateY\(-10vh\)\s*!important;/i,
  );

  assert.doesNotMatch(
    html,
    /\.home-hero \.hero-actions\s*\{[^}]*translateY\(-10vh\)/is,
  );

  assert.doesNotMatch(
    html,
    /\.home-hero \.hero-treatment-link\s*\{[^}]*translateY\(-10vh\)/is,
  );
});
