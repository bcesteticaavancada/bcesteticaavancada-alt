import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppointmentClinicalContext,
  renderAgendaTreatmentButton,
  renderAgendaTreatmentOverlay,
  installAgendaTreatmentBridge,
} from '../../gestao/js/agenda-treatment-bridge.js';

function mockClient(result={data:{},error:null}) {
  const calls=[];
  return {calls,client:{async rpc(name,payload={}){calls.push([name,payload]);return result;}}};
}

test('contexto do agendamento usa RPC dedicado', async()=>{
  const m=mockClient({data:{appointment_id:'a1',can_start:true},error:null});
  const result=await getAppointmentClinicalContext({client:m.client,appointmentId:'a1'});
  assert.equal(result.can_start,true);
  assert.deepEqual(m.calls,[['bc_appointment_clinical_context',{p_agendamento_id:'a1'}]]);
});

test('botão da agenda deixa claro que abre prontuário clínico',()=>{
  const html=renderAgendaTreatmentButton('a1');
  assert.match(html,/>Atender</);
  assert.match(html,/data-open-clinical-treatment=["']a1["']/);
});

test('overlay autorizado oferece atendimento formal; visualização alheia fica somente leitura',()=>{
  const writable=renderAgendaTreatmentOverlay({context:{can_start:true,procedure_name:'Limpeza de pele',professional_name:'Alice'},clientRecord:{nome:'Cliente Teste'},readOnlyHistory:'<div>Histórico</div>'});
  assert.match(writable,/Continuar no prontuário/i);
  assert.match(writable,/data-agenda-treatment-mount/);
  assert.doesNotMatch(writable,/data-agenda-treatment-start/);

  const readonly=renderAgendaTreatmentOverlay({context:{can_start:false,procedure_name:'Botox full face',professional_name:'Alice'},clientRecord:{nome:'Cliente Teste'},readOnlyHistory:'<div>Histórico clínico</div>'});
  assert.match(readonly,/Somente visualização/i);
  assert.match(readonly,/Alice/);
  assert.doesNotMatch(readonly,/data-agenda-treatment-start/);
});

test('installer compartilhado existe',()=>assert.equal(typeof installAgendaTreatmentBridge,'function'));

test('troca rápida de agenda descarta resposta antiga e fechar invalida abertura pendente',async()=>{
 const {parseHTML}=await import('linkedom');const {document}=parseHTML('<html><head></head><body></body></html>');
 const pending=new Map();const client={rpc:async(name,p)=>name==='bc_appointment_clinical_context'?new Promise(resolve=>pending.set(p.p_agendamento_id,resolve)):{data:[],error:null},from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'c1',nome:'Cliente'},error:null})}}};
 const bridge=installAgendaTreatmentBridge({client,root:document});
 const first=bridge.open('a1'),second=bridge.open('a2');
 const result=id=>({data:{appointment_id:id,cliente_id:'c1',can_start:false,procedure_name:id},error:null});
 pending.get('a2')(result('a2'));await second;pending.get('a1')(result('a1'));await first;
 assert.equal(document.querySelectorAll('[data-agenda-treatment-overlay]').length,1);assert.match(document.body.textContent,/a2/);assert.doesNotMatch(document.body.textContent,/a1/);
 const third=bridge.open('a3');bridge.close();pending.get('a3')(result('a3'));await third;assert.equal(document.querySelector('[data-agenda-treatment-overlay]'),null);bridge.destroy();
});
