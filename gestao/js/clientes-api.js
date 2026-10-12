import { normalizeCpf } from './clientes-domain.js';

const CLIENT_SELECT = 'id,nome,cpf,data_nascimento,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,responsavel_nome,responsavel_cpf,responsavel_parentesco,responsavel_telefone,ativo,arquivado_at,arquivado_by,created_at,updated_at';
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

function cleanPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Dados cadastrais inválidos.');
  }
  const allowed = [
    'nome',
    'cpf',
    'data_nascimento',
    'telefone',
    'email',
    'cep',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'uf',
    'responsavel_nome',
    'responsavel_cpf',
    'responsavel_parentesco',
    'responsavel_telefone',
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => Object.prototype.hasOwnProperty.call(payload, key))
      .map((key) => [key, payload[key]]),
  );
}

export async function listClients({ client, search = '', includeArchived = false }) {
  ensureClient(client);
  let query = client.from('clientes').select(CLIENT_SELECT);
  if (!includeArchived) query = query.eq('ativo', true);
  const term = String(search ?? '').trim();
  if (term) {
    const digits = term.replace(/\D/g, '');
    if (digits && digits.length >= 3 && /\d/.test(term)) {
      query = query.or(`cpf.ilike.%${digits}%,telefone.ilike.%${digits}%`);
    } else {
      query = query.ilike('nome', `%${term}%`);
    }
  }
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

export async function createClientV2({ client, payload }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_cliente_create_v2', {
    p_payload: cleanPayload(payload),
  });
  fail(error, 'Não foi possível cadastrar a cliente.');
  return data;
}

export async function updateClientV2({ client, clienteId, payload }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_cliente_update_v2', {
    p_cliente_id: required(clienteId, 'Cliente'),
    p_payload: cleanPayload(payload),
  });
  fail(error, 'Não foi possível atualizar a cliente.');
  return data;
}

export async function findPotentialDuplicates({ client, cpf, nome, dataNascimento, telefone }) {
  ensureClient(client);
  const { data, error } = await client.rpc('bc_cliente_duplicate_candidates', {
    p_cpf: normalizeCpf(cpf),
    p_nome: required(nome, 'Nome'),
    p_data_nascimento: required(dataNascimento, 'Data de nascimento'),
    p_telefone: String(telefone ?? '').replace(/\D/g, ''),
  });
  fail(error, 'Não foi possível verificar duplicidades.');
  return data ?? [];
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
