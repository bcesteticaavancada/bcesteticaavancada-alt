import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {mountAppointmentReceipt} from '../../gestao/js/finance-receipt-panel.js';

const actor='00000000-0000-4000-8000-000000000001';
const appointment='00000000-0000-4000-8000-000000000002';
const receipt='00000000-0000-4000-8000-000000000003';
const charge=()=>({actor_id:actor,appointment_id:appointment,state:'receivable',total:600,received:100,remaining:500,can_receive:true});
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),size:()=>m.size};};
function host(){const {document,window}=parseHTML('<html><body><section id="host"></section></body></html>');return {document,window,root:document.getElementById('host')};}
async function settle(check){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,1));}assert.fail('Operação não concluiu');}
function submit(root,window){root.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));}

test('saldo é reaproveitado e forma de pagamento é opcional',async()=>{
 const h=host();const calls=[];let paid=false;
 const client={rpc:async(name,p)=>{calls.push([name,p]);if(name==='bc_finance_appointment_summary')return {data:paid?{...charge(),state:'paid',remaining:0,received:600,can_receive:false}:charge(),error:null};paid=true;return {data:receipt,error:null};}};
 const panel=await mountAppointmentReceipt({...h,client,appointmentId:appointment,storage:storage()});
 assert.match(h.root.textContent,/500,00/);assert.equal(h.root.querySelector('[name="amount"]').value,'500');
 assert.equal(h.root.querySelector('[name="method"]').hasAttribute('required'),false);
 submit(h.root,h.window);await settle(()=>h.root.textContent.includes('Recebimento confirmado'));
 const sent=calls.find(x=>x[0]==='bc_recebimento_registrar_agendamento_v2')[1];
 assert.equal(sent.p_valor,500);assert.equal(sent.p_forma_pagamento,'nao_informado');assert.equal(sent.p_agendamento_id,appointment);
 assert.match(sent.p_request_key,/^[a-f0-9-]{36}$/);assert.equal(h.root.querySelector('form'),null);panel.destroy();
});

test('resposta perdida mantém a mesma chave e bloqueia alterar o valor da tentativa',async()=>{
 const h=host(),sent=[];let attempts=0;const client={rpc:async(name,p)=>name==='bc_finance_appointment_summary'?{data:charge(),error:null}:(sent.push(p),attempts++,attempts===1?{data:null,error:{code:'NETWORK_ERROR',message:'Rede interrompida'}}:{data:receipt,error:null})};
 await mountAppointmentReceipt({...h,client,appointmentId:appointment,storage:storage()});
 submit(h.root,h.window);await settle(()=>h.root.textContent.includes('Resultado não confirmado'));
 h.root.querySelector('[name="amount"]').value='400';submit(h.root,h.window);await settle(()=>h.root.textContent.includes('Há um recebimento aguardando confirmação'));
 assert.equal(sent.length,1);
 h.root.querySelector('[name="amount"]').value='500';submit(h.root,h.window);await settle(()=>sent.length===2);
 assert.equal(sent[0].p_request_key,sent[1].p_request_key);
});

test('armazenamento indisponível impede envio e não cria tentativa só em memória',async()=>{
 const h=host();let writes=0;const client={rpc:async(name)=>{if(name==='bc_finance_appointment_summary')return {data:charge(),error:null};writes++;return {data:receipt,error:null};}};
 await mountAppointmentReceipt({...h,client,appointmentId:appointment,storage:{getItem(){throw Error('Blocked')},setItem(){throw Error('Blocked')}}});
 submit(h.root,h.window);await settle(()=>h.root.textContent.includes('armazenamento'));assert.equal(writes,0);
});

test('falha de atualização posterior não transforma recebimento confirmado em erro',async()=>{
 const h=host();let reads=0;const client={rpc:async(name)=>name==='bc_finance_appointment_summary'?(++reads===1?{data:charge(),error:null}:{data:null,error:{message:'Lista indisponível'}}):{data:receipt,error:null}};
 await mountAppointmentReceipt({...h,client,appointmentId:appointment,storage:storage(),onChanged:async()=>{throw Error('Painel indisponível')}});
 submit(h.root,h.window);await settle(()=>h.root.textContent.includes('Recebimento confirmado'));
 assert.doesNotMatch(h.root.textContent,/Resultado não confirmado/);
});

test('sessão não concluída e sessão gratuita não oferecem registro de dinheiro',async()=>{
 for(const state of ['not_completed','free']){
  const h=host();await mountAppointmentReceipt({...h,client:{rpc:async()=>({data:{actor_id:actor,state,can_receive:false},error:null})},appointmentId:appointment,storage:storage()});
  assert.equal(h.root.querySelector('form'),null);assert.match(h.root.textContent,state==='free'?/Sem cobrança/:/Conclua/);
 }
});

test('nova identidade usa outra tentativa mesmo abrindo o mesmo agendamento',async()=>{
 const shared=storage();let firstKey;
 for(const user of [actor,'00000000-0000-4000-8000-000000000004']){
  const h=host();let key;const client={rpc:async(name,p)=>name==='bc_finance_appointment_summary'?{data:{...charge(),actor_id:user},error:null}:(key=p.p_request_key,{data:null,error:{code:'NETWORK_ERROR'}})};
  await mountAppointmentReceipt({...h,client,appointmentId:appointment,storage:shared});submit(h.root,h.window);await settle(()=>Boolean(key));
  if(firstKey)assert.notEqual(firstKey,key);else firstKey=key;
 }
});

test('resposta antiga não recria formulário após destroy',async()=>{
 const h=host();let release;let reads=0;
 const client={rpc:async()=>++reads===1?{data:charge(),error:null}:new Promise(r=>{release=r})};
 const panel=await mountAppointmentReceipt({...h,client,appointmentId:appointment,storage:storage()});const pending=panel.refresh();
 panel.destroy();h.root.textContent='Outra tarefa';release({data:charge(),error:null});await pending;assert.equal(h.root.textContent,'Outra tarefa');
});

test('leitura clínica sem acesso financeiro não mostra painel nem botão de tentativa',async()=>{
 const h=host();await mountAppointmentReceipt({...h,client:{rpc:async()=>({data:null,error:{code:'42501',message:'Acesso negado'}})},appointmentId:appointment,storage:storage()});
 assert.equal(h.root.hidden,true);assert.equal(h.root.textContent,'');
});
