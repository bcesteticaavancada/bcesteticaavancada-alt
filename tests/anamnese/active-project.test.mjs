import test from 'node:test';
import assert from 'node:assert/strict';
import { submitPreAnamnese } from '../../agendamento/js/api.js';
import { SUPABASE_URL as gestaoUrl } from '../../gestao/js/config.js';

test('ficha pública é enviada à mesma base ativa da gestão', async () => {
  let destination;
  await submitPreAnamnese({}, async (url) => {
    destination = url;
    return { ok: true, json: async () => ({ publicCode: 'TESTE' }) };
  });
  assert.equal(destination, `${gestaoUrl}/functions/v1/submit-pre-anamnese`);
});
