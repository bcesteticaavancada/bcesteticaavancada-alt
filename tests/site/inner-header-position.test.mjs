import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scriptUrl = new URL('../../script.js', import.meta.url);

test('internal pages move the whole header group 10vw left without affecting the home page', async () => {
  const script = await readFile(scriptUrl, 'utf8');

  assert.match(script, /function\s+installInnerPageHeaderOffset\s*\(/);
  assert.match(script, /if\s*\(document\.querySelector\("\.home-editorial"\)\)\s*return\s*;/);
  assert.match(script, /\.site-header\s+\.header-inner\s*\{[^}]*transform:\s*translateX\(-10vw\)\s*!important/is);
});
