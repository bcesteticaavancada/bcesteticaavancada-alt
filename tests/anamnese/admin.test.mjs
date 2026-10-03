import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListUrl,
  signIn,
  loadPreAnamneses,
  updateStatus,
  getPdfSignedUrl,
} from '../../admin/admin.js';

const cfg = { url: 'https://project.supabase.co', key: 'pub' };
const session = { accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 3600000, user: { id: 'user-1', email: 'admin@example.com' } };

test('buildListUrl keeps order and encodes admin filters', () => {
  const url = buildListUrl({ publicCode: 'BC-2026', patientName: 'Maria Silva', from: '2026-10-01', to: '2026-10-03' }, cfg);
  assert.match(url, /order=created_at\.desc/);
  assert.match(url, /public_code=ilike\.\*BC-2026\*/);
  assert.match(url, /patient_name=ilike\.\*Maria\+Silva\*/);
  assert.match(url, /created_at=gte\.2026-10-01T03%3A00%3A00\.000Z/);
});

test('signIn normalizes Supabase password token response', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u', email: 'a@b.com' } }) });
  const result = await signIn('a@b.com', 'secret', fetchImpl, cfg, () => 1000);
  assert.deepEqual(result, { accessToken: 'a', refreshToken: 'r', expiresAt: 3601000, user: { id: 'u', email: 'a@b.com' } });
});

test('loadPreAnamneses sends bearer token and returns rows', async () => {
  let auth = '';
  const fetchImpl = async (_url, options) => { auth = options.headers.Authorization; return { ok: true, status: 200, json: async () => [{ id: '1' }] }; };
  const rows = await loadPreAnamneses(session, {}, fetchImpl, cfg);
  assert.equal(auth, 'Bearer token');
  assert.deepEqual(rows, [{ id: '1' }]);
});

test('updateStatus rejects unknown status before request', async () => {
  let calls = 0;
  await assert.rejects(() => updateStatus(session, 'id', 'apagada', async () => { calls += 1; }, cfg), /Status inválido/);
  assert.equal(calls, 0);
});

test('getPdfSignedUrl returns temporary signed URL from private bucket', async () => {
  let called = '';
  const fetchImpl = async (url) => { called = url; return { ok: true, status: 200, json: async () => ({ signedURL: '/storage/v1/object/sign/pre-anamnese-pdfs/2026/10/f.pdf?token=x' }) }; };
  const url = await getPdfSignedUrl(session, '2026/10/f.pdf', fetchImpl, cfg);
  assert.equal(url, 'https://project.supabase.co/storage/v1/object/sign/pre-anamnese-pdfs/2026/10/f.pdf?token=x');
  assert.match(called, /pre-anamnese-pdfs\/2026\/10\/f\.pdf$/);
});
