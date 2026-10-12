import test from 'node:test';
import assert from 'node:assert/strict';

async function load() {
  try { return await import('../../gestao/js/signature-pad.js'); }
  catch (error) { assert.fail(`signature-pad.js deve existir: ${error?.code || error}`); }
}

test('métricas de assinatura rejeitam toque/rabisco trivial e aceitam traço real', async () => {
  const { isSignatureMetricsValid } = await load();
  assert.equal(isSignatureMetricsValid({ moveCount: 0, totalDistance: 0, minX: 10, maxX: 10, minY: 10, maxY: 10 }), false);
  assert.equal(isSignatureMetricsValid({ moveCount: 1, totalDistance: 8, minX: 10, maxX: 15, minY: 10, maxY: 12 }), false);
  assert.equal(isSignatureMetricsValid({ moveCount: 8, totalDistance: 94, minX: 10, maxX: 90, minY: 20, maxY: 48 }), true);
});

test('sha256Blob produz hash hexadecimal determinístico', async () => {
  const { sha256Blob } = await load();
  const hash = await sha256Blob(new Blob(['bc-estetica'], { type: 'text/plain' }));
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, await sha256Blob(new Blob(['bc-estetica'])));
});
