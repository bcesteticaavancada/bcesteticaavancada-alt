const PATCH_FIELDS = [
  'queixa_dia','objetivo','avaliacao_profissional','regiao','specific_data','technical_data',
  'resposta_imediata','intercorrencias_ato','orientacoes','retorno','evolucao','feedback','observacoes','final_price','cycle_key',
];

function ensureClient(client){ if(!client || typeof client.rpc !== 'function') throw new Error('Cliente Supabase indisponível.'); }
function required(value,label){ const clean=String(value??'').trim(); if(!clean) throw new Error(`${label} é obrigatório.`); return clean; }
function cleanOptional(value){ const clean=String(value??'').trim(); return clean || null; }
function cleanList(value){ return Array.isArray(value) ? [...new Set(value.map((item)=>String(item??'').trim()).filter(Boolean))] : []; }
function unwrap(result,fallback='Não foi possível concluir a operação.'){ if(result?.error) throw result.error instanceof Error?result.error:new Error(result.error?.message||fallback); return result?.data??null; }
function sanitizePatch(patch={}){ const out={}; for(const field of PATCH_FIELDS){ if(Object.hasOwn(patch,field)) out[field]=patch[field]; } return out; }
async function call(client,name,payload){ ensureClient(client); return unwrap(await client.rpc(name,payload)); }

export async function createTreatment({client,clienteId,procedureId,appointmentId=null,componentVersionIds=[],componentKeys=[]}){
  return call(client,'bc_treatment_create',{
    p_cliente_id:required(clienteId,'Cliente'),
    p_procedure_id:required(procedureId,'Procedimento'),
    p_agendamento_id:appointmentId?required(appointmentId,'Agendamento'):null,
    p_component_version_ids:cleanList(componentVersionIds),
    p_component_keys:cleanList(componentKeys),
  });
}
export async function getTreatment({client,treatmentId}){ return call(client,'bc_treatment_get',{p_treatment_id:required(treatmentId,'Atendimento')}); }
export async function listClientTreatments({client,clienteId}){ return call(client,'bc_treatment_list_client',{p_cliente_id:required(clienteId,'Cliente')}) || []; }
export async function updateTreatmentDraft({client,treatmentId,patch={}}){ return call(client,'bc_treatment_update_draft',{p_treatment_id:required(treatmentId,'Atendimento'),p_patch:sanitizePatch(patch)}); }
export async function confirmTreatmentHealthChange({client,treatmentId,changed,details=null}){ return call(client,'bc_treatment_confirm_health',{p_treatment_id:required(treatmentId,'Atendimento'),p_changed:Boolean(changed),p_details:cleanOptional(details)}); }
export async function confirmTreatmentAlertReview({client,treatmentId}){ return call(client,'bc_treatment_confirm_alerts',{p_treatment_id:required(treatmentId,'Atendimento')}); }
export async function prepareTreatmentConsent({client,treatmentId}){
  const id=required(treatmentId,'Atendimento');
  const treatment=await getTreatment({client,treatmentId:id});
  if(treatment?.consent?.document_id) return treatment.consent;
  return call(client,'bc_treatment_prepare_consent',{p_treatment_id:id});
}
export async function getExternalConsent({client,treatmentId}){ return call(client,'bc_treatment_external_consent_get',{p_treatment_id:required(treatmentId,'Atendimento')}); }
export async function linkExternalConsent({client,treatmentId,clientFileId}){ return call(client,'bc_treatment_external_consent_link',{p_treatment_id:required(treatmentId,'Atendimento'),p_client_file_id:required(clientFileId,'TCLE externo')}); }
export async function markTreatmentReady({client,treatmentId}){ return call(client,'bc_treatment_mark_ready',{p_treatment_id:required(treatmentId,'Atendimento')}); }
export async function startTreatment({client,treatmentId}){ return call(client,'bc_treatment_start',{p_treatment_id:required(treatmentId,'Atendimento')}); }
export async function finalizeTreatment({client,treatmentId}){ return call(client,'bc_treatment_finalize',{p_treatment_id:required(treatmentId,'Atendimento')}); }
export async function completeTreatmentFinalization({client,treatmentId,documentId}){ return call(client,'bc_treatment_complete_finalize',{p_treatment_id:required(treatmentId,'Atendimento'),p_document_id:required(documentId,'Documento')}); }
export async function correctTreatmentSameDay({client,treatmentId,patch={}}){ return call(client,'bc_treatment_correct_same_day',{p_treatment_id:required(treatmentId,'Atendimento'),p_patch:sanitizePatch(patch)}); }
export async function createTreatmentReopenGrant({client,treatmentId,reason,expiresAt}){ return call(client,'bc_treatment_create_reopen_grant',{p_treatment_id:required(treatmentId,'Atendimento'),p_reason:required(reason,'Motivo'),p_expires_at:required(expiresAt,'Expiração')}); }
export async function correctReopenedTreatment({client,treatmentId,patch={}}){ return call(client,'bc_treatment_correct_reopened',{p_treatment_id:required(treatmentId,'Atendimento'),p_patch:sanitizePatch(patch)}); }
export async function listTreatmentAppointmentOptions({client,treatmentId}) {
  return await call(client,'bc_treatment_appointment_options',{p_treatment_id:required(treatmentId,'Atendimento')}) || [];
}
export async function resolveTreatmentAppointment({client,treatmentId,appointmentId=null,inicioIso=null}) {
  if(!appointmentId && !inicioIso) throw new Error('Selecione um agendamento ou informe o horário real da sessão.');
  return call(client,'bc_treatment_resolve_appointment',{p_treatment_id:required(treatmentId,'Atendimento'),p_agendamento_id:appointmentId||null,p_inicio:inicioIso||null});
}
