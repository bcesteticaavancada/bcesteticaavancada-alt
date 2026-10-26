import {SUPPORT_FIELDS,getSupportClient,updateSupportClient,inviteSupportCollaborator,downloadSupportDocument,uploadSupportConsent} from './support-api.js';
const LABELS={nome:'Nome completo',telefone:'Telefone',email:'E-mail',cpf:'CPF',data_nascimento:'Nascimento',cep:'CEP',logradouro:'Endereço',numero:'Número',complemento:'Complemento',bairro:'Bairro',cidade:'Cidade',uf:'UF',responsavel_nome:'Nome do responsável',responsavel_cpf:'CPF do responsável',responsavel_parentesco:'Parentesco',responsavel_telefone:'Telefone do responsável'};
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const date=value=>{const d=new Date(value);return Number.isFinite(d.valueOf())?d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';};
function field(key,client){const type=key==='data_nascimento'?'date':key==='email'?'email':'text';return `<label>${LABELS[key]}<input class="bcg-input" name="${key}" type="${type}" maxlength="500" value="${escape(client[key])}" ${['nome','telefone'].includes(key)?'required':''}></label>`;}
function renderClient(client,documents){
  const originals=documents.filter(item=>item.kind==='original'&&item.category==='consentimento_procedimento');
  return `<h3>${escape(client.nome)}</h3><p class="bcg-muted">Cadastro e cópias documentais. As fichas já assinadas permanecem no histórico.</p>
  <form id="supportClientForm" class="bcg-form"><div class="bcg-form-grid bcg-support-fields">${['nome','telefone','email'].map(key=>field(key,client)).join('')}</div><details><summary>Dados complementares</summary><div class="bcg-form-grid bcg-support-fields">${SUPPORT_FIELDS.filter(key=>!['nome','telefone','email'].includes(key)).map(key=>field(key,client)).join('')}</div></details>
  <label>Motivo<select class="bcg-input" name="reason"><option>Correção cadastral</option><option>Apoio urgente</option><option>Apoio documental</option></select></label><button class="bcg-button" type="submit">Salvar cadastro</button><p id="supportSaveStatus" class="bcg-status" role="status" aria-live="polite"></p></form>
  <div class="bcg-divider"></div><h3>Documentos para cópia</h3><p class="bcg-muted">Baixe o PDF para enviar ao cliente. Depois, anexe o arquivo que ele devolver.</p>
  <div class="bcg-support-documents">${documents.length?documents.map(item=>`<article><strong>${escape(item.title)}</strong><span class="bcg-muted">${escape(date(item.created_at))}</span><button class="bcg-small-button" type="button" data-support-download="${escape(item.id)}" data-support-kind="${escape(item.kind)}">Baixar ${item.kind==='returned'?'cópia devolvida':'para enviar'}</button></article>`).join(''):'<p class="bcg-empty">Os PDFs aparecem aqui depois que a profissional e o cliente assinam e a profissional gera o arquivo.</p>'}</div>
  ${originals.length?`<details class="bcg-support-returned"><summary>Anexar consentimento devolvido</summary><form id="supportReturnedForm" class="bcg-form"><label>Consentimento original<select class="bcg-input" name="documentId" required>${originals.map(item=>`<option value="${escape(item.documentId)}">${escape(item.title)} • ${escape(date(item.created_at))}</option>`).join('')}</select></label><label>PDF devolvido pelo cliente<input class="bcg-input" type="file" name="file" accept="application/pdf" required></label><p class="bcg-muted">PDF de até 8 MB. O original será preservado.</p><button class="bcg-button" type="submit">Anexar cópia à ficha</button><p id="supportUploadStatus" class="bcg-status" role="status" aria-live="polite"></p></form></details>`:''}
  <p id="supportDownloadStatus" class="bcg-status" role="status" aria-live="polite"></p>`;
}

export function initSupportPanel({client,root=document,onChanged=()=>{}}={}){
  const el=id=>root.getElementById(id),dialog=el('supportClientDialog'),body=el('supportClientBody');
  let version=0,context=null;
  const showStatus=(id,message)=>{const node=el(id);if(node)node.textContent=message;};
  const current=selected=>context===selected&&dialog.hasAttribute('open');
  async function openClient(clientId){
    const selected={clientId,version:++version,client:null,documents:[]};context=selected;body.textContent='Carregando cadastro…';
    if(!dialog.hasAttribute('open'))dialog.showModal();
    try{const result=await getSupportClient({client,clientId});if(!current(selected)||selected.version!==version)return;selected.client=result.client;selected.documents=result.documents||[];body.innerHTML=renderClient(selected.client,selected.documents);}
    catch(error){if(current(selected)){body.textContent=error?.message||'Não foi possível abrir o cadastro.';}}
  }
  dialog.addEventListener('close',()=>{++version;context=null;body.replaceChildren();});
  el('supportClientClose').addEventListener('click',()=>dialog.close());
  root.addEventListener('click',event=>{const button=event.target.closest?.('[data-support-client]');if(button){event.preventDefault();openClient(button.dataset.supportClient);}});
  body.addEventListener('submit',async event=>{
    const form=event.target;if(!['supportClientForm','supportReturnedForm'].includes(form.id))return;event.preventDefault();
    const selected=context;if(!selected?.client)return;const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;
    const upload=form.id==='supportReturnedForm',statusId=upload?'supportUploadStatus':'supportSaveStatus';showStatus(statusId,upload?'Anexando cópia…':'Salvando cadastro…');
    try{
      const data=new FormData(form);
      if(upload){
        await uploadSupportConsent({client,clientId:selected.clientId,documentId:data.get('documentId'),file:data.get('file')});
        if(current(selected)){await openClient(selected.clientId);showStatus('supportDownloadStatus','Cópia anexada. O documento original foi preservado.');}
      }else{
        const patch=Object.fromEntries(SUPPORT_FIELDS.map(key=>[key,String(data.get(key)??'')]));
        const result=await updateSupportClient({client,clientId:selected.clientId,expectedUpdatedAt:selected.client.updated_at,patch,reason:String(data.get('reason')||'Correção cadastral')});
        if(current(selected)){selected.client=result.client;body.querySelector('h3').textContent=result.client.nome;showStatus(statusId,'Cadastro salvo.');}
      }
      await onChanged();
    }catch(error){if(current(selected))showStatus(statusId,error?.message||'Não foi possível concluir.');}
    finally{submit.disabled=false;}
  });
  body.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-support-download]');const selected=context;if(!button||!selected?.client||button.disabled)return;button.disabled=true;
    try{
      const file=await downloadSupportDocument({client,clientId:selected.clientId,documentId:button.dataset.supportDownload,kind:button.dataset.supportKind});
      if(!current(selected))return;const anchor=root.createElement('a');anchor.href=file.url;anchor.download=file.filename;anchor.rel='noopener';anchor.hidden=true;root.body.append(anchor);anchor.click();anchor.remove();showStatus('supportDownloadStatus','Download preparado. Envie o arquivo ao cliente pelo canal de costume.');
    }catch(error){if(current(selected))showStatus('supportDownloadStatus',error?.message||'Não foi possível baixar.');}
    finally{button.disabled=false;}
  });
  const invite=el('supportInviteForm');
  invite.addEventListener('submit',async event=>{
    event.preventDefault();const submit=invite.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;showStatus('supportInviteStatus','Enviando convite…');
    try{const data=new FormData(invite);await inviteSupportCollaborator({client,name:data.get('name'),email:data.get('email')});invite.reset();showStatus('supportInviteStatus','Convite enviado. A colaboradora define a própria senha; a Mel configura as liberações profissionais.');await onChanged();}
    catch(error){showStatus('supportInviteStatus',error?.message||'Não foi possível enviar o convite.');}
    finally{submit.disabled=false;}
  });
  return {openClient};
}
