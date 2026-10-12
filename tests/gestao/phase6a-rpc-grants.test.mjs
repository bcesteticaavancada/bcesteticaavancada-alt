import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration(fragment) {
  const names = await readdir(migrationsDir);
  const filename = names.find((name) => name.includes(fragment) && name.endsWith('.sql'));
  assert.ok(filename, `migration ${fragment} deve existir`);
  return (await readFile(new URL(filename, migrationsDir), 'utf8')).toLowerCase();
}

function escapedSignature(signature) {
  return signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertPublicGrantContract(sql, signature) {
  const escaped = escapedSignature(signature);
  assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${escaped}\\s+from\\s+public`));
  assert.match(sql, new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+${escaped}\\s+from\\s+anon`));
  assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+${escaped}\\s+to\\s+authenticated`));
}

test('RPCs públicos v2 revogam PUBLIC e anon e liberam somente authenticated', async () => {
  const sql = await loadMigration('bc_gestao_phase6a_client_core');
  for (const signature of [
    'public.bc_cliente_create_v2(jsonb)',
    'public.bc_cliente_update_v2(uuid, jsonb)',
    'public.bc_cliente_duplicate_candidates(text, text, date, text)',
  ]) {
    assertPublicGrantContract(sql, signature);
  }
});

test('implementações private do cadastro não permanecem executáveis por PUBLIC', async () => {
  const sql = await loadMigration('bc_gestao_phase6a_client_core');
  for (const signature of [
    'private.bc_cliente_create_v2_impl(jsonb)',
    'private.bc_cliente_update_v2_impl(uuid, jsonb)',
  ]) {
    const escaped = escapedSignature(signature);
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${escaped}\\s+from\\s+public`));
  }
});

test('RPCs de foto privada seguem o mesmo contrato de grants', async () => {
  const sql = await loadMigration('bc_gestao_phase6a_client_photo');
  for (const signature of [
    'public.bc_cliente_register_id_photo(uuid, text, text, bigint)',
    'public.bc_cliente_set_current_id_photo(uuid, uuid)',
  ]) {
    assertPublicGrantContract(sql, signature);
  }
  for (const signature of [
    'private.bc_cliente_register_id_photo_impl(uuid, text, text, bigint)',
    'private.bc_cliente_set_current_id_photo_impl(uuid, uuid)',
  ]) {
    const escaped = escapedSignature(signature);
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+${escaped}\\s+from\\s+public`));
  }
});

test('tabela de fotos nunca concede escrita direta a authenticated', async () => {
  const sql = await loadMigration('bc_gestao_phase6a_client_photo');
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.cliente_identificacao_fotos\s+from\s+authenticated/);
  assert.match(sql, /grant\s+select\s+on\s+table\s+public\.cliente_identificacao_fotos\s+to\s+authenticated/);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)[\s\S]*cliente_identificacao_fotos[\s\S]*to\s+authenticated/);
});
