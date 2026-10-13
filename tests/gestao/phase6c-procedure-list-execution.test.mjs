import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_procedure_list_execution') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_procedure_list_execution deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('listagem marca procedimentos gerais como executáveis por profissional ativa e restritos só com permissão', async () => {
  const sql = await loadMigration();
  assert.match(sql,/bc_procedure_list_impl/);
  assert.match(sql,/access_mode/);
  assert.match(sql,/atende_clientes/);
  assert.match(sql,/p\.access_mode\s*=\s*'general'/);
  assert.match(sql,/p\.access_mode\s*=\s*'restricted'/);
  assert.match(sql,/pp\.allowed/);
  assert.match(sql,/pp\.revoked_at\s+is\s+null/);
});
