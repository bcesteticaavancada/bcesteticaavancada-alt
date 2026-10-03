import { assert, assertEquals } from 'jsr:@std/assert@1';
import { normalizeText, validateSubmission } from './validation.ts';

const valid = {
  patient: { name: '  João da Silva  ', birthDate: '1990-01-02', age: 36, phone: '(31) 99999-9999', email: 'joao@example.com' },
  procedure: 'Cryo Lift',
  answers: { observacoes: 'Olá — avaliação estética com ç e ã.' },
  consents: { truthful: true, dataProcessing: true },
  signatureDataUrl: 'data:image/png;base64,cG5n',
  sourceVersion: '2026-10-03.v1',
  submissionToken: '550e8400-e29b-41d4-a716-446655440000',
  website: ''
};

Deno.test('normalizeText preserves Portuguese and removes controls', () => {
  assertEquals(normalizeText('  João\u0000  da   Silva  '), 'João da Silva');
});

Deno.test('validateSubmission accepts valid payload and normalizes it', () => {
  const result = validateSubmission(valid);
  assert(result.valid);
  if (result.valid) {
    assertEquals(result.data.patient.name, 'João da Silva');
    assertEquals(result.data.answers.observacoes, 'Olá — avaliação estética com ç e ã.');
  }
});

Deno.test('validateSubmission rejects missing fields, bot honeypot and invalid signature', () => {
  assert(!validateSubmission({ ...valid, procedure: '', patient: { ...valid.patient, name: '' } }).valid);
  assert(!validateSubmission({ ...valid, website: 'spam.example' }).valid);
  assert(!validateSubmission({ ...valid, signatureDataUrl: 'bad' }).valid);
});

Deno.test('validateSubmission rejects oversized free text', () => {
  assert(!validateSubmission({ ...valid, answers: { observacoes: 'x'.repeat(20001) } }).valid);
});
