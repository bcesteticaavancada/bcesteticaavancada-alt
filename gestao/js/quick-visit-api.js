function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function optional(value){const clean=String(value??'').trim();return clean||null;}
function cleanList(value){return Array.isArray(value)?[...new Set(value.map((item)=>String(item??'').trim()).filter(Boolean))]:[];}
function ensureClient(client){if(!client||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');}
function fail(error,fallback){if(error)throw error instanceof Error?error:new Error(error?.message||fallback);}

export async function listQuickVisitProcedureOptions({client,profissionalUserId}={}){
  ensureClient(client);
  const {data,error}=await client.rpc('bc_quick_visit_procedure_options',{
    p_profissional_user_id:required(profissionalUserId,'Profissional'),
  });
  fail(error,'Não foi possível validar os procedimentos da profissional.');
  return Array.isArray(data)?data:[];
}

export async function createQuickVisit({
  client,
  requestKey,
  clienteId,
  profissionalUserId,
  procedimentoId,
  inicioIso,
  fimIso=null,
  observacao=null,
  componentVersionIds=[],
  componentKeys=[],
}){
  ensureClient(client);
  const {data,error}=await client.rpc('bc_quick_visit_create',{
    p_request_key:required(requestKey,'Chave da requisição'),
    p_cliente_id:required(clienteId,'Cliente'),
    p_profissional_user_id:required(profissionalUserId,'Profissional'),
    p_procedimento_id:required(procedimentoId,'Procedimento'),
    p_inicio:required(inicioIso,'Horário inicial'),
    p_fim:optional(fimIso),
    p_observacao:optional(observacao),
    p_component_version_ids:cleanList(componentVersionIds),
    p_component_keys:cleanList(componentKeys),
  });
  fail(error,'Não foi possível criar o encaixe.');
  if(!data?.appointment_id||!data?.treatment_id)throw new Error('O encaixe não retornou agenda e atendimento válidos.');
  return data;
}
