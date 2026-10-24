import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const dir=dirname(fileURLToPath(import.meta.url));
const html=readFileSync(resolve(dir,'../../gestao/maya-beta/index.html'),'utf8');
const moduleScript=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleScript,'Inline module found');
const executable=moduleScript.replace(/^import .*?;?\s*$/gm,'').trim();
const library=JSON.parse(readFileSync(resolve(dir,'../../gestao/maya-beta/respostas-65.json'),'utf8'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));

async function render(profile,{allow=()=>true}={}){
  const {document,window}=parseHTML(html);
  let calls=0;
  let signedGuard=false;
  const client={};
  const context={
    document,
    globalThis:{supabase:{createClient:()=>({})}},
    createBcGestaoClient:()=>client,
    getCurrentProfile:async()=>profile?.active===true?profile:null,
    installSessionGuard:()=>{
      signedGuard=true;
      return {authorize:async()=>{calls++;return allow()}};
    },
    fetch:async url=>{
      assert.equal(url,'./respostas-65.json');
      return {ok:true,json:async()=>library};
    },
  };
  await runInNewContext('(async()=>{\n'+executable+'\n})()',context,{timeout:2000});
  return {document,window,calls:()=>calls,guardInstalled:()=>signedGuard};
}
function trigger({document,window},target,type='click'){
  const el=document.querySelector(target);
  assert.ok(el,'Expected element '+target);
  el.dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true}));
}
test('Sem login: Maya não abre, não inicia proteção e exibe opção de login',async()=>{
  const x=await render(null);
  assert.ok(x.document.querySelector('#status').textContent.includes('Acesso restrito'));
  assert.ok(x.document.querySelector('#status a[href="../login/"]'));
  assert.equal(x.guardInstalled(),false);
  assert.equal(x.document.querySelector('#app').hidden,true);
});
test('Perfil ativo autorizado: Maya abre sem carregar informação de clientes',async()=>{
  const x=await render({user_id:'t1',role:'colaborador',display_name:'Profissional teste',active:true});
  assert.equal(x.document.querySelector('#personName').textContent,'Profissional teste');
  assert.equal(x.document.querySelector('#dashboardLink').getAttribute('href'),'../colaborador/');
  assert.ok(x.guardInstalled());
  assert.equal(x.document.querySelector('#app').hidden,false);
  assert.ok(x.document.querySelector('#chat').textContent.includes('Posso explicar'));
});
test('Papéis separam orientação financeira da criação e da colaboradora',async()=>{
  for(const [role,expected] of [
    ['admin_criacao','não possui acesso ao financeiro'],
    ['colaborador','Na área Minha comissão'],
    ['admin','administradora consulta o caixa'],
  ]){
    const x=await render({role,display_name:'Teste',user_id:role,active:true});
    trigger(x,'[data-topic="financeiro"]');
    await settle();
    assert.ok(x.document.querySelector('#chat').textContent.includes(expected),role);
    assert.ok(x.calls()>0);
  }
});
test('Texto da pergunta nunca é espelhado no histórico da Maya',async()=>{
  const x=await render({role:'colaborador',display_name:'Teste',user_id:'u1',active:true});
  x.document.querySelector('#question').value='Gostaria de saber sobre agenda, por favor!';
  trigger(x,'#ask','submit');
  await settle();
  const log=x.document.querySelector('#chat').textContent;
  assert.match(log,/Assunto: Agenda/);
  assert.ok(!log.includes('Gostaria de saber sobre agenda, por favor!'));
  assert.equal(x.document.querySelector('#question').value,'');
});
test('Dados pessoais digitados são descartados e não apresentados no chat',async()=>{
  const x=await render({role:'colaborador',display_name:'Teste',user_id:'u2',active:true});
  x.document.querySelector('#question').value='Meu CPF é 123.456.789-09';
  trigger(x,'#ask','submit');
  await settle();
  const log=x.document.querySelector('#chat').textContent;
  assert.ok(!log.includes('123.456.789-09'));
  assert.ok(log.includes('Para proteger a privacidade'));
});
test('Revogação de autorização bloqueia novas respostas',async()=>{
  let active=true;
  const x=await render({role:'colaborador',display_name:'Teste',user_id:'u3',active:true},{allow:()=>active});
  const before=x.document.querySelector('#chat').textContent;
  active=false;
  trigger(x,'[data-topic="agenda"]');
  await settle();
  assert.equal(x.document.querySelector('#chat').textContent,before);
});
test('Limpar conversa remove conteúdo sem gerar novo armazenamento',async()=>{
  const x=await render({role:'colaborador',display_name:'Teste',user_id:'u4',active:true});
  trigger(x,'[data-topic="cadastro"]');
  await settle();
  assert.match(x.document.querySelector('#chat').textContent,/Assunto: Cadastro/);
  trigger(x,'#clearChat');
  assert.ok(!x.document.querySelector('#chat').textContent.includes('Assunto: Cadastro'));
  assert.match(x.document.querySelector('#chat').textContent,/Conversa limpa/);
});

test('Perfil inativo não vê a Maya Beta',async()=>{
  const x=await render({user_id:'blocked',role:'colaborador',active:false,display_name:'Teste inativo'});
  assert.ok(x.document.querySelector('#status').textContent.includes('Acesso restrito'));
  assert.equal(x.guardInstalled(),false);
});

test('Biblioteca mostra 65 respostas com busca e revisão pendente',async()=>{
 const x=await render({user_id:'u5',role:'colaborador',active:true,display_name:'Teste'});
 trigger(x,'#knowledgeOpen');
 await settle();await settle();
 const panel=x.document.querySelector('#knowledgePanel');
 assert.equal(panel.hidden,false);
 assert.match(x.document.querySelector('#knowledgeCount').textContent,/20 primeiras de 65/);
 assert.equal(x.document.querySelectorAll('#knowledgeItems details').length,20);
 x.document.querySelector('#knowledgeSearch').value='botox';
 trigger(x,'#knowledgeSearch','input');
 const match=x.document.querySelectorAll('#knowledgeItems details');
 assert.ok(match.length>=1);
 assert.ok(Array.from(match).some(x=>x.textContent.includes('revisão técnica pendente')));
});
test('Pergunta reconhecida consulta resposta original da biblioteca sem diagnóstico',async()=>{
 const x=await render({user_id:'u6',role:'colaborador',active:true,display_name:'Teste'});
 x.document.querySelector('#question').value='Como é feito o Botox?';
 trigger(x,'#ask','submit');
 await settle();await settle();
 const text=x.document.querySelector('#chat').textContent;
 assert.match(text,/toxina botulínica/i);
 assert.match(text,/revisão técnica pendente/);
 assert.doesNotMatch(text,/Como é feito o Botox\?/);
});
test('Pessoa sem autorização não consegue abrir a biblioteca',async()=>{
 const x=await render({user_id:'u7',role:'colaborador',active:true,display_name:'Teste'},{allow:()=>false});
 trigger(x,'#knowledgeOpen');
 await settle();await settle();
 assert.equal(x.document.querySelector('#knowledgePanel').hidden,true);
});
