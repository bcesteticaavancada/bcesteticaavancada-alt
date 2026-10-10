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

test('finance books API maps operations to phase 5 RPCs', async () => {
  const api = await import('../../gestao/js/finance-books-api.js');
  const client = fakeClient();
  await api.setCommission({ client, profissionalUserId: 'u1', procedimentoId: 'p1', percentual: 35 });
  await api.listAdminCommissions({ client, profissionalUserId: 'u1' });
  await api.closeBook({ client, profissionalUserId: 'u1', periodoInicio: '2026-10-05', periodoFim: '2026-10-11' });
  await api.reopenBook({ client, livroId: 'l1', motivo: 'revisao' });
  await api.recalculateBooks({ client, profissionalUserId: 'u1', procedimentoId: 'p1', periodoInicio: '2026-10-05', periodoFim: '2026-10-11' });
  await api.listOwnBooks({ client, periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  await api.listAdminBooks({ client, profissionalUserId: 'u1', periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  assert.deepEqual(client.calls.map((c) => c.name), [
    'bc_comissao_set','bc_financeiro_comissoes_admin','bc_livro_fechar','bc_livro_reabrir','bc_livros_recalcular','bc_meus_livros_financeiros','bc_financeiro_livros_admin'
  ]);
  assert.equal(client.calls[0].payload.p_percentual, 35);
  assert.equal(client.calls[2].payload.p_periodo_inicio, '2026-10-05');
});

test('finance books API validates commission, identifiers and weekly interval', async () => {
  const api = await import('../../gestao/js/finance-books-api.js');
  const client = fakeClient();
  await assert.rejects(() => api.setCommission({ client, profissionalUserId: '', procedimentoId: 'p1', percentual: 10 }), /profissional/i);
  await assert.rejects(() => api.setCommission({ client, profissionalUserId: 'u1', procedimentoId: 'p1', percentual: 101 }), /percentual/i);
  await assert.rejects(() => api.closeBook({ client, profissionalUserId: 'u1', periodoInicio: '2026-10-05', periodoFim: '2026-10-12' }), /7 dias|sete dias/i);
  await assert.rejects(() => api.reopenBook({ client, livroId: 'l1', motivo: '' }), /motivo/i);
});

test('own book API does not accept percentage or another professional id', async () => {
  const api = await import('../../gestao/js/finance-books-api.js');
  const client = fakeClient();
  await api.listOwnBooks({ client, periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  const payload = client.calls[0].payload;
  assert.equal('p_profissional_user_id' in payload, false);
  assert.equal(Object.keys(payload).some((key) => key.includes('percentual')), false);
});
