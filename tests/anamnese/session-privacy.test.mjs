import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {restoreFinalizeAction} from '../../agendamento/js/main.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../../agendamento/js/state.js';
import * as finalize from '../../agendamento/js/finalize.js';
import {SUBMISSION_TOKEN_KEY} from '../../agendamento/js/api.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
test('draft expires after 30 minutes and legacy permanent health data is erased',()=>{
  const session=memory(),local=memory();
  local.setItem(state.DRAFT_KEY,JSON.stringify({values:{saude:'fictícia'}}));local.setItem(SUBMISSION_TOKEN_KEY,'token-antigo');
  assert.equal(typeof state.prepareSessionStorage,'function');
  const storage=state.prepareSessionStorage({localStorage:local,sessionStorage:session});
  assert.equal(local.getItem(state.DRAFT_KEY),null);assert.equal(local.getItem(SUBMISSION_TOKEN_KEY),null);
  state.saveDraft(storage,{step:3,values:{nome:'Pessoa fictícia',saude:'fictícia'}},1000);
  assert.equal(state.loadDraft(storage,1001).step,3);
  assert.deepEqual(state.loadDraft(storage,1000+30*60*1000),state.createInitialState());
  assert.equal(session.getItem(state.DRAFT_KEY),null);
});
test('explicit new form removes retry token and patient draft',()=>{
  const storage=memory();storage.setItem(state.DRAFT_KEY,'ficha');storage.setItem(SUBMISSION_TOKEN_KEY,'token-antigo');
  assert.equal(typeof finalize.resetPreAnamnese,'function');
  assert.deepEqual(finalize.resetPreAnamnese(storage),state.createInitialState());
  assert.equal(storage.getItem(state.DRAFT_KEY),null);assert.equal(storage.getItem(SUBMISSION_TOKEN_KEY),null);
});
test('blocked browser storage leaves the form usable in memory',()=>{
  assert.equal(typeof state.prepareSessionStorage,'function');
  const view={get localStorage(){throw Error('bloqueado');},get sessionStorage(){throw Error('bloqueado');}};
  const storage=state.prepareSessionStorage(view);
  state.saveDraft(storage,{step:2,values:{nome:'Fictícia'}});
  assert.equal(state.loadDraft(storage).step,2);
});

test('new form restores the original finalization button with its listener after error or success',()=>{
 for(const success of [false,true]){
  const {document}=parseHTML(readFileSync(new URL('../../agendamento/index.html',import.meta.url),'utf8'));
  const panel=document.querySelector('.success-panel'),button=document.getElementById('finalizeButton');
  let called=0;button.addEventListener('click',()=>called++);
  if(success) panel.querySelector('.actions').innerHTML='<button>Baixar PDF</button>';
  restoreFinalizeAction(panel,button);
  assert.equal(document.getElementById('finalizeButton'),button);assert.equal(button.isConnected,true);
  button.click();assert.equal(called,1);assert.equal(button.disabled,false);
 }
});
