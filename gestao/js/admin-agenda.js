import {createReceiptAttempt,receiptFailureMessage,receiptStorageMessage} from './receipt-attempt.js';
import { registerReceiptForAppointment } from './finance-receipts-api.js';
import { linkPublicAppointment } from './schedule-api.js';
import { agendaOriginKind } from './agenda-origin.js';
import { listAdminAppointments,listEligibleProcedures,listStaffDirectory,createAppointment,updateAppointment,setAppointmentStatus } from './agenda-api.js';
import { listClients } from './clientes-api.js';
import { initProcedurePanel } from './procedure-panel.js';
import { initAdminSchedule } from './admin-schedule.js';
import { CLINIC_TIME_ZONE,clinicDayRange,clinicLocalDateTimeToIso,formatClinicDateTime,statusLabel } from './agenda-format.js';

export function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function clinicDateValue(date=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:CLINIC_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter((p)=>p.type!=='literal').map((p)=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
function localInputValue(iso){if(!iso)return '';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:CLINIC_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(iso)).filter((p)=>p.type!=='literal').map((p)=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}
function dateRangeFromInput(value){const clean=String(value??'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(clean))throw new Error('Data da agenda inválida.');return clinicDayRange(new Date(`${clean}T12:00:00Z`));}
function statusClass(status){return ['agendado','atendido','cancelado','faltou'].includes(status)?`bcg-status-${status}`:'';}
export function renderProfessionalOptions(staff=[],{includeAll=false,selected=''}={}){const options=[];if(includeAll)options.push(`<option value=""${selected===''?' selected':''}>Todas</option>`);else options.push('<option value="">Selecione a profissional</option>');for(const item of staff){const isSelected=String(item.user_id)===String(selected);options.push(`<option value="${escapeHtml(item.user_id)}"${isSelected?' selected':''}>${escapeHtml(item.display_name||'Profissional')}</option>`);}return options.join('');}
function renderNamedOptions(items=[],selected='',empty='Selecione'){return `<option value="">${escapeHtml(empty)}</option>${items.map((item)=>`<option value="${escapeHtml(item.id)}"${String(item.id)===String(selected)?' selected':''}>${escapeHtml(item.nome)}</option>`).join('')}`;}
export function filterAdminAppointments(appointments=[],professionalId=''){const id=String(professionalId??'').trim();return id?appointments.filter((item)=>String(item.colaboradora_user_id)===id):appointments;}

export function renderAdminAppointments(appointments=[],staffMap=new Map()){
  if(!appointments.length)return '<div class="bcg-empty">Nenhum atendimento encontrado para esta data.</div>';
  return `<div class="bcg-agenda-list">${appointments.map((appointment)=>{
    const isSite=agendaOriginKind(appointment)==='site';
    const pendingSite=isSite&&!appointment.cliente_id;
    const clientName=appointment.clientes?.nome||(isSite?appointment.public_booking_name:'')||'Cliente';
    const phone=pendingSite?appointment.public_booking_phone:'';
    const procedureName=appointment.procedimentos?.nome||'Procedimento';
    const staffName=staffMap.get(appointment.colaboradora_user_id)||'Profissional';
    const status=appointment.status||'agendado';
    const disabled=status==='atendido'?' disabled':'';
    const detail=[procedureName,staffName,phone].filter(Boolean).join(' • ');
    const chips=`<span class="bcg-chip ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>${isSite?'<span class="bcg-chip">Site</span>':''}${pendingSite?'<span class="bcg-chip bcg-status-pending">Cadastro pendente</span>':''}`;
    const receiptForm=status==='atendido'&&appointment.cliente_id?`<details class="bcg-field-wide"><summary>Registrar recebimento</summary><form class="bcg-form bcg-form-grid" data-admin-receipt-form="${escapeHtml(appointment.id)}"><label>Valor recebido<input class="bcg-input" name="valor" type="number" min="0.01" step="0.01" required></label><label>Forma de pagamento<select class="bcg-input" name="forma" required><option value="">Selecione</option><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option></select></label><button type="submit" class="bcg-small-button">Registrar recebimento</button><span class="bcg-status" data-receipt-status></span></form></details>`:'';
    return `<article class="bcg-appointment-card" data-appointment-id="${escapeHtml(appointment.id)}"><div class="bcg-appointment-time">${escapeHtml((formatClinicDateTime(appointment.inicio).match(/\b\d{2}:\d{2}\b/)||[formatClinicDateTime(appointment.inicio)])[0])}</div><div class="bcg-appointment-main"><strong>${escapeHtml(clientName)}</strong><span>${escapeHtml(detail)}</span></div><div class="bcg-appointment-chips">${chips}</div><div class="bcg-actions"><button type="button" class="bcg-small-button" data-admin-edit="${escapeHtml(appointment.id)}"${disabled}>Editar</button><button type="button" class="bcg-small-button" data-admin-status="agendado"${disabled}>Agendado</button><button type="button" class="bcg-small-button" data-admin-status="atendido"${disabled}>Atendido</button><button type="button" class="bcg-small-button" data-admin-status="faltou"${disabled}>Faltou</button><button type="button" class="bcg-small-button" data-admin-status="cancelado"${disabled}>Cancelar</button></div>${receiptForm}</article>`;
  }).join('')}</div>`;
}
function setMessage(element,message,kind=''){if(!element)return;element.textContent=message||'';element.dataset.kind=kind;}
async function withSubmitState(form,statusEl,action){const submit=form?.querySelector('[type="submit"]');if(submit)submit.disabled=true;setMessage(statusEl,'Salvando…');try{const result=await action();setMessage(statusEl,'Salvo com sucesso.','success');return result;}catch(error){setMessage(statusEl,error?.message||'Não foi possível concluir a operação.','error');throw error;}finally{if(submit)submit.disabled=false;}}

export async function initAdminAgenda({client,profile,root=document}){
  if(!client||!profile?.user_id||!root)throw new Error('Contexto administrativo inválido.');const el=(id)=>root.getElementById(id);const originFilter=el('adminAgendaOriginFilter');const agendaDate=el('adminAgendaDate');const professionalFilter=el('adminAgendaProfessionalFilter');const agendaList=el('adminAgendaList');const agendaStatus=el('adminAgendaStatus');const appointmentForm=el('appointmentForm');const clientSelect=el('appointmentClient');const collaboratorSelect=el('appointmentCollaborator');const procedureSelect=el('appointmentProcedure');const editForm=el('adminAppointmentEditForm');const editProfessional=el('adminEditProfessional');const editProcedure=el('adminEditProcedure');const editStart=el('adminEditStart');const editEnd=el('adminEditEnd');const editNote=el('adminEditNote');
  if(!agendaDate||!professionalFilter||!agendaList||!appointmentForm||!editForm)throw new Error('Estrutura da agenda administrativa incompleta.');let refreshVersion=0;let eligibilityVersion=0;let editVersion=0;let clients=[],procedures=[],staff=[],allAppointments=[],appointmentMap=new Map();
  async function refreshClients(){clients=await listClients({client});clientSelect.innerHTML=renderNamedOptions(clients,'','Selecione o cliente');return clients;}
  async function refreshProcedures(){const version=++eligibilityVersion;const selected=procedureSelect.value;procedureSelect.disabled=true;
    try {const rows=collaboratorSelect.value?await listEligibleProcedures({client,professionalUserId:collaboratorSelect.value}):[];
      if(version!==eligibilityVersion)return [];procedures=rows;procedureSelect.innerHTML=renderNamedOptions(procedures,selected,'Selecione o procedimento');return procedures;
    } finally {if(version===eligibilityVersion)procedureSelect.disabled=false;}}
  async function refreshCollaborators(){const priorFilter=professionalFilter.value;staff=await listStaffDirectory({client});collaboratorSelect.innerHTML=renderProfessionalOptions(staff);professionalFilter.innerHTML=renderProfessionalOptions(staff,{includeAll:true,selected:priorFilter});return staff;}
  function staffMap(){return new Map(staff.map((item)=>[item.user_id,item.display_name]));}
  function staffDirectory(){return staff.map((item)=>({...item}));}
  function renderCurrentAgenda(){const filtered=filterAdminAppointments(allAppointments,professionalFilter.value);agendaList.innerHTML=renderAdminAppointments(filtered,staffMap());setMessage(agendaStatus,`${filtered.length} atendimento(s) nesta visão.`,'success');return filtered;}
  async function refreshAgenda({canApply=()=>true,quiet=false}={}){const version=++refreshVersion;if(!quiet){setMessage(agendaStatus,'Carregando agenda…');agendaList.innerHTML='<div class="bcg-empty">Carregando agenda…</div>';}try{const rows=await listAdminAppointments({client,...dateRangeFromInput(agendaDate.value),origin:originFilter?.value||'all'});if(version!==refreshVersion || !canApply())return [];allAppointments=rows;appointmentMap=new Map(allAppointments.map((item)=>[item.id,item]));return renderCurrentAgenda();}catch(error){if(version!==refreshVersion || !canApply())return [];agendaList.innerHTML='<div class="bcg-empty">Não foi possível carregar a agenda.</div>';setMessage(agendaStatus,error?.message||'Erro ao carregar agenda.','error');throw error;}}
  async function openEdit(id){const version=++editVersion;const appointment=appointmentMap.get(id);if(!appointment)throw new Error('Agendamento não encontrado.');editForm.hidden=true;const eligible=await listEligibleProcedures({client,professionalUserId:appointment.colaboradora_user_id});if(version!==editVersion)return null;editForm.dataset.appointmentId=appointment.id;editProfessional.textContent=staffMap().get(appointment.colaboradora_user_id)||'Profissional';editProcedure.innerHTML=renderNamedOptions(eligible,appointment.procedimento_id,'Selecione o procedimento');editStart.value=localInputValue(appointment.inicio);editEnd.value=localInputValue(appointment.fim);editNote.value=appointment.observacao_administrativa||'';const linkField=el('adminPublicBookingField');if(linkField){linkField.hidden=!(agendaOriginKind(appointment)==='site'&&!appointment.cliente_id);el('adminPublicBookingClient').innerHTML=renderNamedOptions(clients,'','Selecione o cadastro correto');}editForm.hidden=false;editForm.scrollIntoView?.({behavior:'smooth',block:'nearest'});return appointment;}
  el('adminPublicBookingLink')?.addEventListener('click',async(event)=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      await linkPublicAppointment({client,appointmentId:editForm.dataset.appointmentId,clienteId:el('adminPublicBookingClient').value});
      editForm.hidden=true;await refreshAgenda();setMessage(agendaStatus,'Reserva vinculada ao cadastro oficial.','success');
    }catch(error){setMessage(el('adminAppointmentEditStatus'),error?.message||'Não foi possível vincular.','error');}
    finally{button.disabled=false;}
  });
  agendaDate.value=agendaDate.value||clinicDateValue();await Promise.all([refreshClients(),refreshProcedures(),refreshCollaborators()]);await refreshAgenda();agendaDate.addEventListener('change',refreshAgenda);originFilter?.addEventListener('change',refreshAgenda);professionalFilter.addEventListener('change',renderCurrentAgenda);collaboratorSelect.addEventListener('change',()=>refreshProcedures().catch(error=>setMessage(el('appointmentFormStatus'),error.message,'error')));
  appointmentForm.addEventListener('submit',async(event)=>{event.preventDefault();const start=el('appointmentStart').value;const end=el('appointmentEnd').value;try{await withSubmitState(appointmentForm,el('appointmentFormStatus'),()=>createAppointment({client,clienteId:clientSelect.value,colaboradoraUserId:collaboratorSelect.value,procedimentoId:procedureSelect.value,inicioIso:clinicLocalDateTimeToIso(start),fimIso:end?clinicLocalDateTimeToIso(end):null,observacao:el('appointmentNote').value}));appointmentForm.reset();await refreshProcedures();await refreshAgenda();}catch{}});
  editForm.addEventListener('submit',async(event)=>{event.preventDefault();try{await withSubmitState(editForm,el('adminAppointmentEditStatus'),()=>updateAppointment({client,appointmentId:editForm.dataset.appointmentId,procedimentoId:editProcedure.value,inicioIso:clinicLocalDateTimeToIso(editStart.value),fimIso:editEnd.value?clinicLocalDateTimeToIso(editEnd.value):null,observacao:editNote.value}));editForm.hidden=true;await refreshAgenda();}catch{}});el('adminAppointmentEditCancel')?.addEventListener('click',()=>{editVersion++;editForm.hidden=true;});
  agendaList.addEventListener('click',async(event)=>{const editButton=event.target.closest?.('[data-admin-edit]');if(editButton){try{await openEdit(editButton.dataset.adminEdit);}catch(error){setMessage(agendaStatus,error?.message||'Não foi possível editar.','error');}return;}const button=event.target.closest?.('[data-admin-status]');if(!button)return;const id=button.closest('[data-appointment-id]')?.dataset?.appointmentId;if(!id)return;button.disabled=true;try{await setAppointmentStatus({client,appointmentId:id,status:button.dataset.adminStatus});await refreshAgenda();}catch(error){setMessage(agendaStatus,error?.message||'Não foi possível atualizar o status.','error');button.disabled=false;}});
  let receiptStorage;try{receiptStorage=root.defaultView?.sessionStorage;}catch{}
  const receiptAttempts=createReceiptAttempt({storage:receiptStorage});
  agendaList.addEventListener('submit',async(event)=>{
    const form=event.target.closest?.('[data-admin-receipt-form]');if(!form)return;event.preventDefault();
    const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
    const context=`${profile.user_id}:${form.dataset.adminReceiptForm}`;let requestKey;
    try{
      const values={valor:Number(form.querySelector('[name="valor"]').value),formaPagamento:form.querySelector('[name="forma"]').value.trim(),recebidoAt:null,observacao:null};
      requestKey=await receiptAttempts.get(context,values);
      await registerReceiptForAppointment({client,appointmentId:form.dataset.adminReceiptForm,requestKey,...values});
      const released=receiptAttempts.complete(context,requestKey);form.reset();setMessage(form.querySelector('[data-receipt-status]'),released?'Recebimento confirmado.':receiptStorageMessage,'success');
      const EventCtor=root.defaultView?.CustomEvent||globalThis.CustomEvent;if(EventCtor)root.dispatchEvent(new EventCtor('bc:finance-changed'));
    }catch(error){if(requestKey)receiptAttempts.fail(context,requestKey,error);setMessage(form.querySelector('[data-receipt-status]'),receiptFailureMessage(error,requestKey),'error');}
    finally{button.disabled=false;}
  });
  const procedurePanel=await initProcedurePanel({client,profile,root});
  const schedulePanel=await initAdminSchedule({client,profile,root,staffProvider:staffDirectory});
  return {openEdit,refreshAgenda,refreshClients,refreshProcedures,refreshCollaborators,getStaffMap:staffMap,getStaffDirectory:staffDirectory,procedurePanel,schedulePanel,showMyAgenda:()=>{professionalFilter.value=profile.user_id;return renderCurrentAgenda();}};
}
