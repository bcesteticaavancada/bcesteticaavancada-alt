import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
async function loadMigration(){
  const names=await readdir(migrationsDir);
  const name=names.find((item)=>item.includes('phase6c_treatment_performance')&&item.endsWith('.sql'));
  assert.ok(name,'migration phase6c_treatment_performance deve existir');
  return (await readFile(new URL(name,migrationsDir),'utf8')).toLowerCase();
}

test('todas as FKs novas do prontuário 6C têm índice de apoio',async()=>{
  const sql=await loadMigration();
  const expected=[
    ['clinical_treatment_alert_reviews','reviewed_by'],
    ['clinical_treatment_components','component_version_id'],
    ['clinical_treatment_health_confirmations','confirmed_by'],
    ['clinical_treatment_reopen_grants','author_user_id'],
    ['clinical_treatment_reopen_grants','granted_by'],
    ['clinical_treatment_versions','created_by'],
    ['clinical_treatment_versions','document_id'],
    ['clinical_treatment_versions','prior_version_id'],
    ['clinical_treatments','anamnese_id'],
    ['clinical_treatments','consent_document_id'],
    ['clinical_treatments','created_by'],
    ['clinical_treatments','current_version_id'],
    ['clinical_treatments','pending_document_id'],
    ['clinical_treatments','pending_version_id'],
    ['clinical_treatments','procedimento_id'],
  ];
  for(const [table,column] of expected){
    assert.match(sql,new RegExp(`create index if not exists[^;]+on public\\.${table}\\s*\\(\\s*${column}\\s*\\)`),`${table}.${column}`);
  }
});
