import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_treatment_get_consent') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_treatment_get_consent deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('get treatment devolve consentimento vinculado sem chamar prepare novamente', async () => {
  const sql = await loadMigration();
  assert.match(sql,/bc_treatment_get_impl/);
  assert.match(sql,/procedure_consents/);
  assert.match(sql,/consent_template_versions/);
  assert.match(sql,/clinical_documents/);
  for (const key of ['consent','document_id','consent_class','procedure_name','title','body','supplement','status']) {
    assert.match(sql,new RegExp(key));
  }
  assert.doesNotMatch(sql,/bc_treatment_prepare_consent_impl\s*\(/);
});
