import test from 'node:test';
import assert from 'node:assert/strict';
import {initCollaboratorFinance} from '../../gestao/js/colaborador-finance.js';
import {renderAdminAppointments} from '../../gestao/js/admin-agenda.js';
import {parseHTML} from 'linkedom';

function formHarness(){const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',dataset:{},events:{},addEventListener(type,fn){this.events[type]=fn;},querySelector(){return {disabled:false};},reset(){}});return nodes.get(id);};return {el,root:{getElementById:el}};}

test('recebimento do agendamento resolve o atendimento no banco sem confundir os IDs',async()=>{
  const {el,root}=formHarness();let receipt;
  const client={rpc:async(name,args)=>{
    if(name==='bc_recebimento_registrar_agendamento'){receipt=args;return {data:'recibo-ficticio',error:null};}
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
