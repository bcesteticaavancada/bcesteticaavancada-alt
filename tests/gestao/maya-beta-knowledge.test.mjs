import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const folder=dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(readFileSync(resolve(folder,'../../gestao/maya-beta/respostas-65.json'),'utf8'));
const html=readFileSync(resolve(folder,'../../gestao/maya-beta/index.html'),'utf8');
const items=data.items;

test('A biblioteca contém 67 perguntas únicas, todas com resposta e fonte',()=>{
 assert.equal(data.schema,3);
 assert.equal(data.locale,'pt-BR');
 assert.equal(items.length,67);
 assert.equal(new Set(items.map(x=>x.id)).size,67);
 for(const item of items){
  assert.ok(item.question.length>=8,item.id);
  assert.ok(item.answer.length>=30,item.id);
  assert.ok(item.source.length>0,item.id);
  assert.ok(item.triggers.length>=1,item.id);
  assert.ok(item.evidence_level.length>10,item.id);
  assert.ok(item.review_notes.length>10,item.id);
  assert.equal(item.publication_approval,false,item.id);
 }
});
test('Aprovação de conteúdo da Mel mantém publicação bloqueada na Beta interna',()=>{
 assert.equal(data.publication,'beta-interna-revisada');
 assert.equal(data.reviewAuthority,'Mel');
 assert.equal(items.filter(x=>x.audience==='equipe').length,12);
 assert.equal(items.filter(x=>x.audience==='informativo').length,55);
 assert.ok(items.every(x=>x.review==='aprovado'));
 assert.match(html,/Conteúdo revisado pela Mel em 25\/10\/2026/);
});
test('Biblioteca não contém tokens HTML ou campos de cliente',()=>{
 for(const item of items){
  const corpus=item.question+' '+item.answer+' '+item.source;
  assert.doesNotMatch(corpus,/<script|<iframe|onerror\s*=/i,item.id);
  assert.equal(Object.keys(item).filter(k=>k!=='parent_id').sort().join('|'),'answer|audience|evidence_level|id|publication_approval|question|references|research_date|research_notes|review|review_notes|review_source_item|reviewed_at|reviewed_by|source|source_original|triggers',item.id);
  if(item.parent_id)assert.ok(items.some(parent=>parent.id===item.parent_id),item.id);
 }
});
test('Biblioteca é carregada do JSON local sem cache persistente',()=>{
 assert.match(html,/fetch\('\.\/respostas-65\.json',\{cache:'no-store'\}\)/);
 assert.match(html,/response\.json\(\)/);
});
test('Exibição não interpreta respostas como HTML e não publica conteúdo no banco',()=>{
 assert.match(html,/answer\.textContent=knowledgeAnswer\(item\)/);
 assert.match(html,/evidence\.textContent='Contexto do dossiê anterior:/);
 assert.match(html,/a\.rel='noopener noreferrer'/);
 assert.doesNotMatch(html,/\.innerHTML|\.from\(|\.rpc\(|localStorage/);
});

test('52 itens preservam referências históricas sem imporem respostas extensas à revisão da Mel',()=>{
 const information=items.filter(x=>x.references.length>0);
 assert.equal(information.length,52);
 assert.ok(information.every(x=>Array.isArray(x.references)&&x.references.length>0));
 assert.equal(new Set(information.flatMap(x=>x.references)).size,29);
});
test('12 respostas do aplicativo preservam o contexto operacional',()=>{
 const operational=items.filter(x=>x.audience==='equipe');
 assert.equal(operational.length,12);
 assert.ok(operational.every(x=>x.evidence_level.startsWith('Operacional:')));
});
