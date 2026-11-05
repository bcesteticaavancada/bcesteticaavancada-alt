import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listClientDocumentFeed,
  renderClientDocuments,
  renderClientDocumentsPanel,
  initClientDocumentsPanel,
} from '../../gestao/js/client-documents-panel.js';

function makeClient(){
  const rpcCalls=[];
  return {
    rpcCalls,
    client:{
      async rpc(name,payload){rpcCalls.push([name,payload]);return {data:[{source_kind:'external',source_id:'f1',title:'TCLE GOV',category:'tcle_externo',origin:'gov_br',status:'anexado',document_date:'2026-10-14',created_at:'2026-10-14T12:00:00Z',storage_path:'arquivos-clientes/c1/f.pdf',mime_type:'application/pdf',downloadable:true}],error:null};},
    },
  };
}

test('API lista feed por cliente via RPC dedicada',async()=>{
  const mock=makeClient();
  const rows=await listClientDocumentFeed({client:mock.client,clienteId:'c1'});
  assert.equal(rows.length,1);
  assert.deepEqual(mock.rpcCalls[0],['bc_client_document_feed',{p_cliente_id:'c1'}]);
});

test('render mantém gerar/retry de documentos BC e download individual de emitidos',()=>{
  const html=renderClientDocuments([
    {source_kind:'clinical',source_id:'d1',title:'Consentimento do procedimento',category:'consentimento_procedimento',origin:'bc_gestao',status:'pronto_para_pdf',storage_path:null,downloadable:false},
    {source_kind:'clinical',source_id:'d2',title:'Ficha de atendimento',category:'treatment_record',origin:'bc_gestao',status:'erro_pdf',storage_path:null,downloadable:false},
    {source_kind:'clinical',source_id:'d3',title:'Anamnese Geral',category:'anamnese_geral',origin:'bc_gestao',status:'emitido',storage_path:'documentos/d3.pdf',mime_type:'application/pdf',downloadable:true},
  ]);
  assert.match(html,/data-generate-clinical-document=["']d1["']/);
  assert.match(html,/data-generate-clinical-document=["']d2["']/);
  assert.match(html,/Tentar gerar PDF/i);
  assert.match(html,/data-client-document-download=["']d3["']/);
});

test('arquivo externo recebe download próprio e possibilidade de anulação',()=>{
  const html=renderClientDocuments([{source_kind:'external',source_id:'f1',title:'TCLE assinado',category:'tcle_externo',origin:'gov_br',status:'anexado',storage_path:'arquivos-clientes/c1/f.pdf',mime_type:'application/pdf',downloadable:true}]);
  assert.match(html,/TCLE assinado/);
  assert.match(html,/GOV\.BR|GOV/i);
  assert.match(html,/data-client-document-download=["']f1["']/);
  assert.match(html,/data-client-file-void=["']f1["']/);
});

test('painel oferece upload sem ZIP e com categorias/origens aprovadas',()=>{
  const html=renderClientDocumentsPanel({items:[]});
  assert.match(html,/data-client-file-upload-form/);
  assert.match(html,/type=["']file["']/);
  assert.match(html,/accept=["'][^"']*application\/pdf[^"']*image\/jpeg[^"']*image\/png[^"']*image\/webp/i);
  for(const value of ['tcle_externo','exame_documento_apresentado','documento_digitalizado','relatorio_externo','outro_clinico','gov_br','digitalizado','upload_manual','outro']) assert.ok(html.includes(`value="${value}"`),`faltou ${value}`);
  assert.doesNotMatch(html,/zip|baixar pasta completa/i);
});

test('controller compartilhado existe para hidratação lazy da Central',()=>{
  assert.equal(typeof initClientDocumentsPanel,'function');
});

test('painel tem coleta específica do PDF devolvido, sem integração automática com o GOV',()=>{
  const html=renderClientDocumentsPanel({items:[]});
  assert.match(html,/data-returned-consent/);
  assert.match(html,/name="category" value="tcle_externo"/);
  assert.match(html,/name="origin" value="gov_br"/);
  assert.ok(html.includes('accept=".pdf,application/pdf"'));
  assert.match(html,/revisado pela profissional/);
  assert.doesNotMatch(html,/oauth|token do gov|conectar conta/i);
});
