import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerReceipt,
  reverseReceipt,
  listOwnReceipts,
  listAdminReceipts,
} from '../../gestao/js/finance-receipts-api.js';

function makeClient(responseByRpc = {}) {
  const calls = [];
  return {
    calls,
    client: {
      rpc: async (name, payload) => {
        calls.push({ name, payload });
        const response = responseByRpc[name];
        return typeof response === 'function'
          ? response(payload)
          : (response ?? { data: null, error: null });
      },
    },
  };
}

test('registerReceipt envia apenas os campos mínimos para a RPC segura', async () => {
  const { client, calls } = makeClient({
    bc_recebimento_registrar: { data: 'receipt-1', error: null },
  });

  const result = await registerReceipt({
    client,
    atendimentoId: ' atendimento-1 ',
    valor: '125.50',
    formaPagamento: ' Pix ',
    recebidoAt: '2026-10-11T12:00:00-03:00',
    observacao: ' parcial ',
  });

  assert.equal(result, 'receipt-1');
  assert.deepEqual(calls, [{
    name: 'bc_recebimento_registrar',
    payload: {
      p_atendimento_id: 'atendimento-1',
      p_valor: 125.5,
      p_forma_pagamento: 'Pix',
      p_recebido_at: '2026-10-11T12:00:00-03:00',
      p_observacao: 'parcial',
    },
  }]);
  for (const forbidden of ['profissional_user_id', 'cliente_id', 'procedimento_id', 'created_by', 'percentual']) {
    assert.ok(!JSON.stringify(calls[0].payload).includes(forbidden));
  }
});

test('registerReceipt rejeita valor não positivo antes de chamar backend', async () => {
  const { client, calls } = makeClient();
  await assert.rejects(
    () => registerReceipt({ client, atendimentoId: 'a', valor: 0, formaPagamento: 'Pix' }),
    /valor recebido inválido/i,
  );
  assert.equal(calls.length, 0);
});

test('reverseReceipt exige motivo e chama apenas RPC de estorno', async () => {
  const { client, calls } = makeClient({
    bc_recebimento_estornar: { data: 'receipt-1', error: null },
  });
  await reverseReceipt({ client, receiptId: ' receipt-1 ', motivo: ' duplicidade ' });
  assert.deepEqual(calls, [{
    name: 'bc_recebimento_estornar',
    payload: { p_recebimento_id: 'receipt-1', p_motivo: 'duplicidade' },
  }]);
});

test('listOwnReceipts usa somente período e não envia identidade da profissional', async () => {
  const rows = [{ id: 'r1', valor: 80, status: 'ativo' }];
  const { client, calls } = makeClient({
    bc_meus_recebimentos: { data: rows, error: null },
  });
  const result = await listOwnReceipts({
    client,
    periodoInicio: '2026-10-05',
    periodoFim: '2026-10-11',
  });
  assert.deepEqual(result, rows);
  assert.deepEqual(calls[0], {
    name: 'bc_meus_recebimentos',
    payload: { p_periodo_inicio: '2026-10-05', p_periodo_fim: '2026-10-11' },
  });
});

test('listAdminReceipts aceita filtros opcionais e propaga erro do Supabase', async () => {
  const { client, calls } = makeClient({
    bc_financeiro_recebimentos_admin: { data: [], error: null },
  });
  await listAdminReceipts({ client, profissionalUserId: 'user-1', periodoInicio: null, periodoFim: null });
  assert.deepEqual(calls[0], {
    name: 'bc_financeiro_recebimentos_admin',
    payload: { p_profissional_user_id: 'user-1', p_periodo_inicio: null, p_periodo_fim: null },
  });

  const failing = makeClient({
    bc_meus_recebimentos: { data: null, error: { message: 'falha real' } },
  });
  await assert.rejects(
    () => listOwnReceipts({ client: failing.client, periodoInicio: '2026-10-05', periodoFim: '2026-10-11' }),
    /falha real/,
  );
});
