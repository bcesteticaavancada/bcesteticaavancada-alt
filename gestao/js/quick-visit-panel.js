import { listActiveProcedures, listStaffDirectory } from './agenda-api.js';
import { clinicLocalDateTimeToIso } from './agenda-format.js';
import { createQuickVisit, listQuickVisitProcedureOptions } from './quick-visit-api.js';

function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function idOf(value){return String(value??'').trim();}
function staffName(row={}){return row.display_name||row.nome||row.email||'Profissional';}
function procedureName(row={}){return row.nome||row.name||'Procedimento';}
function currentUserId(result){return idOf(result?.data?.user?.id||result?.user?.id);}

export function filterExecutableProcedures(procedures=[],procedureOptions=[]){
  const allowed=new Set((procedureOptions||[]).filter((row)=>row?.can_execute===true).map((row)=>idOf(row.procedure_id)).filter(Boolean));
  return (procedures||[]).filter((row)=>row&&row.ativo!==false&&allowed.has(idOf(row.id)));
}

function staffOptions(staff=[],selectedProfessionalId=''){
  if(!staff.length)return '<option value="">Nenhuma profissional disponível</option>';
  return staff.map((row)=>`<option value="${escapeHtml(row.user_id)}"${idOf(row.user_id)===idOf(selectedProfessionalId)?' selected':''}>${escapeHtml(staffName(row))}</option>`).join('');
}

function procedureOptions(procedures=[],selectedProcedureId=''){
  if(!procedures.length)return '<option value="">Nenhum procedimento autorizado</option>';
  return `<option value="">Selecione</option>${procedures.map((row)=>`<option value="${escapeHtml(row.id)}"${idOf(row.id)===idOf(selectedProcedureId)?' selected':''}>${escapeHtml(procedureName(row))}</option>`).join('')}`;
}

export function renderQuickVisitPanel({
  clientRecord={},
  procedures=[],
  staff=[],
  selectedProfessionalId='',
  procedureOptions:authorizationOptions=[],
  selectedProcedureId='',
  startLocal='',
}={}){
  const executable=filterExecutableProcedures(procedures,authorizationOptions);
  return `<section class="bcg-card bcg-quick-visit" data-quick-visit-panel>
    <div class="bcg-section-heading">
      <div><p class="bcg-eyebrow">NOVO ATENDIMENTO</p><h3>Encaixe rápido</h3></div>
      <button class="bcg-small-button" type="button" data-quick-visit-cancel>Fechar</button>
    </div>
    <p class="bcg-helper">Cliente: <strong>${escapeHtml(clientRecord.nome||'Cliente')}</strong>. O encaixe cria a agenda e abre o mesmo prontuário clínico para continuidade.</p>
    <form class="bcg-form-grid" data-quick-visit-form>
      <label>Profissional<select required data-quick-visit-professional>${staffOptions(staff,selectedProfessionalId)}</select></label>
      <label>Procedimento<select required data-quick-visit-procedure>${procedureOptions(executable,selectedProcedureId)}</select></label>
      <label>Data e hora<input required type="datetime-local" value="${escapeHtml(startLocal)}" data-quick-visit-start></label>
      <label class="bcg-form-span">Observação<textarea rows="2" data-quick-visit-note placeholder="Opcional"></textarea></label>
      <div class="bcg-form-span"><p class="bcg-form-status" data-quick-visit-status aria-live="polite"></p></div>
      <div class="bcg-form-actions bcg-form-span">
        <button class="bcg-secondary-button" type="button" data-quick-visit-cancel>Cancelar</button>
        <button class="bcg-primary-button" type="submit"${executable.length?'':' disabled'}>Criar encaixe</button>
      </div>
    </form>
  </section>`;
}

export function createQuickVisitSubmission({
  create=createQuickVisit,
  openTreatment=async()=>{},
  refresh=async()=>{},
  uuid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,
}={}){
  let requestKey=null;
  let inFlight=null;
  return async(payload={})=>{
    if(inFlight)return inFlight;
    if(!requestKey)requestKey=uuid();
    inFlight=(async()=>{
      const result=await create({...payload,requestKey});
      await openTreatment(result.treatment_id);
      await refresh(result);
      requestKey=null;
      return result;
    })();
    try{return await inFlight;}
    finally{inFlight=null;}
  };
}

async function authenticatedUserId(client){
  if(!client?.auth?.getUser)return '';
  const result=await client.auth.getUser();
  if(result?.error)throw new Error(result.error.message||'Não foi possível identificar a profissional autenticada.');
  return currentUserId(result);
}

function visibleStaffForUser(staff,userId){
  const own=(staff||[]).find((row)=>idOf(row.user_id)===idOf(userId));
  if(!own)return staff||[];
  return own.role==='admin'?(staff||[]):[own];
}

function setStatus(host,message='',type=''){
  const node=host?.querySelector?.('[data-quick-visit-status]');
  if(!node)return;
  node.textContent=message;
  node.dataset.state=type;
}

