import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = new URL('../../supabase/migrations/20261003_003_admin_column_privileges.sql', import.meta.url);

test('admin privileges restrict authenticated updates to status column', async () => {
  const sql = await readFile(migration, 'utf8');
  assert.match(sql, /revoke\s+update\s+on\s+table\s+public\.pre_anamneses\s+from\s+authenticated/i);
  assert.match(sql, /grant\s+update\s*\(\s*status\s*\)\s+on\s+table\s+public\.pre_anamneses\s+to\s+authenticated/i);
  assert.match(sql, /grant\s+select\s+on\s+table\s+public\.admin_users\s+to\s+authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(insert|delete)\s+on\s+table\s+public\.pre_anamneses\s+to\s+authenticated/i);
});
