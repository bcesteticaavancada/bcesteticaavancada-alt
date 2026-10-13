import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261013173000_bc_gestao_phase6d_intercurrences.sql',import.meta.url);
async function sql(){return await readFile(migrationUrl,'utf8');}

test('6D cria intercorrências, evoluções e confirmações estruturadas',async()=>{
  const text=(await sql()).toLowerCase();
  for(const needle of [
    'create table if not exists public.clinical_intercurrences',
    "check (moment in ('antes','durante','apos'))",
    "check (severity in ('leve','moderada','grave','critica'))",
    "check (status in ('aberta','acompanhamento','encerrada'))",
    'create table if not exists public.clinical_intercurrence_updates',
    'create table if not exists public.clinical_treatment_intercurrence_confirmations',
    'open_intercurrence_ids uuid[] not null',
  ]) assert.ok(text.includes(needle),`missing ${needle}`);
});

test('registro original só muda enquanto sessão está editável e evolução posterior é append-only',async()=>{
  const text=await sql();
  assert.match(text,/bc_treatment_intercurrence_update_draft_impl/i);
  assert.match(text,/profissional_user_id\s*<>\s*v_user/i);
  assert.match(text,/status\s+not\s+in\s*\('rascunho','pronto_para_iniciar','em_atendimento'\)/i);
  assert.match(text,/bc_intercurrence_add_update_impl/i);
  assert.match(text,/staff_profiles[\s\S]*atende_clientes/is);
  assert.match(text,/clinical_intercurrence_updates_immutable/i);
  assert.match(text,/before\s+update\s+or\s+delete\s+on\s+public\.clinical_intercurrence_updates/i);
});

test('evolução insere linha e sincroniza status/closed_at atomicamente',async()=>{
  const text=await sql();
  assert.match(text,/insert\s+into\s+public\.clinical_intercurrence_updates/i);
  assert.match(text,/update\s+public\.clinical_intercurrences[\s\S]*status\s*=\s*p_status_after/is);
  assert.match(text,/closed_at/i);
  assert.match(text,/clinical_intercurrence_evolution_added/i);
});

test('confirmação registra conjunto ordenado de abertas para detectar stale',async()=>{
  const text=await sql();
  assert.match(text,/bc_treatment_confirm_open_intercurrences_impl/i);
  assert.match(text,/array_agg\s*\(\s*i\.id\s+order\s+by\s+i\.id\s*\)/i);
  assert.match(text,/open_intercurrence_ids/i);
  assert.match(text,/clinical_open_intercurrences_confirmed/i);
});

test('RLS/RPC-only e auditoria cobrem criação, edição, evolução e confirmação',async()=>{
  const text=await sql();
  for(const table of ['clinical_intercurrences','clinical_intercurrence_updates','clinical_treatment_intercurrence_confirmations']){
    assert.match(text,new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,'i'));
    assert.match(text,new RegExp(`revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+anon\\s*,\\s*authenticated`,'i'));
  }
  for(const fn of ['bc_treatment_intercurrence_list','bc_treatment_intercurrence_create','bc_treatment_intercurrence_update_draft','bc_intercurrence_add_update','bc_treatment_confirm_open_intercurrences']){
    assert.match(text,new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`,'i'));
    assert.match(text,new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}`,'i'));
  }
  for(const action of ['clinical_intercurrence_created','clinical_intercurrence_draft_updated','clinical_intercurrence_evolution_added','clinical_open_intercurrences_confirmed']) assert.match(text,new RegExp(action,'i'));
});
