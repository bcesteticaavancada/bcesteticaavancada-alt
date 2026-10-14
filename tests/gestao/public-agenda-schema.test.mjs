import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration(fragment) {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes(fragment) && item.endsWith('.sql'));
  assert.ok(name, `migration ${fragment} deve existir`);
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('agenda pública cria schema aditivo sem abrir tabelas ao anon', async () => {
  const sql = await loadMigration('bc_gestao_public_agenda_schema');
  for (const expectation of [
    /professional_availability_days/,
    /unique[^;]*professional_user_id[^;]*local_date/i,
    /professional_schedule_blocks/,
    /professional_agenda_inactivations/,
    /public_booking_name/,
    /public_booking_phone_normalized/,
    /origem/,
    /private\.public_booking_rate_limits/,
    /enable row level security/i,
    /revoke all[^;]*from anon/i,
  ]) assert.match(sql, expectation);

  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete|all)[^;]*professional_(availability_days|schedule_blocks|agenda_inactivations)[^;]*to\s+anon/i);
});

test('agendamento interno exige identidade clínica e site exige snapshot público', async () => {
  const sql = await loadMigration('bc_gestao_public_agenda_schema');
  assert.match(sql, /origem[^;]*check[^;]*interno[^;]*site/i);
  assert.match(sql, /origem\s*=\s*'interno'[^;]*(cliente_id|created_by)[^;]*(cliente_id|created_by)/i);
  assert.match(sql, /origem\s*=\s*'site'[^;]*public_booking_name[^;]*public_booking_phone_normalized/i);
});

test('inativação limita motivos internos ao vocabulário aprovado', async () => {
  const sql = await loadMigration('bc_gestao_public_agenda_schema');
  for (const reason of [
    'ferias', 'motivos_pessoais', 'motivo_medico', 'licenca_afastamento',
    'curso_capacitacao', 'viagem', 'folga', 'outro',
  ]) assert.match(sql, new RegExp(reason));
});
