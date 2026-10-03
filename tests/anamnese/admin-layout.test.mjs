import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../../admin/index.html', import.meta.url);
const cssPath = new URL('../../admin/admin.css', import.meta.url);

test('admin HTML exposes login shell but no hardcoded credentials or patient data', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="dashboard"[^>]*hidden/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /type="password"[^>]*value=/);
  assert.doesNotMatch(html, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(html, /Content-Security-Policy/);
});

test('admin CSS includes responsive mobile layout', async () => {
  const css = await readFile(cssPath, 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /record-card/);
});
