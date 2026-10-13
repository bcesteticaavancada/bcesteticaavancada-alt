import { generateAnamnesePdf, generateClinicalPdf } from './clinical-documents-api.js';

const INSTALL_KEY='__bcClinicalDocumentGenerationRuntimeInstalled';

export function generatorKindForDocumentType(documentType='') {
  return documentType === 'anamnese_geral' ? 'anamnese' : ['consentimento_procedimento','treatment_record'].includes(documentType) ? 'clinical' : null;
}

export function installClinicalDocumentGenerationRuntime({client,root=document}={}) {
  if(!client||!root||globalThis[INSTALL_KEY]) return globalThis[INSTALL_KEY]||null;
  const click=async(event)=>{
    const button=event.target.closest?.('[data-generate-clinical-document]');
    if(!button)return;
    const documentId=button.dataset.generateClinicalDocument;
    const documentType=button.dataset.documentType||'';
    const kind=generatorKindForDocumentType(documentType);
    if(!documentId||!kind)return;
    button.disabled=true;
    const previous=button.textContent;
    button.textContent='Gerando PDF…';
    try{
      if(kind==='anamnese') await generateAnamnesePdf({client,documentId});
      else await generateClinicalPdf({client,documentId});
      const folder=button.closest?.('[data-client-folder]');
      const runtime=globalThis.__bcClinicalFolderRuntimeInstalled;
      if(folder&&runtime?.hydrateFolder) await runtime.hydrateFolder(folder,true);
      else button.textContent='PDF gerado';
    }catch(error){
      button.disabled=false;
      button.textContent=previous||'Tentar gerar PDF';
      button.title=error?.message||'Não foi possível gerar o PDF.';
    }
  };
  root.addEventListener?.('click',click);
  const runtime={destroy(){root.removeEventListener?.('click',click);delete globalThis[INSTALL_KEY];}};
  globalThis[INSTALL_KEY]=runtime;
  return runtime;
}
