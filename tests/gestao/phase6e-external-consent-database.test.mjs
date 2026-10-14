import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261014014000_bc_gestao_external_consents.sql',import.meta.url);
async function sql(){return (await readFile(migrationUrl,'utf8')).toLowerCase();}

test('vínculo externo congela arquivo, procedimento, classe, template e componentes',async()=>{
  const text=await sql();
  assert.match(text,/create\s+table\s+if\s+not\s+exists\s+public\.treatment_external_consents/i);
  for(const token of ['treatment_id','client_file_id','cliente_id','procedure_version_id','consent_template_version_id','consent_class','component_version_ids','component_keys','reviewed_by','reviewed_at'])assert.match(text,new RegExp(token,'i'));
  assert.match(text,/treatment_id\s+uuid\s+not\s+null\s+unique/i);
  assert.match(text,/enable\s+row\s+level\s+security/i);
  assert.match(text,/revoke\s+all\s+on\s+public\.treatment_external_consents\s+from\s+anon\s*,\s*authenticated/i);
});

test('link exige profissional responsável ativa, mesma cliente e TCLE não anulado',async()=>{
  const text=await sql();
  assert.match(text,/bc_treatment_external_consent_link_impl/i);
  assert.match(text,/auth\.uid\s*\(\s*\)/i);
  assert.match(text,/v_user\s*<>\s*t\.profissional_user_id|t\.profissional_user_id\s*<>\s*v_user/i);
  assert.match(text,/bc_treatment_can_execute_version/i);
  assert.match(text,/f\.cliente_id\s*<>\s*t\.cliente_id|t\.cliente_id\s*<>\s*f\.cliente_id/i);
  assert.match(text,/f\.category\s*<>\s*'tcle_externo'/i);
  assert.match(text,/f\.voided_at\s+is\s+not\s+null/i);
  assert.match(text,/t\.status\s+not\s+in\s*\(\s*'rascunho'\s*,\s*'pronto_para_iniciar'\s*\)/i);
});

test('vínculo snapshotta classe esperada e template publicado vigente',async()=>{
  const text=await sql();
  assert.match(text,/bc_treatment_expected_consent_class\s*\(\s*t\.id\s*\)/i);
  assert.match(text,/consent_template_versions[\s\S]*status\s*=\s*'published'[\s\S]*consent_class/i);
  assert.match(text,/procedure_version_id[\s\S]*t\.procedure_version_id/i);
});

test('helper canônico aceita consentimento interno válido ou TCLE externo compatível',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_consent_satisfied/i);
  assert.match(text,/procedure_consents/i);
  assert.match(text,/treatment_external_consents/i);
  assert.match(text,/procedure_version_id\s*=\s*t\.procedure_version_id/i);
  assert.match(text,/consent_class\s*=\s*private\.bc_treatment_expected_consent_class/i);
});

test('gate de início usa helper canônico; arquivo solto não basta',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_gate/i);
  assert.match(text,/not\s+private\.bc_treatment_consent_satisfied\s*\(\s*t\.id\s*\)[\s\S]*consentimento_pendente/i);
  assert.doesNotMatch(text,/client_files[\s\S]*reasons\s*:=\s*array_remove[^;]*consentimento_pendente/i);
});

test('RPCs são invoker, authenticated-only e implementações private mantêm execute mínimo',async()=>{
  const text=await sql();
  for(const name of ['bc_treatment_external_consent_link','bc_treatment_external_consent_get']){
    assert.match(text,new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}[\\s\\S]*?security\\s+invoker`,'i'));
    assert.match(text,new RegExp(`grant\\s+execute[\\s\\S]*${name}[\\s\\S]*to\\s+authenticated`,'i'));
  }
  assert.match(text,/grant\s+execute\s+on\s+function\s+private\.bc_treatment_external_consent_link_impl/i);
  assert.match(text,/grant\s+execute\s+on\s+function\s+private\.bc_treatment_external_consent_get_impl/i);
});
