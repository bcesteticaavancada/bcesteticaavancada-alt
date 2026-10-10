import test from 'node:test';
import assert from 'node:assert/strict';
import { listAuditLog } from '../../gestao/js/audit-api.js';

function makeQuery(result = { data: [], error: null }) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'order', 'limit']) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return { query, calls };
}

function makeClient(result) {
  const queries = [];
  return {
    queries,
    client: {
      from(table) {
        assert.equal(table, 'audit_log');
        const built = makeQuery(result);
        queries.push(built);
        return built.query;
      },
    },
  };
}

function hasCall(calls, method, ...args) {
  return calls.some((entry) => entry[0] === method && args.every((arg, i) => entry[i + 1] === arg));
}

test('listAuditLog ordena recente, limita e aceita filtros de entidade', async () => {
  const mock = makeClient();
  await listAuditLog({ client: mock.client, limit: 50, entityType: 'clientes', entityId: 'c1' });
  const calls = mock.queries[0].calls;
  assert.ok(hasCall(calls, 'eq', 'entity_type', 'clientes'));
  assert.ok(hasCall(calls, 'eq', 'entity_id', 'c1'));
  assert.ok(hasCall(calls, 'limit', 50));
  assert.ok(calls.some((call) => call[0] === 'order' && call[1] === 'created_at' && call[2]?.ascending === false));
});

test('listAuditLog propaga erro', async () => {
  const mock = makeClient({ data: null, error: { message: 'forbidden' } });
  await assert.rejects(() => listAuditLog({ client: mock.client }), /forbidden/);
});
