import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTreatment,
  getTreatment,
  listClientTreatments,
  updateTreatmentDraft,
  confirmTreatmentHealthChange,
  confirmTreatmentAlertReview,
  prepareTreatmentConsent,
  markTreatmentReady,
  startTreatment,
  finalizeTreatment,
  completeTreatmentFinalization,
  correctTreatmentSameDay,
  createTreatmentReopenGrant,
  correctReopenedTreatment,
} from '../../gestao/js/treatment-api.js';

function mockClient(result={data:'ok',error:null}){
  const calls=[];
  return {calls,client:{async rpc(name,payload={}){calls.push([name,payload]);return result;}}};
}

test('criação não envia profissional/autoria e aceita agendamento ou walk-in', async()=>{
  const m=mockClient();
  await createTreatment({client:m.client,clienteId:'c1',procedureId:'p1',appointmentId:'a1',componentVersionIds:['v2'],componentKeys:['via_injetavel'],professionalUserId:'NUNCA'});
  assert.deepEqual(m.calls[0],['bc_treatment_create',{p_cliente_id:'c1',p_procedure_id:'p1',p_agendamento_id:'a1',p_component_version_ids:['v2'],p_component_keys:['via_injetavel']}]);
  assert.equal(JSON.stringify(m.calls[0]).includes('NUNCA'),false);
});

test('leitura e atualização usam RPCs dedicadas', async()=>{
  const m=mockClient({data:[],error:null});
  await getTreatment({client:m.client,treatmentId:'t1'});
  await listClientTreatments({client:m.client,clienteId:'c1'});
  await updateTreatmentDraft({client:m.client,treatmentId:'t1',patch:{objetivo:'Glow',created_by:'NUNCA'}});
  assert.deepEqual(m.calls[0],['bc_treatment_get',{p_treatment_id:'t1'}]);
  assert.deepEqual(m.calls[1],['bc_treatment_list_client',{p_cliente_id:'c1'}]);
  assert.equal(JSON.stringify(m.calls[2]).includes('NUNCA'),false);
});

test('confirmações de saúde e alertas derivam autoria no backend', async()=>{
  const m=mockClient();
  await confirmTreatmentHealthChange({client:m.client,treatmentId:'t1',changed:true,details:'Mudança informada'});
  await confirmTreatmentAlertReview({client:m.client,treatmentId:'t1'});
  assert.deepEqual(m.calls[0],['bc_treatment_confirm_health',{p_treatment_id:'t1',p_changed:true,p_details:'Mudança informada'}]);
  assert.deepEqual(m.calls[1],['bc_treatment_confirm_alerts',{p_treatment_id:'t1'}]);
});

test('consentimento e transições enviam somente treatment id', async()=>{
  const m=mockClient();
  await prepareTreatmentConsent({client:m.client,treatmentId:'t1'});
  await markTreatmentReady({client:m.client,treatmentId:'t1'});
  await startTreatment({client:m.client,treatmentId:'t1'});
  assert.deepEqual(m.calls.map(x=>x[0]),['bc_treatment_prepare_consent','bc_treatment_mark_ready','bc_treatment_start']);
  for(const call of m.calls) assert.deepEqual(call[1],{p_treatment_id:'t1'});
});

test('finalização é em duas etapas para assinar o snapshot final', async()=>{
  const m=mockClient();
  await finalizeTreatment({client:m.client,treatmentId:'t1'});
  await completeTreatmentFinalization({client:m.client,treatmentId:'t1',documentId:'d1'});
  assert.deepEqual(m.calls[0],['bc_treatment_finalize',{p_treatment_id:'t1'}]);
  assert.deepEqual(m.calls[1],['bc_treatment_complete_finalize',{p_treatment_id:'t1',p_document_id:'d1'}]);
});

test('correções não enviam autor e reabertura só recebe motivo/expiração', async()=>{
  const m=mockClient();
  await correctTreatmentSameDay({client:m.client,treatmentId:'t1',patch:{observacoes:'Retificação',author:'NUNCA'}});
  await createTreatmentReopenGrant({client:m.client,treatmentId:'t1',reason:'Correção documental',expiresAt:'2026-10-13T03:00:00Z',authorUserId:'NUNCA'});
  await correctReopenedTreatment({client:m.client,treatmentId:'t1',patch:{observacoes:'Retificação 2',author:'NUNCA'}});
  assert.equal(JSON.stringify(m.calls).includes('NUNCA'),false);
  assert.deepEqual(m.calls[1],['bc_treatment_create_reopen_grant',{p_treatment_id:'t1',p_reason:'Correção documental',p_expires_at:'2026-10-13T03:00:00Z'}]);
});
