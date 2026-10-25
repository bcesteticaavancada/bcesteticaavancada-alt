// Ephemeral PostgreSQL; Vault encryption and pg_net transport are simulated.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {PGlite}=await import(process.env.BC_PGLITE_MODULE||'@electric-sql/pglite');
const migrations=new URL('../supabase/migrations/',import.meta.url);
test('automatic worker store protects credentials, leases and durable version IDs',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat('ab',n),'hex')$$;
   create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text,name text unique,description text);
   create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
   create function vault.create_secret(new_secret text,new_name text default null,new_description text default null) returns uuid language plpgsql as $$declare result uuid;begin insert into vault.secrets(secret,name,description) values(new_secret,new_name,new_description) returning id into result;return result;end$$;
   create function vault.update_secret(secret_id uuid,new_secret text default null) returns void language sql as $$update vault.secrets set secret=new_secret where id=secret_id$$;
   create schema net;create table net.http_request_queue(id bigint);
   create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 1000) returns bigint language sql as $$select 1::bigint$$;
  `);
  const names=await readdir(migrations);
  await db.exec(await readFile(new URL(names.find(n=>n.endsWith('_bc_drive_oauth_test_setup.sql')),migrations),'utf8'));
  let sql=await readFile(new URL(names.find(n=>n.endsWith('_bc_drive_automatic_backup.sql')),migrations),'utf8');
  sql=sql.replace(/^create extension[^;]+;/gm,'');
  await db.exec(sql);
  const uid='00000000-0000-4000-8000-000000000001',client='530925228983-23076omi6omga78n5vavvkfub0v7uaq5.apps.googleusercontent.com';
  await db.exec(`insert into private.bc_drive_oauth_connection(user_id,account,client_id,refresh_secret_id,folders_ready) values('${uid}','decolarbh@gmail.com','${client}',gen_random_uuid(),true)`);
  async function role(as,fn){await db.exec('set role '+as);try{return await fn();}finally{await db.exec('reset role');}}
  async function store(op,p={},as='service_role'){return await role(as,async()=> (await db.query('select public.bc_drive_backup_store($1,$2::jsonb) as data',[op,JSON.stringify(p)])).rows[0].data);}
  for(const actor of ['anon','authenticated'])await t.test(actor+' cannot read or invoke private backup functions',async()=>{
   await assert.rejects(store('begin',{},actor),e=>e.code==='42501');
   await assert.rejects(role(actor,()=>db.query('select * from private.bc_drive_backup_versions')),e=>e.code==='42501');
   await assert.rejects(role(actor,()=>db.query('select private.bc_drive_backup_invoke()')),e=>e.code==='42501');
  });
  await t.test('default disabled, invalid capability rejected without leaking secret',async()=>{
   assert.deepEqual(await store('begin'),{disabled:true});assert.equal(await store('authorize',{secret_hash:'0'.repeat(64)}),false);
   const secret=(await db.query('select secret from vault.secrets')).rows[0].secret;
   assert.equal(await store('authorize',{secret_hash:createHash('sha256').update(secret).digest('hex')}),true);
  });
  await db.exec('update private.bc_drive_backup_control set enabled=true');
  let run;
  await t.test('claim excludes simultaneous writer',async()=>{run=(await store('begin')).run_id;assert.match(run,/^[a-f0-9-]{36}$/);assert.deepEqual(await store('begin'),{busy:true});});
  const path='documentos/fictional/file.pdf',key=createHash('sha256').update('bc-prontuario-private:'+path).digest('hex');
  const payload={run_id:run,source_key:key,source_path:path,source_updated:'2026-10-24T20:00:00Z',hash:'b'.repeat(64),kind:'clinical',bytes:4,mime:'application/pdf',file_id:'durable-id-1'};
  await t.test('reservation fixes Drive ID across retries and metadata changes',async()=>{
   let v=await store('reserve',payload);assert.equal(v.file_id,'durable-id-1');assert.equal(v.status,'pending');
   v=await store('reserve',{...payload,file_id:'discarded-id-2',source_updated:'2026-10-24T21:00:00Z'});assert.equal(v.file_id,'durable-id-1');assert.equal(v.source_updated,'2026-10-24T21:00:00Z');
   await assert.rejects(store('reserve',{...payload,bytes:5}));
   await assert.rejects(store('reserve',{...payload,source_path:'financeiro/file.pdf'}));
   await assert.rejects(store('reserve',{...payload,kind:'client'}));
  });
  await t.test('only matching current lease may verify version or finish run',async()=>{
   await assert.rejects(store('record',{run_id:'00000000-0000-4000-8000-000000000002',source_key:key,hash:payload.hash,file_id:payload.file_id}));
   assert.equal(await store('record',{run_id:run,source_key:key,hash:payload.hash,file_id:payload.file_id}),true);
   const snapshot=await store('snapshot',{run_id:run,source_keys:[key]});assert.equal(snapshot[0].status,'verified');
   assert.deepEqual(await store('snapshot',{run_id:run,source_keys:['c'.repeat(64)]}),[]);
   await assert.rejects(store('snapshot',{run_id:run,source_keys:[]}));
   await assert.rejects(store('snapshot',{run_id:run,source_keys:Array(101).fill(key)}));
   assert.equal(await store('finish',{run_id:run,status:'success',counters:{uploaded:1,scanned:1,private_data:'never persist'},error_code:null,copy_cursor:key,audit_cursor:'c'.repeat(64)}),true);
   const result=(await db.query('select status,counters from private.bc_drive_backup_runs')).rows[0];assert.equal(result.status,'success');assert.equal(result.counters.uploaded,1);assert.equal('private_data' in result.counters,false);
   await assert.rejects(store('assert',{run_id:run}));
   const cursors=(await db.query('select copy_cursor,audit_cursor from private.bc_drive_backup_control')).rows[0];
   assert.equal(cursors.copy_cursor,key);assert.equal(cursors.audit_cursor,'c'.repeat(64));
  });
  await t.test('expired leases become abandoned and cannot write',async()=>{
   const old=(await store('begin')).run_id;await db.exec("update private.bc_drive_backup_control set lease_until=clock_timestamp()-interval '1 second'");
   const current=(await store('begin')).run_id;assert.notEqual(current,old);
   await assert.rejects(store('reserve',{...payload,run_id:old}));
   assert.equal((await db.query('select status from private.bc_drive_backup_runs where id=$1',[old])).rows[0].status,'abandoned');
  });
 }finally{await db.close();}
});
