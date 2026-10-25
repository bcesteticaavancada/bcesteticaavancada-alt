import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';

// Interface, módulo de autenticação e proteção de sessão reais; somente fixtures locais.
// Nenhum login, cadastro, arquivo clínico ou chamada ao Supabase hospedado.
const root=process.cwd(),prefix='/bcesteticaavancada-alt';
const bank=await readFile('gestao/maya-beta/respostas-65.json','utf8');
const sdk=`globalThis.supabase={createClient:()=>({
 auth:{
  async getSession(){const f=window.mayaFixture;return {data:{session:f.profile?{user:{id:f.profile.user_id}}:null},error:f.authError?new Error('Conexão fictícia indisponível'):null};},
  onAuthStateChange(listener){window.mayaFixture.listener=listener;return {data:{subscription:{unsubscribe(){}}}};}
 },
 from(table){window.mayaFixture.tables.push(table);if(table!=='staff_profiles')throw Error('Tabela fora do escopo');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:window.mayaFixture.profile};}};}
})};`;
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith(prefix+'/')){res.writeHead(404).end();return;}
  const relative=pathname.slice(prefix.length),file=path.resolve(root,'.'+(relative.endsWith('/')?relative+'index.html':relative));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const entry=origin+prefix+'/gestao/maya-beta/';
