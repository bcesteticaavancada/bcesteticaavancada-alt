import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listTreatmentIntercurrences,createTreatmentIntercurrence,updateTreatmentIntercurrenceDraft,
  addIntercurrenceEvolution,confirmOpenIntercurrencesForFinalization,
} from '../../gestao/js/treatment-intercurrences-api.js';

function makeClient(result={data:[],error:null}){const calls=[];return {calls,client:{async rpc(name,payload={}){calls.push([name,payload]);return typeof result==='function'?result(name,payload):result;}}};}

test('lista e cria intercorrência com enum validado antes do RPC',async()=>{
  const mock=makeClient((name)=>({data:name==='bc_treatment_intercurrence_list'?[{id:'i1'}]:'i1',error:null}));
  assert.deepEqual(await listTreatmentIntercurrences({client:mock.client,treatmentId:'t1'}),[{id:'i1'}]);
  const id=await createTreatmentIntercurrence({client:mock.client,treatmentId:'t1',moment:'durante',severity:'moderada',description:'Descrição',actionTaken:'Conduta registrada',occurredAt:'2026-10-13T14:00:00-03:00'});
  assert.equal(id,'i1');
  assert.deepEqual(mock.calls[1],['bc_treatment_intercurrence_create',{
    p_treatment_id:'t1',p_moment:'durante',p_severity:'moderada',p_description:'Descrição',p_action_taken:'Conduta registrada',p_occurred_at:'2026-10-13T14:00:00-03:00',
  }]);
  const invalid=makeClient();
  await assert.rejects(()=>createTreatmentIntercurrence({client:invalid.client,treatmentId:'t1',moment:'amanha',severity:'leve',description:'x',actionTaken:'y'}),/momento/i);
  await assert.rejects(()=>createTreatmentIntercurrence({client:invalid.client,treatmentId:'t1',moment:'antes',severity:'extrema',description:'x',actionTaken:'y'}),/gravidade/i);
  assert.equal(invalid.calls.length,0);
});

test('correção de rascunho envia somente campos permitidos',async()=>{
  const mock=makeClient({data:'i1',error:null});
  await updateTreatmentIntercurrenceDraft({client:mock.client,intercurrenceId:'i1',patch:{severity:'grave',description:'Ajuste',status:'encerrada',hack:'x'}});
  assert.deepEqual(mock.calls[0],['bc_treatment_intercurrence_update_draft',{p_intercurrence_id:'i1',p_patch:{severity:'grave',description:'Ajuste'}}]);
});

test('evolução e confirmação usam RPCs append-only dedicados',async()=>{
  const mock=makeClient({data:'u1',error:null});
  await addIntercurrenceEvolution({client:mock.client,intercurrenceId:'i1',evolution:'Evolução registrada',statusAfter:'acompanhamento'});
  await confirmOpenIntercurrencesForFinalization({client:mock.client,treatmentId:'t1'});
  assert.deepEqual(mock.calls[0],['bc_intercurrence_add_update',{p_intercurrence_id:'i1',p_evolution:'Evolução registrada',p_status_after:'acompanhamento'}]);
  assert.deepEqual(mock.calls[1],['bc_treatment_confirm_open_intercurrences',{p_treatment_id:'t1'}]);
});

test('evolução rejeita status inválido sem chamar backend',async()=>{
  const mock=makeClient();
  await assert.rejects(()=>addIntercurrenceEvolution({client:mock.client,intercurrenceId:'i1',evolution:'x',statusAfter:'apagada'}),/status/i);
  assert.equal(mock.calls.length,0);
});
