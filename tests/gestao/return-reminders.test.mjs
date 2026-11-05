import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {initTreatmentController} from '../../gestao/js/treatment-panel.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('lembrete usa horário de Brasília e aceita observação livre sem exigir parecer',async()=>{
  const api=await import('../../gestao/js/return-reminders-api.js');
  const calls=[];const client={rpc:async(name,payload)=>{calls.push({name,payload});return {data:'qa'};}};
  await api.saveReturnReminder({client,treatmentId:'qa',returnOn:'2026-11-20',remindAt:'2026-11-19T09:00',note:'Reavaliar em 15 dias'});
  assert.deepEqual(calls,[{name:'bc_return_reminder_save',payload:{p_treatment_id:'qa',p_return_on:'2026-11-20',p_remind_at:'2026-11-19T12:00:00.000Z',p_note:'Reavaliar em 15 dias'}}]);
  assert.doesNotMatch(JSON.stringify(calls),/descricao_sessao|recipient_user_id|service_role/);
});
test('data impossível e hora fora do intervalo não chegam ao banco',async()=>{
  const api=await import('../../gestao/js/return-reminders-api.js');
  let calls=0;const client={rpc:async()=>{calls++;return {data:null};}};
  for(const patch of [{returnOn:'2026-02-30'},{remindAt:'2026-11-19T25:00'},{note:'x'.repeat(4001)}])await assert.rejects(()=>api.saveReturnReminder({client,treatmentId:'qa',returnOn:'2026-11-20',remindAt:'2026-11-19T09:00',...patch}));
  assert.equal(calls,0);
});
test('caixa escapa nome, observa fuso e oferece conclusão e reagendamento',async()=>{
  const {renderReturnInbox}=await import('../../gestao/js/return-reminders-panel.js');
  const html=renderReturnInbox([{id:'qa',client_name:'<script>x</script>',return_on:'2026-11-20',remind_at:'2026-11-19T12:00:00Z',note:'<img src=x>',active:true}]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.match(html,/20\/11\/2026/);
  assert.match(html,/data-reminder-complete/);
  assert.match(html,/data-reminder-edit/);
});
test('despachante nega chamada sem segredo antes de acessar a fila',async()=>{
  const {createReturnReminderHandler}=await import('../../supabase/functions/return-reminders/handler.mjs');
  let calls=0;const handler=createReturnReminderHandler({service:{rpc:async()=>{calls++;return {data:null};}},sendNotification:async()=>{throw Error('unexpected');}});
  const response=await handler(new Request('https://example.test',{method:'POST'}));
  assert.equal(response.status,401);assert.equal(calls,0);
});
test('envio não inclui nome de cliente e endpoint expirado é desativado',async()=>{
  const {createReturnReminderHandler}=await import('../../supabase/functions/return-reminders/handler.mjs');
  const calls=[],push=[];
  const service={rpc:async(name,payload)=>{calls.push({name,payload});if(name==='bc_return_push_worker_config')return {data:{public_key:'public',private_key:'private'}};if(name==='bc_return_push_claim')return {data:[{id:'1',claim_token:'c1',subscription:{endpoint:'https://fcm.googleapis.com/qa',keys:{}}},{id:'2',claim_token:'c2',subscription:{endpoint:'https://fcm.googleapis.com/expired',keys:{}}}]};return {data:true};}};
  const handler=createReturnReminderHandler({service,sendNotification:async(sub,body)=>{push.push(JSON.parse(body));if(sub.endpoint.endsWith('expired'))throw {statusCode:410};}});
  const result=await handler(new Request('https://example.test',{method:'POST',headers:{'x-bc-reminder-key':'secret'}}));
  assert.equal(result.status,200);
  assert.deepEqual(calls.filter(x=>x.name==='bc_return_push_finish').map(x=>x.payload.p_outcome),['delivered','expired']);
  assert.ok(push.every(x=>!('client_name' in x)&&!('procedure' in x)));
});
test('falha transitória ao revalidar o aviso preserva tentativa para reenvio',async()=>{
 const {createReturnReminderHandler}=await import('../../supabase/functions/return-reminders/handler.mjs');
 const outcomes=[];let pushes=0;
 const service={rpc:async(name,payload)=>{
  if(name==='bc_return_push_worker_config')return {data:{public_key:'p',private_key:'s'}};
  if(name==='bc_return_push_claim')return {data:[{id:'d',claim_token:'c',subscription:{}}]};
  if(name==='bc_return_push_is_current')return {error:{message:'temporary database error'}};
  outcomes.push(payload.p_outcome);return {data:true};
 }};
 const handler=createReturnReminderHandler({service,sendNotification:async()=>{pushes++;}});
 await handler(new Request('https://example.test',{method:'POST',headers:{'x-bc-reminder-key':'secret'}}));
 assert.deepEqual(outcomes,['retry']);assert.equal(pushes,0);
});
test('consulta pendente de lembretes respeita formulário aberto e canApply',async()=>{
 const {initReturnReminders}=await import('../../gestao/js/return-reminders-panel.js');
 const {document}=parseHTML('<html><body><section id="lembretes"></section></body></html>');
 let pending=false,release;const client={rpc:async()=>pending?new Promise(resolve=>release=()=>resolve({data:[]})):{data:[]}};
 const runtime=await initReturnReminders({client,root:document});pending=true;let canApply=true;const poll=runtime.refresh({canApply:()=>canApply});await Promise.resolve();
 const form=document.createElement('form');form.dataset.returnReminderForm='';form.innerHTML='<textarea name="note">Observação em edição</textarea>';document.getElementById('lembretes').append(form);canApply=false;release();await poll;
 assert.equal(document.querySelector('[name="note"]').textContent,'Observação em edição');runtime.destroy();
});

test('recarregar a mesma sessão preserva o lembrete ainda não salvo sem levar o texto a outra sessão',async()=>{
 const {document}=parseHTML('<html><body><section data-treatment-panel><div data-treatment-workspace></div><div data-treatment-history></div></section></body></html>');
 const client={storage:{from(){throw Error('Nenhum arquivo deve ser acessado neste teste');}},rpc:async(name,payload)=>{
  if(name==='bc_treatment_get')return {data:{id:payload.p_treatment_id,cliente_id:'c1',status:'rascunho',procedure_version:{nome:'Teste',specific_schema:{fields:[]}},phase6d_summary:{}}};
  if(['bc_treatment_report_get','bc_treatment_external_consent_get','bc_return_reminder_get'].includes(name))return {data:null};
  return {data:[]};
 }};
 const controller=initTreatmentController({client,root:document.body,getClientRecord:()=>({id:'c1'})});
 await controller.openTreatment('t1');
 document.querySelector('[name="return_on"]').value='2026-12-10';
 document.querySelector('[name="remind_at"]').value='2026-12-09T09:00';
 document.querySelector('[data-return-reminder-form] [name="note"]').value='Observação ainda não salva';
 await controller.openTreatment('t1');
 assert.equal(document.querySelector('[name="return_on"]').value,'2026-12-10');
 assert.equal(document.querySelector('[name="remind_at"]').value,'2026-12-09T09:00');
 assert.equal(document.querySelector('[data-return-reminder-form] [name="note"]').value,'Observação ainda não salva');
 await controller.openTreatment('t2');
 assert.equal(document.querySelector('[data-return-reminder-form] [name="note"]').value,'');
});

test('concluir outro lembrete conserva o editor aberto e atualiza o item concluído',async()=>{
 const {initReturnReminders}=await import('../../gestao/js/return-reminders-panel.js');
 const {document,window}=parseHTML('<html><body><section id="lembretes"></section></body></html>');
 const rows=['a','b'].map(id=>({id,treatment_id:`t-${id}`,client_name:`Fictícia ${id}`,return_on:'2026-12-10',remind_at:'2026-12-09T12:00:00Z',active:true}));
 const client={rpc:async(name,payload)=>{
  if(name==='bc_return_reminder_complete'){rows.find(r=>r.id===payload.p_reminder_id).active=false;return {data:payload.p_reminder_id};}
  return {data:rows};
 }};
 const runtime=await initReturnReminders({client,root:document});
 const click=selector=>document.querySelector(selector).dispatchEvent(new window.Event('click',{bubbles:true}));
 click('[data-reminder-edit="a"]');
 document.querySelector('[data-return-reminder="a"] [name="note"]').value='Não apagar esta edição';
 click('[data-reminder-complete="b"]');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(document.querySelector('[data-return-reminder="a"] [name="note"]')?.value,'Não apagar esta edição');
 assert.match(document.querySelector('[data-return-reminder="b"]').textContent,/Concluído/);
 runtime.destroy();
});

test('salvar um editor atualiza o aviso salvo e conserva outro lembrete em edição',async()=>{
 const {initReturnReminders}=await import('../../gestao/js/return-reminders-panel.js');
 const {document,window}=parseHTML('<html><body><section id="lembretes"></section></body></html>');
 const rows=['a','b'].map(id=>({id,treatment_id:`t-${id}`,client_name:`Fictícia ${id}`,return_on:'2026-12-10',remind_at:'2026-12-09T12:00:00Z',active:true}));
 const client={rpc:async(name,payload)=>{
  if(name==='bc_return_reminder_save'){const r=rows.find(row=>row.treatment_id===payload.p_treatment_id);r.note=payload.p_note;return {data:r.id};}
  return {data:rows};
 }};
 const runtime=await initReturnReminders({client,root:document});
 for(const id of ['a','b'])document.querySelector(`[data-reminder-edit="${id}"]`).dispatchEvent(new window.Event('click',{bubbles:true}));
 document.querySelector('[data-return-reminder="a"] [name="note"]').value='Rascunho A';
 const form=document.querySelector('[data-return-reminder="b"] form');
 Object.defineProperty(form,'elements',{value:Object.fromEntries([...form.querySelectorAll('[name]')].map(el=>[el.name,el]))});
 form.elements.note.value='B salvo';
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(document.querySelector('[data-return-reminder="a"] [name="note"]')?.value,'Rascunho A');
 assert.match(document.querySelector('[data-return-reminder="b"]').textContent,/B salvo/);
 assert.equal(document.querySelector('[data-return-reminder="b"] form'),null);
 runtime.destroy();
});

test('clique na notificação conserva destino lembretes quando já existe janela de login',async()=>{
 const handlers={},navigations=[];let pending,focused=false;
 const tab={url:'https://www.bcesteticaavancada.com.br/gestao/login/',navigate:async url=>navigations.push(url),focus:async()=>{focused=true;}};
 const self={addEventListener:(name,handler)=>{handlers[name]=handler;},clients:{matchAll:async()=>[tab],openWindow:async()=>assert.fail('A janela existente deve ser usada')}};
 vm.runInNewContext(readFileSync(new URL('../../gestao/return-reminder-sw.js',import.meta.url),'utf8'),{self,URL});
 handlers.notificationclick({notification:{close(){}},waitUntil:promise=>{pending=promise;}});
 await pending;
 assert.deepEqual(navigations,['https://www.bcesteticaavancada.com.br/gestao/login/#lembretes']);
 assert.equal(focused,true);
});
