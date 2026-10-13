function ensureClient(client){if(!client||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');}
function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function fail(error,fallback){if(error)throw error instanceof Error?error:new Error(error?.message||fallback);}
async function call(client,name,payload,fallback){ensureClient(client);const {data,error}=await client.rpc(name,payload);fail(error,fallback);return data;}
function object(value,label='Parâmetros'){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} deve ser um objeto.`);return {...value};}

export async function listClinicalEquipment({client,includeInactive=false}){
  return (await call(client,'bc_clinical_equipment_list',{p_include_inactive:Boolean(includeInactive)},'Não foi possível carregar os equipamentos.'))??[];
}
export async function saveClinicalEquipment({client,equipmentId=null,payload={}}){
  return await call(client,'bc_clinical_equipment_upsert',{p_equipment_id:equipmentId?required(equipmentId,'Equipamento'):null,p_payload:object(payload,'Dados do equipamento')},'Não foi possível salvar o equipamento.');
}
export async function listTreatmentEquipmentUsages({client,treatmentId}){
  return (await call(client,'bc_treatment_equipment_usage_list',{p_treatment_id:required(treatmentId,'Atendimento')},'Não foi possível carregar os equipamentos usados.'))??[];
}
export async function addTreatmentEquipmentUsage({client,treatmentId,equipmentId,parameterValues={}}){
  return await call(client,'bc_treatment_equipment_usage_add',{
    p_treatment_id:required(treatmentId,'Atendimento'),p_equipment_id:required(equipmentId,'Equipamento'),p_parameter_values:object(parameterValues),
  },'Não foi possível registrar o equipamento no atendimento.');
}
export async function removeTreatmentEquipmentUsage({client,usageId}){
  return await call(client,'bc_treatment_equipment_usage_remove',{p_usage_id:required(usageId,'Uso de equipamento')},'Não foi possível remover o equipamento do atendimento.');
}
