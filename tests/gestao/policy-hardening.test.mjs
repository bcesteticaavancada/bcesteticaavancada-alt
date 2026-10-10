import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261009_bc_gestao_policy_hardening.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('procedimentos deixa de ser legível por qualquer conta autenticada', async () => {
  const sql = await loadMigration();
  assert.match(sql, /drop\s+policy\s+if\s+exists\s+"?procedimentos_authenticated_select"?\s+on\s+public\.procedimentos/);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/);
});

test('procedimentos exige perfil ativo admin ou colaborador', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+policy\s+"?procedimentos_staff_select"?[\s\S]*private\.is_bc_admin\(\)[\s\S]*private\.is_bc_active_colaborador\(\)/);
});
