import { getClient } from './clientes-api.js';
import { listClientTreatments } from './treatment-api.js';
import { renderTreatmentPanel, renderTreatmentHistory, initTreatmentController } from './treatment-panel.js';

const openingVersions=new WeakMap();
const INSTALL_KEY='__bcAgendaTreatmentBridgeInstalled';

function escapeHtml(value){
  return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function unwrap(result,fallback='Não foi possível abrir o prontuário clínico.'){if(result?.error)throw result.error instanceof Error?result.error:new Error(result.error?.message||fallback);return result?.data??null;}

export async function getAppointmentClinicalContext({client,appointmentId}){
  if(!client||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');
  return unwrap(await client.rpc('bc_appointment_clinical_context',{p_agendamento_id:required(appointmentId,'Agendamento')}));
}

export function renderAgendaTreatmentButton(appointmentId,{status='agendado'}={}){
  return `<button type="button" class="bcg-small-button bcg-clinical-entry-button" data-open-clinical-treatment="${escapeHtml(appointmentId)}">${status==='atendido'?'Ver atendimento':'Atender'}</button>`;
}

export function renderAgendaTreatmentOverlay({context={},clientRecord={},readOnlyHistory=''}={}){
  const writable=context.can_start===true;
  return `<div class="bcg-clinical-overlay" data-agenda-treatment-overlay role="dialog" aria-modal="true" aria-label="Prontuário clínico">
    <div class="bcg-clinical-overlay-card">
      <header class="bcg-clinical-overlay-head"><div><p class="bcg-eyebrow">PRONTUÁRIO CLÍNICO</p><h2>${escapeHtml(clientRecord.nome||'Cliente')}</h2><p class="bcg-muted">${escapeHtml(context.procedure_name||'Procedimento')} • ${escapeHtml(context.professional_name||'Profissional')}</p></div><button type="button" class="bcg-small-button" data-agenda-treatment-close>Fechar</button></header>
      ${writable?`<div class="bcg-clinical-overlay-note"><strong>Atendimento da profissional autenticada.</strong><span>Você pode continuar no prontuário formal deste agendamento.</span></div><div data-agenda-treatment-mount></div>`:`<div class="bcg-clinical-overlay-note"><strong>Somente visualização</strong><span>Este agendamento está atribuído a ${escapeHtml(context.professional_name||'outra profissional')}. A autoria clínica permanece com a profissional responsável.</span></div><div class="bcg-agenda-treatment-readonly"><p class="bcg-eyebrow">HISTÓRICO CLÍNICO</p>${readOnlyHistory||'<div class="bcg-empty">Nenhum atendimento clínico formal registrado.</div>'}</div>`}
    </div>
  </div>`;
}

function ensureStyles(root){
  const doc=root?.ownerDocument||root;
  if(!doc?.head||doc.querySelector?.('link[data-agenda-treatment-styles]'))return;
  const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('../assets/agenda-treatment-bridge.css',import.meta.url).href;link.dataset.agendaTreatmentStyles='true';doc.head.append(link);
}

function decorateAppointments(root){
  root.querySelectorAll?.('[data-appointment-id]')?.forEach?.((card)=>{
    const id=card.dataset.appointmentId;
    if(!id||card.querySelector?.('[data-open-clinical-treatment]'))return;
    const actions=card.querySelector?.('.bcg-actions')||card;
    actions.insertAdjacentHTML?.('beforeend',renderAgendaTreatmentButton(id,{status:card.dataset.appointmentStatus}));
  });
}

function closeOverlay(root){openingVersions.set(root,(openingVersions.get(root)||0)+1);root.querySelector?.('[data-agenda-treatment-overlay]')?.remove?.();}

async function openOverlay({client,root,appointmentId}){
  closeOverlay(root);
  const version=openingVersions.get(root);
  const current=()=>openingVersions.get(root)===version;
  const context=await getAppointmentClinicalContext({client,appointmentId});
  if(!current())return null;
  const clientRecord=await getClient({client,clienteId:context.cliente_id});
  let readOnlyHistory='';
  if(!context.can_start){
    const treatments=await listClientTreatments({client,clienteId:context.cliente_id});
    readOnlyHistory=renderTreatmentHistory(treatments||[]).replaceAll(/<button[^>]*data-treatment-open[^>]*>[\s\S]*?<\/button>/gi,'');
  }
  if(!current())return null;
  const host=root.createElement('div');
  host.innerHTML=renderAgendaTreatmentOverlay({context,clientRecord,readOnlyHistory});
  const overlay=host.firstElementChild;
  root.body?.append?.(overlay);
  if(!overlay)return null;

  if(context.can_start){
    const mount=overlay.querySelector('[data-agenda-treatment-mount]');
    mount.innerHTML=renderTreatmentPanel({client:clientRecord});
    const controller=initTreatmentController({client,root:mount,getClientRecord:()=>clientRecord});
    await controller.hydrate();
    if(!current()||!root.body.contains(overlay))return null;
    if(context.existing_treatment_id)await controller.openTreatment(context.existing_treatment_id);
    else await controller.startAppointment(context.appointment_id,context.procedimento_id);
  }
  return overlay;
}

export function installAgendaTreatmentBridge({client,root=document}={}){
  if(!client||!root||globalThis[INSTALL_KEY])return globalThis[INSTALL_KEY]||null;
  ensureStyles(root);
  decorateAppointments(root);
  const click=async(event)=>{
    const close=event.target.closest?.('[data-agenda-treatment-close]');
    if(close){closeOverlay(root);return;}
    const button=event.target.closest?.('[data-open-clinical-treatment]');
    if(!button)return;
    button.disabled=true;
    try{await openOverlay({client,root,appointmentId:button.dataset.openClinicalTreatment});}
    catch(error){button.title=error?.message||'Não foi possível abrir o prontuário.';}
    finally{button.disabled=false;}
  };
  root.addEventListener?.('click',click);
  const Observer=root.defaultView?.MutationObserver||globalThis.MutationObserver;
  const observer=new Observer(()=>decorateAppointments(root));
  observer.observe(root.documentElement||root,{childList:true,subtree:true});
  const runtime={observer,open:appointmentId=>openOverlay({client,root,appointmentId}),close:()=>closeOverlay(root),decorate:()=>decorateAppointments(root),destroy(){closeOverlay(root);observer.disconnect();root.removeEventListener?.('click',click);delete globalThis[INSTALL_KEY];}};
  globalThis[INSTALL_KEY]=runtime;
  return runtime;
}
