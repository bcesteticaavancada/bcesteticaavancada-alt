import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadCoreMigration() {
  const names = await readdir(migrationsDir);
  const filename = names.find((name) => name.includes('bc_gestao_phase6a_client_core') && name.endsWith('.sql'));
  assert.ok(filename, 'migration bc_gestao_phase6a_client_core deve existir');
  return (await readFile(new URL(filename, migrationsDir), 'utf8')).toLowerCase();
}

test('RPCs públicos v2 revogam PUBLIC e anon e liberam somente authenticated', async () => {
  const sql = await loadCoreMigration();
  const signatures = [
    'public.bc_cliente_create_v2(jsonb)',
    'public.bc_cliente_update_v2(uuid, jsonb)',
    'public.bc_cliente_duplicate_candidates(text, text, date, text)',
  ];
  for (const signature of signatures) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${escaped}\\s+from\\s+public`));
    assert.match(sql, new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+${escaped}\\s+from\\s+anon`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${escaped}\\s+to\\s+authenticated`));
  }
});

test('implementações private não permanecem executáveis por PUBLIC', async () => {
  const sql = await loadCoreMigration();
  for (const signature of [
    'private.bc_cliente_create_v2_impl(jsonb)',
    'private.bc_cliente_update_v2_impl(uuid, jsonb)',
  ]) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${escaped}\\s+from\\s+public`));
  }
});
