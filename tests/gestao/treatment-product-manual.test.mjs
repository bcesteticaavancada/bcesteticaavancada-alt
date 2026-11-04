import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addTreatmentProductUsageByName} from '../../gestao/js/treatment-products-api.js';
import {renderTreatment6dCards} from '../../gestao/js/treatment-6d-panel.js';

test('validade em data civil aparece no mesmo dia registrado no lote',()=>{
  const html=renderTreatment6dCards({treatment:{id:'ficticio',status:'em_atendimento'},productUsages:[{
    id:'uso',product_name_snapshot:'Bio fictício',lot_code_snapshot:'QA-01',expires_on_snapshot:'2028-04-15',quantity:1,unit:'mL',
  }]});
  assert.match(html,/Val\. 15\/04\/2028/);
});

test('datas impossíveis são rejeitadas antes da RPC',async()=>{
  const mock=mockClient();
  const base={client:mock.client,treatmentId:'ficticio',productName:'Produto',lotCode:'L1',quantity:1,unit:'mL'};
  for(const expiresOn of ['2028-02-30','2027-02-29','2028-13-01','0000-01-01']){
    await assert.rejects(()=>addTreatmentProductUsageByName({...base,expiresOn}),/validade/i);
  }
  assert.equal(mock.calls.length,0);
});

test('versão pendente sem documento também deixa produto e lote em somente leitura',()=>{
  const html=renderTreatment6dCards({treatment:{id:'ficticio',status:'em_atendimento',pending_version_id:'versao-ficticia'}});
  assert.doesNotMatch(html,/data-6d-product-form/);
});

function mockClient(){
  const calls=[];
  return {calls,client:{async rpc(name,payload){calls.push({name,payload});return {data:'usage-fake-01',error:null};}}};
}

test('campo aberto não depende de produtos pré-cadastrados e exige validade, quantidade e unidade',()=>{
  const html=renderTreatment6dCards({
    treatment:{id:'sessao-ficticia',status:'em_atendimento',procedure_version:{requires_product_lot:true}},
    products:[],productUsages:[],photos:[],equipment:[],equipmentUsages:[],intercurrences:[],
  });
  assert.match(html,/<input[^>]*name="product_name"[^>]*required/);
  assert.match(html,/<input[^>]*name="lot_code"[^>]*required/);
  assert.match(html,/<input[^>]*name="expires_on"[^>]*type="date"[^>]*required/);
  assert.doesNotMatch(html,/name="product_id"/);
  assert.doesNotMatch(html,/name="lot_id"/);
});

test('lista sugestões cadastradas com escape de HTML sem impedir a digitação',()=>{
  const html=renderTreatment6dCards({
    treatment:{id:'sessao-ficticia',status:'em_atendimento'},
    products:[{id:'id1',name:'Produto <teste>',active:true},{id:'id2',name:'Inativo',active:false}],
  });
  assert.match(html,/Produto &lt;teste&gt;/);
  assert.doesNotMatch(html,/<option value="Inativo"/);
});

test('entrada manual usa RPC exclusiva, sem criar snapshots forjados no cliente',async()=>{
  const mock=mockClient();
  const result=await addTreatmentProductUsageByName({
    client:mock.client,treatmentId:'sessao-ficticia',productName:'  Bioestimulador  ',
    lotCode:'  TESTE-ABC  ',expiresOn:'2028-04-15',quantity:'2.5',unit:'mL',
  });
  assert.equal(result,'usage-fake-01');
  assert.deepEqual(mock.calls,[{name:'bc_treatment_product_usage_add_text',payload:{
    p_treatment_id:'sessao-ficticia',p_product_name:'Bioestimulador',
    p_lot_code:'TESTE-ABC',p_expires_on:'2028-04-15',p_quantity:2.5,p_unit:'mL',
  }}]);
  assert.doesNotMatch(JSON.stringify(mock.calls),/snapshot|service_role/);
});

test('não chama banco quando produto, lote, validade ou quantidade estiverem inválidos',async()=>{
  const mock=mockClient();
  const base={client:mock.client,treatmentId:'sessao-ficticia',productName:'Produto',lotCode:'L1',expiresOn:'2028-04-15',quantity:1,unit:'mL'};
  for(const [patch,regex] of [
    [{productName:' '},/produto/i],[{lotCode:' '},/lote/i],[{expiresOn:''},/validade/i],
    [{expiresOn:'amanhã'},/validade/i],[{quantity:0},/quantidade/i],[{unit:''},/unidade/i],
  ]) await assert.rejects(()=>addTreatmentProductUsageByName({...base,...patch}),regex);
  assert.equal(mock.calls.length,0);
});

test('migration não altera tabelas, mantém gateway de validação e revoga acesso anônimo',()=>{
  const sql=readFileSync(new URL('../../supabase/migrations/20261104173949_bc_treatment_manual_product_lot.sql',import.meta.url),'utf8');
  assert.match(sql,/private\.bc_treatment_product_usage_add_impl\(/);
  assert.match(sql,/profissional_user_id is distinct from v_user/i);
  assert.match(sql,/p_expires_on < \(now\(\) at time zone/i);
  assert.match(sql,/grant execute on function public\.bc_treatment_product_usage_add_text[\s\S]+?to authenticated;/i);
  assert.doesNotMatch(sql,/alter table|drop table|delete from|truncate\s|db push/i);
});
