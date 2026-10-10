import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261009_bc_gestao_security_hardening.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('hardening move os helpers privilegiados para schema privado', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+schema\s+if\s+not\s+exists\s+private/);
  assert.match(sql, /create\s+or\s+replace\s+function\s+private\.is_bc_admin\s*\(/);
  assert.match(sql, /create\s+or\s+replace\s+function\s+private\.is_bc_active_colaborador\s*\(/);
  assert.match(sql, /security\s+definer/);
});

test('hardening revoga execução pública dos helpers antigos', async () => {
  const sql = await loadMigration();
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+public\.is_bc_admin\(\)\s+from\s+anon\s*,\s*authenticated/);
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+public\.is_bc_active_colaborador\(\)\s+from\s+anon\s*,\s*authenticated/);
});

test('hardening fixa search_path do trigger e dos helpers', async () => {
  const sql = await loadMigration();
  assert.match(sql, /alter\s+function\s+public\.bc_set_updated_at\(\)\s+set\s+search_path/);
  assert.match(sql, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public\s*,\s*auth/);
});

test('hardening faz as políticas consumirem apenas helpers privados', async () => {
  const sql = await loadMigration();
  assert.match(sql, /alter\s+policy\s+"?staff_profiles_admin_all"?[\s\S]*private\.is_bc_admin\(\)/);
  assert.match(sql, /alter\s+policy\s+"?agendamentos_colaborador_select"?[\s\S]*private\.is_bc_active_colaborador\(\)/);
  assert.match(sql, /alter\s+policy\s+"?pagamentos_admin_all"?[\s\S]*private\.is_bc_admin\(\)/);
});
