import test from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadClientFile,
  getClientFileUrl,
  voidClientFile,
} from '../../gestao/js/client-files-api.js';

function makeClient({rpcResult,signedResult,uploadResult,removeResult}={}){
  const storageCalls=[]; const rpcCalls=[];
  const bucket={
    async upload(...args){storageCalls.push(['upload',...args]);return uploadResult??{data:{path:args[0]},error:null};},
    async remove(...args){storageCalls.push(['remove',...args]);return removeResult??{data:{},error:null};},
    async createSignedUrl(...args){storageCalls.push(['createSignedUrl',...args]);return signedResult??{data:{signedUrl:'https://signed.example/file'},error:null};},
    getPublicUrl(...args){storageCalls.push(['getPublicUrl',...args]);return {data:{publicUrl:'https://public.invalid'}};},
  };
  const client={
    storage:{from(name){storageCalls.push(['from',name]);return bucket;}},
    async rpc(name,payload){rpcCalls.push([name,payload]);return typeof rpcResult==='function'?rpcResult(name,payload):(rpcResult??{data:'file-1',error:null});},
  };
  return {client,storageCalls,rpcCalls};
}

function fakeFile({type='application/pdf',size=4,name='termo.pdf',bytes=[1,2,3,4]}={}){
  return {type,size,name,async arrayBuffer(){return Uint8Array.from(bytes).buffer;}};
}

test('upload valida tipo e limite de 8 MB antes do Storage', async()=>{
  for(const item of [
    {file:null,pattern:/arquivo|selecione/i},
    {file:fakeFile({type:'text/plain'}),pattern:/pdf|jpeg|png|webp/i},
    {file:fakeFile({size:8*1024*1024+1}),pattern:/8\s*mb|tamanho/i},
  ]){
    const mock=makeClient();
    await assert.rejects(()=>uploadClientFile({client:mock.client,clienteId:'c1',file:item.file,title:'Termo',category:'tcle_externo',origin:'gov_br'}),item.pattern);
    assert.equal(mock.storageCalls.length,0);
  }
});

test('upload usa caminho privado por cliente, calcula SHA-256 e não envia autoria', async()=>{
  const mock=makeClient();
  const result=await uploadClientFile({client:mock.client,clienteId:'c1',file:fakeFile(),title:'TCLE assinado',category:'tcle_externo',origin:'gov_br',documentDate:'2026-10-14'});
  const upload=mock.storageCalls.find((call)=>call[0]==='upload');
  assert.equal(mock.storageCalls[0][1],'bc-prontuario-private');
  assert.match(upload[1],/^arquivos-clientes\/c1\/[a-z0-9-]+\.pdf$/i);
  assert.equal(upload[3].upsert,false);
  assert.equal(upload[3].contentType,'application/pdf');
  assert.equal(mock.rpcCalls[0][0],'bc_client_file_register');
  const payload=mock.rpcCalls[0][1];
  assert.equal(payload.p_cliente_id,'c1');
  assert.equal(payload.p_title,'TCLE assinado');
  assert.equal(payload.p_category,'tcle_externo');
  assert.equal(payload.p_origin,'gov_br');
  assert.equal(payload.p_document_date,'2026-10-14');
  assert.equal(payload.p_storage_path,upload[1]);
  assert.equal(payload.p_mime_type,'application/pdf');
  assert.equal(payload.p_size_bytes,4);
  assert.match(payload.p_sha256,/^[0-9a-f]{64}$/);
  assert.equal('p_uploaded_by' in payload,false);
  assert.deepEqual(result,{id:'file-1',storagePath:upload[1]});
});

test('falha ao registrar metadata tenta remover somente o objeto recém-enviado', async()=>{
  const mock=makeClient({rpcResult:()=>({data:null,error:{message:'registro falhou'}})});
  await assert.rejects(()=>uploadClientFile({client:mock.client,clienteId:'c1',file:fakeFile(),title:'Documento',category:'outro_clinico',origin:'upload_manual'}),/registro falhou|registrar/i);
  const upload=mock.storageCalls.find((call)=>call[0]==='upload');
  const remove=mock.storageCalls.find((call)=>call[0]==='remove');
  assert.ok(upload);
  assert.deepEqual(remove?.[1],[upload[1]]);
});

test('download usa URL assinada com nome e nunca URL pública', async()=>{
  const mock=makeClient();
  const url=await getClientFileUrl({client:mock.client,storagePath:'arquivos-clientes/c1/f.pdf',downloadFilename:'TCLE-assinado.pdf'});
  assert.equal(url,'https://signed.example/file');
  assert.ok(mock.storageCalls.some((call)=>call[0]==='createSignedUrl'&&call[2]===300&&call[3]?.download==='TCLE-assinado.pdf'));
  assert.equal(mock.storageCalls.some((call)=>call[0]==='getPublicUrl'),false);
});

test('anulação usa RPC dedicada com motivo e sem exclusão física pelo browser', async()=>{
  const mock=makeClient();
  await voidClientFile({client:mock.client,fileId:'f1',reason:'arquivo anexado por engano'});
  assert.deepEqual(mock.rpcCalls[0],['bc_client_file_void',{p_file_id:'f1',p_reason:'arquivo anexado por engano'}]);
  assert.equal(mock.storageCalls.some((call)=>call[0]==='remove'),false);
});
