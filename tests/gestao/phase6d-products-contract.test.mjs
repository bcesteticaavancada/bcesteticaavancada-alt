import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261013171000_bc_gestao_phase6d_products.sql',import.meta.url);
async function sql(){return await readFile(migrationUrl,'utf8');}

test('6D cria catálogos de produtos/lotes e uso clínico com snapshots',async()=>{
  const text=(await sql()).toLowerCase();
  for(const needle of [
    'create table if not exists public.clinical_products',
    'create table if not exists public.clinical_product_lots',
    'create table if not exists public.clinical_treatment_product_usages',
    'product_name_snapshot text not null',
    'manufacturer_snapshot text',
    'lot_code_snapshot text',
    'expires_on_snapshot date',
    'quantity numeric',
    'unit text not null',
  ]) assert.ok(text.includes(needle),`missing ${needle}`);
  assert.match(text,/unique\s*\(\s*product_id\s*,\s*lot_code\s*\)/i);
  assert.match(text,/quantity\s+numeric[^,]*check\s*\(\s*quantity\s*>\s*0\s*\)/i);
});

test('catálogos são desativáveis, sem caminho destrutivo, e gestão exige permissão da Biblioteca Clínica',async()=>{
  const text=await sql();
  assert.match(text,/active\s+boolean\s+not\s+null\s+default\s+true/i);
  assert.match(text,/private\.bc_can_manage_procedures\(\)/i);
  assert.doesNotMatch(text,/delete\s+from\s+public\.clinical_products/i);
  assert.doesNotMatch(text,/delete\s+from\s+public\.clinical_product_lots/i);
  for(const table of ['clinical_products','clinical_product_lots','clinical_treatment_product_usages']){
    assert.match(text,new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,'i'));
    assert.match(text,new RegExp(`revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+anon\\s*,\\s*authenticated`,'i'));
  }
});

test('uso de produto é criado com snapshot do servidor, lote correspondente e validade vigente',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_product_usage_add_impl/i);
  assert.match(text,/from\s+public\.clinical_products/i);
  assert.match(text,/from\s+public\.clinical_product_lots/i);
  assert.match(text,/v_lot\.product_id\s*<>\s*p_product_id|v_lot\.product_id\s*!=\s*p_product_id/i);
  assert.match(text,/expires_on\s*<\s*\(now\(\)\s+at\s+time\s+zone\s+'america\/sao_paulo'\)::date/i);
  assert.match(text,/v_product\.name/i);
  assert.match(text,/v_product\.manufacturer/i);
  assert.match(text,/v_lot\.lot_code/i);
  assert.match(text,/v_lot\.expires_on/i);
});

test('RPCs de catálogo e uso estão expostos somente a authenticated',async()=>{
  const text=await sql();
  for(const fn of [
    'bc_clinical_product_list','bc_clinical_product_upsert','bc_clinical_product_lot_list','bc_clinical_product_lot_upsert',
    'bc_treatment_product_usage_list','bc_treatment_product_usage_add','bc_treatment_product_usage_remove',
  ]){
    assert.match(text,new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`,'i'));
    assert.match(text,new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}`,'i'));
  }
  assert.match(text,/profissional_user_id\s*=\s*v_user/i);
  assert.match(text,/status\s+not\s+in\s*\('rascunho','pronto_para_iniciar','em_atendimento'\)/i);
});
