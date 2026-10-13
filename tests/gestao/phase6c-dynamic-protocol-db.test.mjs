import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_dynamic_protocols') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_dynamic_protocols deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('save draft aceita protocolo composto por opções dinâmicas da sessão', async () => {
  const sql = await loadMigration();
  const start = sql.indexOf('bc_procedure_save_draft_impl');
  assert.notEqual(start, -1);
  const block = sql.slice(start, start + 14000);
  assert.match(block, /component_options/);
  assert.match(block, /jsonb_array_length/);
  assert.match(block, /procedure_version_components/);
  assert.match(block, /protocol_mode='compound'/);
});

test('protocolo composto continua inválido se não tiver relação nem opções dinâmicas', async () => {
  const sql = await loadMigration();
  assert.match(sql, /protocolo composto exige ao menos um componente/i);
  assert.match(sql, /not exists\s*\(select 1 from public\.procedure_version_components/);
  assert.match(sql, /jsonb_array_length\([^)]*component_options/);
});
