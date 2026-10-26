import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function validateAuditConfig(raw){
 const config=raw?.env||raw;
 let endpoint;try{endpoint=new URL(config?.API_URL);}catch{throw Error('Exige Supabase local isolado.');}
 if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw Error('Exige Supabase local isolado. Produção recusada.');
 const anon=config.ANON_KEY||config.PUBLISHABLE_KEY,service=config.SERVICE_ROLE_KEY||config.SECRET_KEY;
 if(typeof anon!=='string'||!anon||typeof service!=='string'||!service)throw Error('Configuração local incompleta.');
 return {url:endpoint.origin,anon,service};
}

export async function runAuthAudit(config){
 const {url,anon,service}=validateAuditConfig(config);
 const users=[];let passed=0;
 const pass=label=>{passed++;console.log('PASS '+label);};
 async function request(route,{method='GET',key=service,token=key,body,headers={}}={}){
  const response=await fetch(url+route,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await response.json();}catch{}
  return {status:response.status,ok:response.ok,data};
 }
 const period={p_from:'2026-10-01',p_to:'2026-10-31'};
 try{
  for(const role of ['admin','colaborador','admin_criacao']){
   const password=randomBytes(30).toString('base64url')+'aA1!';
   const email='bc-auditoria-'+role+'-'+randomUUID()+'@example.invalid';
   const created=await request('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true,user_metadata:{purpose:'auditoria-efemera-ci'}}});
   assert.ok(created.ok&&created.data?.id,'Criar identidade efêmera '+role);
   const user={id:created.data.id,role,email,password};users.push(user);
   const profile=await request('/rest/v1/staff_profiles',{method:'POST',body:{user_id:user.id,display_name:'Auditoria CI '+role,role,active:true,atende_clientes:false,pode_gerenciar_agendas:false,pode_gerenciar_procedimentos:false,procedure_scope:role==='admin_criacao'?'explicit':'all'}});
   assert.ok(profile.ok,'Provisionar perfil local '+role);
   const login=await request('/auth/v1/token?grant_type=password',{method:'POST',key:anon,body:{email,password}});
   assert.ok(login.ok&&login.data?.access_token&&login.data?.user?.id===user.id,'Autenticar conta de teste '+role);
   user.token=login.data.access_token;
   const own=await request('/rest/v1/staff_profiles?select=user_id,role,active&user_id=eq.'+user.id,{key:anon,token:user.token});
   assert.ok(own.ok&&own.data?.length===1&&own.data[0].role===role&&own.data[0].active===true,'Ler perfil próprio via RLS '+role);
   pass('Auth real e perfil RLS: '+role);
  }
  const colab=users.find(user=>user.role==='colaborador');
  const wrong=await request('/auth/v1/token?grant_type=password',{method:'POST',key:anon,body:{email:colab.email,password:randomBytes(30).toString('hex')}});
  assert.ok(wrong.status>=400&&!wrong.data?.access_token,'Senha incorreta deve ser recusada');pass('Senha incorreta recusada');
  for(const user of users){
   const overview=await request('/rest/v1/rpc/bc_finance_overview',{method:'POST',key:anon,token:user.token,body:period});
   assert.ok(user.role==='admin'?overview.ok:overview.status===403,'Caixa geral restrito ao admin: '+user.role);
   pass('Limite financeiro confirmado em dados locais: '+user.role);
  }
  const mine=await request('/rest/v1/rpc/bc_finance_my_summary',{method:'POST',key:anon,token:colab.token,body:period});
  assert.ok(mine.ok,'Colaboradora pode consultar o próprio resumo local');pass('Resumo próprio da colaboradora');
  const disabled=await request('/rest/v1/staff_profiles?user_id=eq.'+colab.id,{method:'PATCH',body:{active:false}});
  assert.ok(disabled.ok,'Inativar identidade de teste');
  const own=await request('/rest/v1/staff_profiles?select=active&user_id=eq.'+colab.id,{key:anon,token:colab.token});
  assert.ok(own.ok&&(!own.data.length||own.data[0].active===false),'Perfil não pode continuar ativo após inativação');
  const forbidden=await request('/rest/v1/rpc/bc_finance_my_summary',{method:'POST',key:anon,token:colab.token,body:period});
  assert.ok(forbidden.status===403,'Inativação bloqueia RPC protegida');pass('Inativação bloqueia operação autenticada');
 }finally{
  let failed=false;
  for(const user of users.reverse()){
   try{
    await request('/rest/v1/staff_profiles?user_id=eq.'+user.id,{method:'PATCH',body:{active:false}});
    if(user.token)await request('/auth/v1/logout?scope=global',{method:'POST',key:anon,token:user.token});
    const removed=await request('/auth/v1/admin/users/'+user.id,{method:'DELETE'});
    if(!removed.ok)failed=true;
    const check=await request('/auth/v1/admin/users/'+user.id);
    if(check.ok)failed=true;
   }catch{failed=true;}
   delete user.password;delete user.token;
  }
  if(failed)throw Error('Limpeza da auditoria local incompleta. O ambiente efêmero deve ser encerrado.');
  if(users.length)pass('Identidades e sessões efêmeras removidas');
 }
 console.log(passed+' verificações reais de Auth/RLS; nenhum serviço de produção utilizado.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const filename=process.env.BC_AUDIT_STATUS_FILE;if(!filename)throw Error('Configuração local incompleta.');
  await runAuthAudit(JSON.parse(await readFile(filename,'utf8')));
 }catch(error){console.error('Auditoria local: '+error.message);process.exitCode=1;}
}
