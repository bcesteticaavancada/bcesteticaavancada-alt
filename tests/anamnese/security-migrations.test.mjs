import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const statusMigrationUrl = new URL('../../supabase/migrations/20261003_003_admin_status_only.sql', import.meta.url);
const integrityMigrationUrl = new URL('../../supabase/migrations/20261004_004_cpf_rubric_integrity.sql', import.meta.url);

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
