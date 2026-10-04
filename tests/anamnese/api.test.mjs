import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionToken, getOrCreateSubmissionToken, clearSubmissionToken, buildSubmissionPayload, submitPreAnamnese, filenameForCode } from '../../agendamento/js/api.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)), removeItem: (k) => map.delete(k) };
}

test('createSubmissionToken returns UUID-like token from injected crypto', () => {
  assert.equal(createSubmissionToken({ randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' }), '550e8400-e29b-41d4-a716-446655440000');
});

test('submitPreAnamnese sends JSON and returns metadata', async () => {
  let called;
  const fetchImpl = async (url, options) => {
    called = { url, options };
    return { ok: true, status: 201, json: async () => ({ id: '1', publicCode: 'BC-20261003-ABCDE', createdAt: '2026-10-03T12:00:00Z', pdfUrl: 'https://example/pdf', pdfExpiresAt: 'x' }) };
  };
  const result = await submitPreAnamnese({ a: 1 }, fetchImpl, { url: 'https://project/functions/v1/submit-pre-anamnese', key: 'pub' });
  assert.equal(result.publicCode, 'BC-20261003-ABCDE');
  assert.equal(called.options.method, 'POST');
  assert.equal(called.options.headers.apikey, 'pub');
  assert.equal(called.options.body, JSON.stringify({ a: 1 }));
});

test('submitPreAnamnese throws readable backend message', async () => {
  const fetchImpl = async () => ({ ok: false, status: 422, json: async () => ({ error: 'Dados inválidos.' }) });
  await assert.rejects(() => submitPreAnamnese({}, fetchImpl, { url: 'u', key: 'k' }), /Dados inválidos/);
});

test('filenameForCode sanitizes code', () => {
  assert.equal(filenameForCode('BC-20261003-A B/C'), 'BC-20261003-A-B-C.pdf');
});

test('getOrCreateSubmissionToken reuses token across retry and resets after clear', () => {
  const storage = memoryStorage();
  let n = 0;
  const cryptoImpl = { randomUUID: () => `550e8400-e29b-41d4-a716-44665544000${++n}` };
  const first = getOrCreateSubmissionToken(storage, cryptoImpl);
  assert.equal(getOrCreateSubmissionToken(storage, cryptoImpl), first);
  clearSubmissionToken(storage);
  assert.notEqual(getOrCreateSubmissionToken(storage, cryptoImpl), first);
});

test('buildSubmissionPayload maps CPF and data authorization without duplicating CPF in answers', () => {
  const values = {
    nome: 'João',
    cpf: '529.982.247-25',
    nascimento: '1990-01-02',
    idade: '36',
    whatsapp: '(31) 99999-9999',
    email: 'j@e.com',
    procedimentos: ['Cryo Lift', 'Papada Off'],
    observacoes: 'ç ã —',
    dataAuthorization: true,
    consentimento1: true,
    consentimento2: true,
    website: ''
  };
  const payload = buildSubmissionPayload(values, 'data:image/png;base64,cG5n', 'v1', 'token-1234567890123456');
  assert.deepEqual(payload.patient, { name: 'João', cpf: '52998224725', birthDate: '1990-01-02', age: 36, phone: '(31) 99999-9999', email: 'j@e.com' });
  assert.equal(payload.procedure, 'Cryo Lift, Papada Off');
  assert.equal(payload.answers.observacoes, 'ç ã —');
  assert.equal('cpf' in payload.answers, false);
  assert.equal(JSON.stringify(payload.answers).includes('52998224725'), false);
  assert.equal(JSON.stringify(payload.answers).includes('529.982.247-25'), false);
  assert.deepEqual(payload.consents, { truthful: true, dataProcessing: true, dataAuthorization: true });
});
