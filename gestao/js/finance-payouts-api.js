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
function cycle(value) {
  const days = Number(value);
  if (![7, 15, 30].includes(days)) throw new Error('Ciclo inválido: use 7, 15 ou 30 dias.');
  return days;
}
function bookIds(values) {
  const clean = [...new Set((Array.isArray(values) ? values : []).map((item) => String(item ?? '').trim()).filter(Boolean))];
  if (!clean.length) throw new Error('Selecione ao menos um livro financeiro.');
  return clean;
}
function throwIfError(error, fallback) { if (error) throw new Error(error.message || fallback); }

export async function setPayoutCycle({ client, profissionalUserId, cicloDias }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_config_repasse_set', {
    p_profissional_user_id: required(profissionalUserId, 'Profissional'),
    p_ciclo_dias: cycle(cicloDias),
  });
  throwIfError(error, 'Não foi possível configurar o ciclo de repasse.');
  return data;
}

export async function createPayout({ client, profissionalUserId, livroIds, observacao = null }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_repasse_criar', {
    p_profissional_user_id: required(profissionalUserId, 'Profissional'),
    p_livro_ids: bookIds(livroIds),
    p_observacao: optional(observacao),
  });
  throwIfError(error, 'Não foi possível criar o repasse.');
  return data;
}

export async function settlePayout({ client, repasseId, pagoAt = null }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_repasse_baixar', {
    p_repasse_id: required(repasseId, 'Repasse'),
    p_pago_at: pagoAt ? String(pagoAt).trim() : null,
  });
  throwIfError(error, 'Não foi possível baixar o repasse.');
  return data;
}

export async function reversePayout({ client, repasseId, motivo }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_repasse_estornar', {
    p_repasse_id: required(repasseId, 'Repasse'),
    p_motivo: required(motivo, 'Motivo'),
  });
  throwIfError(error, 'Não foi possível estornar o repasse.');
  return data;
}

export async function listOwnPayouts({ client, periodoInicio, periodoFim }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_meus_repasses', {
    p_periodo_inicio: required(periodoInicio, 'Início do período'),
    p_periodo_fim: required(periodoFim, 'Fim do período'),
  });
  throwIfError(error, 'Não foi possível carregar seus repasses.');
  return data ?? [];
}

export async function listAdminPayouts({ client, profissionalUserId = null, periodoInicio = null, periodoFim = null } = {}) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_financeiro_repasses_admin', {
    p_profissional_user_id: optional(profissionalUserId),
    p_periodo_inicio: optional(periodoInicio),
    p_periodo_fim: optional(periodoFim),
  });
  throwIfError(error, 'Não foi possível carregar os repasses administrativos.');
  return data ?? [];
}
