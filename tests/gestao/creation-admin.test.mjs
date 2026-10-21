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
