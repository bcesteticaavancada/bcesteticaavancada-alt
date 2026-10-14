import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261014016000_bc_gestao_storage_photo_policy_hotfix.sql',import.meta.url);
async function sql(){try{return (await readFile(migrationUrl,'utf8')).toLowerCase();}catch{return '';}}

test('policy de fotos clínicas usa helper security definer em vez de consultar clinical_treatments diretamente',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_storage_photo_insert_allowed\s*\(\s*p_name\s+text\s*\)/i);
  assert.match(text,/security\s+definer/i);
  assert.match(text,/drop\s+policy\s+if\s+exists\s+bc_phase6d_photo_insert\s+on\s+storage\.objects/i);
  assert.match(text,/create\s+policy\s+bc_phase6d_photo_insert[\s\S]*private\.bc_storage_photo_insert_allowed\s*\(\s*name\s*\)/i);
  const policy=text.match(/create\s+policy\s+bc_phase6d_photo_insert[\s\S]*?;\s*/i)?.[0]??'';
  assert.doesNotMatch(policy,/from\s+public\.clinical_treatments/i);
});

test('hotfix não concede select direto em clinical_treatments',async()=>{
  const text=await sql();
  assert.doesNotMatch(text,/grant\s+select[\s\S]*on\s+(?:table\s+)?public\.clinical_treatments[\s\S]*to\s+authenticated/i);
  assert.match(text,/revoke\s+all\s+on\s+function\s+private\.bc_storage_photo_insert_allowed\s*\(\s*text\s*\)\s+from\s+public/i);
  assert.match(text,/grant\s+execute\s+on\s+function\s+private\.bc_storage_photo_insert_allowed\s*\(\s*text\s*\)\s+to\s+authenticated/i);
});
