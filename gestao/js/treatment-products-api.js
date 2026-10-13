function ensureClient(client){if(!client||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');}
function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function fail(error,fallback){if(error)throw error instanceof Error?error:new Error(error?.message||fallback);}
async function call(client,name,payload,fallback){ensureClient(client);const {data,error}=await client.rpc(name,payload);fail(error,fallback);return data;}

export async function listClinicalProducts({client,includeInactive=false}){
  return (await call(client,'bc_clinical_product_list',{p_include_inactive:Boolean(includeInactive)},'Não foi possível carregar os produtos.'))??[];
}

export async function saveClinicalProduct({client,productId=null,payload={}}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Dados do produto inválidos.');
  return await call(client,'bc_clinical_product_upsert',{p_product_id:productId?required(productId,'Produto'):null,p_payload:{...payload}},'Não foi possível salvar o produto.');
}

export async function listProductLots({client,productId,includeInactive=false}){
  return (await call(client,'bc_clinical_product_lot_list',{p_product_id:required(productId,'Produto'),p_include_inactive:Boolean(includeInactive)},'Não foi possível carregar os lotes.'))??[];
}

export async function saveProductLot({client,productId,payload={}}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Dados do lote inválidos.');
  return await call(client,'bc_clinical_product_lot_upsert',{p_product_id:required(productId,'Produto'),p_payload:{...payload}},'Não foi possível salvar o lote.');
}

export async function listTreatmentProductUsages({client,treatmentId}){
  return (await call(client,'bc_treatment_product_usage_list',{p_treatment_id:required(treatmentId,'Atendimento')},'Não foi possível carregar os produtos usados.'))??[];
}

export async function addTreatmentProductUsage({client,treatmentId,productId,lotId=null,quantity,unit}){
  const numeric=Number(quantity);
  if(!Number.isFinite(numeric)||numeric<=0)throw new Error('Quantidade deve ser maior que zero.');
  const cleanUnit=required(unit,'Unidade');
  return await call(client,'bc_treatment_product_usage_add',{
    p_treatment_id:required(treatmentId,'Atendimento'),
    p_product_id:required(productId,'Produto'),
    p_lot_id:lotId?required(lotId,'Lote'):null,
    p_quantity:numeric,
    p_unit:cleanUnit,
  },'Não foi possível registrar o produto no atendimento.');
}

export async function removeTreatmentProductUsage({client,usageId}){
  return await call(client,'bc_treatment_product_usage_remove',{p_usage_id:required(usageId,'Uso de produto')},'Não foi possível remover o produto do atendimento.');
}
