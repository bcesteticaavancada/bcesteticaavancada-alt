import { assertEquals } from 'jsr:@std/assert@1';
import { isValidCpf, normalizeCpf } from './cpf.ts';

function makeValidCpf(seed = '123456789') {
  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (const ch of base) { sum += Number(ch) * factor; factor -= 1; }
    const remainder = (sum * 10) % 11;
    return String(remainder === 10 ? 0 : remainder);
  };
  const first = digit(seed, 10);
  return `${seed}${first}${digit(`${seed}${first}`, 11)}`;
}

const validCpf = makeValidCpf();

Deno.test('backend CPF normalizes formatted and unformatted values identically', () => {
  const formatted = `${validCpf.slice(0,3)}.${validCpf.slice(3,6)}.${validCpf.slice(6,9)}-${validCpf.slice(9)}`;
  assertEquals(normalizeCpf(formatted), validCpf);
  assertEquals(normalizeCpf(validCpf), validCpf);
  assertEquals(isValidCpf(formatted), true);
});

Deno.test('backend CPF rejects repeated digits and invalid verifier digits', () => {
  assertEquals(isValidCpf('1'.repeat(11)), false);
  const last = validCpf.at(-1) === '9' ? '8' : String(Number(validCpf.at(-1)) + 1);
  assertEquals(isValidCpf(`${validCpf.slice(0,-1)}${last}`), false);
});
