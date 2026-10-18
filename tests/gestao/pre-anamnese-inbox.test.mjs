import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';

test('recepção mantém dados externos escapados e exige vínculo explícito', async () => {
  const api = await import('../../gestao/js/pre-anamnese-inbox.js').catch(() => ({}));
  assert.equal(typeof api.renderPreAnamneseInbox, 'function', 'recepção deve estar disponível na gestão');
  const html = api.renderPreAnamneseInbox([{id:'ficha-1',patient_name:'<img src=x onerror=alert(1)>',patient_phone:'31900000000',procedure:'Teste',status:'recebida',public_code:'TESTE',pdf_path:'privado/ficha.pdf'}], [{id:'cliente-1',nome:'Cliente fictícia'}]);
  const {document}=parseHTML(html);
  assert.equal(document.querySelector('img'),null);
  assert.equal(document.querySelector('[data-intake-link]').dataset.intakeLink,'ficha-1');
  assert.equal(document.querySelector('select').value,undefined);
  assert.match(document.textContent || html,/Selecione o cadastro correto/);
});

test('vínculo envia somente ficha e cliente selecionados, nunca dados clínicos fornecidos pela tela', async () => {
  const api=await import('../../gestao/js/pre-anamnese-inbox.js').catch(()=>({}));
  assert.equal(typeof api.linkPreAnamnese,'function');
  let call;
  const client={rpc:async(name,args)=>{call={name,args};return {data:{linked:true},error:null};}};
  await api.linkPreAnamnese({client,intakeId:'ficha-1',clienteId:'cliente-1'});
  assert.deepEqual(call,{name:'bc_pre_anamnese_link',args:{p_intake_id:'ficha-1',p_cliente_id:'cliente-1'}});
  await assert.rejects(()=>api.linkPreAnamnese({client,intakeId:'ficha-1',clienteId:''}),/cadastro/i);
});
