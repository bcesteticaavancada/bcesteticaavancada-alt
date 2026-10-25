import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {destinationForRole} from '../../gestao/js/routes.js';
import {getCurrentProfile,requireRole} from '../../gestao/js/auth.js';

function clientFor(role,active=true){
  const profile={user_id:'test-creator',display_name:'Criador fictício',role,active};
  return {auth:{getSession:async()=>({data:{session:{user:{id:profile.user_id}}}}),signOut:async()=>({})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:profile})})};
}
test('creation admin has a separate destination and valid active profile',async()=>{
  assert.equal(destinationForRole('admin_criacao'),'../criacao/');
  assert.equal((await getCurrentProfile(clientFor('admin_criacao')))?.role,'admin_criacao');
  assert.equal(await getCurrentProfile(clientFor('admin_criacao',false)),null);
});
test('creation admin cannot enter full admin or professional dashboards',async()=>{
  for(const role of ['admin','colaborador']){
    const redirects=[];
    assert.equal(await requireRole(role,clientFor('admin_criacao'),url=>redirects.push(url)),null);
    assert.deepEqual(redirects,['../login/']);
  }
});
test('creation page contains read-only operational controls and no financial module',async()=>{
  const html=await readFile(new URL('../../gestao/criacao/index.html',import.meta.url),'utf8').catch(()=> '');
  assert.match(html,/requireRole\('admin_criacao',client\)/);
  assert.match(html,/Admin de Criação/);
  assert.doesNotMatch(html,/admin-finance|colaborador-finance|initAdminAgenda|procedure-panel|createSignedUrl/);
});

test('creation record rendering escapes clinical text and ignores unapproved fields',async()=>{
  const {renderCreationRows}=await import('../../gestao/js/creation-panel.js');
  const html=renderCreationRows([{id:'test',cliente:'<script>danger()</script>',objetivo:'Avaliação fictícia',final_price:9876.54,snapshot:{price:9876.54}}]);
  assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|9876\.54/);
  assert.match(html,/Avaliação fictícia/);
});

test('pending older query cannot overwrite a newer creation panel result',async()=>{
  const {parseHTML}=await import('linkedom');
  const {initCreationPanel}=await import('../../gestao/js/creation-panel.js');
  const {document}=parseHTML(await readFile(new URL('../../gestao/criacao/index.html',import.meta.url),'utf8'));
  nativeSelect(document);
  let pending=[];
  const client={rpc:()=>new Promise(resolve=>pending.push(resolve))};
  const first=initCreationPanel({client,root:document});
  pending.shift()({data:{rows:[],total:0,has_more:false}});
  const panel=await first;
  const old=panel.refresh(),recent=panel.refresh();
  pending.pop()({data:{rows:[{id:'new',nome:'Resultado recente'}],total:1,has_more:false}});
  await recent;
  pending.shift()({data:{rows:[{id:'old',nome:'Resultado antigo'}],total:1,has_more:false}});
  await old;
  assert.match(document.getElementById('creationList').textContent,/Resultado recente/);
  assert.doesNotMatch(document.getElementById('creationList').textContent,/Resultado antigo/);
  const failed=panel.refresh();pending.shift()({error:{message:'Sessão expirada'}});await failed;
  assert.equal(document.getElementById('creationList').textContent,'');
  assert.match(document.getElementById('creationStatus').textContent,/Sessão expirada/);
});

async function creationFixture(rpc){
  const {parseHTML}=await import('linkedom');
  const {initCreationPanel}=await import('../../gestao/js/creation-panel.js');
  const {document,window}=parseHTML(await readFile(new URL('../../gestao/criacao/index.html',import.meta.url),'utf8'));
  nativeSelect(document);
  document.getElementById('gestaoApp').hidden=false;
  const panel=await initCreationPanel({client:{rpc},root:document});
  return {document,window,panel};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function nativeSelect(document){
  // Linkedom omits native select.value assignment; keep the controller real.
  const select=document.getElementById('creationSection');
  Object.defineProperty(select,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||'';},set(value){for(const option of this.querySelectorAll('option')){if(option.value===value)option.setAttribute('selected','');else option.removeAttribute('selected');}}});
}

