import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import * as api from '../../gestao/js/treatment-api.js';
import {renderTreatmentWizard} from '../../gestao/js/treatment-panel.js';
test('legacy clinical record offers explicit matching appointment or actual session time',()=>{
  const {document}=parseHTML(renderTreatmentWizard({step:'clinical',treatment:{id:'old',status:'em_atendimento',can_resolve_appointment:true,treatment_date:'2026-10-18'},appointmentOptions:[{id:'apt-1',inicio:'2026-10-18T13:00:00Z'}]}));
  assert.ok(document.querySelector('[data-treatment-appointment-form]'));
  assert.equal(document.querySelector('option[value="apt-1"]').value,'apt-1');
  assert.ok(document.querySelector('[name="session_time"]'));
});
test('legacy link sends only explicitly selected appointment, or explicit actual time',async()=>{
  assert.equal(typeof api.resolveTreatmentAppointment,'function');let call;
  const client={rpc:async(name,args)=>{call={name,args};return {data:'apt-1'};}};
  await api.resolveTreatmentAppointment({client,treatmentId:'old',appointmentId:'apt-1'});
  assert.deepEqual(call,{name:'bc_treatment_resolve_appointment',args:{p_treatment_id:'old',p_agendamento_id:'apt-1',p_inicio:null}});
  await assert.rejects(()=>api.resolveTreatmentAppointment({client,treatmentId:'old'}),/horário|agendamento/i);
});

test('shared legacy reading remains available without owner-only appointment actions',()=>{
 const {document}=parseHTML(renderTreatmentWizard({step:'clinical',treatment:{id:'old',status:'finalizado',can_resolve_appointment:false}}));
 assert.equal(document.querySelector('[data-treatment-appointment-form]'),null);
 assert.ok(document.querySelector('[data-treatment-wizard="clinical"]'));
});
