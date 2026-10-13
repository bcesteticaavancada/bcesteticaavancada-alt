import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listClinicalProducts,saveClinicalProduct,listProductLots,saveProductLot,
  listTreatmentProductUsages,addTreatmentProductUsage,removeTreatmentProductUsage,
} from '../../gestao/js/treatment-products-api.js';

function makeClient(result={data:[],error:null}){
  const calls=[];
  return {calls,client:{async rpc(name,payload={}){calls.push([name,payload]);return typeof result==='function'?result(name,payload):result;}}};
}

test('wrappers de catálogo usam RPCs específicos e payloads mínimos',async()=>{
  const mock=makeClient();
  await listClinicalProducts({client:mock.client,includeInactive:true});
  await saveClinicalProduct({client:mock.client,productId:null,payload:{name:'Produto X',manufacturer:'Marca'}});
  await listProductLots({client:mock.client,productId:'p1',includeInactive:false});
  await saveProductLot({client:mock.client,productId:'p1',payload:{lot_code:'L1',expires_on:'2027-01-01'}});
  assert.deepEqual(mock.calls[0],['bc_clinical_product_list',{p_include_inactive:true}]);
  assert.deepEqual(mock.calls[1],['bc_clinical_product_upsert',{p_product_id:null,p_payload:{name:'Produto X',manufacturer:'Marca'}}]);
  assert.deepEqual(mock.calls[2],['bc_clinical_product_lot_list',{p_product_id:'p1',p_include_inactive:false}]);
  assert.deepEqual(mock.calls[3],['bc_clinical_product_lot_upsert',{p_product_id:'p1',p_payload:{lot_code:'L1',expires_on:'2027-01-01'}}]);
});

test('uso clínico envia somente IDs, quantidade e unidade; snapshot nunca vem do navegador',async()=>{
  const mock=makeClient({data:'u1',error:null});
  const id=await addTreatmentProductUsage({client:mock.client,treatmentId:'t1',productId:'p1',lotId:'l1',quantity:2.5,unit:'mL',product_name_snapshot:'FAKE',lot_code_snapshot:'FAKE'});
  assert.equal(id,'u1');
  assert.deepEqual(mock.calls[0],['bc_treatment_product_usage_add',{
    p_treatment_id:'t1',p_product_id:'p1',p_lot_id:'l1',p_quantity:2.5,p_unit:'mL',
  }]);
  assert.doesNotMatch(JSON.stringify(mock.calls[0]),/snapshot|manufacturer|expires_on/);
});

test('lista e remove usos por RPC, com validação básica de quantidade/unidade',async()=>{
  const mock=makeClient((name)=>({data:name==='bc_treatment_product_usage_list'?[{id:'u1'}]:'u1',error:null}));
  assert.deepEqual(await listTreatmentProductUsages({client:mock.client,treatmentId:'t1'}),[{id:'u1'}]);
  await removeTreatmentProductUsage({client:mock.client,usageId:'u1'});
  assert.deepEqual(mock.calls[1],['bc_treatment_product_usage_remove',{p_usage_id:'u1'}]);

  const invalid=makeClient();
  await assert.rejects(()=>addTreatmentProductUsage({client:invalid.client,treatmentId:'t1',productId:'p1',quantity:0,unit:'mL'}),/quantidade/i);
  await assert.rejects(()=>addTreatmentProductUsage({client:invalid.client,treatmentId:'t1',productId:'p1',quantity:1,unit:''}),/unidade/i);
  assert.equal(invalid.calls.length,0);
});
