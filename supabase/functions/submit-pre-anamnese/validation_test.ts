import { assert, assertEquals } from 'jsr:@std/assert@1';
import { normalizeText, normalizeCpf, isValidCpf, validateSubmission } from './validation.ts';

const valid = {
  patient: { name: '  João da Silva  ', cpf: '529.982.247-25', birthDate: '1990-01-02', age: 36, phone: '(31) 99999-9999', email: 'joao@example.com' },
  procedure: 'Cryo Lift',
  answers: { observacoes: 'Olá — avaliação estética com ç e ã.' },
  consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
  signatureDataUrl: 'data:image/png;base64,cG5n',
  sourceVersion: '2026-10-03.v1',
  submissionToken: '550e8400-e29b-41d4-a716-446655440000',
  website: ''
};

Deno.test('normalizeText preserves Portuguese and removes controls', () => {
  assertEquals(normalizeText('  João\u0000  da   Silva  '), 'João da Silva');
});

Deno.test('CPF helpers normalize and validate check digits', () => {
  assertEquals(normalizeCpf('529.982.247-25'), '52998224725');
  assert(isValidCpf('52998224725'));
  assert(!isValidCpf('11111111111'));
  assert(!isValidCpf('52998224724'));
});

Deno.test('validateSubmission accepts valid payload and normalizes CPF', () => {
  const result = validateSubmission(valid);
  assert(result.valid);
  if (result.valid) {
    assertEquals(result.data.patient.name, 'João da Silva');
    assertEquals(result.data.patient.cpf, '52998224725');
    assertEquals(result.data.answers.observacoes, 'Olá — avaliação estética com ç e ã.');
    assertEquals(result.data.consents.dataAuthorization, true);
  }
});

Deno.test('validateSubmission does not apply free-text limit to rubric data URL', () => {
  const result = validateSubmission({ ...valid, signatureDataUrl: `data:image/png;base64,${'A'.repeat(24_000)}` });
  assert(result.valid);
});

Deno.test('validateSubmission rejects missing or invalid CPF and missing data authorization', () => {
  assert(!validateSubmission({ ...valid, patient: { ...valid.patient, cpf: '' } }).valid);
  assert(!validateSubmission({ ...valid, patient: { ...valid.patient, cpf: '111.111.111-11' } }).valid);
  assert(!validateSubmission({ ...valid, consents: { ...valid.consents, dataAuthorization: false } }).valid);
});

Deno.test('validateSubmission rejects missing fields, bot honeypot and invalid signature', () => {
  assert(!validateSubmission({ ...valid, procedure: '', patient: { ...valid.patient, name: '' } }).valid);
  assert(!validateSubmission({ ...valid, website: 'spam.example' }).valid);
  assert(!validateSubmission({ ...valid, signatureDataUrl: 'bad' }).valid);
});

Deno.test('validateSubmission rejects oversized free text', () => {
  assert(!validateSubmission({ ...valid, answers: { observacoes: 'x'.repeat(20001) } }).valid);
});
