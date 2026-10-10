import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderClientsList,
  renderClientEditor,
  renderClientHistory,
  runFormSubmit,
} from '../../gestao/js/clientes-panel.js';

test('lista compartilhada escapa dados e abre cliente sem expor arquivamento à colaboradora', () => {
  const html = renderClientsList([
    { id: 'c1', nome: '<script>Ana</script>', telefone: '3199', ativo: true },
  ], false);
  assert.match(html, /data-open-client=["']c1["']/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /data-toggle-client|arquivar|reativar/i);
});

test('admin pode receber controle de arquivar e reativar', () => {
  const active = renderClientEditor({ id: 'c1', nome: 'Ana', telefone: '3199', email: '', ativo: true }, true);
  const archived = renderClientEditor({ id: 'c1', nome: 'Ana', telefone: '3199', email: '', ativo: false }, true);
  assert.match(active, /data-toggle-client=["']false["']/);
  assert.match(active, /Arquivar cliente/);
  assert.match(archived, /data-toggle-client=["']true["']/);
  assert.match(archived, /Reativar cliente/);
});

test('histórico unificado mostra procedimento, profissional e campos clínicos', () => {
  const html = renderClientHistory([{
    id: 'h1',
    data_atendimento: '2026-10-08T15:00:00Z',
    colaboradora_user_id: 'u2',
    queixa_objetivo: 'Sensibilidade',
    observacoes: 'Pele íntegra',
    procedimentos: { nome: 'Peeling' },
  }], new Map([['u2', 'Alice']]));
  for (const text of ['Peeling', 'Alice', 'Sensibilidade', 'Pele íntegra']) {
    assert.match(html, new RegExp(text));
  }
});

test('runFormSubmit bloqueia duplo envio e só reseta após sucesso', async () => {
  const submit = { disabled: false };
  let resets = 0;
  const form = { querySelector: () => submit, reset: () => { resets += 1; } };
  const status = { textContent: '', dataset: {} };
  let release;
  const pending = runFormSubmit({
    form,
    statusEl: status,
    action: () => new Promise((resolve) => { release = resolve; }),
    resetOnSuccess: true,
  });
  assert.equal(submit.disabled, true);
  assert.equal(resets, 0);
  release('ok');
  assert.equal(await pending, 'ok');
  assert.equal(submit.disabled, false);
  assert.equal(resets, 1);
});

test('runFormSubmit preserva campos em falha', async () => {
  const submit = { disabled: false };
  let resets = 0;
  const form = { querySelector: () => submit, reset: () => { resets += 1; } };
  const status = { textContent: '', dataset: {} };
  await assert.rejects(
    () => runFormSubmit({
      form,
      statusEl: status,
      action: async () => { throw new Error('rede caiu'); },
      resetOnSuccess: true,
    }),
    /rede caiu/,
  );
  assert.equal(resets, 0);
  assert.equal(submit.disabled, false);
  assert.equal(status.dataset.kind, 'error');
});
