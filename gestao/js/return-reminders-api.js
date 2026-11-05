const required=(v,label)=>{const s=String(v??'').trim();if(!s)throw Error(`${label} é obrigatório.`);return s;};
async function rpc(client,name,payload={}){if(!client?.rpc)throw Error('Cliente Supabase indisponível.');const {data,error}=await client.rpc(name,payload);if(error)throw Error(error.message||'Não foi possível salvar o lembrete.');return data;}
function date(value){const s=required(value,'Data de retorno');const d=new Date(`${s}T12:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.startsWith('0000')||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Data de retorno inválida.');return s;}
export function clinicReminderToIso(value){
 const s=required(value,'Data e hora do lembrete');const m=s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
 if(!m||Number(m[2])>23||Number(m[3])>59)throw Error('Data e hora do lembrete inválidas.');date(m[1]);
 return new Date(`${s}:00-03:00`).toISOString();
}
export async function saveReturnReminder({client,treatmentId,returnOn,remindAt,note=''}){
 const text=String(note??'').trim();if(text.length>4000)throw Error('Observação deve ter até 4000 caracteres.');
 return rpc(client,'bc_return_reminder_save',{p_treatment_id:required(treatmentId,'Atendimento'),p_return_on:date(returnOn),p_remind_at:clinicReminderToIso(remindAt),p_note:text||null});
}
export const getReturnReminder=({client,treatmentId})=>rpc(client,'bc_return_reminder_get',{p_treatment_id:required(treatmentId,'Atendimento')});
export const listReturnReminders=({client})=>rpc(client,'bc_return_reminder_list');
export const completeReturnReminder=({client,reminderId})=>rpc(client,'bc_return_reminder_complete',{p_reminder_id:required(reminderId,'Lembrete')});
export const savePushSubscription=({client,subscription})=>rpc(client,'bc_return_push_subscribe',{p_subscription:subscription});
export const removePushSubscription=({client,endpoint})=>rpc(client,'bc_return_push_unsubscribe',{p_endpoint:required(endpoint,'Aparelho')});
export const getPushPublicKey=({client})=>rpc(client,'bc_return_push_public_key');
