// Local TLS rehearsal, no live Auth/Google/Vault calls or customer files.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createOAuthHandler} from '../supabase/functions/_shared/drive-oauth/handler.ts';
const root=resolve(new URL('..',import.meta.url).pathname),temporary=await mkdtemp(join(tmpdir(),'bc-oauth-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-keyout',join(temporary,'key.pem'),'-out',join(temporary,'cert.pem')],{stdio:'ignore'});
const email='decolarbh@gmail.com',uid='00000000-0000-4000-8000-000000000001';
const clinical='1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y',clientFolder='1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N';
let origin,base,googleOrigin,handlers,stateHash='',connection=null,ready=false,challenge='',nativePosts=0;
const errors=[];
const server=createServer({key:await readFile(join(temporary,'key.pem')),cert:await readFile(join(temporary,'cert.pem'))},async(req,res)=>{
  try{
    const url=new URL(req.url,'https://'+req.headers.host);
    if(url.origin===base){
      const kind=url.pathname.split('drive-oauth-')[1];assert(handlers[kind]);
      const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
      if(kind==='start'){nativePosts++;assert.equal(req.method,'POST');assert.equal(new URLSearchParams(body.toString()).get('session'),'fake-bc-session');}
      const response=await handlers[kind](new Request(url,{method:req.method,headers:req.headers,body:req.method==='POST'?body:undefined}));
      const headers=Object.fromEntries(response.headers);
      if(headers.location?.startsWith('https://accounts.google.com/'))headers.location=headers.location.replace('https://accounts.google.com',googleOrigin);
      if(kind==='start'&&response.status!==303)errors.push('Start rejected, Origin='+req.headers.origin);
      res.writeHead(response.status,headers);res.end(await response.text());return;
    }
    if(url.origin===googleOrigin){
      challenge=url.searchParams.get('code_challenge');const back=new URL(base+'/functions/v1/drive-oauth-callback');
      back.search=new URLSearchParams({code:'fake-code',state:url.searchParams.get('state')}).toString();
      res.writeHead(302,{location:back.href});res.end();return;
    }
    let path=url.pathname;if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);
    assert(url.origin===origin&&file.startsWith(root+'/')&&['.html','.js','.css'].includes(extname(file)));
    // Same code and policy, translated to isolated TLS hosts for the fixture.
    const content=(await readFile(file,'utf8')).replaceAll('https://tpqsmerlxquyrzrjbogj.supabase.co',base).replaceAll('https://accounts.google.com',googleOrigin);
    res.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]});res.end(content);
  }catch(e){errors.push(e.message);res.writeHead(500);res.end('fixture failed');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
origin='https://app.localhost:'+port;base='https://api.localhost:'+port;googleOrigin='https://google.localhost:'+port;
const deps={now:Date.now,authenticate:async token=>token==='fake-bc-session'?{id:uid,email,email_confirmed_at:'2026-10-01'}:null,
  store:async(op,p)=>{
    if(op==='start'){stateHash=p.state_hash;return true;}if(op==='consume'){const ok=stateHash===p.state_hash;stateHash='';return ok;}
    if(op==='save'){connection=p;ready=false;return true;}if(op==='status')return{connected:!!connection,folders_ready:ready};
    if(op==='read')return connection;if(op==='ready'){ready=true;return true;}throw Error('Unexpected store operation');
  },fetch:async(url,init)=>{
    const u=new URL(url);
    if(url==='https://oauth2.googleapis.com/token'){
      const body=new URLSearchParams(String(init.body));
      if(body.get('grant_type')==='authorization_code')assert.equal(Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.get('code_verifier')))).toString('base64url'),challenge);
      return Response.json({access_token:'fake-access-token',refresh_token:'fake-refresh-token-for-browser',token_type:'Bearer',expires_in:3599,scope:'https://www.googleapis.com/auth/drive.file'});
    }
    if(u.pathname==='/drive/v3/about')return Response.json({user:{emailAddress:email}});
    const id=u.pathname.split('/')[4];assert([clinical,clientFolder].includes(id));
    if(u.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:email}]});
    return Response.json({id,mimeType:'application/vnd.google-apps.folder',trashed:false,owners:[{emailAddress:email}],capabilities:{canAddChildren:true}});
  }};
