function ensureClient(client) {
  if (!client || typeof client.rpc !== 'function') throw new Error('Cliente Supabase indisponível.');
}
function required(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} é obrigatório.`);
  return clean;
}
function optional(value) {
  const clean = String(value ?? '').trim();
  return clean || null;
}
function percentage(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) throw new Error('Percentual inválido.');
  return amount;
}
function assertWeeklyPeriod(start, end) {
  const startClean = required(start, 'Início do período');
  const endClean = required(end, 'Fim do período');
  const startDate = new Date(`${startClean}T00:00:00Z`);
  const endDate = new Date(`${endClean}T00:00:00Z`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || (endDate - startDate) !== 6 * 86400000) {
    throw new Error('Livro deve conter exatamente 7 dias.');
  }
  return [startClean, endClean];
}
function throwIfError(error, fallback) {
  if (error) throw new Error(error.message || fallback);
}

export async function setCommission({ client, profissionalUserId, procedimentoId, percentual }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_comissao_set', {
    p_profissional_user_id: required(profissionalUserId, 'Profissional'),
    p_procedimento_id: required(procedimentoId, 'Procedimento'),
    p_percentual: percentage(percentual),
  });
  throwIfError(error, 'Não foi possível atualizar a comissão.');
  return data;
}

export async function listAdminCommissions({ client, profissionalUserId = null } = {}) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_financeiro_comissoes_admin', {
    p_profissional_user_id: optional(profissionalUserId),
  });
  throwIfError(error, 'Não foi possível carregar as comissões.');
  return data ?? [];
}

export async function closeBook({ client, profissionalUserId, periodoInicio, periodoFim }) {
  ensureClient(client);
  const [start, end] = assertWeeklyPeriod(periodoInicio, periodoFim);
  const { data, error } = await client.rpc('bc_livro_fechar', {
    p_profissional_user_id: required(profissionalUserId, 'Profissional'),
    p_periodo_inicio: start,
    p_periodo_fim: end,
  });
  throwIfError(error, 'Não foi possível fechar o livro financeiro.');
  return data;
}

export async function reopenBook({ client, livroId, motivo }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_livro_reabrir', {
    p_livro_id: required(livroId, 'Livro'),
    p_motivo: required(motivo, 'Motivo'),
  });
  throwIfError(error, 'Não foi possível reabrir o livro.');
  return data;
}

export async function recalculateBooks({ client, profissionalUserId, procedimentoId = null, periodoInicio, periodoFim }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_livros_recalcular', {
    p_profissional_user_id: required(profissionalUserId, 'Profissional'),
    p_procedimento_id: optional(procedimentoId),
    p_periodo_inicio: required(periodoInicio, 'Início do período'),
    p_periodo_fim: required(periodoFim, 'Fim do período'),
  });
  throwIfError(error, 'Não foi possível recalcular os livros.');
  return data;
}

export async function listOwnBooks({ client, periodoInicio, periodoFim }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_meus_livros_financeiros', {
    p_periodo_inicio: required(periodoInicio, 'Início do período'),
    p_periodo_fim: required(periodoFim, 'Fim do período'),
  });
  throwIfError(error, 'Não foi possível carregar seus livros financeiros.');
  return data ?? [];
}

export async function listAdminBooks({ client, profissionalUserId = null, periodoInicio = null, periodoFim = null } = {}) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_financeiro_livros_admin', {
    p_profissional_user_id: optional(profissionalUserId),
    p_periodo_inicio: optional(periodoInicio),
    p_periodo_fim: optional(periodoFim),
  });
  throwIfError(error, 'Não foi possível carregar os livros administrativos.');
  return data ?? [];
}
