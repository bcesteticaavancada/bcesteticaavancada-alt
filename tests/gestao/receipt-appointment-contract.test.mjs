import test from 'node:test';
import assert from 'node:assert/strict';
import {initCollaboratorFinance} from '../../gestao/js/colaborador-finance.js';
import {renderAdminAppointments} from '../../gestao/js/admin-agenda.js';
import {parseHTML} from 'linkedom';

function formHarness(){const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',dataset:{},events:{},addEventListener(type,fn){this.events[type]=fn;},querySelector(){return {disabled:false};},reset(){}});return nodes.get(id);};return {el,root:{getElementById:el}};}

test('recebimento do agendamento resolve o atendimento no banco sem confundir os IDs',async()=>{
  const {el,root}=formHarness();let receipt;
  const client={rpc:async(name,args)=>{
    if(name==='bc_recebimento_registrar_agendamento_v2'){receipt=args;return {data:'recibo-ficticio',error:null};}
    if(name==='bc_recebimento_registrar')return {data:null,error:{message:'Atendimento não encontrado.'}};
    return {data:[],error:null};
  }};
  await initCollaboratorFinance({client,profile:{user_id:'profissional-ficticia'},root,getCurrentAppointment:()=>({id:'agendamento-ficticio',colaboradora_user_id:'profissional-ficticia'})});
  el('currentAppointmentReceiptValue').value='100';el('currentAppointmentReceiptMethod').value='pix';
  await el('currentAppointmentReceiptForm').events.submit({preventDefault(){}});
  assert.equal(el('currentAppointmentReceiptStatus').dataset.kind,'success');
  assert.equal(receipt.p_agendamento_id,'agendamento-ficticio');
  assert.equal('p_atendimento_id' in receipt,false);
});

test('admin pode registrar recebimento após atendimento, inclusive de sua própria agenda',()=>{
  const {document}=parseHTML(renderAdminAppointments([{id:'agenda-ficticia',cliente_id:'cliente-ficticia',status:'atendido',inicio:'2026-10-19T12:00:00Z'}]));
  assert.equal(document.querySelector('[data-admin-receipt-form]')?.dataset.adminReceiptForm,'agenda-ficticia');
  const pending=parseHTML(renderAdminAppointments([{id:'pendente',status:'agendado',inicio:'2026-10-19T12:00:00Z'}])).document;
  assert.equal(pending.querySelector('[data-admin-receipt-form]'),null);
});


test('resposta perdida mantém a mesma tentativa e recusa alteração silenciosa de valor',async()=>{
 const {el,root}=formHarness();const calls=[];let fail=true;
 const client={rpc:async(name,args)=>{if(name==='bc_recebimento_registrar_agendamento_v2'){calls.push(args);return fail?{data:null,error:{message:'Failed to fetch',code:''}}:{data:'receipt',error:null};}return {data:[],error:null};}};
 await initCollaboratorFinance({client,profile:{user_id:'worker'},root,getCurrentAppointment:()=>({id:'appointment',colaboradora_user_id:'worker'})});
 el('currentAppointmentReceiptValue').value='100';el('currentAppointmentReceiptMethod').value='pix';const submit=()=>el('currentAppointmentReceiptForm').events.submit({preventDefault(){}});
 await submit();assert.match(el('currentAppointmentReceiptStatus').textContent,/não confirmado/i);
 el('currentAppointmentReceiptValue').value='200';await submit();assert.equal(calls.length,1);assert.match(el('currentAppointmentReceiptStatus').textContent,/aguardando confirmação/i);
 el('currentAppointmentReceiptValue').value='100';fail=false;await submit();assert.equal(calls.length,2);assert.equal(calls[0].p_request_key,calls[1].p_request_key);assert.equal(el('currentAppointmentReceiptStatus').dataset.kind,'success');
});