test('creation shortcuts restore each area search and page instead of losing the consultation',async()=>{
  const calls=[];
  const {document,window}=await creationFixture(async(name,args)=>{
    calls.push({name,...args});
    return {data:{rows:[{id:'ficticio',nome:'Consulta fictícia'}],total:120,has_more:args.p_offset===0}};
  });
  const clickArea=async key=>{document.querySelector(`[data-creation-target="${key}"]`).dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));await settle();};
  await clickArea('clientes');
  document.getElementById('creationSearch').value='Beatriz';
  document.getElementById('creationFilters').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();
  document.getElementById('creationNext').click();await settle();
  await clickArea('equipe');await clickArea('clientes');
  assert.deepEqual(calls.at(-1),{name:'bc_creation_list',p_section:'clientes',p_offset:50,p_search:'Beatriz',p_cliente_id:null});
  assert.equal(document.getElementById('creationSearch').value,'Beatriz');
  assert.equal(document.querySelector('main h2').textContent,'Clientes');
  assert.equal(document.querySelector('[data-creation-target="clientes"]').getAttribute('aria-current'),'page');
});

test('quiet creation refresh preserves open record and usable count while waiting',async()=>{
  let resolvePending;
  let first=true;
  const {document,panel}=await creationFixture(async()=>{
    if(first){first=false;return {data:{rows:[{id:'ficticio',nome:'Cliente fictícia',telefone:'31000000000'}],total:1,has_more:false}};}
    return new Promise(resolve=>{resolvePending=resolve;});
  });
  const status=document.getElementById('creationStatus');
  const before=status.textContent;
  document.querySelector('#creationList details').setAttribute('open','');
  const refresh=panel.refresh({quiet:true});
  assert.equal(status.textContent,before);
  resolvePending({data:{rows:[{id:'ficticio',nome:'Cliente fictícia',telefone:'31000000001'}],total:1,has_more:false}});await refresh;
  assert.equal(document.querySelector('#creationList details').hasAttribute('open'),true);
  assert.match(document.getElementById('creationList').textContent,/31000000001/);
});

test('clear creation search returns to the first unfiltered page with one query',async()=>{
  const calls=[];
  const {document,window,panel}=await creationFixture(async(name,args)=>{calls.push(args);return {data:{rows:[],total:0,has_more:false}};});
  await panel.openSection('clientes');
  document.getElementById('creationSearch').value='Beatriz';
  document.getElementById('creationFilters').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();
  const before=calls.length;
  document.getElementById('creationClear')?.click();await settle();
  assert.equal(calls.length,before+1);
  assert.equal(calls.at(-1).p_search,'');assert.equal(calls.at(-1).p_offset,0);
  assert.equal(document.getElementById('creationSearch').value,'');
});

test('discarded quiet creation refresh leaves count and pagination unchanged',async()=>{
  const {document,panel}=await creationFixture(async()=>({data:{rows:[{id:'ficticio',nome:'Cliente fictícia'}],total:60,has_more:true}}));
  const count=document.getElementById('creationStatus').textContent;
  await panel.refresh({quiet:true,canApply:()=>false});
  assert.equal(document.getElementById('creationStatus').textContent,count);
  assert.equal(document.getElementById('creationNext').disabled,false);
});

test('choosing a secondary creation area remains eligible for automatic refresh',async()=>{
  const {startLiveRefresh}=await import('../../gestao/js/live-refresh.js');
  const calls=[];
  const {document,window,panel}=await creationFixture(async(name,args)=>{calls.push(args);return {data:{rows:[],total:0,has_more:false}};});
  const live=startLiveRefresh({root:document,view:window,authorize:async()=>true,tasks:[{scope:()=>document.getElementById('creationWorkspace'),refresh:panel.refresh}]});
  try{
    document.getElementById('creationSection').value='produtos';
    document.getElementById('creationSection').dispatchEvent(new window.Event('change',{bubbles:true}));await settle();
    const before=calls.length;await live.refresh();
    assert.equal(calls.length,before+1);
    assert.equal(calls.at(-1).p_section,'produtos');
  }finally{live.stop();}
});
