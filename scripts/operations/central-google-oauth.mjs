import {createServer} from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {scopes} from '../../supabase/functions/bc-central/providers.mjs';

// Executar apenas na estação do administrador com cliente OAuth Desktop de homologação.
const kind=process.argv[2];
if(!Object.hasOwn(scopes,kind))throw Error('Escolha search, analytics ou workspace.');
const {BC_GOOGLE_CLIENT_ID:client,BC_GOOGLE_CLIENT_SECRET:secret,BC_GOOGLE_ADMIN_EMAIL:email}=process.env;
if(!client || !secret || !email)throw Error('Configure o cliente Desktop de homologação e a conta autorizada no ambiente local.');
const verifier=randomBytes(48).toString('base64url'),state=randomBytes(32).toString('hex');
const challenge=createHash('sha256').update(verifier).digest('base64url');
const dest=path.join(homedir(),'.bc-gestao-oauth');
const requested=[scopes[kind],'openid','email'];
let redirect,consumed=false;
const timer=setTimeout(()=>{server.close();console.error('Autorização expirada.');},300000);
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET' || u.pathname!=='/' || consumed){res.writeHead(404).end();return;}
  const supplied=Buffer.from(u.searchParams.get('state')||''),expected=Buffer.from(state);
  if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)){res.writeHead(400).end('Estado inválido.');return;}
  consumed=true;
  try{
    if(!u.searchParams.get('code'))throw Error();
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),body:new URLSearchParams({
      grant_type:'authorization_code',code:u.searchParams.get('code'),client_id:client,client_secret:secret,redirect_uri:redirect,code_verifier:verifier
    })});
    if(!r.ok)throw Error();
    const t=await r.json();
    const granted=(t.scope||'').split(' ');
    if(!t.refresh_token || !t.access_token || !granted.includes(scopes[kind]) ||
       granted.some(s=>![...requested,'https://www.googleapis.com/auth/userinfo.email'].includes(s)))throw Error();
    const who=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+t.access_token}});
    if(!who.ok)throw Error();
    const identity=await who.json();
    if(!identity.email_verified || identity.email?.toLowerCase()!==email.toLowerCase())throw Error();
    await mkdir(dest,{recursive:true,mode:0o700});
    await writeFile(path.join(dest,kind+'-'+Date.now()+'.secret'),t.refresh_token,{mode:0o600,flag:'wx'});
    res.end('Autorização de homologação concluída. Feche esta aba.');
    console.log('Credencial gravada no diretório privado .bc-gestao-oauth da sua conta local. Transfira para o cofre do ambiente isolado.');
  }catch{res.writeHead(400).end('Autorização não concluída. Confira conta, escopo e cliente OAuth.');}
  finally{clearTimeout(timer);server.close();}
});
server.listen(0,'127.0.0.1',()=>{
  redirect='http://127.0.0.1:'+server.address().port+'/';
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:client,redirect_uri:redirect,response_type:'code',scope:requested.join(' '),state,
    code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account',include_granted_scopes:'false'});
  console.log('Abra no navegador da mesma estação:',url.href);
});
