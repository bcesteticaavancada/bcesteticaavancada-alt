import { uploadClientFile, getClientFileUrl, voidClientFile } from './client-files-api.js';
import { getClinicalDocumentUrl, buildClinicalPdfDownloadFilename } from './clinical-documents-api.js';

function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function fail(error,fallback){if(error)throw error instanceof Error?error:new Error(error?.message||fallback);}
function statusLabel(status){return status==='emitido'?'PDF emitido':status==='gerando_pdf'?'Gerando PDF':status==='pronto_para_pdf'?'Pronto para PDF':status==='erro_pdf'?'Erro no PDF':status==='anexado'?'Anexado':String(status||'');}
function originLabel(origin){return origin==='gov_br'?'GOV.BR':origin==='digitalizado'?'Digitalizado':origin==='upload_manual'?'Upload manual':origin==='bc_gestao'?'BC Gestão':'Outro';}
function extensionForMime(mime){return mime==='application/pdf'?'pdf':mime==='image/jpeg'?'jpg':mime==='image/png'?'png':mime==='image/webp'?'webp':'bin';}
function safeFilename(title,mime){const base=String(title||'documento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'documento';const ext=extensionForMime(mime);return base.toLowerCase().endsWith(`.${ext}`)?base:`${base}.${ext}`;}

export async function listClientDocumentFeed({client,clienteId}){
  if(!client||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');
  const {data,error}=await client.rpc('bc_client_document_feed',{p_cliente_id:required(clienteId,'Cliente')});
  fail(error,'Não foi possível carregar os documentos da cliente.');
  return data??[];
}

export function renderClientDocuments(items=[]){
  if(!items.length)return '<div class="bcg-empty">Nenhum documento registrado para esta cliente.</div>';
  return `<div class="bcg-clinical-documents">${items.map((item)=>{
    const source=item.source_kind||'clinical';
    const id=item.source_id||item.id||'';
    let action='';
    if(source==='clinical'&&item.status==='pronto_para_pdf'){
      action=`<button class="bcg-small-button" type="button" data-generate-clinical-document="${escapeHtml(id)}" data-document-type="${escapeHtml(item.category||'')}">Gerar PDF</button>`;
    }else if(source==='clinical'&&item.status==='erro_pdf'){
      action=`<button class="bcg-small-button" type="button" data-generate-clinical-document="${escapeHtml(id)}" data-document-type="${escapeHtml(item.category||'')}">Tentar gerar PDF</button>`;
    }else if(item.downloadable&&item.storage_path){
      action=`<button class="bcg-small-button" type="button" data-client-document-download="${escapeHtml(id)}" data-source-kind="${escapeHtml(source)}">Baixar</button>`;
    }
    const voidAction=source==='external'?`<button class="bcg-small-button" type="button" data-client-file-void="${escapeHtml(id)}">Anular</button>`:'';
    return `<article class="bcg-document-card" data-client-document-id="${escapeHtml(id)}" data-source-kind="${escapeHtml(source)}"><div><strong>${escapeHtml(item.title||'Documento')}</strong><span>${escapeHtml(originLabel(item.origin))}${item.document_date?` • ${escapeHtml(String(item.document_date).split('-').reverse().join('/'))}`:''}</span></div><span class="bcg-chip">${escapeHtml(statusLabel(item.status))}</span><div class="bcg-actions">${action}${voidAction}</div></article>`;
  }).join('')}</div>`;
}

export function renderClientDocumentsPanel({items=[]}={}){
  return `<div class="bcg-client-documents-panel" data-client-documents-panel>
    <p class="bcg-eyebrow">DOCUMENTOS</p>
    <h3>Pasta documental da cliente</h3>
    <p class="bcg-muted">Documentos privados da BC e arquivos externos. Cada item pode ser baixado individualmente.</p>
    <details class="bcg-treatment-card"><summary>Anexar documento</summary>
      <form class="bcg-form bcg-form-grid" data-client-file-upload-form>
        <label class="bcg-field-wide">Título<input class="bcg-input" name="title" required></label>
        <label>Categoria<select class="bcg-input" name="category" required>
          <option value="">Selecione</option>
          <option value="tcle_externo">TCLE assinado externamente</option>
          <option value="exame_documento_apresentado">Exame / documento apresentado</option>
          <option value="documento_digitalizado">Documento digitalizado</option>
          <option value="relatorio_externo">Relatório externo</option>
          <option value="outro_clinico">Outro documento clínico</option>
        </select></label>
        <label>Origem<select class="bcg-input" name="origin" required>
          <option value="upload_manual">Upload manual</option>
          <option value="gov_br">GOV.BR</option>
          <option value="digitalizado">Digitalizado</option>
          <option value="outro">Outro</option>
        </select></label>
        <label>Data do documento <span class="bcg-optional">opcional</span><input class="bcg-input" name="document_date" type="date"></label>
        <label class="bcg-field-wide">Arquivo<input class="bcg-input" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></label>
        <div class="bcg-form-actions bcg-field-wide"><button class="bcg-button" type="submit">Anexar documento</button><span class="bcg-status" data-client-file-upload-status role="status" aria-live="polite"></span></div>
      </form>
    </details>
    <div data-client-documents-list>${renderClientDocuments(items)}</div>
  </div>`;
}

function setStatus(root,message,kind=''){
  const node=root?.querySelector?.('[data-client-file-upload-status]');
  if(!node)return;
  node.textContent=message||'';
  node.dataset.kind=kind;
}

function triggerDownload(root,url,filename){
  const doc=root?.ownerDocument||globalThis.document;
  if(!doc?.createElement)return;
  const anchor=doc.createElement('a');
  anchor.href=url;
  anchor.download=filename||'';
  anchor.rel='noopener';
  anchor.hidden=true;
  doc.body?.append?.(anchor);
  anchor.click?.();
  anchor.remove?.();
}

export function initClientDocumentsPanel({client,root,getClientRecord,refresh}={}){
  if(!client||!root)throw new Error('Contexto documental inválido.');
  let items=[];
  const clientRecord=()=>getClientRecord?.()||root.closest?.('[data-client-folder]')?.__bcClientRecord||{};

  async function hydrate(){
    const clienteId=clientRecord()?.id;
    if(!clienteId)return [];
    items=await listClientDocumentFeed({client,clienteId});
    root.innerHTML=renderClientDocumentsPanel({items});
    return items;
  }

  root.addEventListener?.('submit',async(event)=>{
    const form=event.target.closest?.('[data-client-file-upload-form]');
    if(!form)return;
    event.preventDefault();
    const submit=form.querySelector?.('[type="submit"]');
    if(submit)submit.disabled=true;
    setStatus(root,'Enviando…');
    try{
      const data=new FormData(form);
      await uploadClientFile({
        client,
        clienteId:clientRecord().id,
        file:data.get('file'),
        title:data.get('title'),
        category:data.get('category'),
        origin:data.get('origin'),
        documentDate:data.get('document_date'),
      });
      await hydrate();
      await refresh?.();
    }catch(error){setStatus(root,error?.message||'Não foi possível anexar o documento.','error');}
    finally{if(submit)submit.disabled=false;}
  });

  root.addEventListener?.('click',async(event)=>{
    const download=event.target.closest?.('[data-client-document-download]');
    if(download){
      const item=items.find((entry)=>String(entry.source_id)===String(download.dataset.clientDocumentDownload));
      if(!item)return;
      download.disabled=true;
      try{
        if(item.source_kind==='external'){
          const filename=safeFilename(item.title,item.mime_type);
          const url=await getClientFileUrl({client,storagePath:item.storage_path,downloadFilename:filename});
          triggerDownload(root,url,filename);
        }else{
          const filename=buildClinicalPdfDownloadFilename(clientRecord()?.nome,item.created_at||item.document_date);
          const url=await getClinicalDocumentUrl({client,storagePath:item.storage_path,downloadFilename:filename});
          triggerDownload(root,url,filename);
        }
      }finally{download.disabled=false;}
      return;
    }

    const voidButton=event.target.closest?.('[data-client-file-void]');
    if(voidButton){
      const promptFn=root?.ownerDocument?.defaultView?.prompt||globalThis.prompt;
      const reason=typeof promptFn==='function'?promptFn('Informe o motivo da anulação deste documento:'):null;
      if(!String(reason??'').trim())return;
      voidButton.disabled=true;
      try{await voidClientFile({client,fileId:voidButton.dataset.clientFileVoid,reason});await hydrate();await refresh?.();}
      finally{voidButton.disabled=false;}
    }
  });

  return {hydrate,getItems:()=>[...items]};
}
