import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStep, retreatStep, mergeStateValues, maskCpfValue } from '../../agendamento/js/main.js';

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

test('maskCpfValue formats partial and complete CPF input without extra digits', () => {
  assert.equal(maskCpfValue('5299822'), '529.982.2');
  assert.equal(maskCpfValue('52998224725'), '529.982.247-25');
  assert.equal(maskCpfValue('529.982.247-25999'), '529.982.247-25');
});

test('signature step blocks progression while the signature pad is empty', async () => {
  const { signatureStepErrors } = await import('../../agendamento/js/main.js');
  assert.deepEqual(signatureStepErrors({ isEmpty: () => true }), { signature: 'Faça sua assinatura antes de continuar.' });
  assert.deepEqual(signatureStepErrors({ isEmpty: () => false }), {});
});
