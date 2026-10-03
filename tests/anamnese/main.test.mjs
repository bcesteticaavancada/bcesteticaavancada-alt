import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStep, retreatStep, mergeStateValues } from '../../agendamento/js/main.js';

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
