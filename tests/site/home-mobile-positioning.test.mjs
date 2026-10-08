import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../../home-team-hero.css', import.meta.url);
const scriptUrl = new URL('../../script.js', import.meta.url);

test('mobile home uses a full-bleed hero image and keeps the header group five percent left', async () => {
  const [css, script] = await Promise.all([
    readFile(cssUrl, 'utf8'),
    readFile(scriptUrl, 'utf8'),
  ]);

  assert.match(
    css,
    /@media\(max-width:700px\)[\s\S]*?\.site-header\s+\.header-inner\s*\{[^}]*transform:\s*translateX\(-5vw\)/i,
  );
  assert.match(
    css,
    /@media\(max-width:700px\)[\s\S]*?\.hero-team-wrap\s*\{[^}]*inset:\s*0/i,
  );
  assert.match(
    css,
    /@media\(max-width:700px\)[\s\S]*?\.hero-team-image\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*cover[^}]*object-position:\s*74%\s+center[^}]*transform:\s*none/i,
  );
  assert.doesNotMatch(script, /bc-home-mobile-position-fix/i);
  assert.doesNotMatch(script, /left:\s*100%\s*!important/i);
});
