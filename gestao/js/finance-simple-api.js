const knownFailure=new Set(['22023','42501','55000','23503','23505','P0001']);
export async function financeRpc(client,name,payload){
 if(!client?.rpc)throw Error('Cliente Supabase indisponível.');
 const {data,error}=await client.rpc(name,payload);
 if(error)throw Object.assign(Error(error.message||'Não foi possível concluir a operação.'),{code:error.code,confirmedFailure:knownFailure.has(error.code)});
 return data;
}
function amount(value){const n=Number(value);if(!Number.isFinite(n)||n<=0||n>=1e10||n!==Number(n.toFixed(2)))throw Object.assign(Error('Informe um valor válido em reais e centavos.'),{confirmedFailure:true});return n;}
function period(from,to){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('Confira as datas do período.');return {p_from:from,p_to:to};}
const optional=v=>String(v??'').trim()||null;
export const getFinanceOverview=({client,from,to})=>financeRpc(client,'bc_finance_overview',period(from,to));
export const getOwnFinance=({client,from,to})=>financeRpc(client,'bc_finance_my_summary',period(from,to));
export const getFinanceReport=({client,from,to})=>financeRpc(client,'bc_finance_report',period(from,to));
async function mutation(client,kind,name,payload){
 try{const id=await financeRpc(client,name,payload);if(typeof id!=='string'||!id)throw Error('Resultado não confirmado.');return id;}
 catch(error){
  if(error.confirmedFailure)throw error;
  try{const result=await financeRpc(client,'bc_finance_operation_result',{p_kind:kind,p_request_key:payload.p_request_key});if(result?.id&&Number(result.amount)===Number(payload.p_expected_total??payload.p_amount))return result.id;}catch{}
  throw error;
 }
}
export async function payCommission({client,requestKey,professionalId,itemIds,amount:total,method=null,paidAt=null}){
 return mutation(client,'payment','bc_finance_commission_pay',{p_request_key:requestKey,p_professional:professionalId,p_item_ids:[...itemIds].sort(),p_expected_total:amount(total),p_method:optional(method),p_paid_at:paidAt});
}
export async function createExpense({client,requestKey,description,amount:total,paidAt=null,method=null,note=null}){
 if(!String(description??'').trim())throw Object.assign(Error('Informe a descrição da despesa.'),{confirmedFailure:true});
 return mutation(client,'expense','bc_finance_expense_create',{p_request_key:requestKey,p_description:description.trim(),p_amount:amount(total),p_paid_at:paidAt,p_method:optional(method),p_note:optional(note)});
}
export const applyCommission=({client,professionalId,percent,procedureIds=null})=>financeRpc(client,'bc_finance_commissions_apply',{p_professional:professionalId,p_percent:Number(percent),p_procedure_ids:procedureIds});
export const reverseFinance=({client,kind,id,reason})=>financeRpc(client,kind==='payment'?'bc_finance_commission_reverse':kind==='receipt'?'bc_recebimento_estornar':'bc_finance_expense_reverse',kind==='payment'?{p_payment_id:id,p_reason:reason}:kind==='receipt'?{p_recebimento_id:id,p_motivo:reason}:{p_expense_id:id,p_reason:reason});
