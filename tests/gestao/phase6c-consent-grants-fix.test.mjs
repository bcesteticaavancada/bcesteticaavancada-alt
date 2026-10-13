import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir=new URL('../../supabase/migrations/',import.meta.url);
async function loadFix(){const names=await readdir(migrationsDir);const name=names.find((n)=>n.includes('phase6c_consent_rpc_grants_fix')&&n.endsWith('.sql'));assert.ok(name,'migration phase6c_consent_rpc_grants_fix deve existir');return (await readFile(new URL(name,migrationsDir),'utf8')).toLowerCase();}

test('wrappers invoker conseguem executar implementações private sem expor anon',async()=>{
  const sql=await loadFix();
  assert.match(sql,/grant execute on function private\.bc_treatment_prepare_consent_impl\(uuid,uuid,uuid\[\],text\[\],text\) to authenticated/);
  assert.match(sql,/grant execute on function private\.bc_treatment_consent_finalize_impl\(uuid\) to authenticated/);
  assert.match(sql,/revoke execute on function private\.bc_treatment_prepare_consent_impl\([^;]+\) from anon/);
  assert.match(sql,/revoke execute on function private\.bc_treatment_consent_finalize_impl\(uuid\) from anon/);
});