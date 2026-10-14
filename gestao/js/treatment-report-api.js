function ensureClient(client){if(!client||typeof client.rpc!=='function')throw new Error('Cliente Supabase indisponível.');}
function required(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function optional(value){const clean=String(value??'').trim();return clean||null;}
function fail(error,fallback){if(error)throw error instanceof Error?error:new Error(error?.message||fallback);}
function dateOrNull(value){
  const clean=optional(value);
  if(!clean)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(clean))throw new Error('Data sugerida para retorno é inválida.');
  const parsed=new Date(`${clean}T00:00:00Z`);
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==clean)throw new Error('Data sugerida para retorno é inválida.');
  return clean;
}

export async function getTreatmentReport({client,treatmentId}={}){
  ensureClient(client);
  const {data,error}=await client.rpc('bc_treatment_report_get',{
    p_treatment_id:required(treatmentId,'Atendimento'),
  });
  fail(error,'Não foi possível carregar o parecer clínico.');
  return data||null;
}

export async function saveTreatmentReport({client,treatmentId,payload={}}={}){
  ensureClient(client);
  const retornoNecessario=payload?.retorno_necessario===true;
  const cleanPayload={
    descricao_sessao:required(payload?.descricao_sessao,'Descrição da sessão'),
    resposta_observada:required(payload?.resposta_observada,'Resposta observada'),
    orientacoes:required(payload?.orientacoes,'Orientações'),
    retorno_necessario:retornoNecessario,
    retorno_sugerido_em:retornoNecessario?dateOrNull(payload?.retorno_sugerido_em):null,
    observacoes:optional(payload?.observacoes),
  };
  const {data,error}=await client.rpc('bc_treatment_report_upsert',{
    p_treatment_id:required(treatmentId,'Atendimento'),
    p_payload:cleanPayload,
  });
  fail(error,'Não foi possível salvar o parecer clínico.');
  if(!data)throw new Error('O parecer clínico não retornou identificador válido.');
  return data;
}
