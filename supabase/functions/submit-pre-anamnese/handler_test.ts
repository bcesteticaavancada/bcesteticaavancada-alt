import {assertEquals} from 'jsr:@std/assert';
import {createPreAnamneseHandler,readLimitedJson,finalizePdf} from './index.ts';

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

Deno.test('gerações concorrentes publicam uma versão imutável do PDF e mantêm seu hash',async()=>{
  let saved: any = null;
  const objects = new Map<string,Uint8Array>();
  const admin={storage:{from:()=>({upload:async(path:string,bytes:Uint8Array,options:any)=>{
    assertEquals(options.upsert,false);
    if(objects.has(path))return {error:{message:'already exists'}};
    objects.set(path,bytes);return {error:null};
  },remove:async(paths:string[])=>{paths.forEach(path=>objects.delete(path));return {error:null};}})},
  from:()=>({update:(value:any)=>({eq:()=>({is:()=>({select:()=>({maybeSingle:async()=>{
    if(saved)return {data:null,error:null};saved=value;return {data:{pdf_path:value.pdf_path},error:null};
  }})})})}),select:()=>({eq:()=>({single:async()=>({data:saved,error:null})})})})};
  const row={id:'ci',public_code:'CI',created_at:'2026-10-18T12:00:00Z',patient_name:'Fictícia',patient_phone:'31900000000',answers:{},consents:{}};
  const paths=await Promise.all([
    finalizePdf(admin,row,new Uint8Array(),async()=>new Uint8Array([1,2,3]),async()=>null),
    finalizePdf(admin,row,new Uint8Array(),async()=>new Uint8Array([4,5,6]),async()=>null),
  ]);
  assertEquals(paths[0],paths[1]);
  assertEquals(objects.size,1);
  const bytes=objects.get(saved.pdf_path)!;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
  assertEquals(saved.pdf_sha256,hash);
  assertEquals(saved.pdf_path.endsWith(`ficha-${hash}.pdf`),true);
});
