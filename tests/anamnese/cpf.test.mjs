import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCpf, formatCpf, isValidCpf } from '../../agendamento/js/cpf.js';

test('CPF formatted and unformatted values normalize to the same 11 digits', () => {
  assert.equal(normalizeCpf('529.982.247-25'), '52998224725');
  assert.equal(normalizeCpf('52998224725'), '52998224725');
});

test('formatCpf renders the canonical Brazilian CPF mask', () => {
  assert.equal(formatCpf('52998224725'), '529.982.247-25');
});

test('isValidCpf rejects repeated digits and invalid check digits', () => {
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCpf('529.982.247-24'), false);
});

test('isValidCpf accepts the approved test CPF in either representation', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('52998224725'), true);
});
