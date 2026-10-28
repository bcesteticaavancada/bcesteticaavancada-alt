import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(resolve(here,'../../gestao/maya-beta/index.html'),'utf8');
function functionSource(name,nextName){
  const from=source.indexOf('function '+name+'(');
  const until=source.indexOf(nextName,from);
  assert.ok(from>=0 && until>from,'Function section '+name);
  return source.slice(from,until);
}
const sensitive=runInNewContext(functionSource('sensitive','const replies')+'; sensitive');
const classify=runInNewContext(functionSource('classify','async function answer')+'; classify');

test('Maya usa pt-BR e informa limites da beta',()=>{
 assert.match(source,/<html lang="pt-BR">/);
 assert.match(source,/Português \(Brasil\)/);
 assert.match(source,/sem inteligência artificial generativa/);
 assert.match(source,/não consulta agendas, prontuários, dados financeiros ou clientes/);
});
test('Maya exige perfil ativo antes de revelar interface',()=>{
 assert.match(source,/id="app" class="shell" hidden/);
 assert.match(source,/profile=await getCurrentProfile\(client\)/);
 assert.match(source,/if\(!canUseMaya\(profile\)\)/);
 assert.match(source,/status.hidden=true;app.hidden=false/);
 assert.ok(source.indexOf('getCurrentProfile(client)')<source.indexOf('app.hidden=false'));
});
test('Maya reutiliza a proteção de sessão da gestão',()=>{
 assert.match(source,/installSessionGuard\(\{client,profile,app,onProfile:/);
 assert.match(source,/import \{getCurrentProfile,installSessionGuard\} from '\.\.\/js\/auth\.js'/);
});
test('Maya não integra serviços clínicos, financeiros ou IA externa',()=>{
 for(const word of ['localStorage','sessionStorage','.from(','.rpc(','.storage.','openai.com','innerHTML'])
  assert.equal(source.includes(word),false,'prohibited '+word);
});
test('Não aceita identificadores e relatos sensíveis',()=>{
 for(const q of ['Meu CPF é 123.456.789-09','Meu celular é (31) 99999-8888','alice@example.com','senha: minha-senha','Paciente com sangramento'])
  assert.equal(sensitive(q),true,q);
});
test('Não bloqueia perguntas administrativas comuns',()=>{
 for(const q of ['Como recuperar minha senha?','Posso atualizar CPF depois?','Onde vejo minha comissão?','Como gero um PDF?'])
  assert.equal(sensitive(q),false,q);
});
test('Classifica perguntas por assunto sem enviar dados',()=>{
 const samples=[['preciso recuperar login','acesso'],['como consultar minha comissão','financeiro'],['onde preencher anamnese','anamnese'],['quero agendar avaliação','agenda'],['como cadastrar cliente','cadastro'],['como registrar atendimento','atendimento'],['qual é o protocolo de botox','procedimentos']];
 for(const [q,expected] of samples)assert.equal(classify(q),expected,q);
});
test('Admin de criação permanece bloqueado no financeiro',()=>{
 assert.match(source,/profile\?\.role==='admin_criacao'/);
 assert.match(source,/não possui acesso ao financeiro/);
});
test('Não há botões de ação sobre dados de pacientes',()=>{
 assert.doesNotMatch(source,/criar atendimento agora|confirmar pagamento|enviar anamnese para cliente/i);
 assert.match(source,/não registra atendimentos, envia mensagens ou publica conteúdos/);
});
test('Todo texto enviado pelo usuário é exibido como texto, não HTML',()=>{
 assert.match(source,/node.textContent=value/);
 assert.doesNotMatch(source,/dangerouslySetInnerHTML|\.innerHTML/);
});

test('Texto digitado não aparece no histórico da conversa',()=>{
 assert.doesNotMatch(source,/line\(trimmed,\s*'person'\)/);
 assert.match(source,/const selected=classify\(trimmed\)/);
 assert.match(source,/line\('Assunto: '\+\(topicLabels\[selected\]/);
 assert.match(source,/node.textContent=value/);
});
test('Limpar conversa não grava dados e remove a conversa anterior',()=>{
 assert.match(source,/id="clearChat"/);
 assert.match(source,/clearChat\.addEventListener\('click'/);
 assert.match(source,/chat\.replaceChildren\(\)/);
 assert.match(source,/question\.value=''/);
});
test('Conteúdo revisado pela Mel é consultável internamente e mantém limites de indicação',()=>{
 assert.match(source,/As 67 respostas da biblioteca podem ser consultadas pela equipe/);
 assert.match(source,/conteúdo foi revisado pela Mel em 25\/10\/2026/);
 assert.match(source,/não são indicação individual de tratamento/);
 assert.match(source,/não consulta valores nem executa lançamentos/);
});

test('Painel da biblioteca começa oculto e traz aviso de revisão',()=>{
 assert.match(source,/id="knowledgePanel"[^>]*hidden/);
 assert.match(source,/Conteúdo revisado pela Mel em 25\/10\/2026/);
 assert.match(source,/id="knowledgeSearch"/);
 assert.match(source,/id="knowledgeOpen"/);
});
test('Maya importa apenas o arquivo local de respostas, sem APIs clínicas',()=>{
 assert.match(source,/fetch\('\.\/respostas-65\.json'/);
 assert.equal((source.match(/fetch\(/g)||[]).length,1);
 assert.doesNotMatch(source,/fetch\(['"]https?:|\.from\(|\.rpc\(/);
 assert.match(source,/item\.answer|found\.answer/);
});
