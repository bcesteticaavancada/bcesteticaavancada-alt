import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createSupportHandler} from '../../supabase/functions/client-support/handler.mjs';

const actor='a1000000-0000-4000-8000-000000000001',session='a1000000-0000-4000-8000-000000000010',clientId='a1000000-0000-4000-8000-000000000005',documentId='a1000000-0000-4000-8000-000000000011';
const token='x.'+Buffer.from(JSON.stringify({sub:actor,session_id:session})).toString('base64url')+'.x';
function fixture({rpcError=null,authError=null}={}){
  const calls=[],uploads=[],removed=[],invites=[];
  const service={rpc:async(name,args)=>{calls.push({name,...args});if(rpcError)return {error:rpcError};const action=args.p_action;return {data:action==='invite_reserve'?{invitationId:documentId}:action==='download'?{path:'documentos/consentimentos/ficticio.pdf',clientName:'Pessoa fictícia',title:'Consentimento'}:action==='register_returned'?{fileId:documentId}:{client:{id:clientId,nome:'Pessoa fictícia',telefone:'31000000000',updated_at:'2026-10-25T12:00:00Z'},documents:[]}};},auth:{admin:{inviteUserByEmail:async(email,options)=>{invites.push({email,options});return {data:{user:{id:documentId}}};}}},storage:{from:()=>({upload:async(path,bytes,options)=>{uploads.push({path,bytes:Buffer.from(bytes),options});return {error:null};},remove:async(paths)=>{removed.push(paths);return {error:null};},createSignedUrl:async(path)=>({data:{signedUrl:'https://example.invalid/private-document'}})})}};
  const handler=createSupportHandler({crypto:webcrypto,makeClients:()=>({caller:{auth:{getUser:async received=>({data:authError?null:{user:{id:actor}},error:authError||(received!==token?{message:'Invalid token'}:null)})}},service})});
  const request=body=>new Request('https://example.invalid/client-support',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',origin:'https://bcesteticaavancada.github.io'},body:JSON.stringify(body)});
  return {handler,request,calls,uploads,removed,invites};
}
test('support rejects unauthenticated calls and foreign origins before creating clients',async()=>{
  let created=0;const handler=createSupportHandler({makeClients:()=>{created++;throw Error('must not run');}});
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST',body:'{}'}))).status,401);
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://evil.invalid'},body:'{}'}))).status,403);
  assert.equal(created,0);
});
test('support binds actor and session to the authenticated identity and fixed service RPC',async()=>{
  const f=fixture();const response=await f.handler(f.request({action:'client_get',clientId,reason:'Apoio cadastral'}));
  assert.equal(response.status,200);assert.equal((await response.json()).client.id,clientId);
  assert.equal(f.calls[0].name,'bc_support_service');assert.equal(f.calls[0].p_actor_id,actor);assert.equal(f.calls[0].p_session_id,session);
});
test('support denies role escalation and unexpected identity fields without sending invitations',async()=>{
  const f=fixture();assert.equal((await f.handler(f.request({action:'invite',name:'Fictícia',email:'teste@example.invalid',role:'admin'}))).status,400);
  assert.equal(f.invites.length,0);assert.equal(f.calls.length,0);
  assert.equal((await f.handler(f.request({action:'client_get',clientId,reason:'Apoio',actorId:actor}))).status,400);
});
test('support returns forbidden when current database authorization rejects an old token',async()=>{
  const f=fixture({rpcError:{code:'42501',message:'internal protected detail'}});const r=await f.handler(f.request({action:'client_get',clientId,reason:'Apoio cadastral'}));
  assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/internal protected detail/);
});
test('support rejects financial edits before any database update',async()=>{
  const f=fixture();const r=await f.handler(f.request({action:'client_update',clientId,expectedUpdatedAt:'2026-10-25T12:00:00Z',patch:{nome:'Fictícia',final_price:900},reason:'Correção'}));
  assert.equal(r.status,400);assert.equal(f.calls.length,0);
});
test('clinical activation remains a server-authorized operation with no role parameter',async()=>{
  const f=fixture({rpcError:{code:'42501'}});const r=await f.handler(f.request({action:'activate_staff',userId:documentId}));
  assert.equal(r.status,403);assert.equal(f.calls[0].p_action,'activate_staff');
  assert.equal((await f.handler(f.request({action:'activate_staff',userId:documentId,role:'admin'}))).status,400);
});
test('support invitation creates only the server-defined collaborator flow',async()=>{
  const f=fixture();const r=await f.handler(f.request({action:'invite',name:'Colaboradora fictícia',email:'novo@example.invalid'}));
  assert.equal(r.status,200);assert.deepEqual(f.calls.map(c=>c.p_action),['invite_reserve','invite_finish']);assert.equal(f.invites.length,1);
  assert.equal(f.invites[0].options.redirectTo,'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/redefinir-senha/');
  assert.deepEqual(f.invites[0].options.data,{display_name:'Colaboradora fictícia'});
});
function uploadRequest(bytes){const form=new FormData();for(const [key,value] of Object.entries({action:'upload_returned',clientId,documentId,reason:'Cópia devolvida'}))form.set(key,value);form.set('file',new File([bytes],'consentimento.pdf',{type:'application/pdf'}));return new Request('https://example.invalid/client-support',{method:'POST',headers:{authorization:`Bearer ${token}`},body:form});}
test('returned consent upload preserves PDF bytes and registers the original client/document',async()=>{
  const f=fixture();const bytes=Buffer.from('%PDF-1.4\nTESTE DE FLUXO — SEM VALIDADE CLINICA\n');const r=await f.handler(uploadRequest(bytes));
  assert.equal(r.status,200);assert.deepEqual(f.uploads[0].bytes,bytes);assert.equal(f.uploads[0].options.upsert,false);
  assert.deepEqual(f.calls.map(c=>c.p_action),['upload_check','register_returned']);const payload=f.calls.at(-1).p_payload;
  assert.equal(payload.clientId,clientId);assert.equal(payload.documentId,documentId);assert.equal(payload.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(payload.sizeBytes,bytes.length);assert.match(payload.storagePath,new RegExp('^arquivos-clientes/'+clientId+'/'));
  assert.equal(f.invites.length,0);
});
test('returned consent rejects a mislabeled non-PDF without creating a storage object',async()=>{
  const f=fixture();assert.equal((await f.handler(uploadRequest(Buffer.from('not a PDF')))).status,400);assert.equal(f.uploads.length,0);
});
test('failed returned-copy registration cleans the new object and leaves the original alone',async()=>{
  const f=fixture(); // Exercise the real handler with only the DB commit failing.
  const broken=createSupportHandler({crypto:webcrypto,makeClients:()=>({
    caller:{auth:{getUser:async()=>({data:{user:{id:actor}}})}},
    service:{
      rpc:async(name,args)=>args.p_action==='register_returned'?{error:{code:'40001'}}:{data:{}},
      storage:{from:()=>({upload:async(path)=>{f.uploads.push({path});return {};},remove:async(paths)=>{f.removed.push(paths);return {};}})},
    },
  })});
  const r=await broken(uploadRequest(Buffer.from('%PDF-1.4\nTESTE')));assert.equal(r.status,409);assert.deepEqual(f.removed,[[f.uploads[0].path]]);
});
