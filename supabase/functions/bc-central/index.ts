import {createHandler} from './handler.mjs';
import {buildProviders} from './providers.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
const base=env('SUPABASE_URL').replace(/\/$/,'');
const origin=env('BC_CENTRAL_ORIGIN');
const validOrigin=(s:string)=>{try{const u=new URL(s);return s===u.origin && (u.protocol==='https:' || ['localhost','127.0.0.1'].includes(u.hostname)) && !/(^|\.)(bcesteticaavancada\.com\.br|bcesteticaavancada\.github\.io)$/.test(u.hostname);}catch{return false;}};
const approvedBase=env('BC_STAGING_SUPABASE_URL').replace(/\/$/,'');
const enabled=env('BC_ENV')==='homologacao' && validOrigin(origin) && base===approvedBase &&
  /^(https:\/\/[a-z0-9]+\.supabase\.co|http:\/\/(kong:8000|127\.0\.0\.1:54321|localhost:54321))$/.test(base) &&
  !base.includes('tpqsmerlxquyrzrjbogj') && Boolean(env('SUPABASE_SERVICE_ROLE_KEY')) && Boolean(env('SUPABASE_ANON_KEY'));
const service=env('SUPABASE_SERVICE_ROLE_KEY'),anon=env('SUPABASE_ANON_KEY');
async function local(path:string,key:string,authorization:string,input?:unknown){
  const r=await fetch(base+path,{method:input===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)});
  if(!r.ok){if(r.status===401 && path==='/auth/v1/user')return null;throw Error('indisponivel');}
  const content=await r.text();return content?JSON.parse(content):null;
}
const systemRpc=(name:string,input:unknown)=>local('/rest/v1/rpc/'+name,service,'Bearer '+service,input);
Deno.serve(createHandler({origin,enabled,secret:env('BC_APPROVAL_SECRET'),providers:buildProviders(env),
  async identify(jwt:string){
    const user=await local('/auth/v1/user',anon,jwt);
    if(!user?.id)return null;
    const rows=await local('/rest/v1/staff_profiles?select=user_id,active,role&user_id=eq.'+encodeURIComponent(user.id),anon,jwt);
    const p=rows?.[0];return p?.user_id===user.id?{id:user.id,active:p.active===true,role:p.role}:null;
  },
  ledger:{
    async begin(actor:string,key:string,action:string){return {...await systemRpc('bc_central_begin',{p_actor:actor,p_key:key,p_action:action}),key};},
    finish:(actor:string,key:string,state:string,code:string|null,doc:string|null)=>systemRpc('bc_central_finish',{p_actor:actor,p_key:key,p_state:state,p_code:code,p_document:doc}),
    history:(actor:string)=>systemRpc('bc_central_history',{p_actor:actor})
  },
  async cash(jwt:string,p:{start:string,end:string}){
    const data=await local('/rest/v1/rpc/bc_central_cash_period',anon,jwt,{p_from:p.start,p_to:p.end});
    if(typeof data?.income!=='number'||typeof data?.expense!=='number')throw Error('provedor');
    return {income:data.income,expense:data.expense,balance:Math.round((data.income-data.expense)*100)/100};
  }
}));
