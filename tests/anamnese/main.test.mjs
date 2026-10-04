import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStep, retreatStep, mergeStateValues, applyCpfMask } from '../../agendamento/js/main.js';

test('advanceStep never exceeds the total number of steps', () => {
  assert.equal(advanceStep(7, 8), 8);
  assert.equal(advanceStep(8, 8), 8);
});

test('retreatStep never goes below step one', () => {
  assert.equal(retreatStep(2), 1);
  assert.equal(retreatStep(1), 1);
});

test('mergeStateValues keeps the current step and replaces form values', () => {
  const merged = mergeStateValues({ step: 4, values: { old: 'x' } }, { nome: 'Maria' });
  assert.deepEqual(merged, { step: 4, values: { nome: 'Maria' } });
});

test('rubric step blocks progression until movement metrics are valid', async () => {
  const { signatureStepErrors } = await import('../../agendamento/js/main.js');
  assert.deepEqual(signatureStepErrors({ isValid: () => false }), { signature: 'Faça uma rubrica válida antes de continuar.' });
  assert.deepEqual(signatureStepErrors({ isValid: () => true }), {});
});

test('scheduleSignatureResize waits for the next frame before resizing visible canvas', async () => {
  const { scheduleSignatureResize } = await import('../../agendamento/js/main.js');
  let resized = 0;
  let queued = null;
  scheduleSignatureResize({ resize: () => { resized += 1; } }, (callback) => { queued = callback; return 1; });
  assert.equal(resized, 0);
  assert.equal(typeof queued, 'function');
  queued();
  assert.equal(resized, 1);
});


test('applyCpfMask formats the CPF field in place', () => {
  const input = { value: '123456789' + '09' };
  const formatted = applyCpfMask(input);
  assert.match(formatted, /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  assert.equal(input.value, formatted);
});
