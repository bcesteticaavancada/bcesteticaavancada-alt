import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStep, validateSubmission } from '../../agendamento/js/validation.js';
import { buildReviewSections } from '../../agendamento/js/review.js';

const base = {
  step: 1,
  values: {
    nome: 'João Ávila',
    nascimento: '1990-05-20',
    idade: '36',
    whatsapp: '(31) 99999-9999',
    cpf: '529.982.247-25',
    dataAuthorization: true,
    procedimentos: ['Cryo Lift'],
    consentimento1: true,
    consentimento2: true,
    objetivoTexto: 'Melhorar textura — sem perder naturalidade.',
  },
};

test('step 1 requires identity fields and at least one procedure', () => {
  const result = validateStep('step1', { step: 1, values: { ...base.values, nome: '', procedimentos: [] } });
  assert.equal(result.valid, false);
  assert.equal(result.errors.nome, 'Informe seu nome completo.');
  assert.equal(result.errors.procedimentos, 'Selecione pelo menos um procedimento ou orientação profissional.');
});

test('step 1 requires a mathematically valid CPF', () => {
  const missing = validateStep('step1', { step: 1, values: { ...base.values, cpf: '' } });
  assert.equal(missing.valid, false);
  assert.equal(missing.errors.cpf, 'Informe um CPF válido.');

  const invalid = validateStep('step1', { step: 1, values: { ...base.values, cpf: '111.111.111-11' } });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.cpf, 'Informe um CPF válido.');
});

test('step 1 requires explicit data treatment authorization', () => {
  const result = validateStep('step1', { step: 1, values: { ...base.values, dataAuthorization: false } });
  assert.equal(result.valid, false);
  assert.equal(result.errors.dataAuthorization, 'Autorize o tratamento dos dados para continuar.');
});

test('step 1 remains valid with valid CPF and authorization when other required fields are valid', () => {
  const result = validateStep('step1', base);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('Outro description is required only when Outro procedure is visible', () => {
  const hidden = validateStep('step1', { step: 1, values: { ...base.values, procedimentos: ['Cryo Lift'], outroProc: '' } });
  assert.equal(hidden.valid, true);

  const visible = validateStep('step1', { step: 1, values: { ...base.values, procedimentos: ['Outro'], outroProc: '' } });
  assert.equal(visible.valid, false);
  assert.equal(visible.errors.outroProc, 'Descreva o procedimento de interesse.');
});

test('submission requires both consent checkboxes', () => {
  const result = validateSubmission({ step: 7, values: { ...base.values, consentimento2: false } });
  assert.equal(result.valid, false);
  assert.equal(result.errors.consentimento2, 'Confirme o tratamento das informações para finalizar.');
});

test('unicode text is preserved in review sections', () => {
  const sections = buildReviewSections(base);
  const flat = sections.flatMap((section) => section.rows.map((row) => row.value)).join('\n');
  assert.match(flat, /João Ávila/);
  assert.match(flat, /textura — sem perder naturalidade/);
});
