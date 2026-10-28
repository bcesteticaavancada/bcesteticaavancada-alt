import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import { getCurrentProfile, installSessionGuard } from '../../gestao/js/auth.js';
import { listAppGuides, findAppGuide, canUseMaya } from '../../gestao/maya-beta/app-guides.js';

const dir=dirname(fileURLToPath(import.meta.url));
const html=readFileSync(resolve(dir,'../../gestao/maya-beta/index.html'),'utf8');
const moduleScript=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleScript,'Inline module found');
const executable=moduleScript.replace(/^import .*?;?\s*$/gm,'').trim();
const library=JSON.parse(readFileSync(resolve(dir,'../../gestao/maya-beta/respostas-65.json'),'utf8'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));

async function render(profile,{allow=()=>true,load=async()=>library,realAuth=false,reducedMotion=false}={}){
  const {document,window}=parseHTML(html);
  const motionListeners=[];
  const motionPreference={matches:reducedMotion,addEventListener(type,listener){if(type==='change')motionListeners.push(listener);}};
  Object.defineProperty(document,'hidden',{value:false,writable:true,configurable:true});
  let calls=0;
  let signedGuard=false;
  let current=profile,authListener,sessionError=null;
  const redirects=[];
  const client={
    auth:{
      getSession:async()=>({data:{session:current?{user:{id:current.user_id}}:null},error:sessionError}),
      onAuthStateChange(fn){authListener=fn;return {data:{subscription:{unsubscribe(){}}}};},
    },
    from(table){
      assert.equal(table,'staff_profiles','Somente o perfil da própria equipe pode ser lido');
      return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:current})};
    },
  };
  const context={
    listAppGuides,findAppGuide,canUseMaya,
    document,
    globalThis:{supabase:{createClient:()=>({})},matchMedia:()=>motionPreference},
    createBcGestaoClient:()=>client,
    getCurrentProfile:realAuth?getCurrentProfile:async()=>profile?.active===true?profile:null,
    installSessionGuard:options=>{
      signedGuard=true;
      const guard=realAuth?installSessionGuard({...options,view:{location:{replace:url=>redirects.push(url)}}}):null;
      return {authorize:async()=>{calls++;return guard?guard.authorize():allow()}};
    },
    fetch:async url=>{
      assert.equal(url,'./respostas-65.json');
      return {ok:true,json:load};
    },
  };
  const actions=await runInNewContext('(async()=>{\n'+executable+'\nreturn {answer,openKnowledge};\n})()',context,{timeout:2000});
  return {document,window,...actions,calls:()=>calls,guardInstalled:()=>signedGuard,
    changeProfile:value=>{current=value;},failSession:error=>{sessionError=error;},authEvent:(...args)=>authListener?.(...args),redirects,
    reduceMotion:value=>{motionPreference.matches=value;motionListeners.forEach(listener=>listener());}};
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
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
test('Colaboradora recebe somente orientação da própria comissão',async()=>{
 const x=await render({role:'colaborador',display_name:'Teste',user_id:'colab',active:true});
 trigger(x,'[data-topic="financeiro"]');await settle();
 assert.match(x.document.querySelector('#chat').textContent,/Na área Minha comissão/);
 assert.doesNotMatch(x.document.querySelector('#chat').textContent,/administradora consulta o caixa/);
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

test('Biblioteca mostra 67 respostas com busca e revisão de conteúdo aprovada',async()=>{
 const x=await render({user_id:'u5',role:'colaborador',active:true,display_name:'Teste'});
 trigger(x,'#knowledgeOpen');
 await settle();await settle();
 const panel=x.document.querySelector('#knowledgePanel');
 assert.equal(panel.hidden,false);
 assert.match(x.document.querySelector('#knowledgeCount').textContent,/20 primeiras de 67/);
 assert.equal(x.document.querySelectorAll('#knowledgeItems details').length,20);
 x.document.querySelector('#knowledgeSearch').value='botox';
 trigger(x,'#knowledgeSearch','input');
 await settle();
 const match=x.document.querySelectorAll('#knowledgeItems details');
 const expected=library.items.filter(i=>/botox/i.test(i.question+' '+i.triggers.join(' '))).map(i=>i.question);
 assert.deepEqual(Array.from(match,item=>item.querySelector('summary').textContent),expected);
 assert.ok(Array.from(match).some(x=>x.textContent.includes('Revisado pela Mel em 25/10/2026')));
});
test('Pergunta reconhecida consulta resposta original da biblioteca sem diagnóstico',async()=>{
 const x=await render({user_id:'u6',role:'colaborador',active:true,display_name:'Teste'});
 x.document.querySelector('#question').value='Como é feito o Botox?';
 trigger(x,'#ask','submit');
 await settle();await settle();
 const text=x.document.querySelector('#chat').textContent;
 assert.match(text,/toxina botulínica/i);
 assert.match(text,/Revisado pela Mel em 25\/10\/2026/);
 assert.doesNotMatch(text,/Como é feito o Botox\?/);
});
test('Pessoa sem autorização não consegue abrir a biblioteca',async()=>{
 const x=await render({user_id:'u7',role:'colaborador',active:true,display_name:'Teste'},{allow:()=>false});
 trigger(x,'#knowledgeOpen');
 await settle();await settle();
 assert.equal(x.document.querySelector('#knowledgePanel').hidden,true);
});

for(const role of ['paciente','desconhecido'])test('Papel fora da equipe não consulta biblioteca nem recebe orientação: '+role,async()=>{
 let loads=0;
 const x=await render({user_id:role,role,active:true},{load:async()=>{loads++;return library;}});
 await x.answer('Como é feito o Botox?');await x.openKnowledge();
 assert.equal(x.document.querySelector('#app').hidden,true);
 assert.equal(x.document.querySelector('#chat').children.length,0);
 assert.equal(x.document.querySelector('#knowledgePanel').hidden,true);
 assert.equal(loads,0);
});
for(const action of ['answer','openKnowledge'])for(const [change,nextProfile] of [
 ['inativado',{user_id:'equipe',role:'colaborador',active:false}],
 ['com papel alterado',{user_id:'equipe',role:'admin_criacao',active:true}],
 ['substituído por outra conta',{user_id:'outra-conta',role:'colaborador',active:true}],
]){
 test('Perfil '+change+' durante a espera não recebe conteúdo: '+action,async()=>{
  const wait=deferred();
  const x=await render({user_id:'equipe',role:'colaborador',active:true},{realAuth:true,load:()=>wait.promise});
  const pending=action==='answer'?x.answer('Como é feito o Botox?'):x.openKnowledge();
  await settle();
  x.changeProfile(nextProfile);
  wait.resolve(library);await pending;
  assert.equal(x.document.querySelector('#app').hidden,true);
  assert.equal(x.document.querySelector('#app').textContent,'');
  assert.deepEqual(x.redirects,['../login/']);
 });
}
test('Logout durante a consulta impede que uma resposta repovoe o DOM removido',async()=>{
 const wait=deferred();
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{realAuth:true,load:()=>wait.promise});
 const oldChat=x.document.querySelector('#chat');
 const pending=x.answer('Como é feito o Botox?');await settle();
 x.authEvent('SIGNED_OUT',null);
 const before=oldChat.textContent;
 wait.resolve(library);await pending;
 assert.equal(oldChat.textContent,before);
 assert.equal(x.document.querySelector('#app').hidden,true);
});
test('Limpar conversa cancela o resultado de uma pergunta ainda carregando',async()=>{
 const wait=deferred();
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{load:()=>wait.promise});
 const pending=x.answer('Como é feito o Botox?');await settle();
 trigger(x,'#clearChat');
 wait.resolve(library);await pending;
 assert.equal(x.document.querySelector('#chat').children.length,1);
 assert.equal(x.document.querySelector('#chat').textContent,'Conversa limpa. Como posso ajudar?');
});
test('Fechar biblioteca cancela a renderização que ainda está carregando',async()=>{
 const wait=deferred();
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{load:()=>wait.promise});
 const pending=x.openKnowledge();await settle();
 trigger(x,'#knowledgeClose');
 wait.resolve(library);await pending;
 assert.equal(x.document.querySelector('#knowledgePanel').hidden,true);
 assert.equal(x.document.querySelector('#knowledgeItems').children.length,0);
});
test('Busca na biblioteca revalida perfil ativo com a proteção real da gestão',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{realAuth:true});
 await x.openKnowledge();
 x.changeProfile({user_id:'equipe',role:'colaborador',active:false});
 x.document.querySelector('#knowledgeSearch').value='botox';
 trigger(x,'#knowledgeSearch','input');await settle();await settle();
 assert.equal(x.document.querySelector('#app').hidden,true);
 assert.deepEqual(x.redirects,['../login/']);
});
test('Erro ao revalidar sessão é tratado sem responder nem rejeitar a ação',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{realAuth:true});
 x.failSession(Error('falha simulada de conexão'));
 await assert.doesNotReject(()=>x.answer('Como cadastrar cliente?'));
 assert.doesNotMatch(x.document.querySelector('#chat').textContent,/abra Clientes e escolha Novo cliente/);
 assert.match(x.document.querySelector('#chat').textContent,/Não foi possível confirmar seu acesso/);
 await assert.doesNotReject(()=>x.openKnowledge());
 assert.equal(x.document.querySelector('#knowledgeItems').children.length,0);
});
test('Biblioteca indisponível mantém orientação administrativa sem afirmar conteúdo clínico',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{load:async()=>{throw Error('offline fictício');}});
 await x.answer('Como cadastrar cliente?');
 assert.match(x.document.querySelector('#chat').textContent,/abra Clientes e escolha Novo cliente/);
 await x.openKnowledge();
 assert.match(x.document.querySelector('#knowledgeCount').textContent,/temporariamente indisponível/);
 assert.equal(x.document.querySelector('#knowledgeItems').children.length,0);
});
test('Variações diretas de pergunta encontram um assunto conhecido sem inventar resposta',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true});
 for(const [question,id] of [
  ['O que é microagulhamento?','microagulhamento'],
  ['Como funciona o peeling?','peeling'],
  ['O que é radiofrequência?','radiofrequencia'],
  ['Me explique a drenagem linfática','drenagem'],
 ]){
  await x.answer(question);
  assert.ok(x.document.querySelector('#chat').lastElementChild.textContent.startsWith(library.items.find(i=>i.id===id).answer),question);
 }
});
test('Pergunta com dois procedimentos ou pedido de dose não recebe resposta inferida',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true});
 for(const question of ['O que é botox ou peeling?','O que é black peel ou peeling?','Qual dose de botox devo usar?','Qual dose de toxina botulínica devo usar?']){
  await x.answer(question);
  assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/não são indicação individual|procure a Mel|administração/);
  assert.ok(!library.items.some(i=>x.document.querySelector('#chat').lastElementChild.textContent.startsWith(i.answer)));
 }
});
test('Biblioteca renderiza texto literal e rejeita links fora das fontes autorizadas',async()=>{
 const altered=structuredClone(library);
 altered.items[0].question='<img src=x onerror="alert(1)">';
 altered.items[0].answer='<script>alert(1)</script>';
 altered.items[0].references=['javascript:alert(1)','https://www.aad.org.evil.example/','https://www.aad.org/public/'];
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{load:async()=>altered});
 await x.openKnowledge();
 const item=x.document.querySelector('#knowledgeItems details');
 assert.equal(item.querySelectorAll('img,script').length,0);
 assert.ok(item.textContent.includes('<script>alert(1)</script>'));
 assert.deepEqual(Array.from(item.querySelectorAll('a'),a=>a.getAttribute('href')),['https://www.aad.org/public/']);
});
test('As 67 perguntas e os 229 gatilhos preservam a resposta correspondente para a equipe clínica',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true});
 let checked=0;
 for(const item of library.items)for(const text of [item.question,...item.triggers]){
  await x.answer(text);checked++;
  assert.ok(x.document.querySelector('#chat').lastElementChild.textContent.startsWith(item.answer),item.id+': '+text);
 }
 assert.equal(checked,296);
});

