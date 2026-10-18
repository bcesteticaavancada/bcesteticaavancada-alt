import {assertEquals} from 'jsr:@std/assert';
import {createPreAnamneseHandler,readLimitedJson} from './index.ts';

Deno.test('recepção rejeita método/origem/payload antes de consultar a base',async()=>{
  const handler=createPreAnamneseHandler(()=>{throw new Error('Não deve consultar banco');});
  assertEquals((await handler(new Request('https://example.invalid',{method:'GET'}))).status,405);
  assertEquals((await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://invalid.example'},body:'{}'}))).status,403);
  assertEquals((await handler(new Request('https://example.invalid',{method:'POST',body:'{}'}))).status,422);
});

Deno.test('corpo sem Content-Length também respeita limite real',async()=>{
  const request=new Request('https://example.invalid',{method:'POST',body:'a'.repeat(3_000_001)});
  let message='';try{await readLimitedJson(request);}catch(error){message=(error as Error).message;}
  assertEquals(message,'payload_too_large');
});

Deno.test('reenvio com o mesmo token e outros dados não devolve PDF anterior',async()=>{
  const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const view=new DataView(png.buffer);view.setUint32(16,320);view.setUint32(20,190);
  Deno.env.set('PUBLIC_AGENDA_RATE_LIMIT_SALT','salt-exclusivo-de-teste-ficticio');
  const admin={rpc:async()=>({data:true,error:null}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{submission_hash:'hash-diferente',pdf_path:'privado.pdf'},error:null})})})})};
  const handler=createPreAnamneseHandler(()=>admin as never);
  const response=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({patient:{name:'Pessoa fictícia',cpf:'52998224725',birthDate:'1990-01-01',age:36,phone:'31900000000'},procedure:'Teste',answers:{},consents:{truthful:true,dataProcessing:true,dataAuthorization:true},signatureDataUrl:'data:image/png;base64,'+btoa(String.fromCharCode(...png)),sourceVersion:'ci',submissionToken:'ci-token-000000000000'})}));
  assertEquals(response.status,409);
  assertEquals('pdfUrl' in await response.json(),false);
});
