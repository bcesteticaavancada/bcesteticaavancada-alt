import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function engineSql() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('bc_gestao_public_agenda_engine') && item.endsWith('.sql'));
  assert.ok(name, 'migration bc_gestao_public_agenda_engine deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('motor usa lock transacional único e separa conflito interno de regra pública', async () => {
  const sql = await engineSql();
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /america\/sao_paulo/);
  assert.match(sql, /bc_agendamento_lock_and_assert_no_conflict/);
  assert.match(sql, /bc_schedule_assert_public_slot/);
  assert.match(sql, /slot_unavailable/);
  assert.match(sql, /professional_availability_days/);
  assert.match(sql, /professional_schedule_blocks/);
  assert.match(sql, /professional_agenda_inactivations/);
});

test('motor deriva fim de duração e libera cancelado/faltou de conflitos', async () => {
  const sql = await engineSql();
  assert.match(sql, /duracao_padrao/);
  assert.match(sql, /coalesce\s*\([^)]*fim[^)]*make_interval|coalesce\s*\([^)]*fim[^)]*duracao_padrao/i);
  assert.match(sql, /status\s+not\s+in\s*\(\s*'cancelado'\s*,\s*'faltou'\s*\)/i);
});

test('criação interna não exige dia publicado, mas respeita bloqueio e inativação', async () => {
  const sql = await engineSql();
  assert.match(sql, /create or replace function private\.bc_agendamento_create_impl/);
  assert.match(sql, /bc_agendamento_lock_and_assert_no_conflict/);
  assert.match(sql, /professional_schedule_blocks/);
  assert.match(sql, /professional_agenda_inactivations/);
  assert.match(sql, /encaixe interno|disponibilidade pública não é obrigatória|não exige disponibilidade pública/i);
});

test('RPCs públicos são service-role-only e reserva nasce sem prontuário', async () => {
  const sql = await engineSql();
  for (const name of [
    'bc_public_agenda_catalog',
    'bc_public_agenda_professionals',
    'bc_public_agenda_month',
    'bc_public_agenda_slots',
    'bc_public_agenda_book',
  ]) assert.match(sql, new RegExp(name));
  assert.match(sql, /revoke\s+execute[^;]*bc_public_agenda_book[^;]*from\s+public/i);
  assert.match(sql, /grant\s+execute[^;]*bc_public_agenda_book[^;]*to\s+service_role/i);
  assert.match(sql, /origem[^;]*'site'/i);
  assert.match(sql, /cliente_id[^;]*null/i);
  assert.match(sql, /created_by[^;]*null/i);
  assert.match(sql, /10[^;]*10\s*minute|10\s*minute[^;]*10/i);
});

test('mês público é validado no banco e atendimento exige cliente vinculada', async () => {
  const sql = await engineSql();
  assert.match(sql, /date_trunc\s*\(\s*'month'[^)]*america\/sao_paulo/i);
  assert.match(sql, /cliente_id\s+is\s+null/i);
  assert.match(sql, /cadastro da cliente precisa ser vinculado antes do atendimento/i);
});

test('RPCs internos de disponibilidade e vínculo existem com grants autenticados', async () => {
  const sql = await engineSql();
  for (const name of [
    'bc_schedule_month_get',
    'bc_schedule_day_upsert',
    'bc_schedule_days_apply',
    'bc_schedule_block_create',
    'bc_schedule_block_delete',
    'bc_agenda_inactivation_create',
    'bc_agenda_reactivate',
    'bc_agendamento_link_cliente',
  ]) {
    assert.match(sql, new RegExp(name));
    assert.match(sql, new RegExp(`grant\\s+execute[^;]*${name}[^;]*to\\s+authenticated`, 'i'));
  }
});
