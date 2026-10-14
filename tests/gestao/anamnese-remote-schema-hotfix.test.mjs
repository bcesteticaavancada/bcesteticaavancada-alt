import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = new URL('../../supabase/migrations/20261014017000_bc_gestao_anamnese_remote_schema_hotfix.sql', import.meta.url);

async function sql() {
  return (await readFile(migration, 'utf8')).toLowerCase().replace(/\s+/g, ' ');
}

test('RPCs remotas atravessam private sem conceder USAGE do schema ao anon', async () => {
  const source = await sql();

  assert.match(source, /create or replace function public\.bc_anamnese_remote_get\(p_token text\)[\s\S]*security definer/);
  assert.match(source, /create or replace function public\.bc_anamnese_remote_save\([\s\S]*security definer/);
  assert.doesNotMatch(source, /grant usage on schema private to anon/);
});

test('anon executa apenas os wrappers públicos, nunca os impls private', async () => {
  const source = await sql();

  assert.match(source, /grant execute on function public\.bc_anamnese_remote_get\(text\) to anon, authenticated/);
  assert.match(source, /grant execute on function public\.bc_anamnese_remote_save\(text,jsonb,boolean\) to anon, authenticated/);
  assert.match(source, /revoke all on function private\.bc_anamnese_remote_get_impl\(text\) from anon, authenticated/);
  assert.match(source, /revoke all on function private\.bc_anamnese_remote_save_impl\(text,jsonb,boolean\) from anon, authenticated/);
});
