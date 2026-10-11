import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setPayoutCycle,
  createPayout,
  settlePayout,
  reversePayout,
  listOwnPayouts,
  listAdminPayouts,
} from '../../gestao/js/finance-payouts-api.js';

function makeClient(responseByRpc = {}) {
  const calls = [];
  return {
    calls,
    client: {
      rpc: async (name, payload) => {
        calls.push({ name, payload });
        return responseByRpc[name] ?? { data: null, error: null };
      },
    },
  };
}

test('setPayoutCycle aceita somente 7, 15 ou 30', async () => {
  const { client, calls } = makeClient({ bc_config_repasse_set: { data: 'u1', error: null } });
  const result = await setPayoutCycle({ client, profissionalUserId: ' u1 ', cicloDias: '15' });
  assert.equal(result, 'u1');
  assert.deepEqual(calls[0], {
    name: 'bc_config_repasse_set',
    payload: { p_profissional_user_id: 'u1', p_ciclo_dias: 15 },
  });
  await assert.rejects(() => setPayoutCycle({ client, profissionalUserId: 'u1', cicloDias: 10 }), /ciclo de repasse inválido/i);
});

test('createPayout envia livros normalizados e observação opcional', async () => {
  const { client, calls } = makeClient({ bc_repasse_criar: { data: 'rep-1', error: null } });
  const result = await createPayout({
    client,
    profissionalUserId: 'u1',
    bookIds: [' b1 ', 'b2'],
    observacao: ' quinzenal ',
  });
  assert.equal(result, 'rep-1');
  assert.deepEqual(calls[0], {
    name: 'bc_repasse_criar',
    payload: {
      p_profissional_user_id: 'u1',
      p_livro_ids: ['b1', 'b2'],
      p_observacao: 'quinzenal',
    },
  });
});

test('createPayout rejeita lista vazia de livros', async () => {
  const { client, calls } = makeClient();
  await assert.rejects(() => createPayout({ client, profissionalUserId: 'u1', bookIds: [] }), /livro financeiro/i);
  assert.equal(calls.length, 0);
});

test('settlePayout e reversePayout chamam apenas RPCs administrativas', async () => {
  const { client, calls } = makeClient({
    bc_repasse_baixar: { data: 'rep-1', error: null },
    bc_repasse_estornar: { data: 'rep-1', error: null },
  });
  await settlePayout({ client, payoutId: ' rep-1 ', pagoAt: '2026-10-11T18:00:00-03:00' });
  await reversePayout({ client, payoutId: 'rep-1', motivo: ' correção ' });
  assert.deepEqual(calls[0], {
    name: 'bc_repasse_baixar',
    payload: { p_repasse_id: 'rep-1', p_pago_at: '2026-10-11T18:00:00-03:00' },
  });
  assert.deepEqual(calls[1], {
    name: 'bc_repasse_estornar',
    payload: { p_repasse_id: 'rep-1', p_motivo: 'correção' },
  });
});

test('listOwnPayouts não envia identidade da profissional', async () => {
  const rows = [{ id: 'rep-1', valor_total: 500, status: 'pago' }];
  const { client, calls } = makeClient({ bc_meus_repasses: { data: rows, error: null } });
  const result = await listOwnPayouts({ client, periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  assert.deepEqual(result, rows);
  assert.deepEqual(calls[0], {
    name: 'bc_meus_repasses',
    payload: { p_periodo_inicio: '2026-10-01', p_periodo_fim: '2026-10-31' },
  });
});

test('listAdminPayouts aceita filtros opcionais', async () => {
  const { client, calls } = makeClient({ bc_financeiro_repasses_admin: { data: [], error: null } });
  await listAdminPayouts({ client, profissionalUserId: 'u1', periodoInicio: null, periodoFim: null });
  assert.deepEqual(calls[0], {
    name: 'bc_financeiro_repasses_admin',
    payload: {
      p_profissional_user_id: 'u1',
      p_periodo_inicio: null,
      p_periodo_fim: null,
    },
  });
});
