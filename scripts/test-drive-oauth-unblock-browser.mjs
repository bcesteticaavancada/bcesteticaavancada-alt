// Three local TLS origins; real browser and handlers, fictional Auth/Google/store.
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createOAuthHandler } from '../supabase/functions/_shared/drive-oauth/handler.ts';
import { ACCOUNT, FOLDERS, DRIVE_SCOPE } from '../supabase/functions/_shared/drive-oauth/protocol.ts';

const root = resolve(new URL('..',import.meta.url).pathname);
const temporary = await mkdtemp(join(tmpdir(),'bc-drive-unblock-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-keyout',join(temporary,'key.pem'),'-out',join(temporary,'cert.pem')],{stdio:'ignore'});
const ROOT='qa-private-central', DB='qa-folder-database', uid='qa-browser-admin';
const errors=[], operations=[];
let base, googleOrigin, origins, installations, handlers, config, state='', challenge='', wrongAccount=false, rotations=0;
let connection={user_id:uid,account:ACCOUNT,client_id:'qa-client',refresh_token:'fictional-original-refresh-token'};
const metadata=new Map([
  [ROOT,{name:'Central privada QA',parents:['qa-my-drive']}],
  [FOLDERS.clinical,{name:'01_Anamneses_e_Documentos_Clinicos',parents:[ROOT]}],
  [FOLDERS.client,{name:'02_Arquivos_de_Clientes',parents:[ROOT]}],
  [DB,{name:'05_BC_Gestao_Banco_de_Dados_e_Exportacoes',parents:[ROOT]}],
  ['qa-external-folder',{name:'BC Estética',parents:['qa-external-root']}],
]);
const server=createServer({key:await readFile(join(temporary,'key.pem')),cert:await readFile(join(temporary,'cert.pem'))},async(req,res)=>{
  try {
    const url=new URL(req.url,'https://'+req.headers.host);
    if(url.origin===base) {
      const kind=url.pathname.split('drive-oauth-')[1];assert.ok(handlers[kind]);
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const response=await handlers[kind](new Request(url,{method:req.method,headers:req.headers,body:req.method==='POST'?Buffer.concat(chunks):undefined}));
      const headers=Object.fromEntries(response.headers);
      if(headers.location?.startsWith('https://accounts.google.com/')) headers.location=headers.location.replace('https://accounts.google.com',googleOrigin);
      res.writeHead(response.status,headers);res.end(await response.text());return;
    }
    if(url.origin===googleOrigin) {
      challenge=url.searchParams.get('code_challenge');
      const callback=new URL(base+'/functions/v1/drive-oauth-callback');
      callback.search=new URLSearchParams({code:'fictional-code',state:url.searchParams.get('state')}).toString();
      res.writeHead(302,{location:callback.href});res.end();return;
    }
    const installation=installations.find(x=>x.origin===url.origin);assert.ok(installation);
    if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    assert.ok(url.pathname.startsWith(installation.prefix));
    let path=url.pathname.slice(installation.prefix.length);if(path.endsWith('/'))path+='index.html';
    const file=resolve(root,'.'+path);assert.ok(file.startsWith(root+'/'));
    assert.ok(['.html','.js','.css'].includes(extname(file)));
    const content=(await readFile(file,'utf8')).replaceAll('https://tpqsmerlxquyrzrjbogj.supabase.co',base).replaceAll('https://accounts.google.com',googleOrigin);
    res.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]});res.end(content);
  } catch(e){errors.push(e.message);res.writeHead(500);res.end('fixture failed');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
base='https://api.localhost:'+port;googleOrigin='https://google.localhost:'+port;
origins=['https://legacy.localhost:'+port,'https://www.localhost:'+port,'https://root.localhost:'+port];
installations=origins.map((origin,index)=>({origin,prefix:index===0?'/bcesteticaavancada-alt':'',code:['legacy','www','root'][index]}));
config={enabled:true,writes:'true',activeReconnect:false,baseUrl:base,appOrigin:origins[0],allowedOrigins:origins.slice(1),
  clientId:'qa-client',clientSecret:'fictional-browser-secret-never-used-elsewhere',pickerKey:'qa-public-key'};
const deps={now:Date.now,authenticate:async token=>token==='qa-session'?{id:uid,email:ACCOUNT,email_confirmed_at:'2026-01-01'}:null,
  store:async(op,p)=>{
    operations.push(op);
    if(op==='status')return{connected:true,folders_ready:true};
    if(op==='read')return connection;
    if(op==='start'){state=p.state_hash;return true;}
    if(op==='consume'){const ok=state===p.state_hash;state='';return ok;}
    if(op==='rotate'){
      assert.equal(p.expected_refresh_hash,createHash('sha256').update(connection.refresh_token).digest('hex'));
      connection={...connection,refresh_token:p.refresh_token};rotations++;return true;
    }
    throw new Error('The running backup must not be reinitialized: '+op);
  },fetch:async(url,init)=>{
    const u=new URL(url);
    if(url==='https://oauth2.googleapis.com/token'){
      const body=new URLSearchParams(String(init.body));
      if(body.get('grant_type')==='authorization_code') assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'),challenge);
      return Response.json({access_token:'fictional-access-token',refresh_token:'fictional-rotated-refresh-'+rotations,token_type:'Bearer',expires_in:3600,scope:DRIVE_SCOPE});
    }
    assert.equal(init.method||'GET','GET');
    if(u.pathname==='/drive/v3/about')return Response.json({user:{emailAddress:wrongAccount?'outside@example.invalid':ACCOUNT}});
    const id=u.pathname.split('/')[4];assert.ok(metadata.has(id));
    if(u.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:ACCOUNT}]});
    return Response.json({id,...metadata.get(id),mimeType:'application/vnd.google-apps.folder',trashed:false,owners:[{emailAddress:ACCOUNT}],capabilities:{canAddChildren:true}});
  }};
