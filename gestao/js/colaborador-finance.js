import {getOwnFinance} from './finance-simple-api.js';
import {money,esc,dateTime,defaultPeriod,setStatus,paymentRows} from './finance-view.js';
import {installFinanceAttachments} from './finance-attachments.js';
export async function initCollaboratorFinance({client,profile,root=document}){
 if(!client?.rpc||!profile?.user_id)throw Error('Contexto financeiro inválido.');
 const el=id=>root.getElementById(id),from=el('collaboratorFinanceFrom'),to=el('collaboratorFinanceTo'),message=el('collaboratorFinanceStatus');
 const period=defaultPeriod();from.value||=period.from;to.value||=period.to;let version=0;
 async function refresh({canApply=()=>true,quiet=false}={}){
  const current=++version;if(!quiet)setStatus(message,'Carregando sua comissão…');
  try{const data=await getOwnFinance({client,from:from.value,to:to.value});if(current!==version||!canApply())return null;
   el('collaboratorTotalPending').textContent=money(data.pending_total);el('collaboratorTotalPaid').textContent=money(data.paid_total);
   el('collaboratorFinanceItems').innerHTML=(data.items||[]).length?data.items.map(i=>`<article class="bcg-finance-row"><div><strong>${esc(i.procedure)}</strong><span>${esc(dateTime(i.received_at))}</span></div><strong>${i.state==='awaiting_rule'?'Comissão a combinar':i.state==='waived'?'Sem comissão':money(i.amount)}</strong></article>`).join(''):'<div class="bcg-empty">Nenhuma comissão pendente.</div>';
   el('collaboratorFinancePayments').innerHTML=paymentRows(data.payments);setStatus(message,data.awaiting_rules?'A administração precisa conferir a comissão de alguns recebimentos.':'Comissão atualizada.','success');return data;
  }catch(error){if(current===version&&canApply())setStatus(message,error.message,'error');throw error;}
 }
 for(const node of [from,to,el('collaboratorFinanceRefresh')])node?.addEventListener(node===from||node===to?'change':'click',()=>refresh().catch(()=>{}));
 installFinanceAttachments({client,profile,root:el('financeiro'),admin:false});await refresh().catch(()=>{});return {refresh};
}
