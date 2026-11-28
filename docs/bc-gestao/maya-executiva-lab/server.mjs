import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname,extname} from 'node:path';
import {ReviewStore,fault,actorDemo,digest} from './store.mjs';
import {MAX_BYTES} from './media-format.mjs';
import {activeCentralProfile,canReadCash} from '../../../supabase/functions/bc-central/handler.mjs';
import {createLocalCash} from './central-local.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const choices=new Map(Object.entries({
 '/':'web/index.html','/style.css':'web/style.css','/app.mjs':'web/app.mjs','/scan.mjs':'web/scan.mjs','/media.mjs':'web/media.mjs',
 '/contract.mjs':'contract.mjs','/extract.mjs':'extract.mjs','/media-format.mjs':'media-format.mjs',
 '/maya-finance-preview/engine.mjs':'../maya-finance-preview/engine.mjs','/envelope-v1.schema.json':'envelope-v1.schema.json'
}));
const lock=JSON.parse(await readFile(join(root,'assets.lock.json'),'utf8'));
for(const p of Object.values(lock.packages))for(const item of Object.values(p.files))choices.set('/assets/'+item.path,'.assets/'+item.path);
for(const name of Object.keys(lock.models))choices.set('/assets/'+name,'.assets/'+name);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm'};
const csp="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob:; img-src 'self' blob: data:; media-src blob:; style-src 'self'; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
async function body(req,limit){
 const buffers=[];let count=0;
 if(Number(req.headers['content-length'])>limit)throw fault(413,'Arquivo muito grande.');
 for await(const chunk of req){count+=chunk.length;if(count>limit)throw fault(413,'Arquivo muito grande.');buffers.push(chunk);}
 return Buffer.concat(buffers);
}
const wallClock=()=>Date.now();
export async function startLab({port=0,store=new ReviewStore(),clock=wallClock}={}){
 const tickets=new Map(),sessions=new Map();
 let origin,cash;
 const sessionFor=sid=>{
  const session=sid&&sessions.get(digest(sid));
  if(!session||session.until<=clock())return null;
  const profile=store.profile(session.id);
  return profile?{...session,...profile}:null;
 };
 const issue=(id=actorDemo,role='admin')=>{
  store.db.prepare('INSERT INTO profiles(id,role,active) VALUES(?,?,1) ON CONFLICT(id) DO NOTHING').run(id,role);
  const t=randomBytes(32).toString('hex');tickets.set(digest(t),{id,until:clock()+300000});return t;
 };
 const server=http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','Content-Security-Policy':csp,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Permissions-Policy':'microphone=(self), camera=(self), geolocation=()','Cross-Origin-Resource-Policy':'same-origin','X-Frame-Options':'DENY'};
  const json=(data,status=200,more={})=>{res.writeHead(status,{...headers,'Content-Type':'application/json',...more});res.end(JSON.stringify(data));};
  try{
   if(req.headers.host!==new URL(origin).host)throw fault(403,'Origem indisponível.');
   const path=new URL(req.url,origin).pathname;
   if(req.method==='GET'&&choices.has(path)){
    let bytes;try{bytes=await readFile(join(root,choices.get(path)));}catch{throw fault(404,'Recurso local indisponível.');}
    res.writeHead(200,{...headers,'Content-Type':mime[extname(choices.get(path))]||'application/octet-stream'});res.end(bytes);return;
   }
   if(req.method!=='POST'||!path.startsWith('/api/'))throw fault(404,'Recurso indisponível.');
   if(req.headers.origin!==origin)throw fault(403,'Origem indisponível.');
   const isDocument=path==='/api/original',contentType=req.headers['content-type']?.split(';')[0];
   if(contentType!==(isDocument?'application/octet-stream':'application/json'))throw fault(415,'Formato indisponível.');
   // Authenticate before reading any medium. Audio bytes are never accepted as an operation.
   const sid=(req.headers.cookie||'').match(/(?:^|;\s*)maya_lab=([a-f0-9]{64})(?:;|$)/)?.[1];
   const p=sessionFor(sid);
   if(path!=='/api/session'&&!p)throw fault(401,'Sessão expirada. Abra o acesso local de homologação.');
   if(!['/api/session','/api/logout','/api/cash'].includes(path)&&!canReadCash(p)){
    const operation=({'/api/confirm':'confirmar','/api/original':'documento','/api/history':'historico','/api/client':'cadastro','/api/review':'revisao'})[path]||'acesso';
    store.event(p,{id:randomUUID(),tipo:operation},'negada_rbac');
    throw fault(403,'Acesso indisponível para este perfil.');
   }
   let b={};
   if(!isDocument){try{b=JSON.parse(await body(req,64000));}catch(error){throw error.status?error:fault(400,'Pedido inválido.');}
    if(!b||typeof b!=='object'||Array.isArray(b))throw fault(400,'Pedido inválido.');
   }
   const keys=(...allowed)=>{if(Object.keys(b).some(k=>!allowed.includes(k)))throw fault(400,'Campos não autorizados.');};
   if(path==='/api/session'){
    keys('ticket');
    if(!b.ticket&&p&&activeCentralProfile(p))return json({ready:true,operacional:canReadCash(p)});
    if(typeof b.ticket!=='string'||b.ticket.length!==64)throw fault(401,'Abra o endereço gerado para esta sessão.');
    const key=digest(b.ticket),access=tickets.get(key);tickets.delete(key);
    if(!access||access.until<=clock())throw fault(401,'Acesso local expirado.');
    const profile=store.profile(access.id);
    if(!activeCentralProfile(profile))throw fault(403,'Perfil indisponível.');
    const secret=randomBytes(32).toString('hex'),session={id:profile.id,session:randomUUID(),until:clock()+45*60000};
    sessions.set(digest(secret),session);
    return json({ready:true,operacional:canReadCash(profile)},200,{'Set-Cookie':'maya_lab='+secret+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=2700'});
   }
   if(path==='/api/logout'){sessions.delete(digest(sid));return json({ok:true},200,{'Set-Cookie':'maya_lab=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
   if(path==='/api/intake'){keys('propostas');return json(store.intake(p,b.propostas));}
   if(path==='/api/review'){keys('id','campos','homonimo');return json(store.review(p,b.id,b.campos,{homonimo:b.homonimo}));}
   if(path==='/api/confirm'){keys('id','token');return json(store.confirm(p,b.id,b.token));}
   if(isDocument){
    const id=req.headers['x-review-id'],token=req.headers['x-review-token'];
    const draft=JSON.parse(store.get(p,id).body);
    if(draft.tipo!=='documento')throw fault(415,'Somente o original documental é aceito.');
    return json(store.confirm(p,id,token,await body(req,MAX_BYTES)));
   }
   if(path==='/api/invalidate'){keys('id');return json(store.invalidate(p,b.id));}
   if(path==='/api/cancel'){keys('id');return json(store.cancel(p,b.id));}
   const sendRead=(kind,data)=>{
    store.event(p,{id:randomUUID(),tipo:kind},'consultada');
    return json(data);
   };
   if(path==='/api/list'){keys('tipo');return sendRead('listagem',store.list(p,b.tipo));}
   if(path==='/api/history'){keys();return sendRead('historico',store.history(p));}
   if(path==='/api/client'){keys('id');return sendRead('cadastro',store.clientFile(p,b.id));}
   if(path==='/api/cash'){
    keys();const key=randomUUID(),response=await cash(sid,key);
    if(response.status===403)store.event(p,{id:key,tipo:'caixa'},'negada_rbac');
    return json(await response.json(),response.status);
   }
   if(path==='/api/features'){keys();const exists=async n=>access(join(root,'.assets',n)).then(()=>true,()=>false);return json({voice:await exists('vosk.js')&&await exists('voz-pt.tar.gz')});}
   throw fault(404,'Recurso indisponível.');
  }catch(err){json({error:err.status||!err.code?String(err.message).slice(0,220):'A operação não foi concluída.'},err.status||400);}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});
 origin='http://127.0.0.1:'+server.address().port;
 cash=createLocalCash({origin,store,sessionFor,clock});
 const close=()=>{server.close();server.closeAllConnections();};
 const lifetime=setTimeout(close,60*60000);lifetime.unref();
 server.on('close',()=>{clearTimeout(lifetime);sessions.clear();tickets.clear();store.db.close();});
 return {origin,issue,close};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const lab=await startLab();console.log('Maya Executiva · homologação com dados fictícios\nAbra em até cinco minutos no mesmo aparelho:\n'+lab.origin+'/#'+lab.issue()+'\nCtrl+C encerra e descarta a sessão.');
}
