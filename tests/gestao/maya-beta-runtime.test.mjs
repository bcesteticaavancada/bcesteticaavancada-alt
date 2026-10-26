import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import { getCurrentProfile, installSessionGuard } from '../../gestao/js/auth.js';

const dir=dirname(fileURLToPath(import.meta.url));
const html=readFileSync(resolve(dir,'../../gestao/maya-beta/index.html'),'utf8');
const moduleScript=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleScript,'Inline module found');
const executable=moduleScript.replace(/^import .*?;?\s*$/gm,'').trim();
const library=JSON.parse(readFileSync(resolve(dir,'../../gestao/maya-beta/respostas-65.json'),'utf8'));
const settle=()=>new Promise(resolve=>setImmediate(resolve));

async function render(profile,{allow=()=>true,load=async()=>library,realAuth=false}={}){
  const {document,window}=parseHTML(html);
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
    document,
    globalThis:{supabase:{createClient:()=>({})}},
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
    changeProfile:value=>{current=value;},failSession:error=>{sessionError=error;},authEvent:(...args)=>authListener?.(...args),redirects};
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

test('Perfil de criação recebe orientação de consulta nos cinco assuntos da operação',async()=>{
 const x=await render({user_id:'criacao',role:'admin_criacao',active:true});
 for(const topic of ['cadastro','agenda','anamnese','atendimento','documentos']){
  trigger(x,'[data-topic="'+topic+'"]');await settle();
  assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/apenas consulta/i,topic);
  assert.doesNotMatch(x.document.querySelector('#chat').lastElementChild.textContent,/escolha Novo cliente|Para criar agendamento|Registros clínicos.*devem ser feitos/i,topic);
 }
});
test('Pergunta operacional da biblioteca respeita a consulta do perfil de criação',async()=>{
 const x=await render({user_id:'criacao',role:'admin_criacao',active:true});
 for(const id of ['app-cancelar','app-profissional','app-link-expirou','app-completar-cadastro','app-folga','app-atendimento-confirmacao','app-anamnese-status','app-cadastro-duplicado','app-confirmar-link']){
  await x.answer(library.items.find(i=>i.id===id).question);
  assert.match(x.document.querySelector('#chat').lastElementChild.textContent,/apenas consulta/i,id);
  assert.doesNotMatch(x.document.querySelector('#chat').lastElementChild.textContent,/abrir o cadastro da cliente e consultar o estado da anamnese/i,id);
 }
});
test('Biblioteca distingue orientação adaptada ao perfil do texto de origem revisado',async()=>{
 const x=await render({user_id:'criacao',role:'admin_criacao',active:true});
 await x.openKnowledge();
 x.document.querySelector('#knowledgeSearch').value='Como verificar se a cliente respondeu';
 trigger(x,'#knowledgeSearch','input');await settle();
 const item=x.document.querySelector('#knowledgeItems details');
 assert.match(item.textContent,/apenas consulta/i);
 assert.match(item.textContent,/Orientação adaptada ao perfil de criação/);
 assert.match(item.textContent,/Texto de origem revisado pela Mel/);
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
