// Local, disposable PostgreSQL. No connection to Supabase/Google.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const migrations = new URL('../supabase/migrations/', import.meta.url);
const UID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const CLIENT = '530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com';
const OLD = 'fictional-current-refresh-token';
const NEW = 'fictional-candidate-refresh-token';
const hash = s => createHash('sha256').update(s).digest('hex');

test('atomic OAuth rotation preserves active backups and rejects races', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;create role authenticated;create role service_role;
      create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat('ab',n),'hex')$$;
      create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text,name text unique,description text);
      create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
      create function vault.create_secret(new_secret text,new_name text default null,new_description text default null) returns uuid language plpgsql as $$declare result uuid;begin insert into vault.secrets(secret,name,description) values(new_secret,new_name,new_description) returning id into result;return result;end$$;
      create function vault.update_secret(secret_id uuid,new_secret text default null) returns void language sql as $$update vault.secrets set secret=new_secret where id=secret_id$$;
      create schema net;create table net.http_request_queue(id bigint);
      create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 1000) returns bigint language sql as $$select 1::bigint$$;
    `);
    const names = await readdir(migrations);
    await db.exec(await readFile(new URL(names.find(n => n.endsWith('_bc_drive_oauth_test_setup.sql')), migrations), 'utf8'));
    const backup = await readFile(new URL(names.find(n => n.endsWith('_bc_drive_automatic_backup.sql')), migrations), 'utf8');
    await db.exec(backup.replace(/^create extension[^;]+;/gm,''));
    const rotation = names.find(n => n.endsWith('_bc_drive_oauth_safe_rotation.sql'));
    if (rotation) await db.exec(await readFile(new URL(rotation, migrations), 'utf8'));
    async function role(as, fn) { await db.exec('set role '+as);try{return await fn();}finally{await db.exec('reset role');} }
    async function store(op,p={}) {return await role('service_role',async()=> (await db.query('select public.bc_drive_oauth_store($1,$2::jsonb) as data',[op,JSON.stringify({user_id:UID,client_id:CLIENT,...p})])).rows[0].data);}
    async function rotate(p={},as='service_role') {return await role(as,async()=> (await db.query('select public.bc_drive_oauth_rotate($1::jsonb) as data',[JSON.stringify({user_id:UID,client_id:CLIENT,account:'decolarbh@gmail.com',expected_refresh_hash:hash(OLD),refresh_token:NEW,...p})])).rows[0].data);}
    async function seed() {
      await store('save',{account:'decolarbh@gmail.com',refresh_token:OLD});
      await store('ready',{clinical:'1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y',client:'1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N'});
      await db.exec("update private.bc_drive_backup_control set enabled=true,lease_until=null,copy_cursor=repeat('a',64),audit_cursor=repeat('b',64)");
    }
    await seed();
    for(const actor of ['anon','authenticated']) await t.test(actor+' has no execute permission on rotation',async()=>{
      await assert.rejects(rotate({},actor),e=>e.code==='42501');
    });
    await t.test('successful rotation changes one Vault credential and preserves readiness and cron control',async()=>{
      const before=(await db.query('select to_jsonb(c) as value from private.bc_drive_backup_control c')).rows[0].value;
      assert.equal(await rotate(),true);
      assert.equal((await store('read')).refresh_token,NEW);
      assert.deepEqual(await store('status'),{connected:true,folders_ready:true});
      assert.deepEqual((await db.query('select to_jsonb(c) as value from private.bc_drive_backup_control c')).rows[0].value,before);
      assert.equal((await db.query("select count(*)::int as n from vault.secrets where name='bc_drive_oauth_test_refresh_v1'")).rows[0].n,1);
    });
    await t.test('active worker lease rejects rotation without altering the current connection',async()=>{
      await seed();await db.exec("update private.bc_drive_backup_control set lease_until=clock_timestamp()+interval '2 minutes'");
      assert.equal(await rotate(),false);assert.equal((await store('read')).refresh_token,OLD);
      assert.deepEqual(await store('status'),{connected:true,folders_ready:true});
    });
    await t.test('stale handshake cannot replace a newer refresh credential',async()=>{
      await seed();assert.equal(await rotate({expected_refresh_hash:hash('fictional-stale-token')}),false);
      assert.equal((await store('read')).refresh_token,OLD);
    });
    await t.test('rotation is owner/account/client bound and requires an already ready connection',async()=>{
      await seed();
      for(const p of [{user_id:OTHER},{account:'outside@example.invalid'},{client_id:'foreign-client'}]) {
        await assert.rejects(rotate(p));assert.equal((await store('read')).refresh_token,OLD);
      }
      await db.exec('update private.bc_drive_oauth_connection set folders_ready=false');
      assert.equal(await rotate(),false);assert.equal((await store('read')).refresh_token,OLD);
    });
    await t.test('disabled worker and malformed credentials cannot be silently enabled or saved',async()=>{
      await seed();await db.exec('update private.bc_drive_backup_control set enabled=false');
      assert.equal(await rotate(),false);
      await assert.rejects(rotate({refresh_token:''}));await assert.rejects(rotate({expected_refresh_hash:'wrong'}));
      assert.equal((await store('read')).refresh_token,OLD);
    });
    await t.test('Vault failure rolls back the statement and keeps readiness and the original token',async()=>{
      await seed();
      await db.exec("create or replace function vault.update_secret(secret_id uuid,new_secret text default null) returns void language plpgsql as $$begin raise exception 'fictional storage outage';end$$");
      await assert.rejects(rotate());
      assert.equal((await store('read')).refresh_token,OLD);
      assert.deepEqual(await store('status'),{connected:true,folders_ready:true});
    });
  } finally { await db.close(); }
});
