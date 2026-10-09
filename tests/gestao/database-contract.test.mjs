import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261009_bc_gestao_core.sql', import.meta.url);

async function loadMigration() {
  return readFile(migrationPath, 'utf8');
}

test('migration define as seis tabelas do BC Gestão', async () => {
  const sql = (await loadMigration()).toLowerCase();
  for (const table of ['staff_profiles', 'clientes', 'procedimentos', 'agendamentos', 'atendimentos', 'pagamentos']) {
    assert.match(sql, new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?public\\.${table}\\b`));
  }
});

test('migration habilita RLS nas seis tabelas', async () => {
  const sql = (await loadMigration()).toLowerCase();
  for (const table of ['staff_profiles', 'clientes', 'procedimentos', 'agendamentos', 'atendimentos', 'pagamentos']) {
    assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`));
  }
});

test('migration possui helper de admin e políticas de vínculo para colaboradora', async () => {
  const sql = (await loadMigration()).toLowerCase();
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.is_bc_admin\s*\(/);
  assert.match(sql, /colaboradora_user_id\s*=\s*auth\.uid\(\)/);
  assert.match(sql, /exists\s*\([\s\S]*from\s+public\.agendamentos/);
});

test('migration não concede política de pagamentos para colaboradora nem contém service_role', async () => {
  const sql = (await loadMigration()).toLowerCase();
  assert.doesNotMatch(sql, /service_role/);
  const paymentPolicyLines = sql
    .split('\n')
    .filter((line) => line.includes('policy') && line.includes('pagamentos'))
    .join('\n');
  assert.doesNotMatch(paymentPolicyLines, /colaborador/);
});
