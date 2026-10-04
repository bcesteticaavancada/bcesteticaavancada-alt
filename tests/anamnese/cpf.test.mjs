import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCpf, isValidCpf, normalizeCpf } from '../../agendamento/js/cpf.js';

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

test('valid CPF normalizes the same with or without punctuation', () => {
  const formatted = formatCpf(validCpf);
  assert.equal(normalizeCpf(formatted), validCpf);
  assert.equal(normalizeCpf(validCpf), validCpf);
  assert.equal(isValidCpf(formatted), true);
  assert.equal(isValidCpf(validCpf), true);
});

test('CPF rejects repeated digits and invalid check digits', () => {
  assert.equal(isValidCpf('1'.repeat(11)), false);
  assert.equal(isValidCpf('0'.repeat(11)), false);
  const last = validCpf.at(-1) === '9' ? '8' : String(Number(validCpf.at(-1)) + 1);
  assert.equal(isValidCpf(`${validCpf.slice(0, -1)}${last}`), false);
});

test('formatCpf renders the canonical visual mask', () => {
  const formatted = formatCpf(validCpf);
  assert.match(formatted, /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  assert.equal(normalizeCpf(formatted), validCpf);
});
