import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261013174000_bc_gestao_phase6d_treatment_integration.sql',import.meta.url);
async function sql(){return await readFile(migrationUrl,'utf8');}

test('6D usa gate separado de FINALIZAÇÃO e preserva gate 6C de pré-início',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_finalization_gate\s*\(\s*p_treatment_id\s+uuid\s*\)/i);
  assert.doesNotMatch(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_gate\s*\(/i);
  for(const reason of ['fotos_pendentes','produto_lote_pendente','equipamento_pendente','intercorrencia_aberta_nao_confirmada']) assert.match(text,new RegExp(reason,'i'));
});

test('gate de foto exige antes + depois válidos e ignora foto anulada',async()=>{
  const text=await sql();
  assert.match(text,/requires_photo/i);
  assert.match(text,/kind\s*=\s*'antes'/i);
  assert.match(text,/kind\s*=\s*'depois'/i);
  assert.match(text,/voided_at\s+is\s+null/i);
});

test('gate de produto/lote exige snapshot completo e equipamento exige uso validado',async()=>{
  const text=await sql();
  assert.match(text,/requires_product_lot/i);
  assert.match(text,/lot_code_snapshot\s+is\s+not\s+null/i);
  assert.match(text,/expires_on_snapshot\s+is\s+not\s+null/i);
  assert.match(text,/quantity\s*>\s*0/i);
  assert.match(text,/nullif\s*\(\s*trim\s*\(\s*(?:u\.)?unit\s*\)/i);
  assert.match(text,/requires_equipment/i);
  assert.match(text,/clinical_treatment_equipment_usages/i);
});

test('confirmação de intercorrências só vale para o conjunto atual ordenado',async()=>{
  const text=await sql();
  assert.match(text,/array_agg\s*\(\s*i\.id\s+order\s+by\s+i\.id\s*\)/i);
  assert.match(text,/select\s+c\.open_intercurrence_ids\s+into\s+v_confirmed_ids/is);
  assert.match(text,/v_confirmed_ids\s+is\s+null\s+or\s+not\s*\(\s*v_confirmed_ids\s*=\s*v_open_ids\s*\)/i);
});

test('finalização rejeita pendências 6D e congela arrays 6D no snapshot',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_finalize_impl/i);
  assert.match(text,/bc_treatment_finalization_gate\s*\(\s*t\.id\s*\)/i);
  assert.match(text,/finalizaç[aã]o[^;]*pend/i);
  for(const key of ['photos','product_usages','equipment_usages','intercurrences']) assert.match(text,new RegExp(`'${key}'`,'i'));
  assert.match(text,/insert\s+into\s+public\.clinical_treatment_versions/i);
  assert.match(text,/pending_version_id/i);
  assert.match(text,/pending_document_id/i);
});

test('foto/produto/equipamento ficam congelados assim que existe documento pendente',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_phase6d_frozen_mutation_guard/i);
  assert.match(text,/v_pending\s+is\s+not\s+null|pending_document_id\s+is\s+not\s+null/i);
  for(const table of ['clinical_treatment_photos','clinical_treatment_product_usages','clinical_treatment_equipment_usages']){
    assert.match(text,new RegExp(`before\\s+insert\\s+or\\s+update\\s+or\\s+delete\\s+on\\s+public\\.${table}`,'i'));
  }
});

test('bc_treatment_get retorna finalization_gate_reasons e resumo compacto 6D',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_get_impl/i);
  assert.match(text,/'gate_reasons'\s*,\s*private\.bc_treatment_gate\s*\(/i);
  assert.match(text,/'finalization_gate_reasons'\s*,\s*private\.bc_treatment_finalization_gate\s*\(/i);
  assert.match(text,/'phase6d_summary'/i);
  for(const key of ['photos_before','photos_after','product_usages','equipment_usages','open_intercurrences']) assert.match(text,new RegExp(`'${key}'`,'i'));
});