function replaceProcedureOptions(host,procedures,authorizationOptions,selected=''){
  const select=host?.querySelector?.('[data-quick-visit-procedure]');
  if(!select)return;
  const executable=filterExecutableProcedures(procedures,authorizationOptions);
  select.innerHTML=procedureOptions(executable,selected);
  const submit=host.querySelector?.('[data-quick-visit-form] button[type="submit"]');
  if(submit)submit.disabled=!executable.length;
  if(!executable.length)setStatus(host,'Nenhum procedimento autorizado para esta profissional.','warning');
  else setStatus(host,'','');
}

export function initQuickVisitPanel({
  client,
  root,
  getClientRecord=()=>null,
  openTreatment=async()=>{},
  refresh=async()=>{},
}={}){
  if(!client||!root)throw new Error('Contexto do atendimento rápido indisponível.');
  let host=root.querySelector?.('[data-quick-visit-host]');
  if(!host){
    host=root.ownerDocument.createElement('div');
    host.dataset.quickVisitHost='';
    host.hidden=true;
    root.prepend(host);
  }
  let procedures=[];
  let staff=[];
  let authorizationOptions=[];
  let selectedProfessionalId='';

  const submitQuickVisit=createQuickVisitSubmission({client,openTreatment,refresh});

  async function loadOptions(profissionalUserId){
    selectedProfessionalId=idOf(profissionalUserId);
    authorizationOptions=await listQuickVisitProcedureOptions({client,profissionalUserId:selectedProfessionalId});
    replaceProcedureOptions(host,procedures,authorizationOptions);
  }

  async function open(){
    host.hidden=false;
    host.innerHTML='<div class="bcg-empty">Preparando o novo atendimento...</div>';
    try{
      const userId=await authenticatedUserId(client);
      [procedures,staff]=await Promise.all([
        listActiveProcedures({client}),
        listStaffDirectory({client}),
      ]);
      staff=visibleStaffForUser(staff,userId).filter((row)=>row?.active!==false&&row?.atende_clientes!==false);
      selectedProfessionalId=idOf(staff.find((row)=>idOf(row.user_id)===userId)?.user_id||staff[0]?.user_id);
      if(!selectedProfessionalId)throw new Error('Nenhuma profissional disponível para o encaixe.');
      authorizationOptions=await listQuickVisitProcedureOptions({client,profissionalUserId:selectedProfessionalId});
      host.innerHTML=renderQuickVisitPanel({clientRecord:getClientRecord()||{},procedures,staff,selectedProfessionalId,procedureOptions:authorizationOptions});
      host.querySelector?.('[data-quick-visit-start]')?.focus?.();
    }catch(error){
      host.innerHTML=`<div class="bcg-empty">${escapeHtml(error?.message||'Não foi possível preparar o novo atendimento.')}</div>`;
    }
  }

  function close(){host.hidden=true;}

  const onChange=async(event)=>{
    const professional=event.target.closest?.('[data-quick-visit-professional]');
    if(!professional)return;
    try{
      setStatus(host,'Validando procedimentos...','');
      await loadOptions(professional.value);
    }catch(error){
      replaceProcedureOptions(host,procedures,[]);
      setStatus(host,error?.message||'Não foi possível validar os procedimentos.','error');
    }
  };

  const onClick=(event)=>{
    if(event.target.closest?.('[data-quick-visit-cancel]'))close();
  };

  const onSubmit=async(event)=>{
    const form=event.target.closest?.('[data-quick-visit-form]');
    if(!form)return;
    event.preventDefault();
    const professional=idOf(form.querySelector?.('[data-quick-visit-professional]')?.value);
    const procedure=idOf(form.querySelector?.('[data-quick-visit-procedure]')?.value);
    const startLocal=idOf(form.querySelector?.('[data-quick-visit-start]')?.value);
    const note=form.querySelector?.('[data-quick-visit-note]')?.value||'';
    const submit=form.querySelector?.('button[type="submit"]');
    try{
      if(!professional||!procedure||!startLocal)throw new Error('Preencha profissional, procedimento e data/hora.');
      if(submit)submit.disabled=true;
      setStatus(host,'Criando encaixe e prontuário...','');
      const result=await submitQuickVisit({
        client,
        clienteId:idOf(getClientRecord()?.id),
        profissionalUserId:professional,
        procedimentoId:procedure,
        inicioIso:clinicLocalDateTimeToIso(startLocal),
        observacao:note,
        componentVersionIds:[],
        componentKeys:[],
      });
      setStatus(host,'Atendimento criado. Abrindo prontuário...','success');
      close();
      return result;
    }catch(error){
      setStatus(host,error?.message||'Não foi possível criar o encaixe.','error');
    }finally{
      if(submit)submit.disabled=false;
    }
  };

  host.addEventListener('change',onChange);
  host.addEventListener('click',onClick);
  host.addEventListener('submit',onSubmit);

  return {
    open,
    close,
    destroy(){
      host.removeEventListener('change',onChange);
      host.removeEventListener('click',onClick);
      host.removeEventListener('submit',onSubmit);
      host.remove();
    },
  };
}
