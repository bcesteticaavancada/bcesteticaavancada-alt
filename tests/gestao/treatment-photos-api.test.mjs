import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listTreatmentPhotos,
  uploadTreatmentPhoto,
  voidTreatmentPhoto,
  getTreatmentPhotoUrl,
} from '../../gestao/js/treatment-photos-api.js';

function makeClient({ uploadResult, signedResult, rpcResult } = {}) {
  const storageCalls=[]; const rpcCalls=[];
  const bucket={
    async upload(...args){ storageCalls.push(['upload',...args]); return uploadResult ?? {data:{path:args[0]},error:null}; },
    async createSignedUrl(...args){ storageCalls.push(['createSignedUrl',...args]); return signedResult ?? {data:{signedUrl:'https://signed.example/clinical'},error:null}; },
    getPublicUrl(...args){ storageCalls.push(['getPublicUrl',...args]); return {data:{publicUrl:'https://public.invalid'}}; },
  };
  return {storageCalls,rpcCalls,client:{
    storage:{from(name){storageCalls.push(['from',name]); return bucket;}},
    async rpc(name,payload={}){rpcCalls.push([name,payload]); return typeof rpcResult==='function'?rpcResult(name,payload):(rpcResult ?? {data:name==='bc_treatment_photo_list'?[]:'photo-1',error:null});},
  }};
}

function fakeFile({type='image/jpeg',size=1024,name='foto.jpg'}={}){return {type,size,name};}

test('upload clínico valida arquivo/tipo antes do Storage', async()=>{
  for (const input of [
    {file:null,pattern:/selecione|imagem/i},
    {file:fakeFile({type:'application/pdf'}),pattern:/jpeg|png|webp|imagem/i},
    {file:fakeFile({size:8*1024*1024+1}),pattern:/8\s*mb|tamanho/i},
  ]) {
    const mock=makeClient();
    await assert.rejects(()=>uploadTreatmentPhoto({client:mock.client,treatmentId:'t1',clienteId:'c1',kind:'antes',file:input.file}),input.pattern);
    assert.equal(mock.storageCalls.length,0);
  }
  const mock=makeClient();
  await assert.rejects(()=>uploadTreatmentPhoto({client:mock.client,treatmentId:'t1',clienteId:'c1',kind:'lado',file:fakeFile()}),/antes|depois|adicional|classifica/i);
  assert.equal(mock.storageCalls.length,0);
});

test('upload usa bucket privado e caminho cliente/atendimento, depois registra metadados no RPC', async()=>{
  const mock=makeClient();
  const result=await uploadTreatmentPhoto({client:mock.client,treatmentId:'t1',clienteId:'c1',kind:'antes',region:'face',view:'frontal',caption:'baseline',capturedAt:'2026-10-13T12:00:00-03:00',file:fakeFile()});
  const upload=mock.storageCalls.find((c)=>c[0]==='upload');
  assert.equal(mock.storageCalls[0][1],'bc-prontuario-private');
  assert.match(upload[1],/^fotos-clinicas\/c1\/t1\/[a-z0-9-]+\.jpg$/i);
  assert.equal(upload[3].upsert,false);
  assert.equal(upload[3].contentType,'image/jpeg');
  assert.deepEqual(mock.rpcCalls[0][0],'bc_treatment_photo_register');
  assert.deepEqual(mock.rpcCalls[0][1],{
    p_treatment_id:'t1',p_storage_path:upload[1],p_mime_type:'image/jpeg',p_size_bytes:1024,p_kind:'antes',
    p_region:'face',p_view:'frontal',p_caption:'baseline',p_captured_at:'2026-10-13T12:00:00-03:00',
  });
  assert.equal(result.photoId,'photo-1');
});

test('listar e anular usam somente RPCs clínicos dedicados', async()=>{
  const mock=makeClient({rpcResult:(name)=>({data:name==='bc_treatment_photo_list'?[{id:'p1'}]:'p1',error:null})});
  assert.deepEqual(await listTreatmentPhotos({client:mock.client,treatmentId:'t1'}),[{id:'p1'}]);
  await voidTreatmentPhoto({client:mock.client,photoId:'p1',reason:'upload incorreto'});
  assert.deepEqual(mock.rpcCalls[0],['bc_treatment_photo_list',{p_treatment_id:'t1'}]);
  assert.deepEqual(mock.rpcCalls[1],['bc_treatment_photo_void',{p_photo_id:'p1',p_reason:'upload incorreto'}]);
});

test('preview privado usa createSignedUrl e nunca getPublicUrl', async()=>{
  const mock=makeClient();
  const url=await getTreatmentPhotoUrl({client:mock.client,storagePath:'fotos-clinicas/c1/t1/p.jpg'});
  assert.equal(url,'https://signed.example/clinical');
  assert.ok(mock.storageCalls.some((c)=>c[0]==='createSignedUrl'&&c[2]===300));
  assert.equal(mock.storageCalls.some((c)=>c[0]==='getPublicUrl'),false);
});