handlers=Object.fromEntries(['start','callback','setup'].map(kind=>[kind,createOAuthHandler(kind,config,deps)]));
const sdk=`globalThis.supabase={createClient(){return{auth:{async getSession(){return{data:{session:{access_token:'qa-session',user:{email:'${ACCOUNT}'}}},error:null}}}}}};`;
const picker=`globalThis.gapi={load(name,o){class V{setIncludeFolders(){return this}setSelectFolderEnabled(){return this}setFileIds(id){this.id=id;return this}setParent(id){this.parent=id;return this}}class B{addView(v){this.v=v;return this}setOAuthToken(){return this}setDeveloperKey(){return this}setAppId(){return this}setOrigin(){return this}setTitle(){return this}setCallback(cb){this.cb=cb;return this}build(){const s=this;return{setVisible(show){if(show)setTimeout(()=>s.cb({action:'picked',docs:[{id:s.v.id||globalThis.__qaPickerSelection}]}),0)}}}}globalThis.google={picker:{DocsView:V,PickerBuilder:B,ViewId:{FOLDERS:'folders'},Action:{PICKED:'picked',CANCEL:'cancel'}}};o.callback()}};`;
let browser;
try {
  let launch={headless:true,args:[]};
  if(process.env.BC_CHROMIUM_EXECUTABLE)launch={...launch,executablePath:process.env.BC_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']};
  else if(process.env.BC_CHROMIUM_MODULE){const{default:c}=await import(process.env.BC_CHROMIUM_MODULE);launch={...launch,executablePath:await c.executablePath(),args:c.args};}
  launch.args.push('--host-resolver-rules=MAP *.localhost 127.0.0.1, MAP * ~NOTFOUND');
  browser=await chromium.launch(launch);
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if([...origins,base,googleOrigin].includes(u.origin))return route.continue();
    if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.includes('/@supabase/supabase-js@'))return route.fulfill({contentType:'text/javascript',body:sdk});
    if(u.href==='https://apis.google.com/js/api.js')return route.fulfill({contentType:'text/javascript',body:picker});
    errors.push('Unexpected external request');return route.abort();
  });
  for(const site of installations) {
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    config.activeReconnect=false;wrongAccount=false;
    const url=site.origin+site.prefix+'/gestao/configurar-drive/';
    await page.goto(url);await page.locator('#setupStatus').filter({hasText:'Consulta e seleção disponíveis'}).waitFor();
    assert.equal(await page.locator('#authorizeDrive').isDisabled(),true);
    assert.equal(await page.locator('#pickClinical').isDisabled(),false);
    await page.locator('#pickClinical').click();await page.locator('#clinicalStatus').filter({hasText:'Pasta selecionada'}).waitFor();
    await page.locator('#pickCentral').click();await page.locator('#centralStatus').filter({hasText:'Pasta verificada: Central privada'}).waitFor();
    await page.selectOption('#centralRole','database');await page.evaluate(id=>{globalThis.__qaPickerSelection=id;},DB);
    await page.locator('#pickCentral').click();await page.locator('#centralStatus').filter({hasText:'Pasta verificada: 05_'}).waitFor();
    await page.evaluate(()=>{globalThis.__qaPickerSelection='qa-external-folder';});
    await page.locator('#pickCentral').click();await page.locator('#centralStatus').filter({hasText:'Não foi possível'}).waitFor();
    config.activeReconnect=true;await page.reload();
    const before=rotations;
    await Promise.all([page.waitForURL(url+'?status=authorized'),page.locator('#authorizeDrive').click()]);
    assert.equal(rotations,before+1);assert.ok(!operations.includes('save'));assert.ok(!operations.includes('ready'));
    wrongAccount=true;const kept=connection.refresh_token;
    await Promise.all([page.waitForURL(url+'?status=failed'),page.locator('#authorizeDrive').click()]);
    assert.equal(connection.refresh_token,kept);assert.equal(rotations,before+1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.ok(!/fictional-access-token|fictional-rotated-refresh|qa-session/.test(await page.locator('body').innerText()));
    assert.deepEqual(errors,[]);
    if(process.env.BC_OAUTH_SCREENSHOT_DIR){await mkdir(process.env.BC_OAUTH_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.BC_OAUTH_SCREENSHOT_DIR,'unblock-'+site.code+'.png'),fullPage:true});}
    console.log('PASS '+site.code+': active backup controls, private central selection, atomic reconnect and failure return.');
    await page.close();
  }
  await context.close();console.log('3 TLS origin rehearsals passed; no live login, credentials, clinical data or uploads.');
} finally {
  if(browser)await browser.close();await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true});
}
