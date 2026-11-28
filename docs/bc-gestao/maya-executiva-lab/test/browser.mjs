import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startLab} from '../server.mjs';
const require=createRequire(import.meta.url);
const {chromium,webkit,devices}=require(require.resolve('playwright',{paths:[process.env.MAYA_NODE_MODULES||process.cwd()]}));
const engine=process.argv[2]||'chromium',browser=await ({chromium,webkit})[engine].launch(engine==='chromium'&&process.env.MAYA_CHROMIUM?{executablePath:process.env.MAYA_CHROMIUM,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}:{}),lab=await startLab();
const started=Date.now();
try{
 for(const profile of engine==='webkit'?['iPhone 13']:['Desktop Chrome','Pixel 7']){
  const context=await browser.newContext({...devices[profile],locale:'pt-BR',timezoneId:'America/Sao_Paulo'}),page=await context.newPage(),external=[],audioPosts=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route(/^https?:\/\//,route=>{if(new URL(route.request().url()).origin!==lab.origin){external.push(route.request().url());return route.abort();}if(route.request().method()==='POST'&&route.request().headers()['content-type']?.startsWith('audio/'))audioPosts.push(1);return route.continue();});
  await page.goto(lab.origin+'/#'+lab.issue());await page.locator('#desk').waitFor();
  await page.locator('#example').click();await page.locator('#prepare').click();await page.locator('.card').first().waitFor();
  assert.equal(await page.locator('.card').count(),5);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const card=page.locator('[data-kind="cadastro"]').first();
  const phone=profile==='Pixel 7'?'31900002222':'31900001111';
  if(profile==='Pixel 7'){
   await card.getByRole('button',{name:'Revisar campos'}).click();
   await page.waitForFunction(()=>/Já existe cadastro com esse telefone ou CPF/.test(document.querySelector('#status')?.textContent||''));
   await card.locator('[name="telefone"]').fill(phone);
   await card.locator('input[type=checkbox]').check();
  }
  await card.getByRole('button',{name:'Revisar campos'}).click();await card.getByRole('button',{name:'Voltar e corrigir'}).click();
  await card.locator('[name="telefone"]').fill(phone);
  if(profile==='Pixel 7')await card.locator('input[type=checkbox]').check();
  await card.getByRole('button',{name:'Revisar campos'}).click();await card.getByRole('button',{name:'Confirmar no laboratório'}).click();await card.getByRole('button',{name:'Abrir cadastro'}).click();await page.waitForFunction(()=>/Íris Exemplo/.test(document.querySelector('#client p')?.textContent||''));assert.match(await page.locator('#client p').textContent(),/Íris Exemplo/);
  const att=page.locator('[data-kind="atendimento"]').first();for(const [name,val] of Object.entries({procedimento:'Exemplo',profissional:'Equipe Fictícia',data:'2026-03-10',hora:'11:00'}))await att.locator('[name='+name+']').fill(val);
  await att.getByRole('button',{name:'Revisar campos'}).click();await att.getByRole('button',{name:'Confirmar no laboratório'}).click();await page.getByText('Registrado no laboratório',{exact:true}).nth(1).waitFor();
  const payment=page.locator('[data-kind="recebimento"]').first();await payment.locator('[name=data]').fill('2026-03-10');await payment.locator('[name=conferencia]').selectOption('recebimento_conferido');
  await payment.getByRole('button',{name:'Revisar campos'}).click();await payment.getByRole('button',{name:'Confirmar no laboratório'}).click();await page.getByText('Registrado no laboratório',{exact:true}).nth(2).waitFor();
  const ret=page.locator('[data-kind="agendamento"]').first();await ret.getByRole('button',{name:'Cancelar'}).click();await ret.getByText('Cancelado',{exact:true}).waitFor();
  await page.locator('#history').click();await page.waitForFunction(()=>/Recebimento/.test(document.querySelector('#log')?.innerText||''));assert.match(await page.locator('#log').innerText(),/Recebimento/);
  // Native PDF, image-only PDF and synthetic photos use the real shipped browser engines.
  const metrics=await page.evaluate(async()=>{
   const {readMedia,makePdf,pcm16}=await import('/media.mjs'),{rectify,whole,surface}=await import('/scan.mjs'),{extract}=await import('/extract.mjs');
   const pageCanvas=surface(880,490),c=pageCanvas.getContext('2d');
   c.fillStyle='white';c.fillRect(0,0,880,490);c.fillStyle='black';c.font='34px sans-serif';
   ['FICHA DE TESTE','Nome: Lara Exemplo','Telefone: 31900001234','Valor: R$ 200,00'].forEach((s,i)=>c.fillText(s,55,90+85*i));
   const asFile=async(c,name)=>new File([await new Promise(ok=>c.toBlob(ok,'image/png'))],name,{type:'image/png'});
   const photo=await asFile(pageCanvas,'ficha-ficticia.png'),t=performance.now();const image=await readMedia(photo);const ocrMs=Math.round(performance.now()-t);
   const proposal=extract({message:'Cadastre a cliente',text:image.text,source:image.source})[0];
   if(!proposal.campos.nome||!proposal.campos.telefone)throw Error('OCR cadastro: '+image.text+' '+image.warning);
   const dense=await makePdf([image,image]);const scan=await readMedia(new File([dense],'copia.pdf',{type:'application/pdf'}));
   const pdf=await PDFLib.PDFDocument.create();pdf.addPage([400,200]).drawText('Nome: Lara Exemplo');const digital=await readMedia(new File([await pdf.save()],'digital.pdf',{type:'application/pdf'}));
   const tilt=surface(1050,650),d=tilt.getContext('2d');d.fillStyle='#232323';d.fillRect(0,0,tilt.width,tilt.height);d.translate(100,35);d.transform(1,.08,-.10,1,0,0);d.drawImage(pageCanvas,0,0);
   const skew=await readMedia(await asFile(tilt,'inclinada.png'));if(JSON.stringify(skew.scan.quad)===JSON.stringify(whole()))throw Error('Bordas ausentes');
   const blank=surface(260,140);const illegible=await readMedia(await asFile(blank,'ilegivel.png'));
   const manual=surface(800,320),m=manual.getContext('2d');m.fillStyle='white';m.fillRect(0,0,800,320);m.strokeStyle='#282421';m.lineWidth=3;m.beginPath();m.moveTo(33,150);m.bezierCurveTo(60,20,22,210,96,142);m.bezierCurveTo(143,40,86,215,167,140);m.stroke();
   const stroke=await readMedia(await asFile(manual,'tracos-manuscritos-sinteticos.png'));
   const wav=new Uint8Array(44+16000*2),view=new DataView(wav.buffer);const tag=(i,s)=>s.split('').forEach((ch,j)=>wav[i+j]=ch.charCodeAt(0));tag(0,'RIFF');view.setUint32(4,wav.length-8,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,32000,true);
   const wave=new File([wav],'silencio.wav',{type:'audio/wav'});const pcm=await pcm16(wave),audio=await readMedia(wave,{voice:false});
   return {ocrMs,nome:proposal.campos.nome,telefone:proposal.campos.telefone,ocr:image.source.motor_utilizado,textoPDF:digital.text,scan:scan.source.motor_utilizado,paginas:scan.pages.length,tilt:skew.text,blank:illegible.warning,manuscrito:stroke.warning||stroke.text,pcm:pcm.length,audio:audio.source.motor_utilizado,rotated:rectify(pageCanvas,whole(),1,1.25).width};
  });
  assert.equal(metrics.ocr,'tesseract_wasm_local');assert.equal(metrics.telefone,'31900001234');assert.match(metrics.textoPDF,/Lara Exemplo/);assert.equal(metrics.scan,'pdfjs_tesseract_local');assert.equal(metrics.paginas,2);assert.match(metrics.tilt,/Lara/i);assert.ok(metrics.blank);assert.ok(metrics.manuscrito);assert.equal(metrics.pcm,16000);assert.equal(metrics.audio,'transcricao_manual');assert.ok(metrics.rotated>400);
  // Exercise the file picker, editable OCR evidence and independent original archive.
  const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=700;c.height=220;const d=c.getContext('2d');d.fillStyle='#fff';d.fillRect(0,0,c.width,c.height);d.font='32px sans-serif';d.fillStyle='black';d.fillText('Nome: Lara Exemplo',30,100);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#files').setInputFiles({name:'foto-teste.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('.attachment textarea').waitFor({timeout:70000});await page.locator('#message').fill('Arquive a foto');await page.locator('#kind').selectOption('documento');await page.locator('#prepare').click();
  const doc=page.locator('[data-kind=documento]').last();await doc.locator('[name=cliente_id]').selectOption({index:1});await doc.getByRole('button',{name:'Revisar campos'}).click();await doc.getByRole('button',{name:'Confirmar no laboratório'}).click();await doc.getByText('Registrado no laboratório').waitFor();
  const downloadPromise=page.waitForEvent('download');await page.locator('#pdf').click();assert.equal((await downloadPromise).suggestedFilename(),'maya-scan-copia.pdf');
  await context.setOffline(true);await page.locator('#history').click();await page.waitForFunction(()=>/fetch|network|conex|indisponível|Load failed/i.test(document.querySelector('#status').textContent));await context.setOffline(false);
  assert.deepEqual(external,[]);assert.deepEqual(audioPosts,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,profile,ocrMs:metrics.ocrMs,pdfPages:metrics.paginas,ocrLanguage:'por',foreignRequests:external.length,audioPosts:audioPosts.length,elapsedMs:Date.now()-started}));await context.close();
 }
}finally{await browser.close();lab.close();}
