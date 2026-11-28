import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,open,readFile,rm,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {startLab} from '../server.mjs';
import {ReviewStore,actorDemo,clinicTimestamp,digest} from '../store.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.env.MAYA_NODE_MODULES||process.cwd()]}));
const pdfPath=fileURLToPath(new URL('./fixtures/missao-006.pdf',import.meta.url));
const original=await readFile(pdfPath);
const directory=await mkdtemp(join(tmpdir(),'bc-006-'));
const databasePath=join(directory,'piloto.sqlite');
await (await open(databasePath,'wx',0o600)).close();
const day=clinicTimestamp(Date.now()).slice(0,10);
const start=Date.parse(day+'T15:00:00-03:00');
const relativeDay=n=>clinicTimestamp(start+n*86400000).slice(0,10);
let now=start;
const clock=()=>now;
const store=new ReviewStore({databasePath,clock});
const db=new DatabaseSync(databasePath,{readOnly:true});
const lab=await startLab({store,clock});
const external=[],localPaths=new Set(),violations=[],errors=[];
const report={missao:'BC-PONTE-006',executado_em:new Date().toISOString(),data_ficticia:day,criterios:[]};
function check(id,nome,evidencia,verify){
 try{verify();report.criterios.push({id,nome,resultado:'Pass',evidencia});}
 catch(error){report.criterios.push({id,nome,resultado:'Fail',evidencia,motivo:error.message});}
}
function rows(kind){
 return db.prepare('SELECT id,body FROM records WHERE kind=? ORDER BY rowid').all(kind).map(row=>({id:row.id,...JSON.parse(row.body)}));
}
async function api(cookie,path,data={},file){
 const headers={origin:lab.origin,cookie,'content-type':file?'application/octet-stream':'application/json'};
 if(file){headers['x-review-id']=data.id;headers['x-review-token']=data.token;}
 const response=await fetch(lab.origin+'/api/'+path,{method:'POST',headers,body:file||JSON.stringify(data)});
 return {status:response.status,body:await response.json()};
}
let browser;
try{
 browser=await chromium.launch(process.env.MAYA_CHROMIUM ? {executablePath:process.env.MAYA_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']} : {});
 report.navegador='Chromium '+browser.version();
 const net=await readFile('/proc/self/net/dev','utf8').catch(()=>''),interfaces=net.split('\n').filter(l=>l.includes(':')).map(l=>l.split(':')[0].trim());
 const loopbackOnly=interfaces.length===1&&interfaces[0]==='lo';
 if(process.env.BC_006_REQUIRE_LOOPBACK==='1')assert.ok(loopbackOnly,'O piloto exige namespace com loopback exclusivo.');
 async function login(id,role){
  const ctx=await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await ctx.route(/^https?:\/\//,route=>{
   const url=new URL(route.request().url());
   if(url.origin!==lab.origin){external.push(url.origin);return route.abort();}
   localPaths.add(url.pathname);return route.continue();
  });
  await ctx.routeWebSocket('**/*',route=>{external.push('WebSocket');return route.close();});
  await ctx.addInitScript(()=>{window.cspEvents=[];document.addEventListener('securitypolicyviolation',e=>window.cspEvents.push(e.violatedDirective));});
  const page=await ctx.newPage();
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const session=page.waitForResponse(r=>r.url()===lab.origin+'/api/session');
  await page.goto(lab.origin+'/#'+lab.issue(id,role));
  assert.equal((await session).status(),200);
  if(role==='admin')await page.locator('#desk').waitFor();
  else await page.getByText('Seu perfil não tem acesso', {exact:false}).waitFor();
  const cookie=(await ctx.cookies(lab.origin)).find(c=>c.name==='maya_lab');
  assert.ok(cookie?.httpOnly);
  return {page,cookie:'maya_lab='+cookie.value};
 }
 const admin=await login(actorDemo,'admin'),creation=await login(randomUUID(),'admin_criacao');
 const {page,cookie}=admin;
 // Read a clone of the live HTTP response on arrival. The browser's inspector
 // may discard no-store response bodies before the Playwright side can read them.
 await page.evaluate(()=>{
  const send=window.fetch.bind(window);
  window.missionReplies=new Map();
  window.fetch=async(...args)=>{
   const reply=await send(...args),path=new URL(reply.url).pathname;
   if(['/api/intake','/api/review','/api/confirm','/api/original'].includes(path)){
    window.missionReplies.set(path,{status:reply.status,body:await reply.clone().json()});
   }
   return reply;
  };
 });
 async function observe(path,activate){
  const key='/api/'+path;
  await page.evaluate(k=>window.missionReplies.delete(k),key);
  await activate();await page.waitForFunction(k=>window.missionReplies.has(k),key);
  return page.evaluate(k=>window.missionReplies.get(k),key);
 }
 const request=(path,data,file)=>api(cookie,path,data,file);
 const deny=(path,data,file)=>api(creation.cookie,path,data,file);
 const initial=await request('cash');
 await page.locator('#cash').click();await page.locator('#balance').waitFor();
 const fixture='Cadastre. Nome: Íris   Exemplo; telefone: (00) 90000-0006. Ela realizou um procedimento de R$ 900,00, pagou R$ 680,00 no Pix e precisa de retorno.';
 await page.locator('#files').setInputFiles(pdfPath);
 await page.locator('.attachment textarea').waitFor();
 const extractedText=await page.locator('.attachment textarea').inputValue();
 await page.locator('#message').fill(fixture);
 const {body:intake}=await observe('intake',()=>page.locator('#prepare').click());
 const ops=Object.fromEntries(intake.entidades.map(op=>[op.tipo,op]));
 const card=kind=>page.locator('[data-kind="'+kind+'"]');
 const originalCount=db.prepare('SELECT count(*) n FROM records').get().n;
 const beforeReview=await request('confirm',{id:ops.cadastro.id});
 const afterRefusal=db.prepare('SELECT count(*) n FROM records').get().n;
 async function review(kind,fields={}){
  const box=card(kind);
  for(const [name,val] of Object.entries(fields)){
   const f=box.locator('[name="'+name+'"]');
   if(await f.evaluate(el=>el.tagName)==='SELECT')await f.selectOption(val);else await f.fill(val);
  }
  const {status,body}=await observe('review',()=>box.getByRole('button',{name:'Revisar campos'}).click());
  assert.equal(status,200,kind+' — '+(body.error||'revisão'));
  return body;
 }
 const races={};
 async function confirm(kind,reviewed,race=false){
  const file=kind==='documento'?original:undefined,path=file?'original':'confirm',url=lab.origin+'/api/'+path;
  let concurrent;
  if(race){
   // Release a second real HTTP request when the operator clicks Confirmar, before either reply.
   await page.route(url,async route=>{
    concurrent=request(path,{id:reviewed.op.id,token:reviewed.token},file);
    await route.continue();
   },{times:1});
  }
  const {status,body}=await observe(path,()=>card(kind).getByRole('button',{name:'Confirmar no laboratório'}).click());
  assert.equal(status,200,kind+' — '+(body.error||'confirmação'));
  await card(kind).getByText('Registrado no laboratório').waitFor();
  if(race){
   const second=await concurrent;
   races[kind]={http:[status,second.status],mesma_referencia:second.body.referencia_homologacao===body.referencia_homologacao};
  }
  return body.referencia_homologacao;
 }
 const clientReview=await review('cadastro'),issuedAt=now;
 now+=299000;
 const clientId=await confirm('cadastro',clientReview,true);
 const client=(await request('client',{id:clientId})).body;
 const list=(await request('list',{tipo:'cadastro'})).body;
 check(1,'Cadastro fictício',{antes:originalCount,sem_revisao_http:beforeReview.status,apos_negacao:afterRefusal,id:clientId,nome:client.nome,telefone_ficticio:client.telefone,encontrados:list.length},()=>{
  assert.equal(originalCount,0);assert.equal(beforeReview.status,403);assert.equal(afterRefusal,0);assert.equal(client.nome,'Íris Exemplo');
  assert.equal(client.telefone,'00900000006');assert.equal(list.length,1);assert.equal(list[0].id,clientId);
 });
 const visitId=await confirm('atendimento',await review('atendimento',{procedimento:'Procedimento fictício 006',profissional:'Equipe Exemplo',data:relativeDay(-1),hora:'10:00'}));
 const originalVisit=rows('atendimento')[0];
 const balanceBefore=await request('cash');
 const fraction=await request('review',{id:ops.recebimento.id,campos:{...ops.recebimento.campos,valor_centavos:68000.5}});
 const payment=await review('recebimento',{data:day,conferencia:'recebimento_conferido'});
 const deniedPayment=await deny('confirm',{id:payment.op.id,token:payment.token});
 const paidBefore=rows('recebimento').length;
 const receiptId=await confirm('recebimento',payment,true);
 const balanceAfter=await request('cash');
 await page.waitForFunction(()=>document.querySelector('#balance').textContent.includes('680,00'));
 const receipt=rows('recebimento')[0];
 const storedType=db.prepare("SELECT json_type(body,'$.valor_centavos') AS tipo FROM records WHERE id=?").get(receiptId)?.tipo;
 const returnId=await confirm('agendamento',await review('agendamento',{procedimento:'Revisão fictícia',profissional:'Equipe Exemplo',data:relativeDay(14),hora:'11:00'}),true);
 const docReview=await review('documento');
 const deniedOriginal=await deny('original',{id:docReview.op.id,token:docReview.token},original);
 const originalsBefore=db.prepare('SELECT count(*) n FROM originals').get().n;
 const docId=await confirm('documento',docReview,true);
 await confirm('vinculo_documental',await review('vinculo_documental'));
 await card('atendimento').getByRole('button',{name:'Abrir cadastro'}).click();
 await page.locator('#client li').first().waitFor();
 const fileText=await page.locator('#client').innerText(),file=await request('client',{id:clientId});
 const visit=file.body.atendimentos.find(v=>v.id===visitId);
 check(2,'Atendimento',{http:file.status,cliente:clientId,atendimento:visitId,data:visit?.data,documento:visit?.documentos[0]?.id},()=>{
  assert.equal(file.status,200);assert.equal(visit.cliente_id,clientId);assert.equal(visit.data,relativeDay(-1));assert.equal(visit.documentos[0].id,docId);assert.equal(visit.recebimentos[0].id,receiptId);
 });
 check(3,'Recebimento em centavos',{rascunho:ops.recebimento.campos.valor_centavos,payload:payment.op.campos.valor_centavos,persistido:receipt.valor_centavos,tipo_sqlite:storedType,fracao_http:fraction.status,contratado:visit.contratado_centavos,data_caixa:receipt.data,historico:visit.recebimentos.length},()=>{
  assert.equal(ops.recebimento.campos.valor_centavos,68000);assert.equal(payment.op.campos.valor_centavos,68000);assert.equal(receipt.valor_centavos,68000);assert.equal(storedType,'integer');assert.equal(fraction.status,400);assert.equal(visit.contratado_centavos,90000);assert.equal(receipt.atendimento_id,visitId);assert.equal(receipt.cliente_id,clientId);assert.equal(receipt.data,day);assert.equal(visit.recebimentos[0].valor_centavos,68000);assert.equal(visit.recebimentos.length,1);
 });
 const deniedCash=await deny('cash');
 check(4,'Saldo consolidado',{http:[balanceBefore.status,balanceAfter.status],antes_centavos:balanceBefore.body.saldo_centavos,depois_centavos:balanceAfter.body.saldo_centavos,negativa_http:deniedCash.status,interface:await page.locator('#balance').textContent()},()=>{
  for(const s of [initial,balanceBefore,balanceAfter])assert.equal(s.status,200);
  assert.equal(balanceBefore.body.saldo_centavos,0);assert.equal(balanceAfter.body.saldo_centavos-balanceBefore.body.saldo_centavos,68000);assert.equal(deniedCash.status,403);assert.deepEqual(Object.keys(deniedCash.body),['error']);
 });
 const ret=rows('agendamento')[0];
 check(5,'Retorno',{id:returnId,atendimento:ret.atendimento_id,cliente:ret.cliente_id,data:ret.data,visivel:fileText.includes(ret.data)},()=>{
  assert.deepEqual(rows('atendimento')[0],originalVisit);assert.equal(ret.atendimento_id,visitId);assert.equal(ret.cliente_id,clientId);assert.equal(visit.retornos[0].id,returnId);
  assert.ok(ret.data>day&&fileText.includes('Retorno em '+ret.data));
 });
 const stored=db.prepare('SELECT hash,bytes FROM originals WHERE id=?').get(docId);
 const publicGet=await fetch(lab.origin+'/originals/'+docId);
 const mode=(await stat(databasePath)).mode & 0o777;
 violations.push(...await page.evaluate(()=>window.cspEvents),...await creation.page.evaluate(()=>window.cspEvents));
 const localEngine=docReview.op.origem_captura.motor_utilizado;
 check(6,'Documento local',{motor:localEngine,classe:docReview.op.campos.categoria,sha256:stored.hash,bytes:stored.bytes.length,arquivo_privado:mode.toString(8),get_publico:publicGet.status,interfaces:interfaces,namespace_apenas_loopback:loopbackOnly,requisicoes_externas:external.length,violacoes_csp:violations.length},()=>{
  assert.match(extractedText,/TCLE FICTICIO 006/);assert.equal(localEngine,'pdfjs_nativo_local');assert.equal(docReview.op.campos.categoria,'tcle_externo');assert.equal(docReview.op.origem_captura.sha256_arquivo,stored.hash);
  assert.equal(digest(original),stored.hash);assert.deepEqual(Buffer.from(stored.bytes),original);assert.equal(visit.documentos[0].id,docId);assert.equal(publicGet.status,404);assert.equal(mode,0o600);
  assert.ok(localPaths.has('/assets/pdf.mjs')&&localPaths.has('/assets/pdf.worker.mjs'));assert.deepEqual(external,[]);assert.deepEqual(violations,[]);
 });
 const revokedId=randomUUID(),revoked=await login(revokedId,'admin');
 const activeStatus=await api(revoked.cookie,'cash');
 store.db.prepare('UPDATE profiles SET active=0 WHERE id=?').run(revokedId);
 const inactiveStatus=await api(revoked.cookie,'cash');
 const hidden=await creation.page.locator('#desk').isHidden()&&await creation.page.locator('#cash').isHidden()&&await creation.page.locator('#history').isHidden();
 check(7,'RBAC',{criacao_sessao:200,interface_oculta:hidden,caixa_http:deniedCash.status,confirmar_recebimento_http:deniedPayment.status,anexar_http:deniedOriginal.status,registros_apos_negacao:[paidBefore,originalsBefore],mesma_sessao_ativa_revogada:[activeStatus.status,inactiveStatus.status],admin:balanceAfter.status},()=>{
  assert.ok(hidden);for(const res of [deniedCash,deniedPayment,deniedOriginal,inactiveStatus]){assert.equal(res.status,403);assert.deepEqual(Object.keys(res.body),['error']);}
  assert.equal(paidBefore,0);assert.equal(originalsBefore,0);assert.equal(activeStatus.status,200);assert.equal(balanceAfter.status,200);
 });
 const expense={descricao:'Despesa fictícia TTL',valor_centavos:7,competencia:day,situacao:'paga',pago_em:day};
 const expDraft=(await request('intake',{propostas:[{tipo:'despesa',campos:expense,evidencias:[],depends:[],origem_captura:ops.recebimento.origem_captura}]})).body.entidades[0];
 const expReview=await request('review',{id:expDraft.id,campos:expense});
 const counts=rows('despesa').length;
 now+=300000;
 const exact=await request('confirm',{id:expDraft.id,token:expReview.body.token});
 now+=1000;
 const expired=await request('confirm',{id:expDraft.id,token:expReview.body.token});
 const renewed=await request('review',{id:expDraft.id,campos:expense});
 await request('cancel',{id:expDraft.id});
 const finalCash=await request('cash');
 check(8,'TTL 300 s',{ttl_ms:Date.parse(clientReview.op.expira_em)-issuedAt,aprovada_aos_299s:races.cadastro.http[0],aos_300s:exact.status,aos_301s:expired.status,nova_revisao:renewed.status,despesas_antes_depois:[counts,rows('despesa').length],saldo_final:finalCash.body.saldo_centavos},()=>{
  assert.equal(Date.parse(clientReview.op.expira_em)-issuedAt,300000);assert.equal(races.cadastro.http[0],200);assert.equal(exact.status,409);assert.equal(expired.status,409);assert.match(expired.body.error,/expirou/);assert.equal(renewed.status,200);assert.notEqual(renewed.body.token,expReview.body.token);assert.equal(rows('despesa').length,counts);assert.equal(finalCash.body.saldo_centavos,68000);
 });
 const kinds=['cadastro','recebimento','agendamento','documento'];
 const quantities=Object.fromEntries(kinds.map(k=>[k,rows(k).length]));
 const replay=await request('confirm',{id:payment.op.id,token:payment.token});
 check(9,'Idempotência concorrente',{corridas:races,registros:quantities,originais:db.prepare('SELECT count(*) n FROM originals').get().n,saldo_centavos:finalCash.body.saldo_centavos,reenvio_apos_ttl:replay.status},()=>{
  for(const k of kinds){assert.deepEqual(races[k].http,[200,200]);assert.equal(races[k].mesma_referencia,true);assert.equal(quantities[k],1);}
  assert.equal(db.prepare('SELECT count(*) n FROM originals').get().n,1);assert.equal(finalCash.body.saldo_centavos,68000);assert.equal(replay.status,409);
 });
 const ownHistory=await request('history'),otherHistory=await deny('history');
 const audit=db.prepare('SELECT actor,role,kind,op,event,at FROM audit ORDER BY id').all();
 const eventCount=Object.fromEntries(['confirmada','negada_rbac','expirada','repeticao_idempotente'].map(event=>[event,audit.filter(row=>row.event===event).length]));
 const columns=db.prepare('PRAGMA table_info(audit)').all().map(r=>r.name);
 check(10,'Auditoria privada',{eventos:eventCount,campos:columns,historico_admin:ownHistory.status,historico_criacao:otherHistory.status,erros_de_pagina:errors.length},()=>{
  for(const count of Object.values(eventCount))assert.ok(count>0);
  assert.ok(audit.every(r=>r.actor&&r.role&&r.kind&&r.op&&Number.isInteger(r.at)));assert.ok(audit.some(r=>r.event==='negada_rbac'&&r.role==='admin_criacao'));
  for(const k of kinds)assert.ok(audit.some(r=>r.op===ops[k].id&&r.kind===k&&r.event==='repeticao_idempotente'));
  assert.deepEqual(columns,['id','actor','role','event','op','kind','at']);assert.doesNotMatch(JSON.stringify(audit),/Íris|00900000006|TCLE FICTICIO|Bearer|maya_lab|Despesa fictícia/);
  assert.equal(ownHistory.status,200);assert.ok(ownHistory.body.every(r=>r.actor===actorDemo));assert.equal(otherHistory.status,403);assert.deepEqual(errors,[]);
 });
} catch(error){report.interrupcao=error.message;process.exitCode=1;}
finally{
 if(browser)await browser.close();db.close();lab.close();await rm(directory,{recursive:true,force:true});
 report.criterios.sort((a,b)=>a.id-b.id);
 report.pass=report.criterios.filter(c=>c.resultado==='Pass').length;
 report.fail=report.criterios.filter(c=>c.resultado==='Fail').length;
 report.nao_executados=10-report.criterios.length;
 if(report.pass!==10)process.exitCode=1;
 console.log(JSON.stringify(report,null,2));
}
