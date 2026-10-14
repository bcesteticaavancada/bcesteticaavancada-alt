import test from 'node:test';
import assert from 'node:assert/strict';
import {getTreatmentReport,saveTreatmentReport} from '../../gestao/js/treatment-report-api.js';

function makeClient(result={data:null,error:null}){
  const calls=[];
  return {calls,client:{async rpc(name,payload){calls.push([name,payload]);return typeof result==='function'?result(name,payload):result;}}};
}

test('getTreatmentReport consulta somente pelo treatmentId',async()=>{
  const mock=makeClient({data:{id:'r1',treatment_id:'t1'},error:null});
  const row=await getTreatmentReport({client:mock.client,treatmentId:'t1'});
  assert.equal(row.id,'r1');
  assert.deepEqual(mock.calls,[['bc_treatment_report_get',{p_treatment_id:'t1'}]]);
});

test('saveTreatmentReport envia apenas campos aprovados e normaliza retorno',async()=>{
  const mock=makeClient({data:'r1',error:null});
  const id=await saveTreatmentReport({client:mock.client,treatmentId:'t1',payload:{
    descricao_sessao:'  Sessão concluída  ',
    resposta_observada:' Sem intercorrências imediatas ',
    orientacoes:' Hidratação e cuidados orientados ',
    retorno_necessario:true,
    retorno_sugerido_em:'2026-10-28',
    observacoes:'  Revisão programada ',
    created_by:'forjado',
    procedure_name:'forjado',
  }});
  assert.equal(id,'r1');
  assert.deepEqual(mock.calls[0],[
    'bc_treatment_report_upsert',
    {p_treatment_id:'t1',p_payload:{
      descricao_sessao:'Sessão concluída',
      resposta_observada:'Sem intercorrências imediatas',
      orientacoes:'Hidratação e cuidados orientados',
      retorno_necessario:true,
      retorno_sugerido_em:'2026-10-28',
      observacoes:'Revisão programada',
    }},
  ]);
});

test('retorno sem data aceita null e data inválida é rejeitada antes do backend',async()=>{
  const ok=makeClient({data:'r2',error:null});
  await saveTreatmentReport({client:ok.client,treatmentId:'t1',payload:{
    descricao_sessao:'Sessão',resposta_observada:'Resposta',orientacoes:'Orientações',retorno_necessario:false,
  }});
  assert.equal(ok.calls[0][1].p_payload.retorno_sugerido_em,null);

  const bad=makeClient();
  await assert.rejects(()=>saveTreatmentReport({client:bad.client,treatmentId:'t1',payload:{
    descricao_sessao:'Sessão',resposta_observada:'Resposta',orientacoes:'Orientações',retorno_necessario:true,retorno_sugerido_em:'28/10/2026',
  }}),/data/i);
  assert.equal(bad.calls.length,0);
});

test('campos clínicos obrigatórios são validados antes da RPC',async()=>{
  const mock=makeClient();
  await assert.rejects(()=>saveTreatmentReport({client:mock.client,treatmentId:'t1',payload:{descricao_sessao:'',resposta_observada:'Resposta',orientacoes:'Orientações',retorno_necessario:false}}),/descrição/i);
  assert.equal(mock.calls.length,0);
});
