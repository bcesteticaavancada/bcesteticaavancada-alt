import { assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { canonicalSubmission, sha256Hex } from './integrity.ts';

Deno.test('sha256Hex is deterministic for the same bytes', async () => {
  const value = new TextEncoder().encode('BC Estética');
  const first = await sha256Hex(value);
  const second = await sha256Hex(value);
  assertEquals(first, second);
  assertMatch(first, /^[a-f0-9]{64}$/);
});

Deno.test('canonicalSubmission is stable regardless of answer key order', () => {
  const base = {
    publicCode: 'BC-20261004-ABCDE',
    patientName: 'João da Silva',
    patientCpf: '52998224725',
    procedure: 'Cryo Lift',
    consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
    sourceVersion: 'v2',
    rubricSha256: 'a'.repeat(64),
    confirmedAt: '2026-10-04T21:00:00.000Z',
  };
  const a = canonicalSubmission({ ...base, answers: { z: 2, a: 1 } });
  const b = canonicalSubmission({ ...base, answers: { a: 1, z: 2 } });
  assertEquals(a, b);
  assertEquals(JSON.parse(a).patientCpf, '52998224725');
});
