import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scriptUrl = new URL('../../script.js', import.meta.url);

test('mobile Home keeps the approved framing and uses the softer luxury image treatment', async () => {
  const script = await readFile(scriptUrl, 'utf8');

  assert.match(script, /object-position:\s*74%\s+center\s*!important/i);
  assert.match(
    script,
    /filter:\s*brightness\(1\.08\)\s+contrast\(1\.03\)\s+saturate\(1\.02\)\s*!important/i,
  );
  assert.match(
    script,
    /linear-gradient\(90deg,rgba\(6,4,3,\.32\)\s+0%,rgba\(9,6,4,\.20\)\s+31%,rgba\(10,7,5,\.10\)\s+52%,rgba\(10,7,5,\.02\)\s+80%\)/i,
  );
  assert.match(script, /translateY\(15vh\)\s*!important/i);
});