const config={enabled:true,writes:'false',baseUrl:base,appOrigin:origin,clientId:'530925228983-fake.apps.googleusercontent.com',clientSecret:'fake-client-secret-browser-tests-1234567',pickerKey:'fake-public-key'};
handlers=Object.fromEntries(['start','callback','setup'].map(kind=>[kind,createOAuthHandler(kind,config,deps)]));
const sdk=`globalThis.supabase={createClient(){return{auth:{async getSession(){return{data:{session:{access_token:'fake-bc-session',user:{email:'${email}'}}},error:null}}}}}};`;
const picker=`globalThis.gapi={load(name,o){class V{setIncludeFolders(){return this}setSelectFolderEnabled(){return this}setFileIds(id){this.id=id;return this}}class B{addView(v){this.v=v;return this}setOAuthToken(){return this}setDeveloperKey(){return this}setAppId(){return this}setOrigin(){return this}setTitle(){return this}setCallback(cb){this.cb=cb;return this}build(){const s=this;return{setVisible(show){if(show)setTimeout(()=>s.cb({action:'picked',docs:[{id:s.v.id}]}),0)}}}}globalThis.google={picker:{DocsView:V,PickerBuilder:B,ViewId:{FOLDERS:'folders'},Action:{PICKED:'picked',CANCEL:'cancel'}}};o.callback()}};`;
let browser;
try{
  let launch={headless:true,args:[]};
  if(process.env.BC_CHROMIUM_EXECUTABLE)launch={...launch,executablePath:process.env.BC_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']};
  else if(process.env.BC_CHROMIUM_MODULE){const{default:c}=await import(process.env.BC_CHROMIUM_MODULE);launch={...launch,executablePath:await c.executablePath(),args:c.args};}
  launch.args.push('--host-resolver-rules=MAP *.localhost 127.0.0.1, MAP * ~NOTFOUND');
  browser=await chromium.launch(launch);
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',async route=>{const u=new URL(route.request().url());
    if([origin,base,googleOrigin].includes(u.origin))return route.continue();
    if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.includes('/@supabase/supabase-js@'))return route.fulfill({contentType:'text/javascript',body:sdk});
    if(u.href==='https://apis.google.com/js/api.js')return route.fulfill({contentType:'text/javascript',body:picker});
    errors.push('Unplanned origin '+u.origin);return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  await page.goto(origin+'/gestao/configurar-drive/');await page.getByRole('status').filter({hasText:'Comece autorizando'}).waitFor();
  try{await Promise.all([page.waitForURL('**/gestao/configurar-drive/?status=authorized',{timeout:10000}),page.getByRole('button',{name:'Continuar com Google'}).click()]);}
  catch(e){throw Error('Mock authorization failed: '+errors.join(' | '),{cause:e});}
  await page.getByRole('status').filter({hasText:'Conta Google autorizada'}).waitFor();assert.equal(nativePosts,1);
  assert.equal((await context.cookies(base)).filter(c=>c.name==='__Secure-bc-drive-oauth').length,0);
  await page.getByRole('button',{name:'Selecionar pasta clínica'}).click();await page.locator('#clinicalStatus').filter({hasText:'Pasta selecionada'}).waitFor();
  await page.getByRole('button',{name:'Selecionar pasta de arquivos'}).click();await page.getByRole('button',{name:'Confirmar pastas'}).click();
  await page.getByRole('status').filter({hasText:'Autorização validada'}).waitFor();assert.equal(ready,true);assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert(!await page.locator('body').innerText().then(t=>/fake-access-token|fake-refresh-token|fake-bc-session/.test(t)));
  const output=process.env.BC_OAUTH_SCREENSHOT_DIR||'/tmp/bc-drive-oauth-browser';await mkdir(output,{recursive:true});await page.screenshot({path:output+'/oauth-phone.png',fullPage:true});
  console.log('Browser rehearsal passed: native POST, TLS redirects, Secure cookie/state, PKCE and two folders; no live accounts or uploads.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true});}
