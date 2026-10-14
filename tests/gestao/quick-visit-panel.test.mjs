import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const moduleUrl=new URL('../../gestao/js/quick-visit-panel.js',import.meta.url);
const runtimeUrl=new URL('../../gestao/js/clinical-folder-runtime.js',import.meta.url);
const bridgeUrl=new URL('../../gestao/js/agenda-treatment-bridge.js',import.meta.url);
async function loadPanel(){return import(moduleUrl.href);}

test('painel curto mostra cliente, procedimento, profissional e horário',async()=>{
  const {renderQuickVisitPanel}=await loadPanel();
  const html=renderQuickVisitPanel({
    clientRecord:{id:'c1',nome:'Cliente Teste'},
    procedures:[{id:'p1',nome:'Drenagem Linfática',ativo:true}],
    staff:[{user_id:'u1',display_name:'Profissional Teste'}],
    selectedProfessionalId:'u1',
    procedureOptions:[{procedure_id:'p1',can_execute:true}],
  });
  assert.match(html,/Cliente Teste/);
  assert.match(html,/data-quick-visit-procedure/);
  assert.match(html,/data-quick-visit-professional/);
  assert.match(html,/type=["']datetime-local["']/);
  assert.match(html,/Criar encaixe/i);
});

test('procedimento restrito sem can_execute não aparece como executável',async()=>{
  const {filterExecutableProcedures}=await loadPanel();
  const rows=filterExecutableProcedures(
    [{id:'p1',nome:'Livre',ativo:true},{id:'p2',nome:'Restrito',ativo:true},{id:'p3',nome:'Arquivado',ativo:false}],
    [{procedure_id:'p1',can_execute:true},{procedure_id:'p2',can_execute:false},{procedure_id:'p3',can_execute:true}],
  );
  assert.deepEqual(rows.map((item)=>item.id),['p1']);
});

test('submissão reutiliza requestKey no retry e abre exatamente o treatment retornado',async()=>{
  const {createQuickVisitSubmission}=await loadPanel();
  const keys=[];
  const opened=[];
  let attempts=0;
  const submit=createQuickVisitSubmission({
    create:async(payload)=>{
      keys.push(payload.requestKey);
      attempts+=1;
      if(attempts===1)throw new Error('Rede indisponível');
      return {appointment_id:'a1',treatment_id:'t1'};
    },
    openTreatment:async(id)=>opened.push(id),
    refresh:async()=>{},
    uuid:()=> '11111111-1111-4111-8111-111111111111',
  });
  const payload={client:{},clienteId:'c1',profissionalUserId:'u1',procedimentoId:'p1',inicioIso:'2026-10-14T14:00:00.000Z'};
  await assert.rejects(()=>submit(payload),/rede/i);
  const result=await submit(payload);
  assert.deepEqual(keys,['11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111']);
  assert.deepEqual(opened,['t1']);
  assert.deepEqual(result,{appointment_id:'a1',treatment_id:'t1'});
});

test('controller exportado existe para ser montado pela Central',async()=>{
  const {initQuickVisitPanel}=await loadPanel();
  assert.equal(typeof initQuickVisitPanel,'function');
});

test('runtime da Central monta o quick visit e abre o tratamento retornado',async()=>{
  const source=await readFile(runtimeUrl,'utf8');
  assert.match(source,/from ['"]\.\/quick-visit-panel\.js['"]/);
  assert.match(source,/initQuickVisitPanel/);
  assert.match(source,/bc:client-new-treatment/);
  assert.match(source,/openTreatment/);
});

test('bridge da agenda reutiliza existing_treatment_id sem criar segundo atendimento',async()=>{
  const source=await readFile(bridgeUrl,'utf8');
  assert.match(source,/context\.existing_treatment_id/);
  assert.match(source,/controller\.openTreatment\(context\.existing_treatment_id\)/);
  assert.doesNotMatch(source,/context\.existing_treatment_id[\s\S]{0,220}createTreatment\s*\(/);
});
