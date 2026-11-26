import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {submit} from '../../scripts/operations/indexnow.mjs';

const url='https://www.bcesteticaavancada.com.br/clinica/';
const key='344fc1cd179648fe8495ce927331cad2';
const hash=createHash('sha256').update('conteúdo').digest('hex');
function fixture(page,code=200,verification=key) {
  const sent=[];
  return {sent,request:async(uri,options)=>{
    if (options.method==='POST') {sent.push(JSON.parse(options.body));return new Response('',{status:202});}
    if(uri.endsWith('.txt'))return new Response(verification);
    return new Response(page,{status:code});
  }};
}
test('diferença vazia não faz requisições e uma revisão publicada envia apenas a URL esperada',async()=>{
  assert.equal(await submit([],()=>assert.fail()),0);
  const fx=fixture('conteúdo');assert.equal(await submit([{url,hash}],fx.request),202);
  assert.deepEqual(fx.sent[0].urlList,[url]);
});
test('chave, HTML divergente, remoção não publicada ou recurso divergente bloqueiam todo o lote',async()=>{
  for(const [fx,pages] of [[fixture('antigo'),[{url,hash}]],[fixture('ok',200,'incorreta'),[{url,hash}]],
    [fixture('ainda existe'),[{url,kind:'removida'}]],[fixture('conteúdo'),[{url,hash,assets:[[url+'imagem.webp','inexistente']]}]]]){
    await assert.rejects(submit(pages,fx.request));assert.equal(fx.sent.length,0);
  }
  const fx=fixture('ausente',410);assert.equal(await submit([{url,kind:'removida'}],fx.request),202);
});
