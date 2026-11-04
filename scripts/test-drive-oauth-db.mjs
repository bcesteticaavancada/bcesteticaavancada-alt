// Ephemeral PostgreSQL only. Vault's encryption boundary is simulated; no remote DB.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = await import(process.env.BC_PGLITE_MODULE || '@electric-sql/pglite');
const UID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const CLIENT = '530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com';
const CLINICAL_FOLDER = '1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y';
const CLIENT_FOLDER = '1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N';
const migrations = new URL('../supabase/migrations/', import.meta.url);

test('OAuth server store enforces grants, single use, private credentials and exact destinations', async t => {
  const names = (await readdir(migrations)).filter(x => x.endsWith('_bc_drive_oauth_test_setup.sql'));
  assert.equal(names.length, 1, 'OAuth draft migration must exist');
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema vault;
      create table vault.secrets (id uuid primary key default gen_random_uuid(), secret text not null, name text unique, description text);
      create view vault.decrypted_secrets as select id, secret as decrypted_secret from vault.secrets;
      create function vault.create_secret(new_secret text, new_name text default null, new_description text default null, new_key_id uuid default null)
      returns uuid language plpgsql as $$ declare result uuid; begin
        insert into vault.secrets(secret,name,description) values(new_secret,new_name,new_description) returning id into result;
        return result; end $$;
      create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null)
      returns void language sql as $$ update vault.secrets set secret=coalesce(new_secret,secret) where id=secret_id $$;
    `);
    await db.exec(await readFile(new URL(names[0], migrations), 'utf8'));
    async function role(name, fn) {
      await db.exec(`set role ${name}`);
      try { return await fn(); } finally { await db.exec('reset role'); }
    }
    async function store(op, payload = {}, as = 'service_role') {
      return await role(as, async () => {
        const { rows } = await db.query('select public.bc_drive_oauth_store($1,$2::jsonb) as data',
          [op, JSON.stringify({ user_id: UID, client_id: CLIENT, ...payload })]);
        return rows[0].data;
      });
    }
    for (const actor of ['anon', 'authenticated']) await t.test(`${actor} cannot invoke store or read private state`, async () => {
      await assert.rejects(store('status', {}, actor), e => e.code === '42501');
      await assert.rejects(role(actor, () => db.query('select * from private.bc_drive_oauth_connection')), e => e.code === '42501');
      await assert.rejects(role(actor, () => db.query('select * from vault.decrypted_secrets')), e => e.code === '42501');
    });
    await t.test('state is consumed once and replacement invalidates previous attempt', async () => {
      assert.equal(await store('start', { state_hash: 'a'.repeat(64) }), true);
      assert.equal(await store('consume', { state_hash: 'a'.repeat(64) }), true);
      assert.equal(await store('consume', { state_hash: 'a'.repeat(64) }), false);
      await store('start', { state_hash: 'a'.repeat(64) });
      await store('start', { state_hash: 'b'.repeat(64) });
      assert.equal(await store('consume', { state_hash: 'a'.repeat(64) }), false);
      assert.equal(await store('consume', { user_id: OTHER, state_hash: 'b'.repeat(64) }), false);
      assert.equal(await store('consume', { state_hash: 'b'.repeat(64) }), true);
    });
    await t.test('expired state does not authorize callback', async () => {
      await store('start', { state_hash: 'a'.repeat(64) });
      await db.exec("update private.bc_drive_oauth_state set expires_at=clock_timestamp()-interval '1 second'");
      assert.equal(await store('consume', { state_hash: 'a'.repeat(64) }), false);
    });
    await t.test('save is restricted to expected account and client', async () => {
      await assert.rejects(store('save', { account: 'outside@example.com', refresh_token: 'fake-refresh-token-12345' }));
      await assert.rejects(store('save', { account: 'decolarbh@gmail.com', client_id: 'foreign-client', refresh_token: 'fake-refresh-token-12345' }));
      assert.equal(await store('save', { account: 'decolarbh@gmail.com', refresh_token: 'fake-refresh-token-12345' }), true);
    });
    await t.test('status exposes booleans; token read remains server-only and owner-bound', async () => {
      assert.deepEqual(await store('status'), { connected: true, folders_ready: false });
      assert.equal((await store('read')).refresh_token, 'fake-refresh-token-12345');
      assert.equal(await store('read', { user_id: OTHER }), null);
      assert.deepEqual(await store('status', { user_id: OTHER }), { connected: false, folders_ready: false });
    });
    await t.test('ready accepts only the two configured folders', async () => {
      await assert.rejects(store('ready', { clinical: 'outside', client: CLIENT_FOLDER }));
      assert.equal(await store('ready', { clinical: CLINICAL_FOLDER, client: CLIENT_FOLDER }), true);
      assert.deepEqual(await store('status'), { connected: true, folders_ready: true });
    });
    await t.test('reauthorization updates one Vault secret and requires folder revalidation', async () => {
      await store('save', { account: 'decolarbh@gmail.com', refresh_token: 'fake-rotated-refresh-token-12345' });
      assert.deepEqual(await store('status'), { connected: true, folders_ready: false });
      assert.equal((await store('read')).refresh_token, 'fake-rotated-refresh-token-12345');
      assert.equal((await db.query('select count(*)::int as n from vault.secrets')).rows[0].n, 1);
    });
  } finally { await db.close(); }
});
