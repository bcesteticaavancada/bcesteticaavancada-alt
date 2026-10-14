import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickVisit} from '../../gestao/js/quick-visit-api.js';

function makeClient(result={data:{appointment_id:'a1',treatment_id:'t1'},error:null}){
  const calls=[];
  return {calls,client:{async rpc(name,payload){calls.push([name,payload]);return result;}}};
}

test('createQuickVisit chama RPC transacional com chave idempotente e sem autoria do browser',async()=>{
  const mock=makeClient();
  const result=await createQuickVisit({
    client:mock.client,
    requestKey:'11111111-1111-4111-8111-111111111111',
    clienteId:'c1',
    profissionalUserId:'u1',
    procedimentoId:'p1',
    inicioIso:'2026-10-14T14:20:00-03:00',
    fimIso:'2026-10-14T15:20:00-03:00',
    observacao:'Encaixe',
    componentVersionIds:['v2','v2','v1'],
    componentKeys:['b','a','a'],
  });
  assert.deepEqual(result,{appointment_id:'a1',treatment_id:'t1'});
  assert.equal(mock.calls[0][0],'bc_quick_visit_create');
  const payload=mock.calls[0][1];
  assert.equal(payload.p_request_key,'11111111-1111-4111-8111-111111111111');
  assert.equal(payload.p_cliente_id,'c1');
  assert.equal(payload.p_profissional_user_id,'u1');
  assert.equal(payload.p_procedimento_id,'p1');
  assert.equal(payload.p_inicio,'2026-10-14T14:20:00-03:00');
  assert.equal(payload.p_fim,'2026-10-14T15:20:00-03:00');
  assert.equal(payload.p_observacao,'Encaixe');
  assert.deepEqual(payload.p_component_version_ids,['v2','v1']);
  assert.deepEqual(payload.p_component_keys,['b','a']);
  assert.equal('p_created_by' in payload,false);
  assert.equal('p_actor_user_id' in payload,false);
});

test('requestKey é obrigatório para permitir retry idempotente explícito',async()=>{
  const mock=makeClient();
  await assert.rejects(()=>createQuickVisit({client:mock.client,clienteId:'c1',profissionalUserId:'u1',procedimentoId:'p1',inicioIso:'2026-10-14T14:20:00-03:00'}),/chave|request/i);
  assert.equal(mock.calls.length,0);
});

test('erro do backend é propagado e não tenta segunda criação no browser',async()=>{
  const mock=makeClient({data:null,error:{message:'Horário indisponível.'}});
  await assert.rejects(()=>createQuickVisit({client:mock.client,requestKey:'11111111-1111-4111-8111-111111111111',clienteId:'c1',profissionalUserId:'u1',procedimentoId:'p1',inicioIso:'2026-10-14T14:20:00-03:00'}),/indisponível/i);
  assert.equal(mock.calls.length,1);
});
