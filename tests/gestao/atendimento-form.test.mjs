import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeAttendanceFields,
  validateAttendanceFields,
  canRegisterAttendance,
  bindAttendanceForm,
} from '../../gestao/js/atendimento-form.js';

const FIELD_NAMES = [
  'queixa_objetivo',
  'observacoes',
  'reacoes',
  'intercorrencias',
  'feedback_cliente',
  'orientacoes',
  'recomendacao_proxima_sessao',
];

const collaboratorHtmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

function makeForm(values = {}) {
  const listeners = new Map();
  const fields = new Map(FIELD_NAMES.map((name) => [name, { name, value: values[name] ?? '' }]));
  const submit = { disabled: false };
  const status = { textContent: '', dataset: {} };
  let resetCount = 0;

  return {
    fields,
    submit,
    status,
    get resetCount() { return resetCount; },
    elements: {
      namedItem(name) { return fields.get(name) ?? null; },
    },
    querySelector(selector) {
      if (selector === '[type="submit"]') return submit;
      if (selector === '[data-attendance-status]') return status;
      return null;
    },
    addEventListener(type, handler) { listeners.set(type, handler); },
    reset() {
      resetCount += 1;
      for (const field of fields.values()) field.value = '';
    },
    async submitEvent() {
      const handler = listeners.get('submit');
      if (!handler) throw new Error('submit handler missing');
      return handler({ preventDefault() {} });
    },
  };
}

function makeClient({ response = { data: 'att-1', error: null }, deferred = null } = {}) {
  const rpcCalls = [];
  return {
    rpcCalls,
    client: {
      async rpc(name, payload) {
        rpcCalls.push([name, payload]);
        if (deferred) return deferred.promise;
        return response;
      },
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('normalizeAttendanceFields mantém apenas os sete campos aprovados e aplica trim', () => {
  const result = normalizeAttendanceFields({
    queixa_objetivo: '  Sensibilidade ',
    observacoes: ' Pele íntegra ',
    reacoes: '',
    intercorrencias: ' ',
    feedback_cliente: ' Gostou ',
    orientacoes: ' FPS ',
    recomendacao_proxima_sessao: ' 30 dias ',
    cliente_id: 'NUNCA',
    procedimento_id: 'NUNCA',
  });
  assert.deepEqual(result, {
    queixa_objetivo: 'Sensibilidade',
    observacoes: 'Pele íntegra',
    reacoes: '',
    intercorrencias: '',
    feedback_cliente: 'Gostou',
    orientacoes: 'FPS',
    recomendacao_proxima_sessao: '30 dias',
  });
});

test('validateAttendanceFields exige ao menos um conteúdo significativo', () => {
  assert.deepEqual(validateAttendanceFields({}), {
    valid: false,
    message: 'Registre ao menos uma observação do atendimento.',
  });
  assert.deepEqual(validateAttendanceFields({ orientacoes: 'Usar FPS' }), {
    valid: true,
    message: '',
  });
});

test('ficha só pode ser registrada enquanto o agendamento está agendado', () => {
  assert.equal(canRegisterAttendance('agendado'), true);
  assert.equal(canRegisterAttendance('atendido'), false);
  assert.equal(canRegisterAttendance('cancelado'), false);
  assert.equal(canRegisterAttendance('faltou'), false);
  assert.equal(canRegisterAttendance(''), false);
});

test('tela da colaboradora contém os sete campos da ficha e binding real', async () => {
  const html = await readFile(collaboratorHtmlUrl, 'utf8');
  assert.match(html, /id=["']attendanceForm["']/);
  for (const name of FIELD_NAMES) {
    assert.match(html, new RegExp(`name=["']${name}["']`));
  }
  assert.match(html, /data-attendance-status/);
  assert.match(html, /atendimento-form\.js/);
  assert.match(html, /bindAttendanceForm\s*\(/);
  assert.match(html, /appointmentId\s*:\s*\(\)\s*=>/);
});

test('bindAttendanceForm envia somente appointmentId e campos aprovados', async () => {
  const form = makeForm({
    queixa_objetivo: 'Sensibilidade',
    observacoes: 'Pele íntegra',
  });
  const mock = makeClient();
  let successId = null;

  bindAttendanceForm({
    form,
    client: mock.client,
    appointmentId: 'a1',
    onSuccess: async (id) => { successId = id; },
  });

  await form.submitEvent();
  assert.equal(mock.rpcCalls.length, 1);
  const [name, payload] = mock.rpcCalls[0];
  assert.equal(name, 'bc_registrar_atendimento');
  assert.equal(payload.p_agendamento_id, 'a1');
  assert.equal(payload.p_queixa_objetivo, 'Sensibilidade');
  assert.equal(payload.p_observacoes, 'Pele íntegra');
  assert.equal('p_cliente_id' in payload, false);
  assert.equal('p_procedimento_id' in payload, false);
  assert.equal('p_colaboradora_user_id' in payload, false);
  assert.equal(successId, 'att-1');
  assert.equal(form.resetCount, 1);
});

test('duplo submit enquanto requisição está em curso gera uma única RPC', async () => {
  const gate = deferred();
  const form = makeForm({ observacoes: 'Sessão realizada' });
  const mock = makeClient({ deferred: gate });
  bindAttendanceForm({ form, client: mock.client, appointmentId: 'a1', onSuccess: async () => {} });

  const first = form.submitEvent();
  const second = form.submitEvent();
  assert.equal(form.submit.disabled, true);
  assert.equal(mock.rpcCalls.length, 1);

  gate.resolve({ data: 'att-1', error: null });
  await Promise.all([first, second]);
  assert.equal(mock.rpcCalls.length, 1);
  assert.equal(form.submit.disabled, false);
});

test('erro de rede mantém valores preenchidos, não reseta e mostra mensagem', async () => {
  const form = makeForm({ feedback_cliente: 'Cliente satisfeita' });
  const mock = makeClient({ response: { data: null, error: { message: 'Falha de rede' } } });
  bindAttendanceForm({ form, client: mock.client, appointmentId: 'a1', onSuccess: async () => {} });

  await form.submitEvent();
  assert.equal(form.fields.get('feedback_cliente').value, 'Cliente satisfeita');
  assert.equal(form.resetCount, 0);
  assert.match(form.status.textContent, /falha de rede/i);
  assert.equal(form.status.dataset.kind, 'error');
});

test('appointmentId pode ser resolvido no momento do submit para um único binding', async () => {
  let currentId = 'a1';
  const form = makeForm({ orientacoes: 'FPS' });
  const mock = makeClient();
  bindAttendanceForm({ form, client: mock.client, appointmentId: () => currentId, onSuccess: async () => {} });
  await form.submitEvent();
  currentId = 'a2';
  form.fields.get('orientacoes').value = 'Hidratar';
  await form.submitEvent();
  assert.equal(mock.rpcCalls[0][1].p_agendamento_id, 'a1');
  assert.equal(mock.rpcCalls[1][1].p_agendamento_id, 'a2');
});
