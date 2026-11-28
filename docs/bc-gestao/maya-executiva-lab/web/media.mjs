import {identify,MAX_BYTES} from './media-format.mjs';
import {loadPhoto,corners,rectify,surface} from './scan.mjs';
const modules=new Map();
function script(path){
 if(!modules.has(path))modules.set(path,new Promise((ok,fail)=>{const s=document.createElement('script');s.src=path;s.onload=ok;s.onerror=()=>{modules.delete(path);fail(Error('Motor local indisponível.'));};document.head.append(s);}));
 return modules.get(path);
}
export async function hash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
export async function textSource(text){return {modalidade:'texto',mime_type:'text/plain',sha256_arquivo:await hash(new TextEncoder().encode(text)),motor_utilizado:'parser_texto_local',processado_100_local:true,confianca_global:null};}
const withDeadline=async(promise,ms)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tempo de leitura excedido. Confira manualmente.')),ms);})]);}finally{clearTimeout(timer);}};
async function ocr(canvas){
 await script('/assets/ocr.js');
 // All three paths are explicit. Tesseract would otherwise choose public CDNs.
 const local=name=>new URL('/assets/'+name,location.origin).href;
 const worker=await withDeadline(Tesseract.createWorker('por',1,{workerPath:local('ocr-worker.js'),workerBlobURL:false,corePath:local('tesseract-core-lstm.js'),langPath:local(''),cacheMethod:'none',gzip:true}),45000);
 try{const {data}=await withDeadline(worker.recognize(canvas),60000);return {text:data.text.trim().slice(0,16000),confidence:data.confidence/100};}finally{await worker.terminate();}
}
export async function pcm16(file){
 const ctx=new OfflineAudioContext(1,1,16000),decoded=await ctx.decodeAudioData(await file.arrayBuffer());
 if(decoded.duration>60||decoded.duration<=0)throw Error('Use um áudio de até 60 segundos.');
 const render=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=render.createBufferSource();
 source.buffer=decoded;source.connect(render.destination);source.start();return (await render.startRendering()).getChannelData(0);
}
async function recognize(audio){
 await script('/assets/vosk.js');
 const model=new Vosk.Model(new URL('/assets/voz-pt.tar.gz',location.origin).href,-1);
 try{
  await withDeadline(new Promise((ok,fail)=>{model.on('load',m=>m.result?ok():fail(Error('Modelo de voz indisponível.')));model.on('error',()=>fail(Error('Modelo de voz indisponível.')));}),75000);
  const rec=new model.KaldiRecognizer(16000),parts=[];
  try{return await withDeadline(new Promise((resolve,reject)=>{
   let finishing=false;
   const reply=m=>{if(m.event==='result'&&m.result?.text)parts.push(m.result.text);if(finishing){resolve(parts.join(' ').trim());return;}finishing=true;rec.retrieveFinalResult();};
   rec.on('result',reply);rec.on('partialresult',reply);rec.on('error',()=>reject(Error('Áudio ilegível.')));
   rec.acceptWaveformFloat(audio,16000);
  }),60000);}finally{rec.remove();}
 }finally{model.terminate();}
}
export function recorderMime(){return ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(m=>globalThis.MediaRecorder?.isTypeSupported(m))||'';}
export async function readMedia(file,{voice=false,status=()=>{}}={}){
 if(!file.size||file.size>MAX_BYTES)throw Error('Selecione um arquivo de até 8 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),mime=identify(bytes,file.type),checksum=await hash(bytes);
 const source={modalidade:'fotografia',mime_type:mime,sha256_arquivo:checksum,motor_utilizado:'conferencia_manual',processado_100_local:true,confianca_global:null};
 const result={file,source,pages:[],text:'',warning:''};
 if(mime.startsWith('audio/')){
  Object.assign(source,{modalidade:'audio',motor_utilizado:'transcricao_manual'});
  if(!voice){result.warning='Áudio disponível para ouvir. O modelo local de voz está ausente. Digite a transcrição.';return result;}
  try{result.text=await recognize(await pcm16(file));source.motor_utilizado='vosk_wasm_local';if(!result.text)result.warning='Fala não reconhecida. Confira manualmente.';}catch{result.warning='A voz local ficou indisponível. Ouça e transcreva no aparelho.';}
  return result;
 }
 if(mime.startsWith('image/')){
  const original=await loadPhoto(file,bytes,mime);result.scan={original,quad:corners(original),turns:0,contrast:1};
  result.copy=rectify(original,result.scan.quad);
  try{const r=await ocr(result.copy);result.text=r.text;source.motor_utilizado='tesseract_wasm_local';source.confianca_global=r.confidence;
  if(r.confidence<.70||!r.text)result.warning='Leitura incerta. Confira a foto e preencha os campos legíveis.';}catch{result.warning='OCR local indisponível. Você pode conferir a foto e digitar.';}
  result.pages=[result.text];return result;
 }
 const pdfjs=await import('/assets/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/assets/pdf.worker.mjs';
 const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,useSystemFonts:true,disableFontFace:true,maxImageSize:8000000,stopAtErrors:true,useWorkerFetch:false,wasmUrl:new URL('/assets/pdf-wasm/',location.origin).href});
 try{
  const pdf=await withDeadline(task.promise,30000);if(pdf.numPages>20)throw Error('Use um PDF de até 20 páginas.');
  if(await pdf.getJSActions()||await pdf.getAttachments())throw Error('Documento com conteúdo incorporado. Separe uma cópia simples para conferência.');
  let usedOCR=false;
  for(let i=1;i<=pdf.numPages;i++){status('Lendo página '+i+' de '+pdf.numPages+'…');const page=await pdf.getPage(i);
   if(await page.getJSActions())throw Error('Página com ação incorporada. Documento em quarentena.');
   const content=await page.getTextContent();let plain=content.items.map(it=>(it.str||'')+(it.hasEOL?'\n':' ')).join('').trim();
   if(!plain){usedOCR=true;const raw=page.getViewport({scale:1}),scale=Math.min(2,1350/Math.max(raw.width,raw.height)),view=page.getViewport({scale});
    const canvas=surface(Math.max(1,Math.ceil(view.width)),Math.max(1,Math.ceil(view.height)));
    await withDeadline(page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise,25000);
    const r=await ocr(canvas);plain=r.text;if(!plain||r.confidence<.7)result.warning='Há página com leitura incerta. Confira o original.';
   }
   result.pages.push(plain.slice(0,16000));page.cleanup();
  }
  source.modalidade=usedOCR?'pdf_digitalizado':'pdf_texto_nativo';source.motor_utilizado=usedOCR?'pdfjs_tesseract_local':'pdfjs_nativo_local';
  result.text=result.pages.join('\n').slice(0,16000);return result;
 }finally{await task.destroy();}
}
export async function redoScan(item){const s=item.scan;item.copy=rectify(s.original,s.quad,s.turns,s.contrast);const r=await ocr(item.copy);item.text=r.text;item.pages=[r.text];item.source.motor_utilizado='tesseract_wasm_local';item.source.confianca_global=r.confidence;item.warning=r.confidence<.7?'Confira o texto na imagem.':'';}
export async function makePdf(items){
 await script('/assets/pdf-lib.min.js');const pdf=await PDFLib.PDFDocument.create();
 for(const item of items){const c=item.copy;if(!c)continue;const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',.87));if(!blob)throw Error('Falha ao criar a cópia.');
  const img=await pdf.embedJpg(await blob.arrayBuffer()),scale=555/Math.max(c.width,c.height),w=c.width*scale,h=c.height*scale;
  pdf.addPage([w,h]).drawImage(img,{x:0,y:0,width:w,height:h});}
 if(!pdf.getPageCount())throw Error('Adicione fotos ao scanner.');return new Blob([await pdf.save()],{type:'application/pdf'});
}
