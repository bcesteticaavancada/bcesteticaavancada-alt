import {financeRpc} from './finance-simple-api.js';
import {createReceiptAttempt} from './receipt-attempt.js';
import {esc,setStatus} from './finance-view.js';
const BUCKET='bc-finance-private';
const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']);
export async function uploadFinanceAttachment({client,kind,entityId,file,attempts,actorId}){
 if(!file||!allowed.has(file.type)||!file.size||file.size>10*1024*1024)throw Error('Selecione PDF ou imagem de até 10 MB.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
 const context=`proof:${actorId}:${kind}:${entityId}`;let key;
 try{
  key=await attempts.get(context,{name:file.name,type:file.type,size:file.size,digest});
  const reserved=await financeRpc(client,'bc_finance_attachment_reserve',{p_kind:kind,p_entity_id:entityId,p_name:file.name,p_mime:file.type,p_size:file.size,p_request_key:key});
  if(!reserved?.id||!reserved?.path)throw Error('Não foi possível preparar o comprovante.');
  const uploaded=await client.storage.from(BUCKET).upload(reserved.path,file,{contentType:file.type,upsert:false});
  // A resposta do upload pode se perder. A conclusão confere o objeto já reservado.
  let completed;try{completed=await financeRpc(client,'bc_finance_attachment_complete',{p_attachment_id:reserved.id});}catch(error){throw uploaded.error?Object.assign(Error(uploaded.error.message||'Não foi possível enviar o comprovante.'),{confirmedFailure:false}):error;}
  const released=attempts.complete(context,key);return {...completed,released};
 }catch(error){if(key)attempts.fail(context,key,error);throw error;}
}
export function installFinanceAttachments({client,profile,root,admin=false,storage}={}){
 if(!root)return null;if(storage===undefined)try{storage=root.ownerDocument.defaultView?.sessionStorage;}catch{}
 const attempts=createReceiptAttempt({storage});let version=0;
 root.addEventListener('click',async event=>{
  const button=event.target.closest?.('[data-proof-open]');if(!button)return;
  const [kind,entityId]=button.dataset.proofOpen.split(':');const current=++version;root.querySelector('[data-finance-proof-panel]')?.remove();
  const host=root.ownerDocument.createElement('section');host.className='bcg-editor-card';host.dataset.financeProofPanel='true';host.innerHTML='<h3>Comprovantes</h3><div data-proof-list></div><p data-proof-status class="bcg-status" role="status"></p>'+(admin?'<form class="bcg-form" data-proof-form><label>Anexar comprovante <span class="bcg-optional">opcional</span><input class="bcg-input" type="file" name="proof" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" required></label><button class="bcg-small-button">Enviar comprovante</button></form>':'')+'<button class="bcg-small-button" type="button" data-proof-close>Fechar</button>';button.closest('article')?.after(host);if(!host.parentNode)root.append(host);
  const status=host.querySelector('[data-proof-status]');const alive=()=>current===version&&root.contains(host);
  host.querySelector('[data-proof-close]').onclick=()=>{++version;host.remove();};
  async function list(){const rows=await financeRpc(client,'bc_finance_attachment_list',{p_kind:kind,p_entity_id:entityId});if(!alive())return;host.querySelector('[data-proof-list]').innerHTML=rows.length?rows.map(row=>`<button class="bcg-small-button" type="button" data-proof-download="${esc(row.id)}">${esc(row.name)}</button>`).join(''):'<p class="bcg-muted">Nenhum comprovante anexado.</p>';return rows;}
  let rows=[];try{rows=await list()||[];}catch(error){if(alive())setStatus(status,error.message,'error');}
  host.addEventListener('click',async e=>{const download=e.target.closest?.('[data-proof-download]');if(!download)return;download.disabled=true;try{const row=rows.find(r=>r.id===download.dataset.proofDownload);if(!row)throw Error('Atualize os comprovantes.');const {data,error}=await client.storage.from(BUCKET).createSignedUrl(row.path,60,{download:row.name});if(error)throw error;if(!alive())return;const a=host.ownerDocument.createElement('a');a.href=data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.click();}catch(error){if(alive())setStatus(status,error.message,'error');}finally{download.disabled=false;}});
  host.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,submit=form.querySelector('button');if(submit.disabled)return;submit.disabled=true;try{const result=await uploadFinanceAttachment({client,kind,entityId,file:form.querySelector('input').files[0],attempts,actorId:profile.user_id});if(!alive())return;form.reset();setStatus(status,result.released?'Comprovante anexado.':'Comprovante anexado. Permita o armazenamento do site antes de enviar outro.','success');try{rows=await list()||[];}catch{setStatus(status,'Comprovante anexado. Atualize a lista para conferir.','success');}}catch(error){if(alive())setStatus(status,`O pagamento continua registrado. ${error.message} Tente enviar somente o comprovante novamente.`,'error');}finally{submit.disabled=false;}});
 });return {destroy(){++version;root.querySelector('[data-finance-proof-panel]')?.remove();}};
}
