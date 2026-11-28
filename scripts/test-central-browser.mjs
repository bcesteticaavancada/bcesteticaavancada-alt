import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';
import {createHandler} from '../supabase/functions/bc-central/handler.mjs';

const base='http://127.0.0.1:4183';
const sdk=`globalThis.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:window.f.role?{user:{id:'usuario-ficticio'}}:null}}),onAuthStateChange(fn){window.f.revoke=()=>fn('SIGNED_OUT',null);return {data:{subscription:{unsubscribe(){}}}};}},
  from(name){if(name!=='staff_profiles')throw Error('Fora do escopo');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{user_id:'usuario-ficticio',active:true,role:window.f.role}};}};},
  functions:{async invoke(name,{body}){const response=await fetch('/qa-central',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer qa-local'},body:JSON.stringify(body)});return response.ok?{data:await response.json()}:{error:{context:response}};}}
})};`;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'};
const matrix=[
 ['Desktop',chromium,{viewport:{width:1360,height:850}},'admin'],
 ['Android',chromium,devices['Pixel 7'],'admin_criacao'],
 ['iPad',webkit,devices['iPad (gen 7)'],'admin'],
 ['iPhone',webkit,devices['iPhone 13'],'admin_criacao'],
];
const engines=(process.env.BC_CENTRAL_ENGINES||'chromium,webkit').split(',');
let launched=0;
for(const [label,browserType,device,role] of matrix){
 if(!engines.includes(browserType.name()))continue;
 let options={};
 if(browserType===chromium && process.env.BC_CHROMIUM_MODULE){
   const {default:engine}=await import(process.env.BC_CHROMIUM_MODULE);
   options={executablePath:await engine.executablePath(),args:engine.args};
 }
 const browser=await browserType.launch(options);
 try{
   launched++;const ctx=await browser.newContext(device),page=await ctx.newPage(),unexpected=[],errors=[],calls=[],records=new Map();
   await page.addInitScript(role=>{window.f={role};},role);page.on('pageerror',e=>errors.push(e.message));
   const handler=createHandler({origin:base,enabled:true,secret:'x'.repeat(40),identify:async()=>({id:'usuario-ficticio',role,active:true}),
     ledger:{async begin(actor,key,action){if(records.has(key))return records.get(key);records.set(key,{action,state:'iniciada',started_at:new Date().toISOString()});return {state:'nova'};},
       async finish(actor,key,state){records.get(key).state=state;},async history(){return {operations:[...records.values()].filter(x=>x.action!=='status'),requests24h:records.size};}},
     cash:async()=>({income:100,expense:20,balance:80}),providers:{configured:{search:true,analytics:false,workspace:true,brief:true,vitals:true,checks:true},scopes:{},
       async search(period){return {available:true,period,clicks:4,impressions:40,ctr:.1,position:5};},async brief(){calls.push('brief');return {answer:'Nota fictícia verificada'};},async workspace(){calls.push('docs');return {document:'sintetico'};}}});
   await page.route('**/*',async route=>{
     const url=new URL(route.request().url());
     if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'text/javascript',body:sdk});
     if(url.origin!==base){unexpected.push(url.hostname);return route.abort();}
     if(url.pathname==='/qa-central'){
       const r=await handler(new Request(base+'/qa-central',{method:'POST',headers:{Origin:base,Authorization:'Bearer qa-local','Content-Type':'application/json'},body:route.request().postData()}));
       return route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
     }
     if(url.pathname==='/gestao/js/config.js')return route.fulfill({contentType:'text/javascript',body:"export const SUPABASE_URL='http://127.0.0.1:54321',SUPABASE_PUBLISHABLE_KEY='ficticia'"});
     const file=path.resolve('.','.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
     if(!file.startsWith(process.cwd()+path.sep))return route.abort();
     try{return await route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:''});}
   });
   await page.goto(base+'/gestao/integracoes/');
   await page.getByText('Sessão e API verificadas').waitFor();
   assert.equal(await page.getByRole('button',{name:'Fluxo de caixa'}).count(),role==='admin'?1:0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label);
   await page.getByRole('button',{name:'Busca no Google'}).click();await page.getByText('Impressões',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Baixar indicadores em CSV'}).isVisible(),true);
   await page.getByLabel('Sua pergunta').fill('como conferir o backup');await page.getByRole('button',{name:'Consultar',exact:true}).click();
   await page.locator('#messages').getByText(/Roque · Entender o backup/).waitFor();
   await page.getByRole('button',{name:'Nota de SEO'}).click();await page.getByRole('button',{name:'Cancelar'}).click();assert.deepEqual(calls,[]);
   await page.getByRole('button',{name:'Nota de SEO'}).click();await page.getByRole('button',{name:'Confirmar ação'}).click();
   await page.getByText(/Nota fictícia verificada/).waitFor();assert.deepEqual(calls,['brief']);
   await page.evaluate(()=>window.f.revoke());await page.waitForURL('**/gestao/login/');assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
   console.log('PASS',label,browserType.name(),role);
 }finally{await browser.close();}
}
assert.ok(launched,'Nenhum navegador selecionado');
