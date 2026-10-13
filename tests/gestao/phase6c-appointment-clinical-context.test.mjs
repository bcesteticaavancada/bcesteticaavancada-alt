import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_appointment_clinical_context') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_appointment_clinical_context deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('contexto clínico da agenda deriva vínculo e permissão no servidor', async () => {
  const sql = await loadMigration();
  assert.match(sql,/bc_appointment_clinical_context_impl/);
  assert.match(sql,/private\.is_bc_active_staff/);
  assert.match(sql,/public\.agendamentos/);
  assert.match(sql,/public\.procedimentos/);
  assert.match(sql,/public\.staff_profiles/);
  for (const key of ['cliente_id','procedimento_id','procedure_name','professional_name','can_start','existing_treatment_id']) {
    assert.match(sql,new RegExp(key));
  }
  assert.match(sql,/a\.colaboradora_user_id\s*=\s*v_user/);
  assert.match(sql,/clinical_treatments/);
});

test('wrapper público é invoker e não concede acesso anon', async () => {
  const sql = await loadMigration();
  assert.match(sql,/create or replace function public\.bc_appointment_clinical_context/);
  assert.match(sql,/security invoker/);
  assert.match(sql,/revoke execute[^;]*anon/);
  assert.match(sql,/grant execute[^;]*authenticated/);
});
