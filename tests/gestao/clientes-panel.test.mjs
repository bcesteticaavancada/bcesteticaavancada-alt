import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  renderClientsList,
  renderClientEditor,
  renderClientHistory,
  runFormSubmit,
  notifyClientsChanged,
} from '../../gestao/js/clientes-panel.js';

const panelSourceUrl = new URL('../../gestao/js/clientes-panel.js', import.meta.url);
const adminHtmlUrl = new URL('../../gestao/admin/index.html', import.meta.url);
const collaboratorHtmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

test('lista compartilhada escapa dados e abre cliente sem expor arquivamento à colaboradora', () => {
  const html = renderClientsList([
    { id: 'c1', nome: '<script>Ana</script>', telefone: '3199', ativo: true },
  ], false);
  assert.match(html, /data-open-client=["']c1["']/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /data-toggle-client|arquivar|reativar/i);
});

test('lista de clientes exibe idade derivada e identidade operacional sem expor finanças', () => {
  const html = renderClientsList([
    { id: 'c1', nome: 'Ana', telefone: '31999999999', cpf: '12345678900', data_nascimento: '1990-10-12', ativo: true },
  ], false);
  assert.match(html, /123\.456\.789-00|31999999999/);
  assert.match(html, /36\s*anos/i);
  assert.doesNotMatch(html, /comiss|repasse|percentual|valor total/i);
});

test('admin pode receber controle de arquivar e reativar', () => {
  const active = renderClientEditor({ id: 'c1', nome: 'Ana', telefone: '3199', email: '', ativo: true }, true);
  const archived = renderClientEditor({ id: 'c1', nome: 'Ana', telefone: '3199', email: '', ativo: false }, true);
  assert.match(active, /data-toggle-client=["']false["']/);
  assert.match(active, /Arquivar cliente/);
  assert.match(archived, /data-toggle-client=["']true["']/);
  assert.match(archived, /Reativar cliente/);
});

test('cadastro rápido contém identidade mínima e bloco de responsável legal nas duas áreas', async () => {
  const [adminHtml, collaboratorHtml] = await Promise.all([
    readFile(adminHtmlUrl, 'utf8'),
    readFile(collaboratorHtmlUrl, 'utf8'),
  ]);
  for (const html of [adminHtml, collaboratorHtml]) {
    for (const name of ['nome', 'cpf', 'data_nascimento', 'telefone', 'email', 'responsavel_nome', 'responsavel_cpf', 'responsavel_parentesco', 'responsavel_telefone']) {
      assert.match(html, new RegExp(`name=["']${name}["']`));
    }
    assert.match(html, /id=["']clientAgePreview["']/);
    assert.match(html, /id=["']clientGuardianFields["']/);
  }
});

test('painel deriva idade, ativa responsável para menor e oferece abertura de prontuário duplicado', async () => {
  const source = await readFile(panelSourceUrl, 'utf8');
  assert.match(source, /calculateAge/);
  assert.match(source, /isMinor/);
  assert.match(source, /clientGuardianFields/);
  assert.match(source, /required/);
  assert.match(source, /findPotentialDuplicates/);
  assert.match(source, /Abrir prontu[aá]rio existente/i);
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

test('painel notifica a agenda quando clientes mudam', async () => {
  let calls = 0;
  await notifyClientsChanged(async () => { calls += 1; });
  await notifyClientsChanged(null);
  assert.equal(calls, 1);

  const source = await readFile(panelSourceUrl, 'utf8');
  const mutationNotifications = source.match(/await\s+notifyClientsChanged\(onClientsChanged\)/g) || [];
  assert.ok(mutationNotifications.length >= 3, 'criação, edição e arquivamento/reativação devem atualizar o seletor da agenda');
});
