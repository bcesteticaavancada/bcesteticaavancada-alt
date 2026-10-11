function ensureClient(client) {
  if (!client || typeof client.rpc !== 'function') throw new Error('Cliente Supabase indisponível.');
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

function cleanCycle(value) {
  const cycle = Number(value);
  if (![7, 15, 30].includes(cycle)) throw new Error('Ciclo de repasse inválido.');
  return cycle;
}

function cleanBookIds(bookIds) {
  if (!Array.isArray(bookIds)) throw new Error('Selecione ao menos um livro financeiro.');
  const ids = [...new Set(bookIds.map((value) => String(value ?? '').trim()).filter(Boolean))];
  if (!ids.length) throw new Error('Selecione ao menos um livro financeiro.');
  return ids;
}

async function callRpc(client, name, payload, fallback) {
  ensureClient(client);
  const { data, error } = await client.rpc(name, payload);
  if (error) throw new Error(error.message || fallback);
  return data;
}

export async function setPayoutCycle({ client, profissionalUserId, cicloDias }) {
  return callRpc(client, 'bc_config_repasse_set', {
    p_profissional_user_id: cleanRequired(profissionalUserId, 'Profissional'),
    p_ciclo_dias: cleanCycle(cicloDias),
  }, 'Não foi possível atualizar o ciclo de repasse.');
}

export async function createPayout({ client, profissionalUserId, bookIds, observacao = null }) {
  return callRpc(client, 'bc_repasse_criar', {
    p_profissional_user_id: cleanRequired(profissionalUserId, 'Profissional'),
    p_livro_ids: cleanBookIds(bookIds),
    p_observacao: cleanOptional(observacao),
  }, 'Não foi possível criar o repasse.');
}

export async function settlePayout({ client, payoutId, pagoAt = null }) {
  return callRpc(client, 'bc_repasse_baixar', {
    p_repasse_id: cleanRequired(payoutId, 'Repasse'),
    p_pago_at: cleanOptional(pagoAt),
  }, 'Não foi possível dar baixa no repasse.');
}

export async function reversePayout({ client, payoutId, motivo }) {
  return callRpc(client, 'bc_repasse_estornar', {
    p_repasse_id: cleanRequired(payoutId, 'Repasse'),
    p_motivo: cleanRequired(motivo, 'Motivo'),
  }, 'Não foi possível estornar o repasse.');
}

export async function listOwnPayouts({ client, periodoInicio, periodoFim }) {
  const data = await callRpc(client, 'bc_meus_repasses', {
    p_periodo_inicio: cleanRequired(periodoInicio, 'Início do período'),
    p_periodo_fim: cleanRequired(periodoFim, 'Fim do período'),
  }, 'Não foi possível carregar seus repasses.');
  return data ?? [];
}

export async function listAdminPayouts({
  client,
  profissionalUserId = null,
  periodoInicio = null,
  periodoFim = null,
} = {}) {
  const data = await callRpc(client, 'bc_financeiro_repasses_admin', {
    p_profissional_user_id: cleanOptional(profissionalUserId),
    p_periodo_inicio: cleanOptional(periodoInicio),
    p_periodo_fim: cleanOptional(periodoFim),
  }, 'Não foi possível carregar os repasses administrativos.');
  return data ?? [];
}

export async function listAdminPayoutCycles({ client }) {
  const data = await callRpc(client, 'bc_financeiro_config_repasses_admin', {}, 'Não foi possível carregar os ciclos de repasse.');
  return data ?? [];
}
