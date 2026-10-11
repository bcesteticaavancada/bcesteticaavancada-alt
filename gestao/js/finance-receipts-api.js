function ensureClient(client) {
  if (!client || typeof client.rpc !== 'function') {
    throw new Error('Cliente Supabase indisponível.');
  }
}

function cleanRequired(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} é obrigatório.`);
  return clean;
}

function cleanOptional(value) {
  const clean = String(value ?? '').trim();
  return clean || null;
}

function cleanPositiveMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Valor recebido inválido.');
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function throwIfError(error, fallback) {
  if (!error) return;
  throw new Error(error.message || fallback);
}

async function callRpc(client, name, payload, fallback) {
  ensureClient(client);
  const { data, error } = await client.rpc(name, payload);
  throwIfError(error, fallback);
  return data;
}

export async function registerReceipt({
  client,
  atendimentoId,
  valor,
  formaPagamento,
  recebidoAt = null,
  observacao = null,
}) {
  const payload = {
    p_atendimento_id: cleanRequired(atendimentoId, 'Atendimento'),
    p_valor: cleanPositiveMoney(valor),
    p_forma_pagamento: cleanRequired(formaPagamento, 'Forma de pagamento'),
    p_recebido_at: cleanOptional(recebidoAt),
    p_observacao: cleanOptional(observacao),
  };
  return callRpc(client, 'bc_recebimento_registrar', payload, 'Não foi possível registrar o recebimento.');
}

export async function reverseReceipt({ client, receiptId, motivo }) {
  return callRpc(client, 'bc_recebimento_estornar', {
    p_recebimento_id: cleanRequired(receiptId, 'Recebimento'),
    p_motivo: cleanRequired(motivo, 'Motivo'),
  }, 'Não foi possível estornar o recebimento.');
}

export async function listOwnReceipts({ client, periodoInicio, periodoFim }) {
  const data = await callRpc(client, 'bc_meus_recebimentos', {
    p_periodo_inicio: cleanRequired(periodoInicio, 'Início do período'),
    p_periodo_fim: cleanRequired(periodoFim, 'Fim do período'),
  }, 'Não foi possível carregar seus recebimentos.');
  return data ?? [];
}

export async function listAdminReceipts({
  client,
  profissionalUserId = null,
  periodoInicio = null,
  periodoFim = null,
} = {}) {
  const data = await callRpc(client, 'bc_financeiro_recebimentos_admin', {
    p_profissional_user_id: cleanOptional(profissionalUserId),
    p_periodo_inicio: cleanOptional(periodoInicio),
    p_periodo_fim: cleanOptional(periodoFim),
  }, 'Não foi possível carregar os recebimentos administrativos.');
  return data ?? [];
}
