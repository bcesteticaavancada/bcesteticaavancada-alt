import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {initTreatment6dController} from '../../gestao/js/treatment-6d-panel.js';

const treatment={id:'sessao-ficticia',status:'em_atendimento',procedure_version:{requires_product_lot:true}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

async function harness({save,refresh,products=[],lots=async()=>[]}={}){
  const {document,window}=parseHTML('<main><div data-treatment-6d-slot></div></main>');
  const root=document.querySelector('main');const calls=[];
  const client={storage:{from(){throw new Error('Fotos fora do escopo deste teste');}},async rpc(name,payload){
    calls.push({name,payload});
    if(name==='bc_clinical_product_list')return {data:products,error:null};
    if(name==='bc_clinical_product_lot_list')return {data:await lots(payload.p_product_id),error:null};
    if(name==='bc_treatment_product_usage_add_text')return await save(payload);
    return {data:[],error:null};
  }};
  const controller=initTreatment6dController({client,root,refreshTreatment:refresh});
  await controller.loadTreatment(treatment);
  const form=root.querySelector('[data-6d-product-form]');
  const fields=Object.fromEntries([...form.querySelectorAll('input[name]')].map(el=>[el.name,el]));
  Object.defineProperty(form,'elements',{value:fields});
  form.reset=()=>{for(const field of Object.values(fields))field.value='';};
  Object.entries({product_name:'Bio fictício',lot_code:'QA-01',expires_on:'2028-04-15',quantity:'1',unit:'mL'}).forEach(([k,v])=>{fields[k].value=v;});
  const submit=()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  const change=field=>field.dispatchEvent(new window.Event('change',{bubbles:true}));
  const input=field=>field.dispatchEvent(new window.Event('input',{bubbles:true}));
  return {root,form,fields,calls,submit,change,input,controller};
}

test('corrigir o produto atualiza a unidade automática e preserva a unidade digitada',async()=>{
  const h=await harness({products:[{id:'a',name:'Produto A',default_unit:'mL'},{id:'b',name:'Produto B',default_unit:'U'}]});
  h.fields.unit.value='';
  h.fields.product_name.value='Produto A';h.change(h.fields.product_name);await tick();
  assert.equal(h.fields.unit.value,'mL');
  h.fields.product_name.value='Produto B';h.change(h.fields.product_name);await tick();
  assert.equal(h.fields.unit.value,'U');
  h.fields.product_name.value='Produto novo';h.change(h.fields.product_name);await tick();
  assert.equal(h.fields.unit.value,'');
  h.fields.product_name.value='Produto A';h.change(h.fields.product_name);await tick();
  h.input(h.fields.unit); // A usuária confirmou explicitamente mL.
  h.fields.product_name.value='Produto B';h.change(h.fields.product_name);await tick();
  assert.equal(h.fields.unit.value,'mL');
});

test('duplo envio durante gravação não duplica o uso clínico',async()=>{
  const pending=deferred();
  const h=await harness({save:()=>pending.promise,refresh:async()=>{}});
  h.submit();h.submit();await tick();
  assert.equal(h.calls.filter(c=>c.name==='bc_treatment_product_usage_add_text').length,1);
  assert.equal(h.form.querySelector('button').disabled,true);
  pending.resolve({data:'uso-ficticio',error:null});await tick();
  assert.equal(h.form.querySelector('button').disabled,false);
});

test('erro da RPC preserva o que foi digitado e permite corrigir',async()=>{
  const h=await harness({save:async()=>({data:null,error:{message:'Validade divergente'}}),refresh:async()=>{}});
  h.submit();await tick();
  assert.equal(h.fields.product_name.value,'Bio fictício');
  assert.equal(h.fields.lot_code.value,'QA-01');
  assert.equal(h.form.querySelector('button').disabled,false);
  assert.match(h.root.querySelector('[data-6d-status]').textContent,/Validade divergente/);
});

test('falha de atualização depois do commit informa que o uso já foi salvo',async()=>{
  const h=await harness({save:async()=>({data:'uso-ficticio',error:null}),refresh:async()=>{throw new Error('Rede indisponível');}});
  h.submit();await tick();
  assert.equal(h.fields.product_name.value,'');
  assert.match(h.root.querySelector('[data-6d-status]').textContent,/registrado.*atualiz/i);
});

test('resposta atrasada de sugestões não substitui a pesquisa mais recente',async()=>{
  const first=deferred();const third=deferred();let aRequests=0;
  const h=await harness({products:[{id:'a',name:'Produto A'},{id:'b',name:'Produto B'}],lots:async(id)=>{
    if(id==='a')return ++aRequests===1?first.promise:third.promise;
    return [{lot_code:'B-01',expires_on:'2028-01-01'}];
  }});
  h.fields.product_name.value='Produto A';h.change(h.fields.product_name);
  h.fields.product_name.value='Produto B';h.change(h.fields.product_name);await tick();
  h.fields.product_name.value='Produto A';h.change(h.fields.product_name);
  third.resolve([{lot_code:'ATUAL',expires_on:'2028-02-02'}]);await tick();
  first.resolve([{lot_code:'ANTIGO',expires_on:'2028-01-01'}]);await tick();
  const list=h.form.querySelector('[data-6d-lot-suggestions]');
  assert.equal(list.querySelector('option').value,'ATUAL');
});
