import {reconcileFinanceAttempt} from './finance-simple-api.js';
import {getAppointmentFinancialSummary,registerReceiptForAppointment} from './finance-receipts-api.js';
import {createReceiptAttempt,receiptFailureMessage,receiptStorageMessage} from './receipt-attempt.js';
import {clinicLocalDateTimeToIso} from './agenda-format.js';

const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const stateMessages={not_completed:'Conclua o atendimento para conferir o recebimento.',free:'Sem cobrança nesta sessão.',paid:'Pagamento da cliente confirmado.',cancelled:'Cobrança cancelada.',missing_total:'O valor da sessão precisa ser conferido pela administração.',ambiguous:'A cobrança precisa ser conferida pela administração.'};
function render(summary){
 const content=summary.can_receive?`<div class="bcg-receipt-balance"><span>A receber da cliente</span><strong>${money(summary.remaining)}</strong></div>
 <form class="bcg-form" data-finance-receive-form>
  <details><summary>Receber outro valor ou incluir detalhes</summary><div class="bcg-form bcg-receipt-options">
   <label>Valor recebido<input class="bcg-input" name="amount" type="number" step="0.01" min="0.01" max="${esc(summary.remaining)}" value="${esc(summary.remaining)}" inputmode="decimal" required></label>
   <label>Forma de pagamento <span class="bcg-optional">opcional</span><select class="bcg-input" name="method"><option value="">Não informar</option><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="transferencia">Transferência</option></select></label>
   <label>Recebido em <span class="bcg-optional">opcional</span><input class="bcg-input" type="datetime-local" name="receivedAt"></label>
   <label>Observação <span class="bcg-optional">opcional</span><textarea class="bcg-input" name="note" rows="2" maxlength="1000"></textarea></label>
  </div></details>
  <button class="bcg-button" type="submit">Confirmar recebimento</button>
 </form>`:`<p class="bcg-muted">${esc(stateMessages[summary.state]||'Confira o atendimento para registrar o recebimento.')}</p>`;
 return `${content}<p class="bcg-status" data-receipt-status role="status" aria-live="polite"></p>`;
}

export async function mountAppointmentReceipt({client,root,appointmentId,onChanged,storage}={}){
 if(!client?.rpc||!root||!appointmentId)throw Error('Contexto de recebimento inválido.');
 root.__bcReceiptPanel?.destroy?.();
 if(storage===undefined)try{storage=(root.ownerDocument||root).defaultView?.sessionStorage;}catch{}
 const attempts=createReceiptAttempt({storage});
 let summary=null,destroyed=false,inFlight=false,version=0,dirty=false;
 const message=(text,kind='')=>{if(destroyed)return;const p=root.querySelector('[data-receipt-status]');if(p){p.textContent=text;p.dataset.kind=kind;}};
 const renderError=error=>{if(destroyed)return;if(error?.code==='42501'){root.hidden=true;root.innerHTML='';return;}root.innerHTML='<p class="bcg-status" data-receipt-status role="status" aria-live="polite"></p><button class="bcg-small-button" type="button" data-receipt-refresh>Atualizar saldo</button>';message(error?.message||'Não foi possível conferir o saldo.','error');};
 async function refresh({force=false}={}){
  if(destroyed||(!force&&(dirty||inFlight)))return null;
  const current=++version;
  try{
   let loaded=await getAppointmentFinancialSummary({client,appointmentId});
   if(destroyed||current!==version)return null;
   if(!loaded?.actor_id)throw Error('Não foi possível confirmar a sessão. Atualize a página.');
   let recovered=null;try{recovered=await reconcileFinanceAttempt({client,attempts,context:`receipt:${loaded.actor_id}:${appointmentId}`,kind:'receipt',appointmentId});}catch(error){if(error.code!=='BC_STORAGE')throw error;}
   if(recovered)loaded=await getAppointmentFinancialSummary({client,appointmentId});
   if(destroyed||current!==version)return null;

   summary=loaded;root.hidden=false;root.innerHTML=render(summary);dirty=false;if(recovered?.status==='found')message('Recebimento anterior conferido. Saldo atualizado.','success');return summary;
  }catch(error){if(!destroyed&&current===version){summary=null;renderError(error);}throw error;}
 }
 async function onSubmit(event){
  const form=event.target.closest?.('[data-finance-receive-form]');
  if(!form||!root.contains(form))return;event.preventDefault();
  if(destroyed||inFlight||!summary?.can_receive)return;
  inFlight=true;for(const field of form.querySelectorAll('input,select,textarea,button'))field.disabled=true;
  const context=`receipt:${summary.actor_id}:${appointmentId}`;let key,confirmed=false,released=false;
  try{
   const amount=Number(form.querySelector('[name="amount"]').value);
   if(!Number.isFinite(amount)||amount<=0||amount!==Number(amount.toFixed(2))||amount>Number(summary.remaining))throw Object.assign(Error('Confira o valor recebido e o saldo da cliente.'),{confirmedFailure:true});
   const receivedAt=form.querySelector('[name="receivedAt"]').value;
   const payload={valor:amount,formaPagamento:String(form.querySelector('[name="method"]').value??'').trim()||'nao_informado',recebidoAt:receivedAt?clinicLocalDateTimeToIso(receivedAt):null,observacao:String(form.querySelector('[name="note"]').value??'').trim()||null};
   key=await attempts.get(context,payload);message('Confirmando recebimento…');
   const id=await registerReceiptForAppointment({client,appointmentId,requestKey:key,...payload});
   if(typeof id!=='string'||!id)throw Error('Não foi possível confirmar o resultado.');
   confirmed=true;released=attempts.complete(context,key);dirty=false;summary.can_receive=false;
   if(!destroyed){root.innerHTML='<p class="bcg-status" data-receipt-status role="status" aria-live="polite"></p>';message('Recebimento confirmado. Atualizando saldo…','success');}
   const results=await Promise.allSettled([refresh({force:true}),Promise.resolve().then(()=>onChanged?.())]);
   message(!released?receiptStorageMessage:results.some(r=>r.status==='rejected')?'Recebimento confirmado. Atualize o saldo para conferir.':'Recebimento confirmado.','success');
  }catch(error){
   if(key)attempts.fail(context,key,error);
   message(confirmed?'Recebimento confirmado. Atualize o saldo para conferir.':receiptFailureMessage(error,key),confirmed?'success':'error');
  }finally{inFlight=false;if(!destroyed&&root.contains(form))for(const field of form.querySelectorAll('input,select,textarea,button'))field.disabled=false;}
 }
 const onInput=()=>{dirty=true;};
 const onClick=event=>{if(event.target.closest?.('[data-receipt-refresh]'))refresh({force:true}).catch(()=>{});};
 root.addEventListener('submit',onSubmit);root.addEventListener('input',onInput);root.addEventListener('change',onInput);root.addEventListener('click',onClick);
 const runtime={refresh,get protected(){return dirty||inFlight;},destroy(){if(destroyed)return;destroyed=true;++version;root.removeEventListener('submit',onSubmit);root.removeEventListener('input',onInput);root.removeEventListener('change',onInput);root.removeEventListener('click',onClick);if(root.__bcReceiptPanel===runtime)delete root.__bcReceiptPanel;}};
 root.__bcReceiptPanel=runtime;root.innerHTML='<p class="bcg-status">Conferindo saldo…</p>';
 await refresh().catch(()=>{});return runtime;
}
