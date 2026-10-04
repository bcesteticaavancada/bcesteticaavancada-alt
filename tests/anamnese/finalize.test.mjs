import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_KEY } from '../../agendamento/js/state.js';
import { SUBMISSION_TOKEN_KEY } from '../../agendamento/js/api.js';
import { createSubmissionGate, finalizePreAnamnese } from '../../agendamento/js/finalize.js';

function storage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    has: (key) => map.has(key),
  };
}

function makeValidCpf(seed = '123456789') {
  const digit = (base, factor) => {
    let sum = 0;
    for (const ch of base) { sum += Number(ch) * factor; factor -= 1; }
    const remainder = (sum * 10) % 11;
    return String(remainder === 10 ? 0 : remainder);
  };
  const first = digit(seed, 10);
  return `${seed}${first}${digit(`${seed}${first}`, 11)}`;
}

const validCpf = makeValidCpf();

const validState = { step: 8, values: { nome: 'João da Silva', nascimento: '1990-01-02', idade: '36', whatsapp: '(31) 99999-9999', email: 'j@e.com', cpf: validCpf, dataAuthorization: true, procedimentos: ['Cryo Lift'], consentimento1: true, consentimento2: true } };
const signaturePad = { isEmpty: () => false, isValid: () => true, toDataUrl: () => 'data:image/png;base64,cG5n' };

test('createSubmissionGate collapses double tap into one submission', async () => {
  let calls = 0;
  let release;
  const gate = createSubmissionGate();
  const task = () => { calls += 1; return new Promise((resolve) => { release = resolve; }); };
  const first = gate(task);
  const second = gate(task);
  assert.equal(first, second);
  assert.equal(calls, 1);
  release('ok');
  assert.equal(await first, 'ok');
  assert.equal(await second, 'ok');
});

test('finalizePreAnamnese preserves draft and token when network submission fails', async () => {
  const local = storage({ [DRAFT_KEY]: JSON.stringify(validState) });
  await assert.rejects(() => finalizePreAnamnese({
    state: validState,
    signaturePad,
    storage: local,
    cryptoImpl: { randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' },
    submitImpl: async () => { throw new Error('rede'); },
  }), /rede/);
  assert.equal(local.has(DRAFT_KEY), true);
  assert.equal(local.has(SUBMISSION_TOKEN_KEY), true);
});

test('finalizePreAnamnese clears draft and retry token only after success', async () => {
  const local = storage({ [DRAFT_KEY]: JSON.stringify(validState) });
  const result = await finalizePreAnamnese({
    state: validState,
    signaturePad,
    storage: local,
    cryptoImpl: { randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' },
    submitImpl: async (payload) => ({ id: '1', publicCode: 'BC-20261003-ABCDE', createdAt: '2026-10-03T12:00:00Z', pdfUrl: 'https://pdf', pdfExpiresAt: 'x', payload }),
  });
  assert.equal(result.publicCode, 'BC-20261003-ABCDE');
  assert.equal(result.payload.patient.name, 'João da Silva');
  assert.equal(local.has(DRAFT_KEY), false);
  assert.equal(local.has(SUBMISSION_TOKEN_KEY), false);
});

test('finalizePreAnamnese refuses invalid state and invalid rubric without calling backend', async () => {
  let calls = 0;
  const local = storage();
  await assert.rejects(() => finalizePreAnamnese({ state: { step: 8, values: {} }, signaturePad: { isValid: () => false }, storage: local, submitImpl: async () => { calls += 1; } }), /Revise|rubrica/i);
  assert.equal(calls, 0);

  await assert.rejects(() => finalizePreAnamnese({ state: validState, signaturePad: { isEmpty: () => false, isValid: () => false, toDataUrl: () => 'data:image/png;base64,cG5n' }, storage: local, submitImpl: async () => { calls += 1; } }), /rubrica/i);
  assert.equal(calls, 0);
});
