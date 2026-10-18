import test from 'node:test';
import assert from 'node:assert/strict';
import * as clientesApi from '../../gestao/js/clientes-api.js';

const {
  listClients,
  getClient,
  createClient,
  updateClient,
  setClientActive,
  listClientHistory,
} = clientesApi;

function makeQuery(result = { data: [], error: null }) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'ilike', 'or', 'order', 'limit']) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  query.single = async () => {
    calls.push(['single']);
    return result;
  };
  query.maybeSingle = async () => {
    calls.push(['maybeSingle']);
    return result;
  };
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return { query, calls };
}

function makeClient({ queryResult = { data: [], error: null }, rpcResult = { data: 'id-1', error: null } } = {}) {
  const tables = [];
  const rpcCalls = [];
  const queries = [];
  return {
    tables,
    rpcCalls,
    queries,
    client: {
      from(table) {
        tables.push(table);
        const built = makeQuery(queryResult);
        queries.push(built);
        return built.query;
      },
      async rpc(name, payload = {}) {
        rpcCalls.push([name, payload]);
        return rpcResult;
      },
    },
  };
}

function hasCall(calls, method, ...args) {
  return calls.some((entry) => entry[0] === method && args.every((arg, i) => entry[i + 1] === arg));
}

test('listClients filtra ativos por padrão e busca por nome', async () => {
  const mock = makeClient();
  await listClients({ client: mock.client, search: ' Ana ' });
  assert.equal(mock.tables[0], 'clientes');
  assert.ok(hasCall(mock.queries[0].calls, 'eq', 'ativo', true));
  assert.ok(hasCall(mock.queries[0].calls, 'ilike', 'nome', '%Ana%'));
});

test('listClients pode incluir arquivados quando solicitado', async () => {
  const mock = makeClient();
  await listClients({ client: mock.client, includeArchived: true });
  assert.equal(mock.queries[0].calls.some((call) => call[0] === 'eq' && call[1] === 'ativo'), false);
});

test('listClients seleciona os campos da pasta e busca CPF ou telefone por dígitos', async () => {
  const mock = makeClient();
  await listClients({ client: mock.client, search: '123.456' });
  const selectCall = mock.queries[0].calls.find((call) => call[0] === 'select');
  assert.ok(selectCall, 'deve selecionar campos do cadastro');
  for (const field of ['cpf', 'data_nascimento', 'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf']) {
    assert.match(selectCall[1], new RegExp(`\\b${field}\\b`));
  }
  const orCall = mock.queries[0].calls.find((call) => call[0] === 'or');
  assert.ok(orCall, 'busca numérica deve consultar CPF ou telefone');
  assert.match(orCall[1], /cpf\.ilike\.%123456%/);
  assert.match(orCall[1], /telefone\.ilike\.%123456%/);
});

test('getClient busca cadastro único por id', async () => {
  const mock = makeClient({ queryResult: { data: { id: 'c1', nome: 'Ana' }, error: null } });
  const value = await getClient({ client: mock.client, clienteId: 'c1' });
  assert.equal(value.id, 'c1');
  assert.ok(hasCall(mock.queries[0].calls, 'eq', 'id', 'c1'));
});

test('create update e archive legados usam RPCs e não enviam autoria do browser', async () => {
  const mock = makeClient();
  await createClient({ client: mock.client, nome: ' Ana ', telefone: ' 3199 ', email: ' a@b.com ' });
  await updateClient({ client: mock.client, clienteId: 'c1', nome: 'Ana B', telefone: '3188', email: '' });
  await setClientActive({ client: mock.client, clienteId: 'c1', active: false });
  assert.deepEqual(mock.rpcCalls, [
    ['bc_cliente_create', { p_nome: 'Ana', p_telefone: '3199', p_email: 'a@b.com' }],
    ['bc_cliente_update', { p_cliente_id: 'c1', p_nome: 'Ana B', p_telefone: '3188', p_email: null }],
    ['bc_cliente_set_active', { p_cliente_id: 'c1', p_active: false }],
  ]);
  assert.equal(JSON.stringify(mock.rpcCalls).includes('created_by'), false);
});

test('createClientV2 envia somente payload cadastral ao RPC v2', async () => {
  assert.equal(typeof clientesApi.createClientV2, 'function');
  const mock = makeClient();
  const payload = {
    nome: 'Cliente Teste',
    cpf: '123.456.789-00',
    data_nascimento: '1990-01-01',
    telefone: '31999999999',
    email: 'cliente@example.com',
  };
  await clientesApi.createClientV2({ client: mock.client, payload });
  assert.deepEqual(mock.rpcCalls[0], ['bc_cliente_create_v2', { p_payload: payload }]);
  assert.doesNotMatch(JSON.stringify(mock.rpcCalls[0]), /created_by|user_id|role/i);
});

test('updateClientV2 usa id separado do payload e não envia autoria', async () => {
  assert.equal(typeof clientesApi.updateClientV2, 'function');
  const mock = makeClient();
  const payload = { nome: 'Cliente Atualizada', telefone: '31888888888' };
  await clientesApi.updateClientV2({ client: mock.client, clienteId: 'c1', payload });
  assert.deepEqual(mock.rpcCalls[0], ['bc_cliente_update_v2', { p_cliente_id: 'c1', p_payload: payload }]);
  assert.doesNotMatch(JSON.stringify(mock.rpcCalls[0]), /created_by|updated_by|user_id|role/i);
});

test('findPotentialDuplicates usa RPC dedicado com identidade normalizada', async () => {
  assert.equal(typeof clientesApi.findPotentialDuplicates, 'function');
  const mock = makeClient({ rpcResult: { data: [], error: null } });
  await clientesApi.findPotentialDuplicates({
    client: mock.client,
    cpf: '123.456.789-00',
    nome: ' Cliente Teste ',
    dataNascimento: '1990-01-01',
    telefone: '(31) 99999-9999',
  });
  assert.deepEqual(mock.rpcCalls[0], ['bc_cliente_duplicate_candidates', {
    p_cpf: '12345678900',
    p_nome: 'Cliente Teste',
    p_data_nascimento: '1990-01-01',
    p_telefone: '31999999999',
  }]);
});

test('duplicidade pode ser verificada só com nome e telefone antes da avaliação', async () => {
  const mock = makeClient({ rpcResult: { data: [], error: null } });
  await clientesApi.findPotentialDuplicates({ client: mock.client, nome: ' Pessoa Fictícia ', telefone: '(31) 90000-0000' });
  assert.deepEqual(mock.rpcCalls[0], ['bc_cliente_duplicate_candidates', {
    p_cpf: '', p_nome: 'Pessoa Fictícia', p_data_nascimento: null, p_telefone: '31900000000',
  }]);
});

test('listClientHistory retorna timeline completa por cliente do mais recente', async () => {
  const mock = makeClient();
  await listClientHistory({ client: mock.client, clienteId: 'c1' });
  assert.equal(mock.tables[0], 'atendimentos');
  assert.ok(hasCall(mock.queries[0].calls, 'eq', 'cliente_id', 'c1'));
  assert.ok(mock.queries[0].calls.some((call) => call[0] === 'order' && call[1] === 'data_atendimento' && call[2]?.ascending === false));
});

test('erros de RPC nunca viram sucesso falso', async () => {
  const mock = makeClient({ rpcResult: { data: null, error: { message: 'denied' } } });
  await assert.rejects(
    () => createClient({ client: mock.client, nome: 'A', telefone: '1' }),
    /denied/,
  );
});
