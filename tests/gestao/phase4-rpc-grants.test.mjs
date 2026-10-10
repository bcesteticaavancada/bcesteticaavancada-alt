import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20261010_bc_gestao_phase4_rpc_grants_fix.sql', import.meta.url);

const publicSignatures = [
  'public.bc_cliente_create(text, text, text)',
  'public.bc_cliente_update(uuid, text, text, text)',
  'public.bc_cliente_set_active(uuid, boolean)',
  'public.bc_agendamento_create(uuid, uuid, uuid, timestamptz, timestamptz, text)',
  'public.bc_agendamento_update(uuid, uuid, timestamptz, timestamptz, text)',
];

const privateSignatures = [
  'private.bc_cliente_create_impl(text, text, text)',
  'private.bc_cliente_update_impl(uuid, text, text, text)',
  'private.bc_cliente_set_active_impl(uuid, boolean)',
  'private.bc_agendamento_create_impl(uuid, uuid, uuid, timestamptz, timestamptz, text)',
  'private.bc_agendamento_update_impl(uuid, uuid, timestamptz, timestamptz, text)',
];

test('hardening da Fase 4 segue o contrato de grants da Fase 3', async () => {
  const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase().replace(/\s+/g, ' ');

  for (const signature of publicSignatures) {
    const sig = signature.toLowerCase();
    assert.match(sql, new RegExp(`revoke all on function ${sig.replace(/[()]/g, '\\$&')} from public`));
    assert.match(sql, new RegExp(`revoke execute on function ${sig.replace(/[()]/g, '\\$&')} from anon`));
    assert.match(sql, new RegExp(`grant execute on function ${sig.replace(/[()]/g, '\\$&')} to authenticated`));
  }

  for (const signature of privateSignatures) {
    const sig = signature.toLowerCase();
    assert.match(sql, new RegExp(`revoke all on function ${sig.replace(/[()]/g, '\\$&')} from public`));
    assert.match(sql, new RegExp(`revoke execute on function ${sig.replace(/[()]/g, '\\$&')} from anon`));
    assert.match(sql, new RegExp(`grant execute on function ${sig.replace(/[()]/g, '\\$&')} to authenticated`));
  }
});
