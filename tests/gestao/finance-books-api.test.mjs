import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setCommission,
  listAdminCommissions,
  closeBook,
  reopenBook,
  recalculateBooks,
  listOwnBooks,
  listAdminBooks,
} from '../../gestao/js/finance-books-api.js';

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

test('setCommission valida faixa e chama somente RPC administrativa', async () => {
  const { client, calls } = makeClient({ bc_comissao_set: { data: 'rule-1', error: null } });
  const result = await setCommission({
    client,
    profissionalUserId: ' user-1 ',
    procedimentoId: ' proc-1 ',
    percentual: '37.5',
  });
  assert.equal(result, 'rule-1');
  assert.deepEqual(calls[0], {
    name: 'bc_comissao_set',
    payload: { p_profissional_user_id: 'user-1', p_procedimento_id: 'proc-1', p_percentual: 37.5 },
  });
  await assert.rejects(() => setCommission({ client, profissionalUserId: 'u', procedimentoId: 'p', percentual: 101 }), /percentual inválido/i);
});

test('closeBook envia profissional e período sem qualquer percentual', async () => {
  const { client, calls } = makeClient({ bc_livro_fechar: { data: 'book-1', error: null } });
  await closeBook({ client, profissionalUserId: 'u1', periodoInicio: '2026-10-05', periodoFim: '2026-10-11' });
  assert.deepEqual(calls[0], {
    name: 'bc_livro_fechar',
    payload: { p_profissional_user_id: 'u1', p_periodo_inicio: '2026-10-05', p_periodo_fim: '2026-10-11' },
  });
  assert.ok(!JSON.stringify(calls[0].payload).includes('percentual'));
});

test('reopenBook exige motivo e recalculateBooks aceita filtro opcional de procedimento', async () => {
  const { client, calls } = makeClient({
    bc_livro_reabrir: { data: 'book-1', error: null },
    bc_livros_recalcular: { data: 1, error: null },
  });
  await reopenBook({ client, bookId: 'book-1', motivo: ' ajuste ' });
  await recalculateBooks({
    client,
    profissionalUserId: 'u1',
    procedimentoId: 'p1',
    periodoInicio: '2026-10-05',
    periodoFim: '2026-10-11',
  });
  assert.deepEqual(calls[0], {
    name: 'bc_livro_reabrir',
    payload: { p_livro_id: 'book-1', p_motivo: 'ajuste' },
  });
  assert.deepEqual(calls[1], {
    name: 'bc_livros_recalcular',
    payload: {
      p_profissional_user_id: 'u1',
      p_procedimento_id: 'p1',
      p_periodo_inicio: '2026-10-05',
      p_periodo_fim: '2026-10-11',
    },
  });
});

test('listOwnBooks não envia identidade da profissional e retorna lista segura', async () => {
  const rows = [{ id: 'b1', repasse_total: 200, status: 'fechado' }];
  const { client, calls } = makeClient({ bc_meus_livros_financeiros: { data: rows, error: null } });
  const result = await listOwnBooks({ client, periodoInicio: '2026-10-01', periodoFim: '2026-10-31' });
  assert.deepEqual(result, rows);
  assert.deepEqual(calls[0], {
    name: 'bc_meus_livros_financeiros',
    payload: { p_periodo_inicio: '2026-10-01', p_periodo_fim: '2026-10-31' },
  });
});

test('leituras administrativas aceitam filtros opcionais', async () => {
  const { client, calls } = makeClient({
    bc_financeiro_comissoes_admin: { data: [], error: null },
    bc_financeiro_livros_admin: { data: [], error: null },
  });
  await listAdminCommissions({ client, profissionalUserId: null });
  await listAdminBooks({ client, profissionalUserId: 'u1', periodoInicio: null, periodoFim: null });
  assert.deepEqual(calls[0], {
    name: 'bc_financeiro_comissoes_admin',
    payload: { p_profissional_user_id: null },
  });
  assert.deepEqual(calls[1], {
    name: 'bc_financeiro_livros_admin',
    payload: { p_profissional_user_id: 'u1', p_periodo_inicio: null, p_periodo_fim: null },
  });
});
