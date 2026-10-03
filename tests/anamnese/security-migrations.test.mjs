import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20261003_003_admin_status_only.sql', import.meta.url);

test('authenticated admins receive update permission only for status', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /revoke\s+update\s+on\s+table\s+public\.pre_anamneses\s+from\s+authenticated/i);
  assert.match(sql, /grant\s+update\s*\(\s*status\s*\)\s+on\s+table\s+public\.pre_anamneses\s+to\s+authenticated/i);
  assert.doesNotMatch(sql, /grant\s+update\s+on\s+table\s+public\.pre_anamneses\s+to\s+authenticated/i);
});
