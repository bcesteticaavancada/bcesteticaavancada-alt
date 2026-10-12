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

const RPCS = [
  'bc_procedure_list',
  'bc_procedure_get',
  'bc_procedure_save_draft',
  'bc_procedure_publish',
  'bc_procedure_archive',
  'bc_procedure_set_execution_permission',
  'bc_staff_set_procedure_manager',
];

test('RPCs públicas 6C são wrappers invoker e execução é autenticada', async () => {
  const sql = await loadMigration('phase6c_procedure_library');

  for (const name of RPCS) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b[\\s\\S]*?security\\s+invoker`));
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}[^;]*from\\s+public`));
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}[^;]*from\\s+anon`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}[^;]*to\\s+authenticated`));
  }
});

test('lógica privilegiada fica em private com auth.uid e search_path fixo', async () => {
  const sql = await loadMigration('phase6c_procedure_library');

  for (const name of ['bc_procedure_save_draft_impl','bc_procedure_publish_impl','bc_procedure_archive_impl','bc_procedure_set_execution_permission_impl','bc_staff_set_procedure_manager_impl']) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${name}\\b[\\s\\S]*?security\\s+definer[\\s\\S]*?set\\s+search_path\\s*=\\s*''`));
    assert.match(sql, new RegExp(`private\\.${name}[\\s\\S]*?auth\\.uid\\s*\\(`));
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+private\\.${name}[^;]*from\\s+public`));
  }
});

test('ações superiores continuam admin-only enquanto gestão editorial usa capacidade separada', async () => {
  const sql = await loadMigration('phase6c_procedure_library');

  for (const name of ['bc_procedure_archive_impl','bc_procedure_set_execution_permission_impl','bc_staff_set_procedure_manager_impl']) {
    const start = sql.indexOf(`private.${name}`);
    assert.notEqual(start, -1, `${name} deve existir`);
    const block = sql.slice(start, start + 7000);
    assert.match(block, /is_bc_admin/);
  }

  for (const name of ['bc_procedure_save_draft_impl','bc_procedure_publish_impl']) {
    const start = sql.indexOf(`private.${name}`);
    assert.notEqual(start, -1, `${name} deve existir`);
    const block = sql.slice(start, start + 7000);
    assert.match(block, /pode_gerenciar_procedimentos|is_bc_admin/);
  }
});
