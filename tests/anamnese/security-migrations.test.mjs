import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const statusMigrationUrl = new URL('../../supabase/migrations/20261003_003_admin_status_only.sql', import.meta.url);
const integrityMigrationUrl = new URL('../../supabase/migrations/20261004_004_cpf_rubric_integrity.sql', import.meta.url);
const submitIndexUrl = new URL('../../supabase/functions/submit-pre-anamnese/index.ts', import.meta.url);

test('authenticated admins receive update permission only for status', async () => {
  const sql = await readFile(statusMigrationUrl, 'utf8');
  assert.match(sql, /revoke\s+update\s+on\s+table\s+public\.pre_anamneses\s+from\s+authenticated/i);
  assert.match(sql, /grant\s+update\s*\(\s*status\s*\)\s+on\s+table\s+public\.pre_anamneses\s+to\s+authenticated/i);
  assert.doesNotMatch(sql, /grant\s+update\s+on\s+table\s+public\.pre_anamneses\s+to\s+authenticated/i);
});

test('CPF and rubric integrity migration is backward-compatible and does not widen public access', async () => {
  const sql = await readFile(integrityMigrationUrl, 'utf8');

  for (const column of [
    'patient_cpf',
    'data_authorization_accepted_at',
    'rubric_sha256',
    'payload_sha256',
    'rubric_confirmed_at',
  ]) {
    assert.match(sql, new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${column}\\b`, 'i'));
  }

  assert.match(sql, /patient_cpf\s+is\s+null\s+or\s+patient_cpf\s*~\s*'\^\[0-9\]\{11\}\$'/i);
  assert.match(sql, /alter\s+table\s+public\.pre_anamneses\s+enable\s+row\s+level\s+security/i);
  assert.doesNotMatch(sql, /grant\s+[^;]+\s+to\s+(?:anon|public)\b/i);
  assert.doesNotMatch(sql, /disable\s+row\s+level\s+security/i);
});

test('submission validates rubric before writes and persists CPF, consent timestamp and hashes atomically', async () => {
  const source = await readFile(submitIndexUrl, 'utf8');
  assert.match(source, /validateRubricPngDataUrl\(payload\.signatureDataUrl\)/);
  assert.match(source, /buildCanonicalSubmissionSnapshot\(/);
  assert.match(source, /canonicalStringify\(/);
  assert.match(source, /sha256Hex\(/);

  const validationAt = source.indexOf('validateRubricPngDataUrl(payload.signatureDataUrl)');
  const storageWriteAt = source.indexOf(".from('pre-anamnese-signatures').upload");
  const databaseWriteAt = source.indexOf(".from('pre_anamneses').insert");
  assert.ok(validationAt >= 0 && storageWriteAt > validationAt && databaseWriteAt > validationAt);

  for (const field of [
    'created_at: createdAt',
    'patient_cpf: payload.patient.cpf',
    'data_authorization_accepted_at: createdAt',
    'rubric_sha256: rubricSha256',
    'payload_sha256: payloadSha256',
    'rubric_confirmed_at: createdAt',
  ]) {
    assert.ok(source.includes(field), `missing persisted field: ${field}`);
  }

  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^;\n]*(?:cpf|payload|answers)/i);
});
