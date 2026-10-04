import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isAuthorizedAdmin,
  normalizeAdminFilters,
  sanitizeStatus,
  buildAdminQueryDescriptor,
  formatAdminCpf,
} from '../../admin/admin.js';

const root = new URL('../../', import.meta.url);

test('isAuthorizedAdmin accepts only active admin rows matching the authenticated user', () => {
  assert.equal(isAuthorizedAdmin({ id: 'u1' }, { user_id: 'u1', active: true, role: 'admin' }), true);
  assert.equal(isAuthorizedAdmin({ id: 'u1' }, { user_id: 'u1', active: false, role: 'admin' }), false);
  assert.equal(isAuthorizedAdmin({ id: 'u1' }, { user_id: 'u2', active: true, role: 'admin' }), false);
  assert.equal(isAuthorizedAdmin(null, { user_id: 'u1', active: true, role: 'admin' }), false);
});

test('normalizeAdminFilters trims inputs and preserves date bounds', () => {
  assert.deepEqual(normalizeAdminFilters({ publicCode: '  BC-20261003-ABCDE ', patientName: '  Ana  ', from: '2026-10-01', to: '2026-10-03' }), {
    publicCode: 'BC-20261003-ABCDE',
    patientName: 'Ana',
    from: '2026-10-01',
    to: '2026-10-03',
  });
});

test('sanitizeStatus allows only the three workflow statuses', () => {
  assert.equal(sanitizeStatus('recebida'), 'recebida');
  assert.equal(sanitizeStatus('em_avaliacao'), 'em_avaliacao');
  assert.equal(sanitizeStatus('avaliada'), 'avaliada');
  assert.throws(() => sanitizeStatus('apagada'));
});

test('buildAdminQueryDescriptor defaults to newest first and maps filters safely', () => {
  assert.deepEqual(buildAdminQueryDescriptor({ patientName: 'Ana', from: '2026-10-01', to: '2026-10-03' }), {
    orderBy: 'created_at',
    ascending: false,
    publicCode: '',
    patientName: 'Ana',
    fromIso: '2026-10-01T00:00:00.000Z',
    toIso: '2026-10-03T23:59:59.999Z',
  });
});

test('formatAdminCpf reveals full CPF only when a detail record provides exactly eleven digits', () => {
  assert.equal(formatAdminCpf('52998224725'), '529.982.247-25');
  assert.equal(formatAdminCpf(null), '—');
  assert.equal(formatAdminCpf(''), '—');
});

test('admin list query excludes CPF while authenticated detail supports CPF display', async () => {
  const js = await readFile(new URL('../../admin/admin.js', import.meta.url), 'utf8');
  const listStart = js.indexOf('export async function loadPreAnamneses');
  const detailStart = js.indexOf('export async function loadPreAnamnese', listStart + 1);
  const listSource = js.slice(listStart, detailStart);
  assert.doesNotMatch(listSource, /patient_cpf/);
  assert.match(js, /setText\(qs\('detailCpf'\),\s*formatAdminCpf\(record\.patient_cpf\)\)/);

  const html = await readFile(new URL('../../admin/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="detailCpf"/);
  assert.doesNotMatch(html, /<th>CPF<\/th>/i);
});

test('admin static HTML contains no embedded patient data or password', async () => {
  const html = await readFile(new URL('../../admin/index.html', import.meta.url), 'utf8');
  assert.equal(/patient_name\s*[:=]\s*["'][^"']+/i.test(html), false);
  assert.equal(/password\s*[:=]\s*["'][^"']+/i.test(html), false);
  assert.match(html, /id="loginView"/);
  assert.match(html, /id="adminView"/);
});
