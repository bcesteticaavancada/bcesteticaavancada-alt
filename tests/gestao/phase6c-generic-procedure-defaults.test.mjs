import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_procedure_defaults') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_procedure_defaults deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('novo draft vazio recebe ficha e referência genéricas no backend', async () => {
  const sql = await loadMigration();
  assert.match(sql,/before\s+insert\s+or\s+update\s+on\s+public\.procedure_versions/);
  assert.match(sql,/specific_schema/);
  assert.match(sql,/technical_schema/);
  for (const key of ['objetivo_sessao','area_regiao','observacao_avaliacao','reference_steps']) {
    assert.match(sql,new RegExp(key));
  }
  assert.match(sql,/new\.status\s*=\s*'draft'/);
});
