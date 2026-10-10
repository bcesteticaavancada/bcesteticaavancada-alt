import test from 'node:test';
import assert from 'node:assert/strict';

function fakeClient() {
  const calls = [];
  return { calls, async rpc(name, payload) { calls.push({ name, payload }); return { data: [], error: null }; } };
}

test('finance payouts API maps all payout operations to RPCs', async () => {
  const api = await import('../../gestao/js/finance-payouts-api.js');
  const client = fakeClient();
  await api.setPayoutCycle({ client, profissionalUserId: 'u1', cicloDias: 15 });
  await api.createPayout({ client, profissionalUserId: 'u1', livroIds: ['l1','l2'], observacao: 'quinzena' });
  await api.settlePayout({ client, repasseId: 'r1', pagoAt: '2026-10-10T12:00:00-03:00' });
  await api.reversePayout({ client, repasseId: 'r1', motivo: 'ajuste' });
  await api.listOwnPayouts({ client, periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  await api.listAdminPayouts({ client, profissionalUserId: 'u1', periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  assert.deepEqual(client.calls.map((c) => c.name), ['bc_config_repasse_set','bc_repasse_criar','bc_repasse_baixar','bc_repasse_estornar','bc_meus_repasses','bc_financeiro_repasses_admin']);
  assert.deepEqual(client.calls[1].payload.p_livro_ids, ['l1','l2']);
});

test('finance payouts API validates cycle and batch inputs', async () => {
  const api = await import('../../gestao/js/finance-payouts-api.js');
  const client = fakeClient();
  await assert.rejects(() => api.setPayoutCycle({ client, profissionalUserId: 'u1', cicloDias: 10 }), /7.*15.*30|ciclo/i);
  await assert.rejects(() => api.createPayout({ client, profissionalUserId: 'u1', livroIds: [] }), /livro/i);
  await assert.rejects(() => api.reversePayout({ client, repasseId: 'r1', motivo: '' }), /motivo/i);
});

test('own payouts do not accept another professional or percentage', async () => {
  const api = await import('../../gestao/js/finance-payouts-api.js');
  const client = fakeClient();
  await api.listOwnPayouts({ client, periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  const payload = client.calls[0].payload;
  assert.equal('p_profissional_user_id' in payload, false);
  assert.equal(Object.keys(payload).some((key) => key.includes('percentual')), false);
});
