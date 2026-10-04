import { assert, assertEquals } from 'jsr:@std/assert@1';
import { normalizeCpf, isValidCpf } from './cpf.ts';

Deno.test('backend CPF normalization accepts masked and unmasked forms', () => {
  assertEquals(normalizeCpf('529.982.247-25'), '52998224725');
  assertEquals(normalizeCpf('52998224725'), '52998224725');
});

Deno.test('backend CPF validation rejects repeated and invalid digits', () => {
  assert(isValidCpf('52998224725'));
  assert(!isValidCpf('11111111111'));
  assert(!isValidCpf('52998224724'));
});
