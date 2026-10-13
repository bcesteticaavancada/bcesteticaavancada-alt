import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadCompatMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_document_column_compat') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_document_column_compat deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('TCLE e ficha final usam os nomes reais de snapshot da clinical_documents 6B', async () => {
  const sql = await loadCompatMigration();
  for (const fn of ['bc_treatment_prepare_consent_impl','bc_treatment_finalize_impl']) {
    assert.match(sql, new RegExp(fn));
  }
  for (const column of ['profissional_nome','profissional_profissao','profissional_conselho','profissional_registro']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
  assert.doesNotMatch(sql,/profissional_nome_snapshot|profissao_snapshot|conselho_snapshot|registro_snapshot/);
});
