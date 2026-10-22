import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../../scripts/ops/staff-identity-maintenance/invite.mjs').catch(()=>null);
const key='test-only-key';
const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(n=>n.toString(16).padStart(2,'0')).join('');
function fixture(){
 const task={id:'task',action:'staff_creation_invite_planned',new_data:{email:'creator@example.invalid',display_name:'Creator',role:'admin_criacao',predecessor_task_id:'previous'}};
 const state={calls:0,invites:0,task,previous:{action:'staff_identity_reassigned',new_data:{old_email:'creator@example.invalid',new_email:'alice@example.invalid',user_id:'old-user'}}};
 const client={from(){state.calls++;let patch;const filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},update(v){patch=v;return q;},async maybeSingle(){const row=filters.some(([k,v])=>k==='id'&&v==='previous')?state.previous:task;if(!filters.every(([k,v])=>k==='id'||row[k]===v))return {data:null,error:null};if(patch)Object.assign(row,patch);return {data:structuredClone(row),error:null};},then(resolve){if(patch)Object.assign(task,patch);return Promise.resolve({error:null}).then(resolve);}};return q;},auth:{admin:{async inviteUserByEmail(email,options){state.invites++;assert.equal(email,'creator@example.invalid');assert.match(options.redirectTo,/gestao\/redefinir-senha\/$/);return {data:{user:{id:'new-user',email}},error:null};}}}};
 return {state,client};
}
function handler(f,expiresAt=Date.now()+60000){assert.ok(mod?.createInvitationHandler);return mod.createInvitationHandler({taskId:'task',keyHash:hash,expiresAt,clientFactory:()=>f.client});}
const request=(token=key)=>new Request('https://maintenance.invalid',{method:'POST',headers:{authorization:`Bearer ${token}`}});
test('invite guard rejects invalid authorization and expiry before service client',async()=>{for(const [token,expiry,status] of [['wrong',Date.now()+60000,401],[key,Date.now()-1,410]]){const f=fixture();assert.equal((await handler(f,expiry)(request(token))).status,status);assert.equal(f.state.calls,0);}});
test('invite requires completed identity separation and exact creation role',async()=>{for(const alter of [f=>f.state.previous.action='staff_identity_reassign_running',f=>f.state.task.new_data.role='admin']){const f=fixture();alter(f);assert.equal((await handler(f)(request())).status,409);assert.equal(f.state.invites,0);}});
test('invite creates separate identity once and records new UUID',async()=>{const f=fixture();const run=handler(f);assert.equal((await run(request())).status,200);assert.equal(f.state.task.action,'staff_creation_invited');assert.equal(f.state.task.new_data.user_id,'new-user');assert.equal((await run(request())).status,409);assert.equal(f.state.invites,1);});
test('concurrent invitation requests cannot invite twice',async()=>{const f=fixture();const run=handler(f);const results=await Promise.all([run(request()),run(request())]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.state.invites,1);});
