import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scriptUrl = new URL('../../script.js', import.meta.url);

test('mobile home uses a full-bleed hero image and keeps the header group five percent left', async () => {
  const script = await readFile(scriptUrl, 'utf8');

  assert.match(script, /bc-home-hero-fullbleed-fix/i);
  assert.match(
    script,
    /\.site-header\s+\.header-inner\s*\{[^}]*transform:\s*translateX\(-5vw\)\s*!important/is,
  );
  assert.match(
    script,
    /\.home-hero\s+\.hero-team-wrap\s*\{[^}]*inset:\s*0\s*!important[^}]*width:\s*100%\s*!important[^}]*height:\s*100%\s*!important/is,
  );
  assert.match(
    script,
    /\.home-hero\s+\.hero-team-image\s*\{[^}]*inset:\s*0\s*!important[^}]*width:\s*100%\s*!important[^}]*height:\s*100%\s*!important[^}]*object-fit:\s*cover\s*!important[^}]*object-position:\s*74%\s+center\s*!important[^}]*transform:\s*none\s*!important/is,
  );
  assert.doesNotMatch(script, /left:\s*100%\s*!important/i);
});
