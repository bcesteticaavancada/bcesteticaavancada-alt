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

function cleanPercentage(value) {
  const percentage = Number(value);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error('Percentual inválido.');
  }
  return Math.round((percentage + Number.EPSILON) * 100) / 100;
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

export async function setCommission({ client, profissionalUserId, procedimentoId, percentual }) {
  return callRpc(client, 'bc_comissao_set', {
    p_profissional_user_id: cleanRequired(profissionalUserId, 'Profissional'),
    p_procedimento_id: cleanRequired(procedimentoId, 'Procedimento'),
    p_percentual: cleanPercentage(percentual),
  }, 'Não foi possível atualizar a comissão.');
}

export async function listAdminCommissions({ client, profissionalUserId = null } = {}) {
  const data = await callRpc(client, 'bc_financeiro_comissoes_admin', {
    p_profissional_user_id: cleanOptional(profissionalUserId),
  }, 'Não foi possível carregar as comissões.');
  return data ?? [];
}

export async function closeBook({ client, profissionalUserId, periodoInicio, periodoFim }) {
  return callRpc(client, 'bc_livro_fechar', {
    p_profissional_user_id: cleanRequired(profissionalUserId, 'Profissional'),
    p_periodo_inicio: cleanRequired(periodoInicio, 'Início do período'),
    p_periodo_fim: cleanRequired(periodoFim, 'Fim do período'),
  }, 'Não foi possível fechar o livro financeiro.');
}

export async function reopenBook({ client, bookId, motivo }) {
  return callRpc(client, 'bc_livro_reabrir', {
    p_livro_id: cleanRequired(bookId, 'Livro financeiro'),
    p_motivo: cleanRequired(motivo, 'Motivo'),
  }, 'Não foi possível reabrir o livro financeiro.');
}

export async function recalculateBooks({
  client,
  profissionalUserId,
  procedimentoId = null,
  periodoInicio,
  periodoFim,
}) {
  return callRpc(client, 'bc_livros_recalcular', {
    p_profissional_user_id: cleanRequired(profissionalUserId, 'Profissional'),
    p_procedimento_id: cleanOptional(procedimentoId),
    p_periodo_inicio: cleanRequired(periodoInicio, 'Início do período'),
    p_periodo_fim: cleanRequired(periodoFim, 'Fim do período'),
  }, 'Não foi possível recalcular os livros financeiros.');
}

export async function listOwnBooks({ client, periodoInicio, periodoFim }) {
  const data = await callRpc(client, 'bc_meus_livros_financeiros', {
    p_periodo_inicio: cleanRequired(periodoInicio, 'Início do período'),
    p_periodo_fim: cleanRequired(periodoFim, 'Fim do período'),
  }, 'Não foi possível carregar seus livros financeiros.');
  return data ?? [];
}

export async function listAdminBooks({
  client,
  profissionalUserId = null,
  periodoInicio = null,
  periodoFim = null,
} = {}) {
  const data = await callRpc(client, 'bc_financeiro_livros_admin', {
    p_profissional_user_id: cleanOptional(profissionalUserId),
    p_periodo_inicio: cleanOptional(periodoInicio),
    p_periodo_fim: cleanOptional(periodoFim),
  }, 'Não foi possível carregar os livros financeiros administrativos.');
  return data ?? [];
}
