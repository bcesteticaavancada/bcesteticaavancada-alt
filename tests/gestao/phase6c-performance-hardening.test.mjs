import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration(fragment) {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes(fragment) && item.endsWith('.sql'));
  assert.ok(name, `migration ${fragment} deve existir`);
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('6C indexa foreign keys novas usadas na biblioteca', async () => {
  const sql = await loadMigration('phase6c_procedure_performance_hardening');
  const expectations = [
    /create\s+index[^;]*on\s+public\.procedimentos\s*\(current_version_id\)/,
    /create\s+index[^;]*on\s+public\.procedure_aliases\s*\(procedimento_id\)/,
    /create\s+index[^;]*on\s+public\.procedure_professional_permissions\s*\(granted_by\)/,
    /create\s+index[^;]*on\s+public\.procedure_version_components\s*\(component_version_id\)/,
    /create\s+index[^;]*on\s+public\.procedure_versions\s*\(created_by\)/,
    /create\s+index[^;]*on\s+public\.procedure_versions\s*\(published_by\)/,
  ];
  for (const expectation of expectations) assert.match(sql, expectation);
});

test('policy de permissão usa initplan para auth.uid', async () => {
  const sql = await loadMigration('phase6c_procedure_performance_hardening');
  const start = sql.indexOf('procedure_permissions_scoped_read');
  assert.notEqual(start, -1);
  const block = sql.slice(start, start + 1800);
  assert.match(block, /professional_user_id\s*=\s*\(select\s+auth\.uid\(\)\)/);
  assert.doesNotMatch(block, /professional_user_id\s*=\s*auth\.uid\(\)/);
});
