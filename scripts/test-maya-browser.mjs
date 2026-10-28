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
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
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
async function pageFixture(browser,role,viewport={width:390,height:844},capabilities={}){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({role,capabilities})=>{
  window.mayaFixture={profile:role?{user_id:'ficticio-'+role,display_name:'Equipe fictícia',role,active:true,...capabilities}:null,tables:[],authError:false};
 },{role,capabilities});
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
async function visualState(page){
 return page.evaluate(()=>{
  const style=selector=>{const element=document.querySelector('#mayaCharacter '+selector);return element?getComputedStyle(element):null;};
  return {
   bodyAnimation:style('.maya-body')?.animationName??null,
   bodyIterations:style('.maya-body')?.animationIterationCount??null,
   eyesAnimation:style('.maya-eyes')?.animationName??null,
   eyesIterations:style('.maya-eyes')?.animationIterationCount??null,
   headAnimation:style('.maya-head')?.animationName??null,
   neutralOpacity:style('.maya-mouth-neutral')?.opacity??null,
   smileOpacity:style('.maya-smile')?.opacity??null,
   animations:document.querySelector('#mayaCharacter').getAnimations({subtree:true}).length
  };
 });
}
try{
 for(const engine of engines){
  assert.ok(['chromium','webkit'].includes(engine),'Motor de teste conhecido');
  const browser=await ({chromium,webkit})[engine].launch(engine==='chromium'?chromiumOptions:{});
  try{
   for(const {role,chief,label} of [
    {role:'colaborador',chief:false,label:'colaborador'},
    {role:'colaborador',chief:true,label:'colaborador-chefe'},
    {role:'admin',chief:false,label:'admin'},
    {role:'admin_criacao',chief:false,label:'admin-criacao'}
   ])for(const [device,width,height] of [['phone',320,740],['desktop',1280,900]]){
    const panel=({admin:'admin',colaborador:'colaborador',admin_criacao:'criacao'})[role];
    const fixture=await pageFixture(browser,role,{width,height},{pode_gerenciar_agendas:chief,pode_gerenciar_procedimentos:chief}),{page}=fixture;
    try{
     // HTML e links reais do painel; autenticação e operações desse painel são fixtures.
     const dashboard=origin+prefix+'/gestao/'+panel+'/';
     await page.route(dashboard,async route=>{
      const html=(await readFile('gestao/'+panel+'/index.html','utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
      await route.fulfill({contentType:'text/html',body:html});
     });
     await page.goto(dashboard);await page.evaluate(()=>{document.getElementById('gestaoApp').hidden=false;document.getElementById('authStatus').hidden=true;});
     assert.equal(await page.locator('.bcg-topbar').evaluate(el=>getComputedStyle(el).display),'flex','CSS real do painel carregado antes de testar entrada');
     assert.ok(await page.locator('[data-maya-entry]').isVisible(),'Atalho disponível no próprio painel');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Entrada da Maya sem rolagem horizontal');
     const [mayaEntry,logout]=await Promise.all([page.locator('[data-maya-entry]').boundingBox(),page.locator('#logoutBtn').boundingBox()]);
     assert.ok(mayaEntry&&logout&&(mayaEntry.x+mayaEntry.width<=logout.x+1||mayaEntry.y+mayaEntry.height<=logout.y+1),'Ajuda da Maya não cobre Sair');
     await page.screenshot({path:`test-results/maya/${engine}-${label}-${device}-entry.png`});
     await page.locator('[data-maya-entry]').click();await page.locator('#app').waitFor();
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-state'),'ready');
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-motion'),'off');
     assert.equal(await page.locator('#mayaCharacter').getAttribute('aria-hidden'),'true');
     assert.equal(await page.locator('#mayaMotionToggle').isDisabled(),true,'Preferência de movimento reduzido respeitada');
     await page.locator('#mayaCharacter svg').waitFor({state:'visible'});
     assert.equal(await page.locator('#dashboardLink').getAttribute('href'),'../'+({admin:'admin',colaborador:'colaborador',admin_criacao:'criacao'})[role]+'/');
     await page.locator('[data-topic="financeiro"]').click();
     await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('Assunto: Financeiro'));
     assert.match(await page.locator('#chat').innerText(),role==='admin_criacao'?/não possui acesso ao financeiro/:role==='colaborador'?/apenas os valores que seu perfil já permite/:/administradora consulta o caixa/);
     await page.locator('[data-topic="cadastro"]').click();
     await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('Assunto: Cadastro'));
     assert.match(await page.locator('#chat .maya').last().innerText(),role==='admin_criacao'?/Apoio ao cliente/:/escolha Novo cliente/);
     await page.locator('#question').fill('O que é microagulhamento?');await page.locator('#question').press('Enter');
     await page.waitForFunction(()=>document.querySelector('#chat .maya:last-child')?.textContent.includes('Revisado pela Mel em 25/10/2026'));
     assert.match(await page.locator('#chat .maya').last().innerText(),/microagulhamento/i);
     for(const [question,expected] of [['Quero agendar massagem desportiva','BC não realiza massagem desportiva'],['Horário de atendimento','terça a sábado, das 9h às 19h']]){
      await page.locator('#question').fill(question);await page.locator('#question').press('Enter');
      await page.waitForFunction(expected=>document.querySelector('#chat .maya:last-child')?.textContent.includes(expected),expected);
     }
     await page.locator('#knowledgeOpen').click();await page.locator('#knowledgeItems details').nth(19).waitFor();
     await page.locator('#knowledgeSearch').fill('radiofrequência');
     await page.waitForFunction(()=>document.querySelectorAll('#knowledgeItems details').length===1);
     const details=page.locator('#knowledgeItems details');
     await details.locator('summary').focus();await page.keyboard.press('Enter');
     await page.waitForFunction(()=>document.querySelector('#knowledgeItems details').open);
     assert.match(await details.innerText(),/Revisado pela Mel em 25\/10\/2026/);
     assert.ok(await details.locator('a').count()>0,'Fontes disponíveis');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sem rolagem horizontal');
     await page.screenshot({path:`test-results/maya/${engine}-${label}-${device}.png`,fullPage:true});
     await page.locator('#knowledgeClose').click();
     await page.locator('#guidesOpen').click();await page.locator('#guideChoices button').first().waitFor();
     assert.equal(await page.locator('#guideChoices button').filter({hasText:'Agenda da equipe'}).count(),role==='admin'||chief?1:0);
     await page.locator('#guideChoices button').first().focus();await page.keyboard.press('Enter');
     await page.waitForFunction(()=>document.activeElement===document.querySelector('#guideTitle'));
     assert.equal(await page.locator('#guideChoices').isVisible(),false,'Opções recolhidas após escolha');
     await page.locator('#guideChooseAgain').click();await page.locator('#guideChoices button').first().waitFor({state:'visible'});
     await page.locator('#question').fill('Como anexar o PDF assinado pelo GOV?');await page.locator('#question').press('Enter');
     await page.waitForFunction(expected=>document.querySelector('#chat .maya:last-child')?.textContent.includes(expected),role==='admin_criacao'?'O original é preservado':'Revisar e vincular');
     assert.equal(await page.locator('#guideAction').getAttribute('href'),'../'+panel+'/#clientes');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Guias sem rolagem horizontal');
     const [openArea,chooseAgain]=await Promise.all([
      page.locator('#guideAction').boundingBox(),page.locator('#guideChooseAgain').boundingBox()
     ]);
     assert.ok(openArea&&chooseAgain,'Ações do guia visíveis');
     const actionGap=Math.max(chooseAgain.x-openArea.x-openArea.width,openArea.x-chooseAgain.x-chooseAgain.width,chooseAgain.y-openArea.y-openArea.height,openArea.y-chooseAgain.y-chooseAgain.height);
     assert.ok(actionGap>=8,'Ações do guia separadas, sem sobreposição');
     await page.screenshot({path:`test-results/maya/${engine}-${label}-${device}-guides.png`,fullPage:true});

     await page.locator('#question').fill('Meu CPF é 123.456.789-09');await page.locator('#question').press('Enter');
     await page.waitForFunction(()=>document.querySelector('#chat').textContent.includes('Para proteger a privacidade'));
     assert.ok(!(await page.locator('#chat').innerText()).includes('123.456.789-09'));
     assert.equal(await page.locator('#question').inputValue(),'');
     await page.locator('#clearChat').click();await page.locator('#question').waitFor({state:'visible'});
     assert.equal(await page.locator('#chat .bubble').count(),1);
     assert.equal(await page.locator('#question').evaluate(el=>document.activeElement===el),true);
     await assertIsolated(fixture);pass(`${engine}/${label}/${device}: acesso, permissões, diálogo, busca, teclado, privacidade e largura`);
    }catch(error){await page.screenshot({path:`test-results/maya/${engine}-${label}-${device}-failure.png`,fullPage:true});throw error;}
    finally{await page.close();}
   }
   {
    const fixture=await pageFixture(browser,'colaborador'),{page}=fixture;
    let release,started;
    const wait=new Promise(resolve=>{release=resolve;}),requested=new Promise(resolve=>{started=resolve;});
    await page.route('**/respostas-65.json',async route=>{started();await wait;await route.fulfill({contentType:'application/json',body:bank});});
    try{
     await page.emulateMedia({reducedMotion:'no-preference'});
     await page.goto(entry);await page.locator('#app').waitFor();
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-motion'),'on');
     let visual=await visualState(page);
     assert.equal(visual.bodyAnimation,'maya-breathe','V2 respira suavemente quando os movimentos estão permitidos');
     assert.equal(visual.bodyIterations,'infinite');
     assert.equal(visual.eyesAnimation,'maya-blink');
     assert.equal(visual.eyesIterations,'infinite','Piscadas espaçadas continuam enquanto permitido');
     assert.equal(visual.headAnimation,'maya-attend');
     await page.locator('#question').fill('O que é peeling?');await page.locator('#question').press('Enter');
     await bounded(requested,'consulta visual fictícia');
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-state'),'thinking');
     visual=await visualState(page);assert.equal(visual.neutralOpacity,'1');assert.equal(visual.smileOpacity,'0','Espera não exibe confirmação');
     assert.equal(await page.locator('.maya-thought i').first().evaluate(el=>getComputedStyle(el).animationName),'maya-wait');
     await page.locator('#mayaMotionToggle').focus();await page.keyboard.press('Enter');
     assert.equal(await page.locator('#mayaMotionToggle').getAttribute('aria-pressed'),'false');
     assert.equal(await page.locator('.maya-thought i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
     assert.equal((await visualState(page)).animations,0,'Pausa para corpo, olhos, cabeça e indicador');
     await page.emulateMedia({reducedMotion:'reduce'});
     await page.waitForFunction(()=>document.querySelector('#mayaMotionToggle').disabled);
     release();await page.waitForFunction(()=>document.querySelector('#mayaCharacter').dataset.state==='answered');
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-motion'),'off');
     visual=await visualState(page);assert.equal(visual.animations,0);assert.equal(visual.smileOpacity,'1','Resposta mantém expressão estática com movimento reduzido');
     await page.emulateMedia({reducedMotion:'no-preference'});
     await page.waitForFunction(()=>!document.querySelector('#mayaMotionToggle').disabled);
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-motion'),'off','Pausa manual preservada');
     await page.locator('#mayaMotionToggle').focus();await page.keyboard.press('Enter');
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-motion'),'on');
     visual=await visualState(page);assert.equal(visual.bodyAnimation,'maya-breathe');assert.equal(visual.headAnimation,'maya-nod');
     await page.screenshot({path:`test-results/maya/${engine}-2d-motion-phone.png`,fullPage:true});
     await page.locator('#mayaCharacter').screenshot({path:`test-results/maya/${engine}-2d-character.png`});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Personagem não gera rolagem horizontal');
     await assertIsolated(fixture);pass(engine+'/V2: respiração, piscadas, expressões, pausa, redução de movimento e retomada');
    }finally{release();await page.close();}
   }
   {
    const fixture=await pageFixture(browser,'colaborador',{width:320,height:740}),{page}=fixture;
    try{
     await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(entry);await page.locator('#app').waitFor();
     await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-motion'),'off');
     assert.equal((await visualState(page)).animations,0,'Aba oculta interrompe todos os movimentos');
     await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
     assert.equal((await visualState(page)).bodyAnimation,'maya-breathe');
     await page.locator('#mayaMotionToggle').click();
     await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
     assert.equal((await visualState(page)).animations,0,'Retornar à aba não perde a pausa manual');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     await assertIsolated(fixture);pass(engine+'/V2: visibilidade simulada interrompe movimentos e preserva pausa em 320 px');
    }finally{await page.close();}
   }
   for(const role of ['desconhecido']){
    const fixture=await pageFixture(browser,role),{page}=fixture;
    try{await page.goto(entry);await page.getByText('Acesso restrito à equipe autorizada.').waitFor();assert.equal(await page.locator('#app').isVisible(),false);await assertIsolated(fixture);pass(engine+'/'+role+': fora da equipe');}finally{await page.close();}
   }
   for(const role of ['admin','admin_criacao','colaborador']){
    const fixture=await pageFixture(browser,role,{width:320,height:740},{active:false}),{page}=fixture;
    try{await page.goto(entry);await page.getByText('Acesso restrito à equipe autorizada.').waitFor();assert.equal(await page.locator('#app').isVisible(),false);await assertIsolated(fixture);pass(engine+'/'+role+': conta inativa bloqueada');}finally{await page.close();}
   }
   {
    const fixture=await pageFixture(browser,null),{page}=fixture;
    try{await page.goto(entry);await page.getByText('Acesso restrito à equipe autorizada.').waitFor();assert.equal(await page.locator('#app').isVisible(),false);await assertIsolated(fixture);pass(engine+'/anônimo: acesso bloqueado');}finally{await page.close();}
   }
   {
    const fixture=await pageFixture(browser,'colaborador'),{page}=fixture;
    await page.route('**/respostas-65.json',route=>route.fulfill({status:503,body:'Biblioteca fictícia indisponível'}));
    try{
     await page.goto(entry);await page.locator('#app').waitFor();
     await page.locator('#question').fill('Tem horário para massagem esportiva?');await page.locator('#question').press('Enter');
     await page.waitForFunction(()=>document.querySelector('#chat .maya:last-child')?.textContent.includes('BC não realiza massagem desportiva'));
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-state'),'unavailable','Falha da biblioteca não anuncia busca concluída');
     const visual=await visualState(page);assert.equal(visual.neutralOpacity,'1');assert.equal(visual.smileOpacity,'0','Falha não sorri nem confirma ação');
     assert.doesNotMatch(await page.locator('#chat .maya').last().innerText(),/Para criar agendamento/);
     await assertIsolated(fixture);pass(engine+'/biblioteca indisponível: serviço não oferecido não vira orientação de reserva');
    }finally{await page.close();}
   }
   for(const [action,role] of [['limpar','colaborador'],['inativar','colaborador'],['inativar','admin'],['inativar','admin_criacao']]){
    const fixture=await pageFixture(browser,role),{page}=fixture;
    let release,started;
    const wait=new Promise(resolve=>{release=resolve;}),requested=new Promise(resolve=>{started=resolve;});
    await page.route('**/respostas-65.json',async route=>{started();await wait;await route.fulfill({contentType:'application/json',body:bank});});
    try{
     await page.goto(entry);await page.locator('#app').waitFor();
     await page.locator('#question').fill('Como é feito o Botox?');await page.locator('#question').press('Enter');await bounded(requested,'solicitação da biblioteca');
     assert.equal(await page.locator('#mayaCharacter').getAttribute('data-state'),'thinking');
     if(action==='limpar')await page.locator('#clearChat').click();
     else await page.evaluate(()=>{window.mayaFixture.profile.active=false;});
     release();
     if(action==='limpar'){
      // Aguarda o consumo da biblioteca e a nova conferência de sessão, sem pausa arbitrária.
      await page.waitForFunction(()=>window.mayaFixture.tables.length>=3);
      assert.equal(await page.locator('#chat').innerText(),'Conversa limpa. Como posso ajudar?');
      assert.equal(await page.locator('#mayaCharacter').getAttribute('data-state'),'ready');
     }else await page.waitForURL('**/gestao/login/');
     if(action==='limpar')await assertIsolated(fixture);else{assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.external,[]);}
     pass(`${engine}/${role}/${action}: resultado pendente descartado`);
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
