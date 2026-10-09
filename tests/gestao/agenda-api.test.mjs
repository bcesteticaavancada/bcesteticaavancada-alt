import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listOwnAppointments,
  listAdminAppointments,
  listAdminClients,
  createClient,
  listActiveProcedures,
  createProcedure,
  listActiveCollaborators,
  createAppointment,
  setAppointmentStatus,
  listAuthorizedHistory,
  listStaffDirectory,
  registerAttendance,
} from '../../gestao/js/agenda-api.js';

function makeQuery(result = { data: [], error: null }) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'gte', 'gt', 'lte', 'lt', 'order', 'ilike', 'insert']) {
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

function makeClient({ queryResult = { data: [], error: null }, rpcResult = { data: [], error: null } } = {}) {
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

test('listOwnAppointments filtra período e profissional autenticada explicitamente', async () => {
  const mock = makeClient();
  await listOwnAppointments({
    client: mock.client,
    userId: 'user-1',
    fromIso: '2026-10-09T03:00:00.000Z',
    toIso: '2026-10-10T03:00:00.000Z',
  });
  const calls = mock.queries[0].calls;
  assert.deepEqual(mock.tables, ['agendamentos']);
  assert.ok(hasCall(calls, 'eq', 'colaboradora_user_id', 'user-1'));
  assert.ok(hasCall(calls, 'gte', 'inicio', '2026-10-09T03:00:00.000Z'));
  assert.ok(hasCall(calls, 'lt', 'inicio', '2026-10-10T03:00:00.000Z'));
  assert.ok(calls.some((c) => c[0] === 'order' && c[1] === 'inicio'));
});

test('listAdminAppointments usa período sem inventar filtro de colaboradora', async () => {
  const mock = makeClient();
  await listAdminAppointments({ client: mock.client, fromIso: 'A', toIso: 'B' });
  const calls = mock.queries[0].calls;
  assert.ok(hasCall(calls, 'gte', 'inicio', 'A'));
  assert.ok(hasCall(calls, 'lt', 'inicio', 'B'));
  assert.equal(calls.some((c) => c[0] === 'eq' && c[1] === 'colaboradora_user_id'), false);
});

test('clientes: lista com busca opcional e cria payload mínimo', async () => {
  const listMock = makeClient();
  await listAdminClients({ client: listMock.client, search: 'Ana' });
  assert.ok(hasCall(listMock.queries[0].calls, 'ilike', 'nome', '%Ana%'));

  const created = { id: 'c1', nome: 'Ana', telefone: '3199' };
  const createMock = makeClient({ queryResult: { data: created, error: null } });
  const result = await createClient({ client: createMock.client, nome: ' Ana ', telefone: ' 3199 ', email: ' a@b.com ', createdBy: 'admin-1' });
  const insert = createMock.queries[0].calls.find((c) => c[0] === 'insert');
  assert.deepEqual(insert[1], { nome: 'Ana', telefone: '3199', email: 'a@b.com', created_by: 'admin-1' });
  assert.deepEqual(result, created);
});

test('procedimentos: lista apenas ativos e cria duração opcional', async () => {
  const listMock = makeClient();
  await listActiveProcedures({ client: listMock.client });
  assert.ok(hasCall(listMock.queries[0].calls, 'eq', 'ativo', true));

  const createMock = makeClient({ queryResult: { data: { id: 'p1' }, error: null } });
  await createProcedure({ client: createMock.client, nome: 'Limpeza de pele', duracaoPadrao: 60, createdBy: 'admin-1' });
  const insert = createMock.queries[0].calls.find((c) => c[0] === 'insert');
  assert.deepEqual(insert[1], { nome: 'Limpeza de pele', duracao_padrao: 60, created_by: 'admin-1' });
});

test('diretório de colaboradoras usa RPC mínima', async () => {
  const mock = makeClient({ rpcResult: { data: [{ user_id: 'u1', display_name: 'Alice' }], error: null } });
  const a = await listActiveCollaborators({ client: mock.client });
  const b = await listStaffDirectory({ client: mock.client });
  assert.deepEqual(a, [{ user_id: 'u1', display_name: 'Alice' }]);
  assert.deepEqual(b, [{ user_id: 'u1', display_name: 'Alice' }]);
  assert.deepEqual(mock.rpcCalls, [
    ['bc_staff_directory', {}],
    ['bc_staff_directory', {}],
  ]);
});

test('createAppointment envia apenas vínculo, horário, observação e autoria', async () => {
  const mock = makeClient({ queryResult: { data: { id: 'a1' }, error: null } });
  await createAppointment({
    client: mock.client,
    clienteId: 'c1',
    colaboradoraUserId: 'u1',
    procedimentoId: 'p1',
    inicioIso: '2026-10-09T12:00:00Z',
    fimIso: '2026-10-09T13:00:00Z',
    observacao: 'retorno',
    createdBy: 'admin-1',
  });
  const insert = mock.queries[0].calls.find((c) => c[0] === 'insert');
  assert.deepEqual(insert[1], {
    cliente_id: 'c1',
    colaboradora_user_id: 'u1',
    procedimento_id: 'p1',
    inicio: '2026-10-09T12:00:00Z',
    fim: '2026-10-09T13:00:00Z',
    observacao_administrativa: 'retorno',
    created_by: 'admin-1',
  });
});

test('status e registro de atendimento usam RPCs com payload mínimo', async () => {
  const mock = makeClient({ rpcResult: { data: 'ok-id', error: null } });
  const status = await setAppointmentStatus({ client: mock.client, appointmentId: 'a1', status: 'faltou' });
  const attendance = await registerAttendance({
    client: mock.client,
    appointmentId: 'a1',
    fields: {
      queixa_objetivo: 'Sensibilidade',
      observacoes: 'Pele íntegra',
      reacoes: '',
      intercorrencias: '',
      feedback_cliente: 'Bem',
      orientacoes: 'FPS',
      recomendacao_proxima_sessao: '30 dias',
      cliente_id: 'NUNCA-ENVIAR',
    },
  });
  assert.equal(status, 'ok-id');
  assert.equal(attendance, 'ok-id');
  assert.deepEqual(mock.rpcCalls[0], ['bc_set_agendamento_status', { p_agendamento_id: 'a1', p_status: 'faltou' }]);
  assert.deepEqual(mock.rpcCalls[1], ['bc_registrar_atendimento', {
    p_agendamento_id: 'a1',
    p_queixa_objetivo: 'Sensibilidade',
    p_observacoes: 'Pele íntegra',
    p_reacoes: '',
    p_intercorrencias: '',
    p_feedback_cliente: 'Bem',
    p_orientacoes: 'FPS',
    p_recomendacao_proxima_sessao: '30 dias',
  }]);
});

test('histórico autorizado filtra por cliente e ordena do mais recente', async () => {
  const mock = makeClient();
  await listAuthorizedHistory({ client: mock.client, clienteId: 'c1' });
  const calls = mock.queries[0].calls;
  assert.deepEqual(mock.tables, ['atendimentos']);
  assert.ok(hasCall(calls, 'eq', 'cliente_id', 'c1'));
  assert.ok(calls.some((c) => c[0] === 'order' && c[1] === 'data_atendimento' && c[2]?.ascending === false));
});

test('erros do Supabase viram exceção e nunca sucesso falso', async () => {
  const mock = makeClient({ rpcResult: { data: null, error: { message: 'denied' } } });
  await assert.rejects(
    () => setAppointmentStatus({ client: mock.client, appointmentId: 'a1', status: 'faltou' }),
    /denied/i,
  );
});