test('Biblioteca identifica aprovação de conteúdo sem repetir pendência da Mel',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true});
 await x.openKnowledge();
 assert.match(x.document.querySelector('#knowledgeCount').textContent,/20 primeiras de 67/);
 assert.match(x.document.querySelector('#knowledgeItems').textContent,/Revisado pela Mel em 25\/10\/2026/);
 assert.doesNotMatch(x.document.querySelector('#knowledgeItems').textContent,/validação da Mel pendente/);
 await x.answer('Como é feito o Botox?');
 assert.doesNotMatch(x.document.querySelector('#chat').lastElementChild.textContent,/revisão técnica pendente|—/);
});
for(const issue of ['parecer pendente','autor ausente','origem ausente','escopo incorreto','publicação liberada']){
 test('Biblioteca recusa metadados incompletos de aprovação: '+issue,async()=>{
  const altered=structuredClone(library);
  if(issue==='parecer pendente')altered.items[0].review='pendente';
  if(issue==='autor ausente')delete altered.items[0].reviewed_by;
  if(issue==='origem ausente')delete altered.reviewSource;
  if(issue==='escopo incorreto')altered.reviewSource.scope='publicacao';
  if(issue==='publicação liberada')altered.reviewSource.publication_approval=true;
  const x=await render({user_id:'equipe',role:'colaborador',active:true},{load:async()=>altered});
  await x.openKnowledge();
  assert.equal(x.document.querySelector('#knowledgeItems').children.length,0);
  assert.match(x.document.querySelector('#knowledgeCount').textContent,/temporariamente indisponível/);
 });
}
test('Pedido de agendamento de massagem desportiva informa que a BC não oferece o serviço',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true});
 for(const text of ['Quero agendar massagem desportiva','Vocês fazem massagem esportiva?','Vocês têm massagem desportiva?','Tem horário para massagem esportiva?','Quero um agendamento de massagem desportiva','Gostaria de fazer massagem desportiva']){
  await x.answer(text);
  assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/BC não realiza massagem desportiva/);
 }
});
test('Falha de biblioteca mantém a indisponibilidade da massagem desportiva sem sugerir reserva',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true},{load:async()=>{throw Error('biblioteca offline fictícia');}});
 for(const text of ['Quero agendar massagem desportiva','Tem horário para massagem esportiva?']){
  await x.answer(text);
  assert.equal(x.document.querySelector('#chat').lastElementChild.textContent,library.items.find(i=>i.id==='massagem-desportiva-agendamento').answer);
  assert.doesNotMatch(x.document.querySelector('#chat').lastElementChild.textContent,/Para criar agendamento/);
 }
});
test('Perguntas conceituais com tem preservam a explicação revisada sobre massagem desportiva',async()=>{
 const x=await render({user_id:'equipe',role:'colaborador',active:true});
 for(const text of ['Quais benefícios tem a massagem desportiva?','Que efeito tem a massagem esportiva?']){
  await x.answer(text);
  assert.ok(x.document.querySelector('#chat').lastElementChild.textContent.startsWith(library.items.find(i=>i.id==='massagem-desportiva').answer));
 }
});
test('Revisão da Mel não cria acesso para perfil de paciente',async()=>{
 const x=await render({user_id:'ficticio',role:'cliente',active:true});
 assert.equal(x.document.querySelector('#app').hidden,true);
 assert.equal(x.guardInstalled(),false);
 assert.match(x.document.querySelector('#status').textContent,/Acesso restrito/);
});

