import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scriptUrl = new URL('../../script.js', import.meta.url);

test('mobile home pushes the hero artwork right and the header group five percent left', async () => {
  const script = await readFile(scriptUrl, 'utf8');

  assert.match(script, /bc-home-mobile-position-fix/i);
  assert.match(
    script,
    /\.site-header\s+\.header-inner\s*\{[^}]*transform:\s*translateX\(-5vw\)\s*!important/is,
  );
  assert.match(
    script,
    /\.home-hero\s+\.hero-team-image\s*\{[^}]*left:\s*100%\s*!important/is,
  );
  assert.match(
    script,
    /\.home-hero\s+\.hero-team-image\s*\{[^}]*transform:\s*translateX\(-50%\)\s*!important/is,
  );
});
