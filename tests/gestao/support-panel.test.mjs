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
