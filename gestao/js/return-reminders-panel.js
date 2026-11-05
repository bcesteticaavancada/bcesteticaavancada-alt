import {getReturnReminder,saveReturnReminder,listReturnReminders,completeReturnReminder} from './return-reminders-api.js';
import {enableReturnPush,pushAvailability} from './return-notifications.js';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const civil=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v))?String(v).split('-').reverse().join('/'):'—';
function localInput(value){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function suggestedTime(returnOn){if(!returnOn)return '';const d=new Date(`${returnOn}T09:00:00-03:00`);d.setUTCDate(d.getUTCDate()-1);return localInput(d.getTime()>Date.now()?d:new Date(Date.now()+3600000));}
function reminderForm(reminder={},treatmentId='',returnOn=''){
 const day=reminder.return_on||returnOn||'';
 return `<form class="bcg-form bcg-form-grid" data-return-reminder-form data-treatment-id="${esc(treatmentId)}">
 <label>Data prevista do retorno<input class="bcg-input" type="date" name="return_on" value="${esc(day)}" required></label>
 <label>Avisar em (horário de Brasília)<input class="bcg-input" type="datetime-local" name="remind_at" value="${esc(localInput(reminder.remind_at)||suggestedTime(day))}" required></label>
 <label class="bcg-field-wide">Prazo / observações do retorno<textarea class="bcg-input" name="note" rows="2" maxlength="4000" placeholder="Ex.: reavaliar em 15 dias">${esc(reminder.note||'')}</textarea></label>
 <div class="bcg-form-actions bcg-field-wide"><button class="bcg-button" type="submit">${reminder.active?'Atualizar lembrete':'Salvar lembrete de retorno'}</button>${reminder.active?`<button class="bcg-small-button" type="button" data-reminder-complete="${esc(reminder.id)}">Concluir / cancelar</button>`:''}</div>
 </form>`;
}
function pushButton(){return '<button class="bcg-small-button" type="button" data-return-push-enable>Ativar notificações neste aparelho</button><p class="bcg-muted">No iPhone, abra o BC pelo ícone adicionado à Tela de Início. A caixa de lembretes funciona mesmo sem a permissão de notificação.</p>';}
function setStatus(root,message,kind=''){const el=root.querySelector('[data-reminder-status]');if(el){el.textContent=message;el.dataset.kind=kind;}}

export function renderReturnInbox(rows=[]){
 if(!rows.length)return '<p class="bcg-muted">Nenhum lembrete cadastrado. Você pode criar um dentro do atendimento.</p>';
 return rows.map(r=>`<article class="bcg-editor-card" data-return-reminder="${esc(r.id)}"><h3>${esc(r.client_name||'Retorno')}</h3><p><strong>Retorno:</strong> ${civil(r.return_on)} • <strong>Aviso:</strong> ${esc(localInput(r.remind_at).replace('T',' ').replace(/^(\d{4})-(\d{2})-(\d{2})/,'$3/$2/$1'))}</p><p>${esc(r.note||'')}</p><span class="bcg-chip">${r.active?(r.notified_at?'Aviso disponível na gestão':'Programado'):'Concluído / cancelado'}</span>${r.push_failed?'<p class="bcg-muted">O envio ao aparelho não foi concluído. Confira a permissão de notificações.</p>':''}${r.active?`<div class="bcg-actions"><button class="bcg-small-button" type="button" data-reminder-edit="${esc(r.id)}">Editar / reagendar</button><button class="bcg-small-button" type="button" data-reminder-complete="${esc(r.id)}">Concluir / cancelar</button></div>`:''}<div data-reminder-editor></div></article>`).join('');
}

function attachActions({client,root,afterSave}){
 let busy=false;
 const submit=async event=>{
  const form=event.target.closest?.('[data-return-reminder-form]');if(!form||!root.contains(form))return;event.preventDefault();if(busy)return;busy=true;
  const button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
  try{await saveReturnReminder({client,treatmentId:form.dataset.treatmentId,returnOn:form.elements.return_on.value,remindAt:form.elements.remind_at.value,note:form.elements.note.value});await afterSave({reminderId:form.closest('[data-return-reminder]')?.dataset.returnReminder});setStatus(root,'Lembrete salvo na gestão. Ative as notificações neste aparelho para receber o aviso fora da página.','success');}
  catch(error){setStatus(root,error.message,'error');}finally{busy=false;if(button)button.disabled=false;}
 };
 const click=async event=>{
  const push=event.target.closest?.('[data-return-push-enable]');const complete=event.target.closest?.('[data-reminder-complete]');if(!push&&!complete)return;
  const button=push||complete;button.disabled=true;
  try{if(push){await enableReturnPush({client});setStatus(root,'Notificações ativadas para esta conta neste aparelho.','success');}
  else{await completeReturnReminder({client,reminderId:complete.dataset.reminderComplete});await afterSave({reminderId:complete.dataset.reminderComplete});setStatus(root,'Lembrete concluído / cancelado.','success');}}
  catch(error){setStatus(root,error.message,'error');}finally{button.disabled=false;}
 };
 root.addEventListener('submit',submit);root.addEventListener('click',click);
 return ()=>{root.removeEventListener('submit',submit);root.removeEventListener('click',click);};
}

export async function mountTreatmentReturnReminder({client,root,treatment,report}={}){
 if(!root||!treatment?.id)return {destroy(){}};
 async function render(){const reminder=await getReturnReminder({client,treatmentId:treatment.id});root.innerHTML=`<p class="bcg-eyebrow">RETORNO</p><h4>Retorno e lembrete</h4><p class="bcg-muted">Programe o seu aviso sem precisar finalizar a ficha. Este lembrete pode ser ajustado depois do atendimento.</p>${reminderForm(reminder||{},treatment.id,report?.retorno_sugerido_em)}${pushButton()}<p class="bcg-status" data-reminder-status role="status" aria-live="polite"></p>`;}
 try{await render();}catch(error){root.textContent=error.message;return {destroy(){}};}
 const detach=attachActions({client,root,afterSave:render});
 const change=event=>{if(event.target.name==='return_on'){const time=event.target.form?.elements.remind_at;if(time&&!time.value)time.value=suggestedTime(event.target.value);}};
 root.addEventListener('change',change);
 return {destroy(){detach();root.removeEventListener('change',change);}};
}

export async function initReturnReminders({client,root=document}={}){
 const host=root.getElementById('lembretes');if(!host)throw Error('Caixa de lembretes indisponível.');let rows=[];
 async function refresh({canApply=()=>true,force=false,reminderId}={}){
  const loaded=await listReturnReminders({client})||[];
  if(!force&&(!canApply()||host.querySelector('[data-return-reminder-form],button[type="submit"]:disabled')))return;
  // Keep other editors as live DOM nodes: no unsaved note is serialized or discarded.
  const editors=[...host.querySelectorAll('[data-return-reminder-form]')].map(form=>({form,id:form.closest('[data-return-reminder]')?.dataset.returnReminder})).filter(editor=>editor.id!==reminderId);
  rows=loaded;host.innerHTML=`<p class="bcg-eyebrow">ACOMPANHAMENTO</p><h2>Meus lembretes de retorno</h2>${pushButton()}<p class="bcg-status" data-reminder-status role="status" aria-live="polite"></p><div data-return-inbox>${renderReturnInbox(rows)}</div>`;
  for(const editor of editors){const row=[...host.querySelectorAll('[data-return-reminder]')].find(el=>el.dataset.returnReminder===editor.id);row?.querySelector('[data-reminder-editor]')?.append(editor.form);}
 }
 const detach=attachActions({client,root:host,afterSave:({reminderId}={})=>refresh({force:true,reminderId})});
 const edit=event=>{const button=event.target.closest?.('[data-reminder-edit]');if(!button)return;const r=rows.find(x=>x.id===button.dataset.reminderEdit);const target=button.closest('[data-return-reminder]').querySelector('[data-reminder-editor]');if(r)target.innerHTML=reminderForm(r,r.treatment_id);};
 host.addEventListener('click',edit);await refresh();
 return {refresh:async(options={})=>{if(!host.querySelector('[data-return-reminder-form]'))await refresh(options);},destroy(){detach();host.removeEventListener('click',edit);}};
}

export function startReturnReminderBadge({client,root=document,authorize=async()=>true}={}){
 let stopped=false,running=false;
 async function refresh(){if(stopped||running)return;running=true;try{if(!await authorize())return;const rows=await listReturnReminders({client})||[];const due=rows.filter(r=>r.active&&new Date(r.remind_at).getTime()<=Date.now()).length;root.querySelectorAll('[data-return-reminder-badge]').forEach(el=>{el.textContent=due?String(due):'';el.hidden=!due;});}catch{}finally{running=false;}}
 const timer=setInterval(refresh,60000);refresh();return {stop(){stopped=true;clearInterval(timer);}};
}
