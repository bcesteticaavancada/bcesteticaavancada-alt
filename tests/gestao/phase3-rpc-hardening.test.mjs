import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261009_bc_gestao_phase3_rpc_hardening.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

const publicFunctions = [
  'bc_set_agendamento_status',
  'bc_registrar_atendimento',
  'bc_staff_directory',
];

test('hardening troca RPCs públicas para security invoker', async () => {
  const sql = await loadMigration();
  for (const fn of publicFunctions) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`));
  }
  const publicSections = sql.split(/create\s+or\s+replace\s+function\s+private\./)[0];
  assert.doesNotMatch(publicSections, /security\s+definer/);
  assert.match(publicSections, /security\s+invoker/);
});

test('hardening move lógica privilegiada para schema private', async () => {
  const sql = await loadMigration();
  for (const fn of publicFunctions) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl`));
  }
  assert.match(sql, /security\s+definer/);
  assert.match(sql, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public\s*,\s*auth\s*,\s*private/);
});

test('hardening mantém wrappers autenticados, bloqueia anon e não expõe impl privadas', async () => {
  const sql = await loadMigration();
  for (const fn of publicFunctions) {
    assert.match(sql, new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*from\\s+anon`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*to\\s+authenticated`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+private\\.${fn}_impl[\\s\\S]*to\\s+authenticated`));
  }
  assert.doesNotMatch(sql, /grant\s+execute\s+on\s+function\s+private\.[^;]+to\s+anon/);
});
