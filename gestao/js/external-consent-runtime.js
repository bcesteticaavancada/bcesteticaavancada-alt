import {getExternalConsent,linkExternalConsent} from './treatment-api.js';

function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
const installed=new WeakMap();

async function enhance({client,folder}){
  const wizard=folder.querySelector?.('[data-treatment-wizard="clinical"][data-treatment-id]');
  if(!wizard||wizard.dataset.externalConsentEnhanced==='true')return;
  wizard.dataset.externalConsentEnhanced='true';
  const treatmentId=wizard.dataset.treatmentId;
  try{
    const linked=await getExternalConsent({client,treatmentId});
    const candidate=folder.__bcPendingExternalConsent||null;
    if(!linked&&!candidate)return;
    const consentStage=wizard.querySelector?.('[data-treatment-consent-stage]')||[...wizard.querySelectorAll?.('.bcg-treatment-stage')||[]].find((node)=>/consentimento/i.test(node.textContent||''));
    if(!consentStage)return;
    const block=wizard.ownerDocument.createElement('div');
    block.dataset.externalConsentRuntime='';
    block.className='bcg-treatment-supplement';
    if(linked){
      block.innerHTML=`<strong>TCLE externo revisado</strong><p>${escapeHtml(linked.file_title||'Documento externo')} foi vinculado a este atendimento pela profissional responsável.</p><p class="bcg-status" data-kind="success">Vínculo compatível com a versão e classe documental desta sessão.</p>`;
    }else{
      block.innerHTML=`<strong>TCLE externo selecionado</strong><p>${escapeHtml(candidate.title||'Documento externo')}</p><p class="bcg-muted">Confirme somente após revisar o documento e verificar que corresponde a esta sessão.</p><button class="bcg-small-button" type="button" data-external-consent-link-confirm="${escapeHtml(candidate.fileId)}">Confirmar vínculo como TCLE externo</button><span class="bcg-status" data-external-consent-status></span>`;
    }
    consentStage.append(block);
  }catch(error){wizard.dataset.externalConsentEnhanced='false';}
}

function ensureInstalled({client,folder}){
  if(installed.has(folder))return installed.get(folder);
  const observer=new MutationObserver(()=>enhance({client,folder}).catch(()=>{}));
  observer.observe(folder,{childList:true,subtree:true});
  const onClick=async(event)=>{
    const button=event.target.closest?.('[data-external-consent-link-confirm]');
    if(!button)return;
    const wizard=button.closest?.('[data-treatment-wizard="clinical"]');
    const treatmentId=wizard?.dataset.treatmentId;
    const status=button.parentElement?.querySelector?.('[data-external-consent-status]');
    button.disabled=true;
    try{
      await linkExternalConsent({client,treatmentId,clientFileId:button.dataset.externalConsentLinkConfirm});
      folder.__bcPendingExternalConsent=null;
      if(status){status.textContent='TCLE externo revisado e vinculado.';status.dataset.kind='success';}
      const reopen=folder.querySelector?.(`[data-treatment-open="${CSS?.escape?CSS.escape(treatmentId):treatmentId}"]`);
      if(reopen)reopen.click();
    }catch(error){if(status){status.textContent=error?.message||'Não foi possível vincular o TCLE externo.';status.dataset.kind='error';}button.disabled=false;}
  };
  folder.addEventListener('click',onClick);
  const runtime={observer,destroy(){observer.disconnect();folder.removeEventListener('click',onClick);installed.delete(folder);}};
  installed.set(folder,runtime);
  enhance({client,folder}).catch(()=>{});
  return runtime;
}

export function activateExternalConsentCandidate({client,folder,fileId,title}){
  if(!client||!folder||!fileId)throw new Error('Contexto do TCLE externo inválido.');
  folder.__bcPendingExternalConsent={fileId:String(fileId),title:String(title||'TCLE externo')};
  ensureInstalled({client,folder});
  folder.querySelector?.('[data-folder-tab="atendimentos"]')?.click?.();
}
