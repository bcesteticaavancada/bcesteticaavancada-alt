import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTreatment6dCards} from '../../gestao/js/treatment-6d-panel.js';
import {renderTreatmentWizard} from '../../gestao/js/treatment-panel.js';
import * as equipmentApi from '../../gestao/js/treatment-equipment-api.js';

test('equipamento aceita nome inédito sem catálogo e preserva formulário de parâmetros',()=>{
  const html=renderTreatment6dCards({treatment:{id:'qa',status:'rascunho'}});
  assert.match(html,/<input[^>]*name="equipment_name"[^>]*required/);
  assert.doesNotMatch(html,/<select[^>]*name="equipment_id"/);
  assert.match(html,/name="equipment_notes"/);
});
test('RPC por texto normaliza nome, aceita parâmetros e rejeita vazio antes de salvar',async()=>{
  assert.equal(typeof equipmentApi.addTreatmentEquipmentUsageByName,'function');
  const calls=[];const client={rpc:async(name,payload)=>{calls.push({name,payload});return {data:'uso-qa'};}};
  await equipmentApi.addTreatmentEquipmentUsageByName({client,treatmentId:'qa',equipmentName:'  Laser livre  ',parameterValues:{potencia:2},notes:' Teste '});
  assert.deepEqual(calls,[{name:'bc_treatment_equipment_usage_add_text',payload:{p_treatment_id:'qa',p_equipment_name:'Laser livre',p_parameter_values:{potencia:2},p_notes:'Teste'}}]);
  await assert.rejects(()=>equipmentApi.addTreatmentEquipmentUsageByName({client,treatmentId:'qa',equipmentName:' '}),/equipamento/i);
  assert.equal(calls.length,1);
});
test('parecer permite preenchimento no rascunho e bloqueia versões pendentes',()=>{
  const render=t=>renderTreatmentWizard({step:'clinical',treatment:{id:'qa',...t}});
  for(const status of ['rascunho','pronto_para_iniciar','em_atendimento'])assert.match(render({status}),/data-treatment-report-form data-readonly="false"/);
  for(const state of [{status:'finalizado'},{status:'em_atendimento',pending_version_id:'v1'},{status:'em_atendimento',pending_document_id:'d1'}])assert.match(render(state),/data-treatment-report-form data-readonly="true"/);
});
test('lembrete separado continua disponível em ficha finalizada',()=>{
  const html=renderTreatmentWizard({step:'clinical',treatment:{id:'qa',status:'finalizado'}});
  assert.match(html,/data-return-reminder-slot/);
});
