import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  setClientActive,
  listClientHistory,
} from '../../gestao/js/clientes-api.js';

function makeQuery(result = { data: [], error: null }) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'ilike', 'order', 'limit']) {
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

test('getClient busca cadastro único por id', async () => {
  const mock = makeClient({ queryResult: { data: { id: 'c1', nome: 'Ana' }, error: null } });
  const value = await getClient({ client: mock.client, clienteId: 'c1' });
  assert.equal(value.id, 'c1');
  assert.ok(hasCall(mock.queries[0].calls, 'eq', 'id', 'c1'));
});

test('create update e archive usam RPCs e não enviam autoria do browser', async () => {
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
