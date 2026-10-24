import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import {initTreatmentController,renderTreatmentPanel} from '../../gestao/js/treatment-panel.js';
import {renderAgendaTreatmentOverlay,renderAgendaTreatmentButton} from '../../gestao/js/agenda-treatment-bridge.js';

function fixture({existing=false,compound=false}={}){
 const {document}=parseHTML('<html><body><main></main></body></html>');const root=document.querySelector('main');root.innerHTML=renderTreatmentPanel({client:{id:'c1'}});
 const procedure={id:'p1',nome:'Procedimento da agenda',can_execute:true,current_version:{id:'v1',nome:'Procedimento da agenda',protocol_mode:compound?'compound':'simple',specific_schema:{component_options:compound?[{key:'led',label:'LED',classe_documental:'nao_injetavel'}]:[],fields:[]}}};
 const treatment={id:'t1',cliente_id:'c1',agendamento_id:'a1',status:'rascunho',procedure_version:procedure.current_version,gate_reasons:[],finalization_gate_reasons:[]};
 const calls=[];let rows=existing?[treatment]:[];
 const client={storage:{from(){throw Error('Upload inesperado');}},from(){throw Error('Consulta de tabela inesperada neste cenário');},rpc:async(name,p)=>{calls.push([name,p]);let data=[];
  if(name==='bc_procedure_list')data=[procedure];else if(name==='bc_treatment_list_client')data=rows;
  else if(name==='bc_treatment_create'){rows=[treatment];data='t1';}else if(name==='bc_treatment_get')data=treatment;
  else if(name==='bc_treatment_report_get'||name==='bc_treatment_external_consent_get')data=null;
  return {data,error:null};
 }};
 return {root,client,calls,controller:initTreatmentController({client,root,getClientRecord:()=>({id:'c1',nome:'Cliente fictícia'})})};
}

test('Atender reaproveita agendamento e procedimento simples sem nova seleção',async()=>{
 const f=fixture();await f.controller.hydrate();await f.controller.startAppointment('a1','p1');
 const calls=f.calls.filter(x=>x[0]==='bc_treatment_create');assert.equal(calls.length,1);
 assert.equal(calls[0][1].p_agendamento_id,'a1');assert.equal(calls[0][1].p_procedure_id,'p1');
 assert.ok(f.root.querySelector('[data-treatment-wizard="clinical"]'));assert.equal(f.root.querySelector('[data-treatment-create-form]'),null);
});

test('Atender continua rascunho existente sem criar outra sessão',async()=>{
 const f=fixture({existing:true});await f.controller.hydrate();await f.controller.startAppointment('a1','p1');
 assert.equal(f.calls.filter(x=>x[0]==='bc_treatment_create').length,0);assert.ok(f.root.querySelector('[data-treatment-id="t1"]'));
});

test('protocolo com componentes mantém a escolha clínica com procedimento preenchido',async()=>{
 const f=fixture({compound:true});await f.controller.hydrate();await f.controller.startAppointment('a1','p1');
 assert.equal(f.calls.filter(x=>x[0]==='bc_treatment_create').length,0);
 assert.ok(f.root.querySelector('[data-treatment-component]'));assert.ok(f.root.querySelector('option[value="p1"][selected]'));
});

test('entrada da agenda não exige botão intermediário para continuar',()=>{
 assert.match(renderAgendaTreatmentButton('a1'),/>Atender</);
 const html=renderAgendaTreatmentOverlay({context:{can_start:true},clientRecord:{nome:'Cliente'}});
 assert.doesNotMatch(html,/data-agenda-treatment-start|Continuar no prontuário/);assert.match(html,/data-agenda-treatment-mount/);
});

test('novo atendimento usa só o prontuário formal e componente de recebimento compartilhado',async()=>{
 const html=await readFile(new URL('../../gestao/colaborador/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="attendanceForm"|bindAttendanceForm|id="currentAppointmentReceiptForm"/);
 assert.match(html,/id="currentAppointmentReceiptHost"/);
 const admin=await readFile(new URL('../../gestao/js/admin-agenda.js',import.meta.url),'utf8');
 const collaborator=await readFile(new URL('../../gestao/js/colaborador-agenda.js',import.meta.url),'utf8');
 assert.match(admin,/mountAppointmentReceipt/);assert.match(collaborator,/mountAppointmentReceipt/);
});
