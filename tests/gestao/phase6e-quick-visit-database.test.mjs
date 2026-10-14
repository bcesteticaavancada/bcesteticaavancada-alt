import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261014012000_bc_gestao_quick_visit.sql',import.meta.url);
async function sql(){return (await readFile(migrationUrl,'utf8')).toLowerCase();}

test('quick visit possui idempotência persistente por request_key',async()=>{
  const text=await sql();
  assert.match(text,/create\s+table\s+if\s+not\s+exists\s+public\.quick_visit_requests/i);
  assert.match(text,/request_key\s+uuid\s+(?:primary\s+key|not\s+null\s+unique)/i);
  assert.match(text,/appointment_id/);
  assert.match(text,/treatment_id/);
  assert.match(text,/pg_advisory_xact_lock[\s\S]*p_request_key/i);
  assert.match(text,/select[\s\S]+from\s+public\.quick_visit_requests[\s\S]+request_key\s*=\s*p_request_key/i);
});

test('quick visit valida ator, cliente, profissional e autorização do procedimento',async()=>{
  const text=await sql();
  assert.match(text,/auth\.uid\s*\(\s*\)/i);
  assert.match(text,/private\.is_bc_active_staff\s*\(\s*\)/i);
  assert.match(text,/private\.is_bc_admin\s*\(\s*\)/i);
  assert.match(text,/p_profissional_user_id\s*<>\s*v_user|v_user\s*<>\s*p_profissional_user_id/i);
  assert.match(text,/public\.clientes[\s\S]*ativo/i);
  assert.match(text,/staff_profiles[\s\S]*active[\s\S]*atende_clientes/i);
  assert.match(text,/bc_treatment_can_execute_version/i);
});

test('conflito de agenda é serializado e cobre criação normal e encaixe',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_agendamento_no_overlap/i);
  assert.match(text,/create\s+trigger\s+bc_agendamento_no_overlap/i);
  assert.match(text,/before\s+insert\s+or\s+update\s+on\s+public\.agendamentos/i);
  assert.match(text,/pg_advisory_xact_lock/i);
  assert.match(text,/a\.inicio\s*<\s*v_new_end/i);
  assert.match(text,/v_existing_end\s*>\s*new\.inicio|coalesce\s*\(\s*a\.fim[\s\S]*>\s*new\.inicio/i);
  assert.match(text,/hor[aá]rio[^;]*indispon[ií]vel/i);
});

test('quick visit cria agenda e tratamento na mesma transação e retorna ambos',async()=>{
  const text=await sql();
  assert.match(text,/private\.bc_agendamento_create_impl\s*\(/i);
  assert.match(text,/private\.bc_treatment_create_for_professional_impl\s*\(/i);
  assert.match(text,/jsonb_build_object\s*\(\s*'appointment_id'/i);
  assert.match(text,/'treatment_id'/i);
  assert.doesNotMatch(text,/exception\s+when\s+others[\s\S]*return/i);
});

test('helper de tratamento permite admin preparar encaixe para profissional sem mudar autoria clínica',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_create_for_professional_impl/i);
  assert.match(text,/profissional_user_id[\s\S]*p_profissional_user_id/i);
  assert.match(text,/created_by[\s\S]*v_user/i);
  assert.match(text,/agendamento[^;]*colaboradora_user_id[^;]*p_profissional_user_id/i);
  assert.match(text,/private\.bc_treatment_create_impl[\s\S]*bc_treatment_create_for_professional_impl/i);
});

test('wrapper público é invoker, authenticated-only e request table não é exposta',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+public\.bc_quick_visit_create/i);
  assert.match(text,/language\s+sql[\s\S]*security\s+invoker/i);
  assert.match(text,/revoke\s+all\s+on\s+public\.quick_visit_requests\s+from\s+anon\s*,\s*authenticated/i);
  assert.match(text,/revoke\s+execute[\s\S]*bc_quick_visit_create[\s\S]*from\s+anon/i);
  assert.match(text,/grant\s+execute[\s\S]*bc_quick_visit_create[\s\S]*to\s+authenticated/i);
});
