import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const folder=dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(readFileSync(resolve(folder,'../../gestao/maya-beta/respostas-65.json'),'utf8'));
const html=readFileSync(resolve(folder,'../../gestao/maya-beta/index.html'),'utf8');
const items=data.items;

test('A biblioteca contém 65 perguntas únicas, todas com resposta e fonte',()=>{
 assert.equal(data.locale,'pt-BR');
 assert.equal(items.length,65);
 assert.equal(new Set(items.map(x=>x.id)).size,65);
 for(const item of items){
  assert.ok(item.question.length>=8,item.id);
  assert.ok(item.answer.length>=30,item.id);
  assert.ok(item.source.length>0,item.id);
  assert.ok(item.triggers.length>=1,item.id);
 }
});
test('Liberação é exclusivamente para consulta da Beta interna, sem homologação clínica',()=>{
 assert.equal(data.publication,'beta-interna-em-revisao');
 assert.equal(data.reviewAuthority,'Mel');
 assert.equal(items.filter(x=>x.audience==='equipe').length,13);
 assert.equal(items.filter(x=>x.audience==='informativo').length,52);
 assert.ok(items.every(x=>x.review==='pendente'));
 assert.match(html,/Conteúdo técnico ainda em revisão pela Mel/);
});
test('Biblioteca não contém tokens HTML ou campos de cliente',()=>{
 for(const item of items){
  const corpus=item.question+' '+item.answer+' '+item.source;
  assert.doesNotMatch(corpus,/<script|<iframe|onerror\s*=/i,item.id);
  assert.equal(Object.keys(item).sort().join('|'),'answer|audience|id|question|review|source|triggers',item.id);
 }
});
test('Busca e diálogo dependem da autorização do BC Gestão',()=>{
 assert.match(html,/async function openKnowledge\(\)\{\s*if\(!await guard.authorize\(\)\)return/);
 assert.match(html,/async function answer\(text,topic\)\{\s*if\(!await guard.authorize\(\)\)return/);
 assert.match(html,/fetch\('\.\/respostas-65\.json',\{cache:'no-store'\}\)/);
 assert.match(html,/response\.json\(\)/);
});
test('Exibição não interpreta respostas como HTML e não publica conteúdo no banco',()=>{
 assert.match(html,/answer\.textContent=item\.answer/);
 assert.match(html,/source\.textContent='Referência/);
 assert.doesNotMatch(html,/\.innerHTML|\.from\(|\.rpc\(|localStorage/);
});
