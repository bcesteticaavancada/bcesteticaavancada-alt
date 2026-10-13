const MOMENTS=new Set(['antes','durante','apos']);
const SEVERITIES=new Set(['leve','moderada','grave','critica']);
const STATUSES=new Set(['aberta','acompanhamento','encerrada']);
const PATCH_FIELDS=new Set(['moment','severity','description','action_taken','occurred_at']);

function ensureClient(client){if(!client||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');}
function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function enumValue(value,allowed,label){const clean=required(value,label);if(!allowed.has(clean))throw new Error(`${label} inválido.`);return clean;}
function fail(error,fallback){if(error)throw error instanceof Error?error:new Error(error?.message||fallback);}
async function call(client,name,payload,fallback){ensureClient(client);const {data,error}=await client.rpc(name,payload);fail(error,fallback);return data;}
function sanitizePatch(patch={}){if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Correção de intercorrência inválida.');const out={};for(const [key,value] of Object.entries(patch)){if(PATCH_FIELDS.has(key))out[key]=value;}return out;}

export async function listTreatmentIntercurrences({client,treatmentId}){
  return (await call(client,'bc_treatment_intercurrence_list',{p_treatment_id:required(treatmentId,'Atendimento')},'Não foi possível carregar as intercorrências.'))??[];
}
export async function createTreatmentIntercurrence({client,treatmentId,moment,severity,description,actionTaken,occurredAt=null}){
  return await call(client,'bc_treatment_intercurrence_create',{
    p_treatment_id:required(treatmentId,'Atendimento'),p_moment:enumValue(moment,MOMENTS,'Momento'),p_severity:enumValue(severity,SEVERITIES,'Gravidade'),
    p_description:required(description,'Descrição'),p_action_taken:required(actionTaken,'Conduta registrada'),p_occurred_at:occurredAt?required(occurredAt,'Data da ocorrência'):null,
  },'Não foi possível registrar a intercorrência.');
}
export async function updateTreatmentIntercurrenceDraft({client,intercurrenceId,patch={}}){
  return await call(client,'bc_treatment_intercurrence_update_draft',{p_intercurrence_id:required(intercurrenceId,'Intercorrência'),p_patch:sanitizePatch(patch)},'Não foi possível corrigir a intercorrência.');
}
export async function addIntercurrenceEvolution({client,intercurrenceId,evolution,statusAfter}){
  return await call(client,'bc_intercurrence_add_update',{p_intercurrence_id:required(intercurrenceId,'Intercorrência'),p_evolution:required(evolution,'Evolução'),p_status_after:enumValue(statusAfter,STATUSES,'Status')},'Não foi possível registrar a evolução.');
}
export async function confirmOpenIntercurrencesForFinalization({client,treatmentId}){
  return await call(client,'bc_treatment_confirm_open_intercurrences',{p_treatment_id:required(treatmentId,'Atendimento')},'Não foi possível confirmar as intercorrências abertas.');
}
