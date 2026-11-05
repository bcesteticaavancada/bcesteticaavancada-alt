import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';

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