const engines=(process.env.BC_MAYA_TEST_ENGINES||'chromium,webkit').split(',');
let chromiumOptions={};
if(process.env.BC_CHROMIUM_MODULE){
 const {default:engine}=await import(process.env.BC_CHROMIUM_MODULE);
 chromiumOptions={executablePath:await engine.executablePath(),args:engine.args};
}
await mkdir('test-results/maya',{recursive:true});
let passed=0;
function pass(label){passed++;console.log('PASS '+label);}
async function bounded(promise,label){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Tempo esgotado: '+label)),15000);})]);}
 finally{clearTimeout(timer);}
}
async function pageFixture(browser,role,viewport={width:390,height:844}){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(role=>{
  window.mayaFixture={profile:role?{user_id:'ficticio-'+role,display_name:'Equipe fictícia',role,active:true}:null,tables:[],authError:false};
 },role);
 await page.route('**/*',route=>{
  const request=route.request().url();
  if(request.startsWith(origin+'/'))return route.continue();
  if(request==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'text/javascript',body:sdk});
  external.push(request);return route.abort();
 });
 return {page,errors,external};
}
async function assertIsolated({page,errors,external}){
 assert.deepEqual(errors,[],'Sem erros JavaScript');
 assert.deepEqual(external,[],'Sem serviços externos');
 assert.ok(await page.evaluate(()=>window.mayaFixture.tables.every(t=>t==='staff_profiles')),'Só o próprio perfil é consultado');
}
try{
 for(const engine of engines){
  assert.ok(['chromium','webkit'].includes(engine),'Motor de teste conhecido');
  const browser=await ({chromium,webkit})[engine].launch(engine==='chromium'?chromiumOptions:{});
  try{
   for(const role of ['admin','colaborador','admin_criacao'])for(const [device,width,height] of [['phone',320,740],['desktop',1280,900]]){
    const fixture=await pageFixture(browser,role,{width,height}),{page}=fixture;
    try{
     await page.goto(entry);await page.locator('#app').waitFor();
     assert.equal(await page.locator('#dashboardLink').getAttribute('href'),'../'+({admin:'admin',colaborador:'colaborador',admin_criacao:'criacao'})[role]+'/');
     await page.locator('[data-topic="financeiro"]').click();
     await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('Assunto: Financeiro'));
     assert.match(await page.locator('#chat').innerText(),role==='admin_criacao'?/não possui acesso ao financeiro/:role==='colaborador'?/apenas os valores que seu perfil já permite/:/administradora consulta o caixa/);
     await page.locator('[data-topic="cadastro"]').click();
     await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('Assunto: Cadastro'));
     assert.match(await page.locator('#chat .maya').last().innerText(),role==='admin_criacao'?/apenas consulta/:/escolha Novo cliente/);
     await page.locator('#question').fill('O que é microagulhamento?');await page.locator('#question').press('Enter');
     await page.waitForFunction(()=>document.querySelector('#chat .maya:last-child')?.textContent.includes('revisão técnica pendente'));
     assert.match(await page.locator('#chat .maya').last().innerText(),/microagulhamento/i);
     await page.locator('#knowledgeOpen').click();await page.locator('#knowledgeItems details').nth(19).waitFor();
     await page.locator('#knowledgeSearch').fill('radiofrequência');
     await page.waitForFunction(()=>document.querySelectorAll('#knowledgeItems details').length===1);
     const details=page.locator('#knowledgeItems details');
     await details.locator('summary').focus();await page.keyboard.press('Enter');
     await page.waitForFunction(()=>document.querySelector('#knowledgeItems details').open);
     assert.match(await details.innerText(),/validação da Mel pendente/);
     assert.ok(await details.locator('a').count()>0,'Fontes disponíveis');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sem rolagem horizontal');
     await page.screenshot({path:`test-results/maya/${engine}-${role}-${device}.png`,fullPage:true});
     await page.locator('#knowledgeClose').click();
     await page.locator('#question').fill('Meu CPF é 123.456.789-09');await page.locator('#question').press('Enter');
     await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('Para proteger a privacidade'));
     assert.ok(!(await page.locator('#chat').innerText()).includes('123.456.789-09'));
     assert.equal(await page.locator('#question').inputValue(),'');
     await page.locator('#clearChat').click();await page.locator('#question').waitFor({state:'visible'});
     assert.equal(await page.locator('#chat .bubble').count(),1);
     assert.equal(await page.locator('#question').evaluate(el=>document.activeElement===el),true);
     await assertIsolated(fixture);pass(`${engine}/${role}/${device}: acesso, permissões, diálogo, busca, teclado, privacidade e largura`);
    }catch(error){await page.screenshot({path:`test-results/maya/${engine}-${role}-${device}-failure.png`,fullPage:true});throw error;}
    finally{await page.close();}
   }
   {
    const fixture=await pageFixture(browser,null),{page}=fixture;
    try{await page.goto(entry);await page.getByText('Acesso restrito à equipe autorizada.').waitFor();assert.equal(await page.locator('#app').isVisible(),false);await assertIsolated(fixture);pass(engine+'/anônimo: acesso bloqueado');}finally{await page.close();}
   }
   for(const action of ['limpar','inativar']){
    const fixture=await pageFixture(browser,'colaborador'),{page}=fixture;
    let release,started;
    const wait=new Promise(resolve=>{release=resolve;}),requested=new Promise(resolve=>{started=resolve;});
    await page.route('**/respostas-65.json',async route=>{started();await wait;await route.fulfill({contentType:'application/json',body:bank});});
    try{
     await page.goto(entry);await page.locator('#app').waitFor();
     await page.locator('#question').fill('Como é feito o Botox?');await page.locator('#question').press('Enter');await bounded(requested,'solicitação da biblioteca');
     if(action==='limpar')await page.locator('#clearChat').click();
     else await page.evaluate(()=>{window.mayaFixture.profile.active=false;});
     release();
     if(action==='limpar'){
      // Aguarda o consumo da biblioteca e a nova conferência de sessão, sem pausa arbitrária.
      await page.waitForFunction(()=>window.mayaFixture.tables.length>=3);
      assert.equal(await page.locator('#chat').innerText(),'Conversa limpa. Como posso ajudar?');
     }else await page.waitForURL('**/gestao/login/');
     if(action==='limpar')await assertIsolated(fixture);else{assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.external,[]);}
     pass(`${engine}/${action}: resultado pendente descartado`);
    }finally{release();await page.close();}
   }
   {
    const fixture=await pageFixture(browser,'colaborador'),{page}=fixture;
    try{
     await page.goto(entry);await page.locator('#app').waitFor();await page.evaluate(()=>{window.mayaFixture.authError=true;});
     await page.locator('[data-topic="agenda"]').click();await page.getByText(/Não foi possível confirmar seu acesso/).waitFor();
     await assertIsolated(fixture);pass(engine+'/falha de conexão: aviso recuperável sem rejeição não tratada');
    }finally{await page.close();}
   }
  }finally{await browser.close();}
 }
 console.log(`${passed} cenários de navegador aprovados; somente fixtures locais.`);
}finally{server.close();}