const visualProfile={user_id:'visual-ficticio',role:'colaborador',active:true};
function character(x){
 const element=x.document.querySelector('#mayaCharacter');
 assert.ok(element,'A personagem 2D está presente dentro da Beta');
 return element;
}
test('Personagem acompanha a consulta lenta sem atrasar a resposta ou expor a pergunta',async()=>{
 const wait=deferred(),x=await render(visualProfile,{load:()=>wait.promise});
 assert.equal(character(x).dataset.state,'ready');
 const pending=x.answer('O que é microagulhamento?');await settle();
 assert.equal(character(x).dataset.state,'thinking');
 assert.match(x.document.querySelector('#mayaState').textContent,/Consultando orientação/);
 trigger(x,'#mayaMotionToggle');
 assert.equal(character(x).dataset.motion,'off');
 wait.resolve(library);await pending;
 assert.equal(character(x).dataset.state,'answered');
 assert.match(x.document.querySelector('#mayaState').textContent,/Orientação disponível/);
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/microagulhamento/i);
 assert.equal(character(x).dataset.motion,'off','Responder não reativa movimento pausado');
});
test('Controle de animação pausa e retoma somente o movimento, mantendo o diálogo',async()=>{
 const x=await render(visualProfile),toggle=x.document.querySelector('#mayaMotionToggle');
 assert.equal(character(x).dataset.motion,'on');
 assert.equal(toggle.getAttribute('aria-pressed'),'true');
 const before=x.document.querySelector('#chat').textContent;
 trigger(x,'#mayaMotionToggle');
 assert.equal(character(x).dataset.motion,'off');
 assert.equal(toggle.getAttribute('aria-pressed'),'false');
 trigger(x,'#mayaMotionToggle');
 assert.equal(character(x).dataset.motion,'on');
 assert.equal(x.document.querySelector('#chat').textContent,before);
});
test('Preferência do dispositivo impede movimento e preserva a pausa manual ao mudar',async()=>{
 const x=await render(visualProfile,{reducedMotion:true});
 assert.equal(character(x).dataset.motion,'off');
 assert.equal(x.document.querySelector('#mayaMotionToggle').disabled,true);
 await x.answer('','agenda');
 assert.equal(character(x).dataset.state,'answered');
 assert.equal(character(x).dataset.motion,'off');
 x.reduceMotion(false);
 assert.equal(x.document.querySelector('#mayaMotionToggle').disabled,false);
 trigger(x,'#mayaMotionToggle');
 x.reduceMotion(true);x.reduceMotion(false);
 assert.equal(character(x).dataset.motion,'off','Pausa manual sobrevive à mudança da preferência do sistema');
});
test('Página oculta suspende animações sem perder a escolha manual',async()=>{
 const x=await render(visualProfile);
 character(x);
 x.document.hidden=true;x.document.dispatchEvent(new x.window.Event('visibilitychange'));
 assert.equal(character(x).dataset.motion,'off');
 x.document.hidden=false;x.document.dispatchEvent(new x.window.Event('visibilitychange'));
 assert.equal(character(x).dataset.motion,'on');
 trigger(x,'#mayaMotionToggle');
 x.document.hidden=true;x.document.dispatchEvent(new x.window.Event('visibilitychange'));
 x.document.hidden=false;x.document.dispatchEvent(new x.window.Event('visibilitychange'));
 assert.equal(character(x).dataset.motion,'off');
});
for(const action of ['limpar conversa','fechar biblioteca'])test('Estado visual pendente é descartado ao '+action,async()=>{
 const wait=deferred(),x=await render(visualProfile,{load:()=>wait.promise});
 const pending=action==='limpar conversa'?x.answer('O que é peeling?'):x.openKnowledge();
 await settle();assert.equal(character(x).dataset.state,'thinking');
 trigger(x,action==='limpar conversa'?'#clearChat':'#knowledgeClose');
 assert.equal(character(x).dataset.state,'ready');
 wait.resolve(library);await pending;
 assert.equal(character(x).dataset.state,'ready');
});
test('Falha de biblioteca não deixa personagem presa consultando nem afirma sucesso',async()=>{
 const x=await render(visualProfile,{load:async()=>{throw Error('biblioteca fictícia offline');}});
 await x.openKnowledge();
 assert.equal(character(x).dataset.state,'unavailable');
 assert.match(x.document.querySelector('#mayaState').textContent,/Tente novamente/);
 assert.equal(x.document.querySelector('#knowledgeItems').children.length,0);
});
test('Consulta antiga não substitui o aviso visual de uma ação mais recente que falhou',async()=>{
 const wait=deferred();let loads=0;
 const x=await render(visualProfile,{load:()=>++loads===1?wait.promise:Promise.reject(Error('falha fictícia'))});
 const old=x.answer('O que é peeling?');await settle();
 await x.openKnowledge();
 assert.equal(character(x).dataset.state,'unavailable');
 wait.resolve(library);await old;
 assert.equal(character(x).dataset.state,'unavailable');
});
test('Erro de sessão deixa status recuperável sem fingir resposta da personagem',async()=>{
 const x=await render(visualProfile,{realAuth:true});
 x.failSession(Error('conexão fictícia'));
 await x.answer('O que é peeling?');
 assert.equal(character(x).dataset.state,'unavailable');
 assert.match(x.document.querySelector('#chat').textContent,/Não foi possível confirmar seu acesso/);
});
for(const action of ['limpar conversa','fechar biblioteca'])test('Erro de autorização atrasado não desfaz '+action,async()=>{
 const wait=deferred(),x=await render(visualProfile,{allow:()=>wait.promise});
 const pending=action==='limpar conversa'?x.answer('O que é peeling?'):x.openKnowledge();
 await settle();trigger(x,action==='limpar conversa'?'#clearChat':'#knowledgeClose');
 const before=x.document.querySelector('#chat').textContent;
 wait.reject(Error('falha fictícia atrasada'));await pending;
 assert.equal(character(x).dataset.state,'ready');
 assert.equal(x.document.querySelector('#chat').textContent,before);
});
test('Erro de autorização antigo não oculta a biblioteca concluída por uma ação mais recente',async()=>{
 const wait=deferred();let checks=0;
 const x=await render(visualProfile,{allow:()=>++checks===1?wait.promise:true});
 const old=x.answer('O que é peeling?');await settle();
 await x.openKnowledge();
 assert.equal(character(x).dataset.state,'answered');
 wait.reject(Error('falha fictícia da ação antiga'));await old;
 assert.equal(character(x).dataset.state,'answered');
 assert.equal(x.document.querySelector('#knowledgePanel').hidden,false);
 assert.equal(x.document.querySelectorAll('#knowledgeItems details').length,20);
 assert.doesNotMatch(x.document.querySelector('#chat').textContent,/Não foi possível confirmar seu acesso/);
});
test('Falha de busca no chat mantém fallback seguro e informa indisponibilidade',async()=>{
 const x=await render(visualProfile,{load:async()=>{throw Error('falha fictícia da biblioteca');}});
 await x.answer('O que é peeling?');
 assert.equal(character(x).dataset.state,'unavailable');
 assert.match(x.document.querySelector('#mayaState').textContent,/Tente novamente/);
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/67 respostas da biblioteca/);
});
for(const [role,panel] of [['admin','admin'],['admin_criacao','criacao']]){
 test('Maya recebe perfil ativo da equipe e retorna ao próprio painel: '+role,async()=>{
  const x=await render({user_id:'equipe-'+role,role,active:true});
  assert.equal(x.document.querySelector('#app').hidden,false);
  assert.equal(x.guardInstalled(),true);
  assert.equal(x.document.querySelector('#dashboardLink').getAttribute('href'),'../'+panel+'/');
  await x.answer('O que é microagulhamento?');
  assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/Revisado pela Mel/);
 });
 test('Maya não recebe perfil inativo: '+role,async()=>{
  const x=await render({user_id:'inativo-'+role,role,active:false});
  assert.equal(x.document.querySelector('#app').hidden,true);
  assert.equal(x.guardInstalled(),false);
 });
}
test('Administração recebe guias no próprio painel mesmo sem capacidades de colaboradora chefe',()=>{
 const guides=listAppGuides({role:'admin',active:true,pode_gerenciar_agendas:false,pode_gerenciar_procedimentos:false});
 assert.ok(guides.some(x=>x.id==='cadastro'&&x.href==='../admin/#clientes'));
 assert.ok(guides.some(x=>x.id==='financeiro-admin'&&x.href==='../admin/#financeiro'));
 assert.ok(guides.some(x=>x.id==='agenda-equipe'));
 assert.ok(guides.some(x=>x.id==='procedimentos'));
 assert.ok(!guides.some(x=>x.id==='comissao'||x.href.startsWith('../colaborador/')));
});
test('Criação recebe navegação e apoio próprios sem atalhos financeiros ou ações clínicas',()=>{
 const profile={role:'admin_criacao',active:true,pode_gerenciar_agendas:true,pode_gerenciar_procedimentos:true};
 const guides=listAppGuides(profile);
 for(const id of ['criacao','convite','apoio-documentos','instalar','senha','conexao','site'])assert.ok(guides.some(x=>x.id===id),id);
 assert.ok(!guides.some(x=>['comissao','financeiro-admin','cadastro','agendar','atendimento','procedimentos','agenda-equipe','gov'].includes(x.id)));
 assert.ok(guides.every(x=>!/^\.\.\/(admin|colaborador)\//.test(x.href)&&!x.href.includes('#financeiro')));
});
test('Criação não recebe financeiro ao perguntar pelo caixa ou por uma comissão',async()=>{
 const x=await render({user_id:'criacao',role:'admin_criacao',active:true});
 for(const query of ['Onde vejo minha comissão?','Como consultar o caixa?']){
  await x.answer(query);
  assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/não possui acesso ao financeiro/);
  assert.equal(x.document.querySelector('#guideAction').hasAttribute('href'),false);
 }
});
test('Maya descreve apoio cadastral e cópias de consentimento existentes no painel de criação',async()=>{
 const x=await render({user_id:'apoio',role:'admin_criacao',active:true});
 trigger(x,'[data-topic="cadastro"]');await settle();
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/Apoio ao cliente/);
 trigger(x,'[data-topic="documentos"]');await settle();
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/cópia|cópias/);
 assert.doesNotMatch(x.document.querySelector('#chat').lastElementChild.textContent,/permite apenas consulta da identificação/);
});
for(const [role,panel] of [['admin','admin'],['admin_criacao','criacao']]){
 test('Administração encontra os recursos e planeja criação pelo próprio painel: '+role,async()=>{
  const x=await render({user_id:'planejamento-'+role,role,active:true});
  for(const [query,title,href] of [
   ['Quais são os recursos diretos e indiretos do site?','Mapa dos recursos da BC','../'+panel+'/'],
   ['Como funciona o site por dentro?','Como o site funciona por dentro','../'+panel+'/'],
   ['Como propor uma melhoria no site?','Organizar uma melhoria no site','../'+panel+'/'],
   ['Como publicar uma alteração no site?','Publicação e recuperação de versões','../'+panel+'/'],
   ['Como funciona o domínio próprio?','Domínio próprio e endereços','../../'],
   ['Como conferir o backup?','Entender o backup e a recuperação','../../backup/'],
   ['Como criar uma área do cliente?','Planejar a área do cliente','../'+panel+'/#clientes'],
   ['Posso conversar com você dentro do site?','IA para criação dentro do site','../'+panel+'/'],
  ]){
   await x.answer(query);
   assert.equal(x.document.querySelector('#guideTitle').textContent,title,query);
   assert.equal(x.document.querySelector('#guideAction').getAttribute('href'),href,query);
   assert.equal(x.document.querySelector('#guidePanel').hidden,false);
  }
 });
}
test('Guias de arquitetura não são oferecidos ao perfil de colaboradora nem a inativos',async()=>{
 const query='Como funciona o site por dentro?';
 for(const profile of [{...visualProfile,pode_gerenciar_agendas:true,pode_gerenciar_procedimentos:true},{role:'admin',active:false},{role:'admin_criacao',active:false}]){
  assert.equal(findAppGuide(query,profile),null);
  const x=await render(profile);
  await x.answer(query);
  assert.equal(x.document.querySelector('#guideAction').hasAttribute('href'),false);
 }
});
test('Troca de papel entre administradores durante a consulta revoga a sessão da Maya',async()=>{
 const wait=deferred();
 const profile={user_id:'mesma-conta',role:'admin',active:true};
 const x=await render(profile,{realAuth:true,load:()=>wait.promise});
 const pending=x.answer('O que é peeling?');await settle();
 x.changeProfile({...profile,role:'admin_criacao'});wait.resolve(library);await pending;
 assert.equal(x.document.querySelector('#app').hidden,true);
 assert.equal(x.document.querySelector('#app').textContent,'');
 assert.deepEqual(x.redirects,['../login/']);
});
test('Guia de documento GOV orienta fluxo manual e oferece somente navegação',async()=>{
 const x=await render(visualProfile);
 await x.answer('Como anexar o PDF assinado pelo GOV?');
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/Anexar documento/);
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/GOV.BR/);
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/Revisar e vincular/);
 assert.equal(x.document.querySelector('#guideAction').getAttribute('href'),'../colaborador/#clientes');
 assert.equal(x.document.querySelector('#guideAction').hidden,false);
});
test('Guia de comissão não encaminha colaboradora ao caixa administrativo',async()=>{
 const x=await render(visualProfile);
 await x.answer('Onde vejo minha comissão?');
 assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/Minha comissão/);
 assert.equal(x.document.querySelector('#guideAction').getAttribute('href'),'../colaborador/#financeiro');
 assert.ok(!x.document.querySelector('#guideAction').getAttribute('href').includes('admin'));
});
test('Guia de agenda da equipe só aparece para colaboradora chefe autorizada',async()=>{
 for(const canManage of [false,true]){
  const x=await render({...visualProfile,pode_gerenciar_agendas:canManage});
  trigger(x,'#guidesOpen');await settle();
  const options=x.document.querySelector('#guideChoices').textContent;
  assert.equal(options.includes('Agenda da equipe'),canManage);
 }
});
test('Limpar conversa remove também atalho da orientação anterior',async()=>{
 const x=await render(visualProfile);
 await x.answer('Como anexar o PDF assinado pelo GOV?');
 trigger(x,'#clearChat');
 assert.equal(x.document.querySelector('#guidePanel').hidden,true);
 assert.equal(x.document.querySelector('#guideAction').hidden,true);
 assert.equal(x.document.querySelector('#guideAction').hasAttribute('href'),false);
});
test('Mudança de capacidades é refletida antes de orientar agenda e biblioteca da equipe',async()=>{
 const original={...visualProfile,pode_gerenciar_agendas:true,pode_gerenciar_procedimentos:true};
 const x=await render(original,{realAuth:true});
 x.changeProfile({...original,pode_gerenciar_agendas:false,pode_gerenciar_procedimentos:false});
 trigger(x,'#guidesOpen');await settle();await settle();
 assert.doesNotMatch(x.document.querySelector('#guideChoices').textContent,/Agenda da equipe|Biblioteca de procedimentos/);
 await x.answer('agenda da equipe passo a passo');
 assert.doesNotMatch(x.document.querySelector('#chat').lastElementChild.textContent,/Sua capacidade de gestão/);
});
test('Ação antiga com autorização atrasada preserva guias abertos pela ação nova',async()=>{
 const wait=deferred();let checks=0;
 const x=await render(visualProfile,{allow:()=>++checks===1?wait.promise:true});
 const old=x.answer('como gerar pdf');await settle();
 trigger(x,'#guidesOpen');await settle();
 const before=x.document.querySelector('#guideChoices').textContent;
 wait.resolve(true);await old;
 assert.equal(x.document.querySelector('#guidePanel').hidden,false);
 assert.equal(x.document.querySelector('#guideChoices').textContent,before);
});
test('Escolher guia recolhe opções e permite escolher outra tarefa sem perder o texto',async()=>{
 const x=await render(visualProfile);
 trigger(x,'#guidesOpen');await settle();
 const choice=x.document.querySelector('#guideChoices button');choice.dispatchEvent(new x.window.Event('click'));
 await settle();
 assert.equal(x.document.querySelector('#guideChoices').hidden,true);
 assert.equal(x.document.querySelector('#guideChooseAgain').hidden,false);
 const before=x.document.querySelector('#chat').textContent;
 trigger(x,'#guideChooseAgain');await settle();
 assert.equal(x.document.querySelector('#guideChoices').hidden,false);
 assert.equal(x.document.querySelector('#chat').textContent,before);
});
