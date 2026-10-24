import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {renderClientFolder} from '../../gestao/js/clientes-folder.js';
import {initPreAnamneseInbox} from '../../gestao/js/pre-anamnese-inbox.js';
test('pasta administrativa abre pré-anamneses contextuais sem vincular automaticamente',async()=>{
 const record={id:'c1',nome:'Cliente fictícia',telefone:'31900000000'};assert.match(renderClientFolder({client:record,canArchive:true}),/data-client-intakes/);assert.doesNotMatch(renderClientFolder({client:record}),/data-client-intakes/);
 const {document}=parseHTML('<html><body><div id="preAnamneseInbox"></div></body></html>');let links=0;const client={from(){return {select(){return this},eq(){return this},order:async()=>({data:[record],error:null})}},rpc:async name=>{if(name==='bc_pre_anamnese_link')links++;return {data:[{id:'i1',patient_name:record.nome,patient_phone:record.telefone,procedure:'Avaliação',status:'recebida',pdf_path:'private.pdf'}],error:null}}};
 const panel=await initPreAnamneseInbox({client,root:document});await panel.setClientContext(record);assert.equal(links,0);assert.match(document.body.textContent,/Revisei a ficha e confirmo o vínculo/);assert.equal(document.querySelector('select').value,undefined);
});
