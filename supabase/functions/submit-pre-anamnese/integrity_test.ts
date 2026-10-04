import { assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1';
import { buildCanonicalSubmissionSnapshot, canonicalStringify, sha256Hex } from './integrity.ts';

Deno.test('sha256Hex returns lowercase 64-character hexadecimal digest', async () => {
  const digest = await sha256Hex(new TextEncoder().encode('BC Estética'));
  assertMatch(digest, /^[0-9a-f]{64}$/);
});

Deno.test('canonicalStringify ignores object key insertion order', () => {
  const first = { b: 2, a: { d: 4, c: 3 }, list: [{ y: 2, x: 1 }] };
  const second = { list: [{ x: 1, y: 2 }], a: { c: 3, d: 4 }, b: 2 };
  assertEquals(canonicalStringify(first), canonicalStringify(second));
});

Deno.test('buildCanonicalSubmissionSnapshot emits only the integrity contract fields', () => {
  const snapshot = buildCanonicalSubmissionSnapshot({
    publicCode: 'BC-20261004-ABCDE',
    patientName: 'João da Silva',
    patientCpf: '52998224725',
    procedure: 'Cryo Lift',
    answers: { observacoes: 'ok' },
    consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
    sourceVersion: '2026-10-04.v2',
    rubricSha256: 'a'.repeat(64),
    confirmedAt: '2026-10-04T12:00:00.000Z',
    ignored: 'não entra no snapshot',
  });
  assertEquals(Object.keys(snapshot), [
    'publicCode',
    'patientName',
    'patientCpf',
    'procedure',
    'answers',
    'consents',
    'sourceVersion',
    'rubricSha256',
    'confirmedAt',
  ]);
});

Deno.test('canonical submission hash changes when protected fields change', async () => {
  const base = {
    publicCode: 'BC-20261004-ABCDE',
    patientName: 'João da Silva',
    patientCpf: '52998224725',
    procedure: 'Cryo Lift',
    answers: { observacoes: 'ok', nested: { b: 2, a: 1 } },
    consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
    sourceVersion: '2026-10-04.v2',
    rubricSha256: 'a'.repeat(64),
    confirmedAt: '2026-10-04T12:00:00.000Z',
  };

  const digest = async (value: Record<string, unknown>) => sha256Hex(
    new TextEncoder().encode(canonicalStringify(buildCanonicalSubmissionSnapshot(value))),
  );

  const original = await digest(base);
  const reordered = await digest({ ...base, answers: { nested: { a: 1, b: 2 }, observacoes: 'ok' } });
  assertEquals(reordered, original);

  assertNotEquals(await digest({ ...base, patientCpf: '12345678909' }), original);
  assertNotEquals(await digest({ ...base, answers: { ...base.answers, observacoes: 'mudou' } }), original);
  assertNotEquals(await digest({ ...base, consents: { ...base.consents, dataAuthorization: false } }), original);
  assertNotEquals(await digest({ ...base, rubricSha256: 'b'.repeat(64) }), original);
  assertNotEquals(await digest({ ...base, confirmedAt: '2026-10-04T12:00:01.000Z' }), original);
});
