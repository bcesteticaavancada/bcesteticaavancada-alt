import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listClinicalEquipment,saveClinicalEquipment,listTreatmentEquipmentUsages,addTreatmentEquipmentUsage,removeTreatmentEquipmentUsage,
} from '../../gestao/js/treatment-equipment-api.js';

function makeClient(result={data:[],error:null}){const calls=[];return {calls,client:{async rpc(name,payload={}){calls.push([name,payload]);return typeof result==='function'?result(name,payload):result;}}};}

test('catálogo de equipamentos usa RPCs dedicados',async()=>{
  const mock=makeClient();
  await listClinicalEquipment({client:mock.client,includeInactive:true});
  await saveClinicalEquipment({client:mock.client,equipmentId:null,payload:{name:'Aparelho X',parameter_schema:{fields:[]}}});
  assert.deepEqual(mock.calls[0],['bc_clinical_equipment_list',{p_include_inactive:true}]);
  assert.deepEqual(mock.calls[1],['bc_clinical_equipment_upsert',{p_equipment_id:null,p_payload:{name:'Aparelho X',parameter_schema:{fields:[]}}}]);
});

test('uso envia equipamento + valores, nunca snapshots fornecidos pelo navegador',async()=>{
  const mock=makeClient({data:'eu1',error:null});
  const result=await addTreatmentEquipmentUsage({client:mock.client,treatmentId:'t1',equipmentId:'e1',parameterValues:{power:10},equipment_name_snapshot:'FAKE',parameter_schema_snapshot:{fake:true}});
  assert.equal(result,'eu1');
  assert.deepEqual(mock.calls[0],['bc_treatment_equipment_usage_add',{p_treatment_id:'t1',p_equipment_id:'e1',p_parameter_values:{power:10}}]);
  assert.doesNotMatch(JSON.stringify(mock.calls[0]),/snapshot|manufacturer_snapshot|model_snapshot/);
});

test('lista/remove usam RPCs e parameterValues precisa ser objeto simples',async()=>{
  const mock=makeClient((name)=>({data:name==='bc_treatment_equipment_usage_list'?[{id:'eu1'}]:'eu1',error:null}));
  assert.deepEqual(await listTreatmentEquipmentUsages({client:mock.client,treatmentId:'t1'}),[{id:'eu1'}]);
  await removeTreatmentEquipmentUsage({client:mock.client,usageId:'eu1'});
  assert.deepEqual(mock.calls[1],['bc_treatment_equipment_usage_remove',{p_usage_id:'eu1'}]);
  const invalid=makeClient();
  await assert.rejects(()=>addTreatmentEquipmentUsage({client:invalid.client,treatmentId:'t1',equipmentId:'e1',parameterValues:[]}),/parâmetros|parametros|objeto/i);
  assert.equal(invalid.calls.length,0);
});
