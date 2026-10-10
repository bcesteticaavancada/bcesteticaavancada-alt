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
  updateAppointment,
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
});

test('listAdminAppointments usa período sem filtro de profissional', async () => {
  const mock = makeClient();
  await listAdminAppointments({ client: mock.client, fromIso: 'A', toIso: 'B' });
  const calls = mock.queries[0].calls;
  assert.ok(hasCall(calls, 'gte', 'inicio', 'A'));
  assert.ok(hasCall(calls, 'lt', 'inicio', 'B'));
  assert.equal(calls.some((call) => call[0] === 'eq' && call[1] === 'colaboradora_user_id'), false);
});

test('ponte legada de clientes já usa API segura e filtro de ativos', async () => {
  const listMock = makeClient();
  await listAdminClients({ client: listMock.client, search: 'Ana' });
  assert.ok(hasCall(listMock.queries[0].calls, 'eq', 'ativo', true));
  assert.ok(hasCall(listMock.queries[0].calls, 'ilike', 'nome', '%Ana%'));

  const createMock = makeClient({ rpcResult: { data: 'c1', error: null } });
  const result = await createClient({
    client: createMock.client,
    nome: ' Ana ',
    telefone: ' 3199 ',
    email: ' a@b.com ',
    createdBy: 'ignorado',
  });
  assert.equal(result, 'c1');
  assert.deepEqual(createMock.rpcCalls[0], [
    'bc_cliente_create',
    { p_nome: 'Ana', p_telefone: '3199', p_email: 'a@b.com' },
  ]);
});

test('procedimentos: lista apenas ativos e cria duração opcional', async () => {
  const listMock = makeClient();
  await listActiveProcedures({ client: listMock.client });
  assert.ok(hasCall(listMock.queries[0].calls, 'eq', 'ativo', true));

  const createMock = makeClient({ queryResult: { data: { id: 'p1' }, error: null } });
  await createProcedure({ client: createMock.client, nome: 'Limpeza de pele', duracaoPadrao: 60, createdBy: 'admin-1' });
  const insert = createMock.queries[0].calls.find((call) => call[0] === 'insert');
  assert.deepEqual(insert[1], { nome: 'Limpeza de pele', duracao_padrao: 60, created_by: 'admin-1' });
});

test('diretório clínico usa RPC mínima', async () => {
  const mock = makeClient({ rpcResult: { data: [{ user_id: 'm1', display_name: 'Mel' }], error: null } });
  const first = await listActiveCollaborators({ client: mock.client });
  const second = await listStaffDirectory({ client: mock.client });
  assert.deepEqual(first, [{ user_id: 'm1', display_name: 'Mel' }]);
  assert.deepEqual(second, [{ user_id: 'm1', display_name: 'Mel' }]);
  assert.deepEqual(mock.rpcCalls, [
    ['bc_staff_directory', {}],
    ['bc_staff_directory', {}],
  ]);
});

test('createAppointment usa RPC sem created_by', async () => {
  const mock = makeClient({ rpcResult: { data: 'a1', error: null } });
  const result = await createAppointment({
    client: mock.client,
    clienteId: 'c1',
    colaboradoraUserId: 'u1',
    procedimentoId: 'p1',
    inicioIso: '2026-10-09T12:00:00Z',
    fimIso: '2026-10-09T13:00:00Z',
    observacao: 'retorno',
    createdBy: 'ignorado',
  });
  assert.equal(result, 'a1');
  assert.deepEqual(mock.rpcCalls[0], ['bc_agendamento_create', {
    p_cliente_id: 'c1',
    p_colaboradora_user_id: 'u1',
    p_procedimento_id: 'p1',
    p_inicio: '2026-10-09T12:00:00Z',
    p_fim: '2026-10-09T13:00:00Z',
    p_observacao: 'retorno',
  }]);
  assert.equal(JSON.stringify(mock.rpcCalls[0]).includes('created_by'), false);
});

test('updateAppointment usa RPC segura sem permitir trocar profissional', async () => {
  const mock = makeClient({ rpcResult: { data: 'a1', error: null } });
  await updateAppointment({
    client: mock.client,
    appointmentId: 'a1',
    procedimentoId: 'p2',
    inicioIso: '2026-10-09T14:00:00Z',
    fimIso: null,
    observacao: '',
  });
  assert.deepEqual(mock.rpcCalls[0], ['bc_agendamento_update', {
    p_agendamento_id: 'a1',
    p_procedimento_id: 'p2',
    p_inicio: '2026-10-09T14:00:00Z',
    p_fim: null,
    p_observacao: null,
  }]);
  assert.equal(JSON.stringify(mock.rpcCalls[0]).includes('colaboradora'), false);
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
  assert.equal(JSON.stringify(mock.rpcCalls[1]).includes('NUNCA-ENVIAR'), false);
});

test('histórico filtra por cliente e ordena do mais recente', async () => {
  const mock = makeClient();
  await listAuthorizedHistory({ client: mock.client, clienteId: 'c1' });
  const calls = mock.queries[0].calls;
  assert.deepEqual(mock.tables, ['atendimentos']);
  assert.ok(hasCall(calls, 'eq', 'cliente_id', 'c1'));
  assert.ok(calls.some((call) => call[0] === 'order' && call[1] === 'data_atendimento' && call[2]?.ascending === false));
});

test('erros do Supabase viram exceção e nunca sucesso falso', async () => {
  const mock = makeClient({ rpcResult: { data: null, error: { message: 'denied' } } });
  await assert.rejects(
    () => setAppointmentStatus({ client: mock.client, appointmentId: 'a1', status: 'faltou' }),
    /denied/i,
  );
});
