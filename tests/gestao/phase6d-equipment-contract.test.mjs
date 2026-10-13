import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261013172000_bc_gestao_phase6d_equipment.sql',import.meta.url);
async function sql(){return await readFile(migrationUrl,'utf8');}

test('6D cria biblioteca de equipamentos e snapshot de uso',async()=>{
  const text=(await sql()).toLowerCase();
  for(const needle of [
    'create table if not exists public.clinical_equipment',
    'parameter_schema jsonb not null',
    'create table if not exists public.clinical_treatment_equipment_usages',
    'equipment_name_snapshot text not null',
    'manufacturer_snapshot text',
    'model_snapshot text',
    'internal_code_snapshot text',
    'parameter_schema_snapshot jsonb not null',
    'parameter_values jsonb not null',
  ]) assert.ok(text.includes(needle),`missing ${needle}`);
});

test('validador backend limita tipos e rejeita chaves/valores incompatíveis',async()=>{
  const text=await sql();
  assert.match(text,/private\.bc_validate_equipment_parameters\s*\(\s*jsonb\s*,\s*jsonb\s*\)/i);
  for(const type of ['number','text','select','boolean']) assert.match(text,new RegExp(`'${type}'`,'i'));
  assert.match(text,/jsonb_object_keys\(p_values\)/i);
  assert.match(text,/jsonb_typeof/i);
  assert.match(text,/required/i);
  assert.match(text,/options/i);
  assert.match(text,/min/i);
  assert.match(text,/max/i);
});

test('catálogo e usos são RLS/RPC-only e mutações exigem permissão adequada',async()=>{
  const text=await sql();
  for(const table of ['clinical_equipment','clinical_treatment_equipment_usages']){
    assert.match(text,new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,'i'));
    assert.match(text,new RegExp(`revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+anon\\s*,\\s*authenticated`,'i'));
  }
  assert.match(text,/private\.bc_can_manage_procedures\(\)/i);
  assert.match(text,/profissional_user_id\s*<>\s*v_user/i);
  assert.match(text,/status\s+not\s+in\s*\('rascunho','pronto_para_iniciar','em_atendimento'\)/i);
  assert.doesNotMatch(text,/delete\s+from\s+public\.clinical_equipment\b/i);
});

test('RPCs expõem catálogo e uso sem acesso anon',async()=>{
  const text=await sql();
  for(const fn of ['bc_clinical_equipment_list','bc_clinical_equipment_upsert','bc_treatment_equipment_usage_list','bc_treatment_equipment_usage_add','bc_treatment_equipment_usage_remove']){
    assert.match(text,new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`,'i'));
    assert.match(text,new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}`,'i'));
  }
});
