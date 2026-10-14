import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261014015000_bc_gestao_client_central_hardening.sql',import.meta.url);
async function sql(){return (await readFile(migrationUrl,'utf8')).toLowerCase();}

test('wrappers invoker mantêm execute mínimo nas implementações private chamadas diretamente',async()=>{
  const text=await sql();
  for(const signature of ['bc_quick_visit_procedure_options_impl(uuid)','bc_treatment_report_get_impl(uuid)','bc_treatment_report_upsert_impl(uuid,jsonb)','bc_treatment_finalize_impl(uuid)']){
    const escaped=signature.replace(/[()]/g,(m)=>`\\${m}`);
    assert.match(text,new RegExp(`grant\\s+execute\\s+on\\s+function\\s+private\\.${escaped}\\s+to\\s+authenticated`,'i'));
  }
  assert.match(text,/revoke\s+execute[\s\S]*private\.bc_quick_visit_procedure_options_impl[\s\S]*from\s+anon/i);
  assert.match(text,/revoke\s+execute[\s\S]*private\.bc_treatment_report_get_impl[\s\S]*from\s+anon/i);
});

test('encaixe curto não oferece nem aceita protocolo composto sem seleção de componentes',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_quick_visit_procedure_options_impl/i);
  assert.match(text,/procedure_versions[\s\S]*protocol_mode\s*=\s*'simple'/i);
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_quick_visit_simple_guard_impl/i);
  assert.match(text,/protocol_mode[\s\S]*'compound'[\s\S]*fluxo clínico completo/i);
  assert.match(text,/create\s+or\s+replace\s+function\s+public\.bc_quick_visit_create[\s\S]*bc_quick_visit_simple_guard_impl[\s\S]*bc_quick_visit_create_impl/i);
});

test('hardening não abre tabelas clínicas nem storage diretamente',async()=>{
  const text=await sql();
  for(const table of ['quick_visit_requests','clinical_treatment_reports','client_files']) assert.doesNotMatch(text,new RegExp(`grant\\s+(?:select|insert|update|delete|all)[\\s\\S]*public\\.${table}[\\s\\S]*to\\s+authenticated`,'i'));
  assert.doesNotMatch(text,/getpublicurl|create\s+policy[\s\S]*anon/i);
});
