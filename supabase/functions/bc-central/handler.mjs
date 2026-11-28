import {dateWindow,subjects} from './providers.mjs';
const actions=['status','search','analytics','checks','vitals','cash','brief','workspace'];
const costly=new Set(['brief','workspace']);
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const enc=new TextEncoder();
const asHex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');

async function approval(secret,actor,body,now,token) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const expires=token ? Number(token.split('.')[0]) : now+300000;
  const message=enc.encode([actor,body.action,body.topic||'',body.key,expires].join('|'));
  if (!token) return expires+'.'+asHex(await crypto.subtle.sign('HMAC',key,message));
  if (!/^\d{13}\.[a-f\d]{64}$/.test(token) || expires<=now || expires>now+300000) return false;
  const sig=Uint8Array.from(token.split('.')[1].match(/../g),b=>parseInt(b,16));
  return crypto.subtle.verify('HMAC',key,sig,message);
}

async function readBody(req){
  if (!req.body || Number(req.headers.get('content-length'))>2048) throw Error();
  const reader=req.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let size=0,text='';
  try {
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>2048){await reader.cancel();throw Error();}
      text+=decoder.decode(value,{stream:true});
    }
    return JSON.parse(text+decoder.decode());
  } finally {reader.releaseLock();}
}

export function createHandler({origin,enabled,secret,identify,ledger,providers,cash,clock=()=>new Date()}) {
  return async function handle(req){
    const allowed=Boolean(origin && req.headers.get('origin')===origin);
    const headers={'Cache-Control':'no-store','Vary':'Origin','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
    if(allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
    const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
    if(!enabled)return reply(503,{error:'homologacao_indisponivel'});
    if(!allowed)return reply(403,{error:'origem'});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply(405,{error:'metodo'});
    if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return reply(415,{error:'formato'});
    const bearer=req.headers.get('authorization')||'';
    if(!/^Bearer [^\s]{1,8192}$/.test(bearer))return reply(401,{error:'sessao'});
    let profile;
    try {profile=await identify(bearer);} catch {return reply(503,{error:'autenticacao_indisponivel'});}
    if(!profile)return reply(401,{error:'sessao'});
    if(!profile.active || !['admin','admin_criacao'].includes(profile.role))return reply(403,{error:'perfil'});
    let b;
    try {b=await readBody(req);}catch{return reply(400,{error:'pedido'});}
    if(!b || Array.isArray(b) || !actions.includes(b.action) || !uuid.test(b.key||'') ||
       Object.keys(b).some(k=>!['action','key','topic','approval','prepare'].includes(k)) ||
       (b.action==='brief' ? !Object.hasOwn(subjects,b.topic) : 'topic' in b) ||
       ('prepare' in b && (b.prepare!==true || !costly.has(b.action))) ||
       ('approval' in b && (!costly.has(b.action) || b.prepare || typeof b.approval!=='string')))return reply(400,{error:'pedido'});
    if(b.action==='cash' && profile.role!=='admin')return reply(403,{error:'perfil'});
    if(b.action in providers.configured && !providers.configured[b.action])return reply(503,{error:'configuracao'});
    const now=clock();
    try {
      if(costly.has(b.action)){
        if(!secret || secret.length<32)return reply(503,{error:'configuracao'});
        if(b.prepare){
          const prepKey=crypto.randomUUID();
          const slot=await ledger.begin(profile.id,prepKey,'status');
          if(slot.state!=='nova')return reply(429,{error:'limite'});
          const challenge=await approval(secret,profile.id,b,now.getTime());
          await ledger.finish(profile.id,prepKey,'concluida',null,null);
          return reply(200,{approval:challenge});
        }
        if(!b.approval || !await approval(secret,profile.id,b,now.getTime(),b.approval))return reply(403,{error:'confirmacao'});
      }
      const slot=await ledger.begin(profile.id,b.key,b.action);
      if(slot.state==='limite')return reply(429,{error:'limite'});
      if(slot.state!=='nova'){
        if(slot.state==='concluida' && b.action==='workspace' && slot.document)return reply(200,{document:slot.document});
        return reply(409,{error:'pedido_ja_registrado',state:slot.state});
      }
      try {
        const period=dateWindow(now);
        let result;
        switch(b.action){
          case 'status': result={role:profile.role,environment:'homologacao',observed:now.toISOString(),
            configured:{...providers.configured,brief:Boolean(providers.configured.brief && secret?.length>=32),workspace:Boolean(providers.configured.workspace && secret?.length>=32)},
            scopes:providers.scopes,...await ledger.history(profile.id)};break;
          case 'cash': result={period,...await cash(bearer,period)};break;
          case 'brief': result=await providers.brief(b.topic);break;
          case 'workspace': result=await providers.workspace(period,b.key);break;
          default: result=await providers[b.action](period);
        }
        await ledger.finish(profile.id,b.key,'concluida',null,result.document||null);
        return reply(200,result);
      }catch(error){
        const code=error.message==='configuracao'?'configuracao':'provedor';
        await ledger.finish(profile.id,b.key,costly.has(b.action)?'incerta':'falha',code,null);
        return reply(502,{error:code});
      }
    }catch{return reply(503,{error:'auditoria_indisponivel'});}
  };
}
