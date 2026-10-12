import test from 'node:test';
import assert from 'node:assert/strict';

async function loadApi() {
  try { return await import('../../gestao/js/anamnese-api.js'); }
  catch (error) { assert.fail(`anamnese-api.js deve existir: ${error?.code || error}`); }
}

function mockClient() {
  const calls = [];
  return {
    calls,
    rpc: async (name, args = {}) => {
      calls.push({ name, args });
      return { data: name.includes('begin') ? '11111111-1111-1111-1111-111111111111' : [], error: null };
    },
  };
}

test('API inicia anamnese por RPC sem enviar autoria ou papel do usuário', async () => {
  const { beginAnamnese } = await loadApi();
  const client = mockClient();
  await beginAnamnese({ client, clienteId: 'c1', source: 'presencial' });
  assert.equal(client.calls[0].name, 'bc_anamnese_begin');
  assert.deepEqual(client.calls[0].args, { p_cliente_id: 'c1', p_source: 'presencial' });
  const payload = JSON.stringify(client.calls[0].args);
  assert.doesNotMatch(payload, /created_by|user_id|role|admin/i);
});

test('API salva respostas em lote pelo RPC dedicado', async () => {
  const { saveAnamneseAnswers } = await loadApi();
  const client = mockClient();
  await saveAnamneseAnswers({ client, anamneseId: 'a1', answers: { alergias_conhecidas: 'sim' } });
  assert.deepEqual(client.calls[0], { name: 'bc_anamnese_save_answers', args: { p_anamnese_id: 'a1', p_answers: { alergias_conhecidas: 'sim' } } });
});

test('API cria link remoto e retorna token apenas da resposta RPC', async () => {
  const { createRemoteLink } = await loadApi();
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { token: 'raw-once', expires_at: '2026-10-15T00:00:00Z' }, error: null }; } };
  const result = await createRemoteLink({ client, anamneseId: 'a1' });
  assert.equal(calls[0].name, 'bc_anamnese_create_remote_link');
  assert.deepEqual(calls[0].args, { p_anamnese_id: 'a1' });
  assert.equal(result.token, 'raw-once');
});
