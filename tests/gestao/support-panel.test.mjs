import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import {initSupportPanel} from '../../gestao/js/support-panel.js';
import {updateSupportClient} from '../../gestao/js/support-api.js';
const a='a1000000-0000-4000-8000-000000000005',b='a1000000-0000-4000-8000-000000000006';
async function fixture(invoke){const {document,window}=parseHTML(await readFile(new URL('../../gestao/criacao/index.html',import.meta.url),'utf8'));const dialog=document.getElementById('supportClientDialog');dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new window.Event('close'));};return {document,window,panel:initSupportPanel({client:{functions:{invoke}},root:document})};}
test('support API rejects fields outside the patient record before invoking privileged service',()=>{let calls=0;assert.throws(()=>updateSupportClient({client:{functions:{invoke(){calls++;}}},clientId:a,patch:{role:'admin'}}),/Campo cadastral/);assert.equal(calls,0);});
test('rapid patient switching does not display an older patient response in the newer folder',async()=>{
  const pending=[];const {document,panel}=await fixture((name,args)=>new Promise(resolve=>pending.push({resolve,body:args.body})));
  const first=panel.openClient(a),second=panel.openClient(b);
  pending[1].resolve({data:{client:{id:b,nome:'Cliente B fictícia',telefone:'31000000000',updated_at:'2026-10-25T12:00:00Z'},documents:[]}});await second;
  pending[0].resolve({data:{client:{id:a,nome:'Cliente A antiga',telefone:'31000000000',updated_at:'2026-10-25T12:00:00Z'},documents:[]}});await first;
  assert.match(document.getElementById('supportClientBody').textContent,/Cliente B fictícia/);assert.doesNotMatch(document.getElementById('supportClientBody').textContent,/Cliente A antiga/);
});
test('closing the support folder clears private content and prevents a delayed response reopening it',async()=>{
  let resolve;const {document,panel}=await fixture(()=>new Promise(done=>{resolve=done;}));const loading=panel.openClient(a);document.getElementById('supportClientDialog').close();
  resolve({data:{client:{id:a,nome:'Paciente fictícia sigilosa'},documents:[]}});await loading;
  assert.equal(document.getElementById('supportClientBody').textContent,'');assert.equal(document.getElementById('supportClientDialog').hasAttribute('open'),false);
});
test('support rendering escapes patient/document text and offers only original consent uploads',async()=>{
  const {document,panel}=await fixture(async()=>({data:{client:{id:a,nome:'<img src=x>',telefone:'31000000000',updated_at:'2026-10-25T12:00:00Z'},documents:[{id:b,documentId:b,kind:'original',category:'consentimento_procedimento',title:'<script>texto</script>',created_at:'2026-10-25T12:00:00Z'},{id:a,kind:'returned',category:'tcle_externo',title:'Cópia anterior'}]}}));await panel.openClient(a);
  assert.equal(document.getElementById('supportClientBody').querySelector('img,script'),null);
  assert.equal(document.querySelectorAll('#supportReturnedForm option[value]').length,1);
});

const original={id:b,documentId:b,kind:'original',category:'consentimento_procedimento',title:'Consentimento fictício'};
const person=id=>({client:{id,nome:id===a?'Pessoa A':'Pessoa B',telefone:'31000000000',updated_at:'2026-10-25T12:00:00Z'},documents:[original]});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function withFormData(fn){const Native=globalThis.FormData;globalThis.FormData=class extends Native{constructor(form){super();if(form)for(const input of form.querySelectorAll('[name]'))this.set(input.name,input.type==='file'?new File(['%PDF-TESTE'],'teste.pdf',{type:'application/pdf'}):input.value||input.querySelector('option')?.value||'');}};try{await fn();}finally{globalThis.FormData=Native;}}
test('upload preserves an unsaved demographic draft while refreshing documents',async()=>withFormData(async()=>{
  let gets=0;const {document,window,panel}=await fixture(async(name,{body})=>({data:body instanceof FormData?{fileId:b}:{...person(a),documents:++gets>1?[original,{id:a,kind:'returned',title:'Cópia devolvida'}]:[original]}}));
  await panel.openClient(a);document.querySelector('#supportClientForm [name=nome]').value='Rascunho não salvo';
  document.getElementById('supportReturnedForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
  assert.equal(document.querySelector('#supportClientForm [name=nome]').value,'Rascunho não salvo');assert.match(document.querySelector('.bcg-support-documents').textContent,/Cópia devolvida/);
}));
test('a previous upload refresh cannot show success or old documents in another patient folder',async()=>withFormData(async()=>{
  let refresh,gets=0;const {document,window,panel}=await fixture((name,{body})=>{if(body instanceof FormData)return Promise.resolve({data:{fileId:b}});if(body.clientId===a&&++gets>1)return new Promise(done=>{refresh=done;});return Promise.resolve({data:person(body.clientId)});});
  await panel.openClient(a);document.getElementById('supportReturnedForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await tick();
  await panel.openClient(b);refresh({data:{...person(a),documents:[{id:a,kind:'returned',title:'Cópia antiga A'}]}});await tick();await tick();
  assert.match(document.getElementById('supportClientBody').textContent,/Pessoa B/);assert.doesNotMatch(document.getElementById('supportClientBody').textContent,/Cópia antiga A|Cópia anexada/);
}));
