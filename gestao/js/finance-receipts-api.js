function inputError(message){return Object.assign(new Error(message),{confirmedFailure:true});}
function ensureClient(client) {
  if (!client || typeof client.rpc !== 'function') {
    throw inputError('Cliente Supabase indisponível.');
  }
}

function cleanRequired(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw inputError(`${label} é obrigatório.`);
  return clean;
}

function cleanOptional(value) {
  const clean = String(value ?? '').trim();
  return clean || null;
}

function positiveMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw inputError('Valor recebido deve ser maior que zero.');
  }
  return amount;
}

function throwIfError(error, fallback) {
  if (!error) return;
  throw Object.assign(new Error(error.message||fallback),{code:error.code,confirmedFailure:/^(?:(?:22|23|25|28|40|42|55|P0|XX)[0-9A-Z]{3}|PGRST[123][0-9]{2})$/.test(error.code||'')});
}

export async function registerReceipt({
  client,
  atendimentoId,
  requestKey,
  valor,
  formaPagamento,
  recebidoAt = null,
  observacao = null,
}) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_recebimento_registrar_v2', {
    p_atendimento_id: cleanRequired(atendimentoId, 'Atendimento'),
    p_valor: positiveMoney(valor),
    p_forma_pagamento: cleanRequired(formaPagamento, 'Forma de pagamento'),
    p_recebido_at: recebidoAt ? String(recebidoAt).trim() : null,
    p_observacao: cleanOptional(observacao),
    p_request_key: cleanRequired(requestKey,'Chave da tentativa'),
  });
  throwIfError(error, 'Não foi possível registrar o recebimento.');
  return data;
}

export async function registerReceiptForAppointment({client,appointmentId,requestKey,valor,formaPagamento,recebidoAt=null,observacao=null}) {
  ensureClient(client);
  const {data,error}=await client.rpc('bc_recebimento_registrar_agendamento_v2',{
    p_agendamento_id:cleanRequired(appointmentId,'Agendamento'),
    p_valor:positiveMoney(valor),
    p_forma_pagamento:cleanRequired(formaPagamento,'Forma de pagamento'),
    p_recebido_at:recebidoAt?String(recebidoAt).trim():null,
    p_observacao:cleanOptional(observacao),
    p_request_key:cleanRequired(requestKey,'Chave da tentativa'),
  });
  throwIfError(error,'Não foi possível registrar o recebimento.');
  return data;
}

export async function reverseReceipt({ client, recebimentoId, motivo }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_recebimento_estornar', {
    p_recebimento_id: cleanRequired(recebimentoId, 'Recebimento'),
    p_motivo: cleanRequired(motivo, 'Motivo'),
  });
  throwIfError(error, 'Não foi possível estornar o recebimento.');
  return data;
}

export async function listOwnReceipts({ client, periodoInicio, periodoFim }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_meus_recebimentos', {
    p_periodo_inicio: cleanRequired(periodoInicio, 'Início do período'),
    p_periodo_fim: cleanRequired(periodoFim, 'Fim do período'),
  });
  throwIfError(error, 'Não foi possível carregar seus recebimentos.');
  return data ?? [];
}

export async function listAdminReceipts({
  client,
  profissionalUserId = null,
  periodoInicio = null,
  periodoFim = null,
} = {}) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_financeiro_recebimentos_admin', {
    p_profissional_user_id: cleanOptional(profissionalUserId),
    p_periodo_inicio: cleanOptional(periodoInicio),
    p_periodo_fim: cleanOptional(periodoFim),
  });
  throwIfError(error, 'Não foi possível carregar os recebimentos administrativos.');
  return data ?? [];
}
