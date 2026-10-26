import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
const bank=read('gestao/maya-beta/respostas-65.json');
const audit=read('docs/bc-gestao/maya-mel-aprovacao-2026-10-25.json');
const byId=id=>bank.items.find(item=>item.id===id);
const sha=value=>createHash('sha256').update(value).digest('hex');

test('Documento da Mel aprova 65 itens e dois complementos, sem autorizar publicação',()=>{
 assert.equal(audit.source.sha256,'54832998ef2b37da0d788bc1cb629a7ce5fe100369401f3af861604d80f4d8ff');
 assert.equal(audit.original_items,65);assert.equal(audit.complementary_items,2);
 assert.equal(bank.items.length,67);
 assert.deepEqual(bank.reviewSource,audit.source);
 assert.equal(bank.reviewSource.scope,'conteudo');
 assert.equal(bank.reviewSource.publication_approval,false);
 for(const item of bank.items){
  assert.equal(item.review,'aprovado',item.id);
  assert.equal(item.reviewed_by,'Mel',item.id);
  assert.equal(item.reviewed_at,'2026-10-25',item.id);
  assert.equal(item.publication_approval,false,item.id);
 }
});
test('Textos incorporados correspondem aos 67 pareceres com a única correção editorial registrada',()=>{
 assert.equal(audit.items.length,67);
 assert.equal(new Set(audit.items.map(x=>x.source_item)).size,67);
 assert.equal(audit.editorial_corrections.length,1);
 assert.equal(audit.editorial_corrections[0].source_item,'04');
 for(const approved of audit.items){
  const item=byId(approved.id);assert.ok(item,approved.id);
  assert.equal(item.review_source_item,approved.source_item,approved.id);
  assert.equal(sha(item.question),approved.question_sha256,approved.id+' pergunta');
  assert.equal(sha(item.answer),approved.answer_sha256,approved.id+' texto final');
 }
});
test('Complementos mantêm vínculo com dor no Botox e massagem desportiva',()=>{
 assert.equal(byId('botox-conforto')?.parent_id,'botox-dor');
 assert.equal(byId('massagem-desportiva-agendamento')?.parent_id,'massagem-desportiva');
 assert.match(byId('massagem-desportiva-agendamento').answer,/BC não realiza massagem desportiva/);
});
test('Horário e confirmação refletem a revisão, sem reintroduzir disponibilidade em tempo real',()=>{
 for(const id of ['agendamento-horarios','app-agenda-expediente']){
  assert.match(byId(id).answer,/terça a sábado, das 9h às 19h/);
  assert.match(byId(id).answer,/WhatsApp/);
  assert.doesNotMatch(byId(id).answer,/segunda a sábado|último início.*18h/);
 }
 assert.match(byId('agendamento-horarios').answer,/não consigo ver a agenda em tempo real/);
 assert.match(byId('contato').answer,/só vale como agendado depois dessa confirmação/);
});
test('Diretrizes editoriais preservam respostas da Mel sem travessões ou termo removido',()=>{
 for(const item of bank.items){
  assert.doesNotMatch(item.question+' '+item.answer,/—|masseter/i,item.id);
 }
 assert.doesNotMatch(byId('microagulhamento').answer,/acne\. Mo/);
 assert.match(byId('app-dados-chat').answer,/não envie exames/i);
 assert.match(byId('produto-seguro').answer,/somente com produtos regularizados na Anvisa/);
});
