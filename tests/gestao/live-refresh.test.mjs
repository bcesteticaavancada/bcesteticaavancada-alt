import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import * as live from '../../gestao/js/live-refresh.js';
function environment(){const {document,window}=parseHTML('<html><body><section id="list"><form><input></form></section></body></html>');const timers=[];window.setInterval=fn=>{timers.push(fn);return 1;};window.clearInterval=()=>{};return {document,window,timers};}
test('returning to visible app refreshes only lists, preserving edited forms and coalescing requests',async()=>{
 const {document,window}=environment();let calls=0,release;
 const controller=live.startLiveRefresh({root:document,view:window,tasks:[{scope:()=>document.getElementById('list'),refresh:()=>{calls++;return new Promise(r=>release=r);}}]});
 const first=controller.refresh(),second=controller.refresh();assert.equal(calls,1);release();await Promise.all([first,second]);
 const input=document.querySelector('input');input.dispatchEvent(new window.Event('input',{bubbles:true}));
 await controller.refresh();assert.equal(calls,1);
 document.querySelector('form').dispatchEvent(new window.Event('reset',{bubbles:true}));
 const third=controller.refresh();assert.equal(calls,2);release();await third;controller.stop();
});
test('hidden or offline app does not poll; invalidation messages contain no patient data',async()=>{
 const {document,window}=environment();let calls=0;Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
 const controller=live.startLiveRefresh({root:document,view:window,tasks:[{refresh:async()=>calls++}]});
 await controller.refresh();assert.equal(calls,0);Object.defineProperty(document,'visibilityState',{value:'visible'});
 window.dispatchEvent(new window.Event('focus'));await Promise.resolve();await Promise.resolve();assert.equal(calls,1);controller.stop();
});

test('cross-tab invalidation carries only a constant event and no record payload',()=>{
 const {window}=environment();const messages=[];
 window.BroadcastChannel=class {postMessage(message){messages.push(message);}close(){}};
 live.notifyAppChange(window);
 assert.deepEqual(messages,[{type:'invalidate'}]);
 assert.equal(live.isMutationRpc('bc_treatment_complete_finalize'),true);
 assert.equal(live.isMutationRpc('bc_agenda_list'),false);
});

test('blocked BroadcastChannel cannot report a committed mutation as failed',()=>{
 const {document,window}=environment();window.BroadcastChannel=class {constructor(){throw new Error('bloqueado');}};
 assert.doesNotThrow(()=>live.notifyAppChange(window));
 const controller=live.startLiveRefresh({root:document,view:window});controller.stop();
});

test('edits begun during fetch and blurred selects outside forms prevent applying the late result',async()=>{
 const {document,window}=environment();const scope=document.getElementById('list');scope.innerHTML='<select><option value="">Escolha</option><option value="c1">Cliente</option></select><div id="result">Inicial</div>';
 let release;const response=new Promise(r=>release=r);
 const controller=live.startLiveRefresh({root:document,view:window,tasks:[{scope:()=>scope,async refresh({canApply}){await response;if(canApply())document.getElementById('result').textContent='Sobrescrito';}}]});
 const pending=controller.refresh();document.querySelector('option[value="c1"]').selected=true;
 document.querySelector('select').dispatchEvent(new window.Event('change',{bubbles:true}));release();await pending;
 assert.equal(document.getElementById('result').textContent,'Inicial');controller.stop();
});
