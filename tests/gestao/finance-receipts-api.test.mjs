import test from 'node:test';
import assert from 'node:assert/strict';

function fakeClient() {
  const calls = [];
  return {
    calls,
    async rpc(name, payload) {
      calls.push({ name, payload });
      return { data: [], error: null };
    },
  };
}

test('finance receipts API uses phase 5 RPCs', async () => {
  const api = await import('../../gestao/js/finance-receipts-api.js');
  const client = fakeClient();
  await api.registerReceipt({ client, atendimentoId: 'at-1', valor: 120.5, formaPagamento: 'pix', recebidoAt: '2026-10-10T12:00:00-03:00', observacao: 'parcela' });
  await api.reverseReceipt({ client, recebimentoId: 'rec-1', motivo: 'correcao' });
  await api.listOwnReceipts({ client, periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  await api.listAdminReceipts({ client, profissionalUserId: 'user-1', periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  assert.deepEqual(client.calls.map((call) => call.name), ['bc_recebimento_registrar','bc_recebimento_estornar','bc_meus_recebimentos','bc_financeiro_recebimentos_admin']);
  assert.equal(client.calls[0].payload.p_atendimento_id, 'at-1');
  assert.equal(client.calls[0].payload.p_valor, 120.5);
  assert.equal(client.calls[0].payload.p_forma_pagamento, 'pix');
  assert.equal(client.calls[1].payload.p_motivo, 'correcao');
});

test('finance receipts API validates required inputs', async () => {
  const api = await import('../../gestao/js/finance-receipts-api.js');
  const client = fakeClient();
  await assert.rejects(() => api.registerReceipt({ client, atendimentoId: '', valor: 10, formaPagamento: 'pix' }), /atendimento/i);
  await assert.rejects(() => api.registerReceipt({ client, atendimentoId: 'a', valor: 0, formaPagamento: 'pix' }), /valor/i);
  await assert.rejects(() => api.registerReceipt({ client, atendimentoId: 'a', valor: 10, formaPagamento: '' }), /forma/i);
  await assert.rejects(() => api.reverseReceipt({ client, recebimentoId: 'r', motivo: '' }), /motivo/i);
});

test('browser payload does not send professional id or percentage', async () => {
  const api = await import('../../gestao/js/finance-receipts-api.js');
  const client = fakeClient();
  await api.registerReceipt({ client, atendimentoId: 'at-2', valor: 80, formaPagamento: 'dinheiro' });
  const payload = client.calls[0].payload;
  assert.equal('p_profissional_user_id' in payload, false);
  assert.equal(Object.keys(payload).some((key) => key.includes('percentual')), false);
});
