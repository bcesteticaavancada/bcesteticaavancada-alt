import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261009_bc_gestao_phase3_agenda_atendimento.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('fase 3 cria rpc segura de status com papéis e estados permitidos', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bc_set_agendamento_status\s*\(/);
  assert.match(sql, /security\s+definer/);
  assert.match(sql, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public\s*,\s*auth\s*,\s*private/);
  for (const status of ['agendado', 'atendido', 'cancelado', 'faltou']) assert.match(sql, new RegExp(`'${status}'`));
  assert.match(sql, /private\.is_bc_admin\(\)/);
  assert.match(sql, /private\.is_bc_active_colaborador\(\)/);
  assert.match(sql, /colaboradora_user_id\s*=\s*auth\.uid\(\)/);
});

test('fase 3 registra atendimento derivando vínculo somente do agendamento', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bc_registrar_atendimento\s*\(/);
  assert.match(sql, /from\s+public\.agendamentos/);
  assert.match(sql, /v_cliente_id\s*:=\s*v_agendamento\.cliente_id/);
  assert.match(sql, /v_procedimento_id\s*:=\s*v_agendamento\.procedimento_id/);
  assert.match(sql, /v_colaboradora_user_id\s*:=\s*v_agendamento\.colaboradora_user_id/);
  assert.doesNotMatch(sql, /p_cliente_id|p_procedimento_id|p_colaboradora_user_id/);
});

test('fase 3 rejeita cancelado/faltou, evita duplicidade e atualiza status na mesma função', async () => {
  const sql = await loadMigration();
  assert.match(sql, /status\s+in\s*\(\s*'cancelado'\s*,\s*'faltou'\s*\)/);
  assert.match(sql, /from\s+public\.atendimentos[\s\S]*agendamento_id\s*=\s*p_agendamento_id/);
  assert.match(sql, /insert\s+into\s+public\.atendimentos/);
  assert.match(sql, /update\s+public\.agendamentos[\s\S]*status\s*=\s*'atendido'/);
});

test('fase 3 remove edição silenciosa da colaboradora e cria diretório mínimo de equipe', async () => {
  const sql = await loadMigration();
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+"?atendimentos_colaborador_update_proprio"?\s+on\s+public\.atendimentos/);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bc_staff_directory\s*\(\s*\)/);
  assert.match(sql, /returns\s+table\s*\(\s*user_id\s+uuid\s*,\s*display_name\s+text\s*\)/);
  assert.match(sql, /sp\.active\s*=\s*true/);
  assert.doesNotMatch(sql, /returns\s+table\s*\([^)]*role/);
});

test('fase 3 cria índices e restringe execução das RPCs a authenticated', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+index\s+if\s+not\s+exists\s+idx_agendamentos_colaboradora_inicio\s+on\s+public\.agendamentos\s*\(\s*colaboradora_user_id\s*,\s*inicio\s*\)/);
  assert.match(sql, /create\s+index\s+if\s+not\s+exists\s+idx_atendimentos_cliente_data\s+on\s+public\.atendimentos\s*\(\s*cliente_id\s*,\s*data_atendimento\s+desc\s*\)/);
  for (const fn of ['bc_set_agendamento_status', 'bc_registrar_atendimento', 'bc_staff_directory']) {
    assert.match(sql, new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn}`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*to\\s+authenticated`));
  }
  assert.doesNotMatch(sql, /grant\s+execute[\s\S]*to\s+anon/);
});
