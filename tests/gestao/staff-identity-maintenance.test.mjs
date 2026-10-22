import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../../scripts/ops/staff-identity-maintenance/handler.mjs').catch(()=>null);
const taskId='00000000-0000-4000-8000-000000000001';
const uid='00000000-0000-4000-8000-000000000002';
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const secret='test-only-'+('a'.repeat(64));
function fixture(){
 const task={id:taskId,action:'staff_identity_reassign_planned',new_data:{user_id:uid,old_email:'creator@example.invalid',new_email:'alice@example.invalid',display_name:'Alice',redirect_to:'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/redefinir-senha/'}};
 const user={id:uid,email:'creator@example.invalid',app_metadata:{existing:true},identities:[{provider:'email'}],phone:'',factors:[]};
 const staff={user_id:uid,display_name:'Alice',role:'colaborador',active:true};
 const state={task,user,staff,recovery:[],updates:0,clientCalls:0};
 const client={from(table){state.clientCalls++;let patch=null;const filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},update(v){patch=v;return q;},async maybeSingle(){const row=table==='audit_log'?task:staff;if(!filters.every(([k,v])=>row[k]===v))return {data:null,error:null};if(patch)Object.assign(row,patch);return {data:structuredClone(row),error:null};},then(resolve){if(patch)Object.assign(task,patch);return Promise.resolve({data:null,error:null}).then(resolve);}};return q;},auth:{admin:{async getUserById(id){assert.equal(id,uid);return {data:{user:structuredClone(user)},error:null};},async updateUserById(id,patch){assert.equal(id,uid);state.updates++;Object.assign(user,patch);return {data:{user:structuredClone(user)},error:null};}},async resetPasswordForEmail(email,opts){state.recovery.push({email,opts});return {error:null};}}};
 return {state,client};
}
async function handler(f,opts={}){assert.ok(mod?.createMaintenanceHandler,'maintenance handler is not implemented');return mod.createMaintenanceHandler({taskId,keyHash:await digest(secret),expiresAt:Date.now()+60000,clientFactory:()=>f.client,...opts});}
function request(key=secret){return new Request('https://maintenance.invalid',{method:'POST',headers:{authorization:`Bearer ${key}`}});}
test('maintenance rejects wrong authorization before touching Auth or database',async()=>{const f=fixture();const run=await handler(f);assert.equal((await run(request('wrong'))).status,401);assert.equal(f.state.clientCalls,0);assert.equal(f.state.updates,0);});
test('maintenance rejects expired task before touching Auth or database',async()=>{const f=fixture();const run=await handler(f,{expiresAt:Date.now()-1});assert.equal((await run(request())).status,410);assert.equal(f.state.clientCalls,0);});
test('maintenance preserves user id, rotates old password and sends recovery to corrected email',async()=>{const f=fixture();const run=await handler(f);const response=await run(request());assert.equal(response.status,200);const body=await response.text();assert.equal(f.state.user.id,uid);assert.equal(f.state.user.email,'alice@example.invalid');assert.ok(f.state.user.password.length>=40);assert.equal(f.state.user.app_metadata.existing,true);assert.equal(f.state.recovery[0].email,'alice@example.invalid');assert.doesNotMatch(body,new RegExp(f.state.user.password));assert.equal(f.state.task.action,'staff_identity_reassigned');assert.equal((await run(request())).status,409);assert.equal(f.state.updates,1);});
test('maintenance refuses a different existing account email without changing credentials',async()=>{const f=fixture();f.state.user.email='unrelated@example.invalid';const run=await handler(f);assert.equal((await run(request())).status,409);assert.equal(f.state.updates,0);});

test('maintenance refuses a changed staff role',async()=>{const f=fixture();f.state.staff.role='admin';const run=await handler(f);assert.equal((await run(request())).status,409);assert.equal(f.state.updates,0);});
test('two simultaneous requests cannot rotate credentials twice',async()=>{const f=fixture();const run=await handler(f);const responses=await Promise.all([run(request()),run(request())]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.state.updates,1);});

test('maintenance refuses alternate sign-in identities or factors',async()=>{for(const extra of [{identities:[{provider:'email'},{provider:'google'}]},{phone:'fake-phone'},{factors:[{id:'fake-factor'}]}]){const f=fixture();Object.assign(f.state.user,extra);const run=await handler(f);assert.equal((await run(request())).status,409);assert.equal(f.state.updates,0);}});
