const CLIENT_SELECT = 'id,nome,telefone,email,ativo,arquivado_at,arquivado_by,created_at,updated_at';
const HISTORY_SELECT = `
  id,
  agendamento_id,
  cliente_id,
  colaboradora_user_id,
  procedimento_id,
  data_atendimento,
  queixa_objetivo,
  observacoes,
  reacoes,
  intercorrencias,
  feedback_cliente,
  orientacoes,
  recomendacao_proxima_sessao,
  procedimentos(id,nome)
`;

function ensureClient(client) {
  if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') {
    throw new Error('Cliente Supabase indisponível.');
  }
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

function fail(error, fallback) {
  if (error) throw new Error(error.message || fallback);
}

async function rows(query, fallback) {
  const { data, error } = await query;
  fail(error, fallback);
  return data ?? [];
}

export async function listClients({ client, search = '', includeArchived = false }) {
  ensureClient(client);
  let query = client.from('clientes').select(CLIENT_SELECT);
  if (!includeArchived) query = query.eq('ativo', true);
  const term = String(search ?? '').trim();
  if (term) query = query.ilike('nome', `%${term}%`);
  return rows(query.order('nome', { ascending: true }), 'Não foi possível carregar os clientes.');
}

export async function getClient({ client, clienteId }) {
  ensureClient(client);
  const { data, error } = await client
    .from('clientes')
    .select(CLIENT_SELECT)
    .eq('id', required(clienteId, 'Cliente'))
    .maybeSingle();
  fail(error, 'Não foi possível carregar o cliente.');
  if (!data) throw new Error('Cliente não encontrado.');
  return data;
}

export async function createClient({ client, nome, telefone, email = null }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_cliente_create', {
    p_nome: required(nome, 'Nome'),
    p_telefone: required(telefone, 'Telefone'),
    p_email: optional(email),
  });
  fail(error, 'Não foi possível cadastrar o cliente.');
  return data;
}

export async function updateClient({ client, clienteId, nome, telefone, email = null }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_cliente_update', {
    p_cliente_id: required(clienteId, 'Cliente'),
    p_nome: required(nome, 'Nome'),
    p_telefone: required(telefone, 'Telefone'),
    p_email: optional(email),
  });
  fail(error, 'Não foi possível atualizar o cliente.');
  return data;
}

export async function setClientActive({ client, clienteId, active }) {
  ensureClient(client);
  if (typeof active !== 'boolean') throw new Error('Estado do cliente inválido.');
  const { data, error } = await client.rpc('bc_cliente_set_active', {
    p_cliente_id: required(clienteId, 'Cliente'),
    p_active: active,
  });
  fail(error, 'Não foi possível alterar o estado do cliente.');
  return data;
}

export async function listClientHistory({ client, clienteId }) {
  ensureClient(client);
  const query = client
    .from('atendimentos')
    .select(HISTORY_SELECT)
    .eq('cliente_id', required(clienteId, 'Cliente'))
    .order('data_atendimento', { ascending: false });
  return rows(query, 'Não foi possível carregar o histórico do cliente.');
}
