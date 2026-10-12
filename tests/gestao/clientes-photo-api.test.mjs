import test from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadClientIdPhoto,
  listClientIdPhotos,
  getClientIdPhotoUrl,
  setCurrentClientIdPhoto,
} from '../../gestao/js/clientes-photo-api.js';

function makeClient({ uploadResult, signedResult, rpcResult, listResult } = {}) {
  const storageCalls = [];
  const rpcCalls = [];
  const tableCalls = [];
  const queryCalls = [];
  const bucket = {
    async upload(...args) {
      storageCalls.push(['upload', ...args]);
      return uploadResult ?? { data: { path: args[0] }, error: null };
    },
    async createSignedUrl(...args) {
      storageCalls.push(['createSignedUrl', ...args]);
      return signedResult ?? { data: { signedUrl: 'https://signed.example/photo' }, error: null };
    },
    getPublicUrl(...args) {
      storageCalls.push(['getPublicUrl', ...args]);
      return { data: { publicUrl: 'https://public.invalid' } };
    },
  };
  const query = {
    select(...args) { queryCalls.push(['select', ...args]); return query; },
    eq(...args) { queryCalls.push(['eq', ...args]); return query; },
    order(...args) { queryCalls.push(['order', ...args]); return query; },
    then(resolve, reject) { return Promise.resolve(listResult ?? { data: [], error: null }).then(resolve, reject); },
  };
  return {
    storageCalls,
    rpcCalls,
    tableCalls,
    queryCalls,
    client: {
      storage: {
        from(name) {
          storageCalls.push(['from', name]);
          return bucket;
        },
      },
      async rpc(name, payload = {}) {
        rpcCalls.push([name, payload]);
        return rpcResult ?? { data: 'photo-1', error: null };
      },
      from(name) {
        tableCalls.push(name);
        return query;
      },
    },
  };
}

function fakeFile({ type = 'image/jpeg', size = 1024, name = 'foto.jpg' } = {}) {
  return { type, size, name };
}

test('upload usa bucket privado, caminho por cliente e registra metadados via RPC', async () => {
  const mock = makeClient();
  const result = await uploadClientIdPhoto({ client: mock.client, clienteId: 'c1', file: fakeFile() });
  assert.equal(mock.storageCalls[0][0], 'from');
  assert.equal(mock.storageCalls[0][1], 'bc-prontuario-private');
  const upload = mock.storageCalls.find((call) => call[0] === 'upload');
  assert.match(upload[1], /^identificacao\/c1\/[a-z0-9-]+\.jpg$/i);
  assert.equal(upload[3].contentType, 'image/jpeg');
  assert.equal(upload[3].upsert, false);
  assert.deepEqual(mock.rpcCalls[0][0], 'bc_cliente_register_id_photo');
  assert.equal(mock.rpcCalls[0][1].p_cliente_id, 'c1');
  assert.equal(mock.rpcCalls[0][1].p_mime_type, 'image/jpeg');
  assert.equal(mock.rpcCalls[0][1].p_tamanho_bytes, 1024);
  assert.doesNotMatch(JSON.stringify(mock.rpcCalls[0]), /created_by|user_id/i);
  assert.equal(result.fotoId, 'photo-1');
  assert.match(result.storagePath, /^identificacao\/c1\//);
});

test('arquivo inválido é rejeitado antes de chamar Storage', async () => {
  const wrongType = makeClient();
  await assert.rejects(
    () => uploadClientIdPhoto({ client: wrongType.client, clienteId: 'c1', file: fakeFile({ type: 'application/pdf' }) }),
    /jpeg|png|webp|imagem/i,
  );
  assert.equal(wrongType.storageCalls.length, 0);

  const tooLarge = makeClient();
  await assert.rejects(
    () => uploadClientIdPhoto({ client: tooLarge.client, clienteId: 'c1', file: fakeFile({ size: 8 * 1024 * 1024 + 1 }) }),
    /8\s*mb|tamanho/i,
  );
  assert.equal(tooLarge.storageCalls.length, 0);
});

test('lista histórico de fotos por cliente do mais recente', async () => {
  const mock = makeClient({ listResult: { data: [{ id: 'p1' }], error: null } });
  const rows = await listClientIdPhotos({ client: mock.client, clienteId: 'c1' });
  assert.deepEqual(rows, [{ id: 'p1' }]);
  assert.equal(mock.tableCalls[0], 'cliente_identificacao_fotos');
  assert.ok(mock.queryCalls.some((call) => call[0] === 'eq' && call[1] === 'cliente_id' && call[2] === 'c1'));
  assert.ok(mock.queryCalls.some((call) => call[0] === 'order' && call[1] === 'created_at' && call[2]?.ascending === false));
});

test('foto privada usa createSignedUrl e nunca getPublicUrl', async () => {
  const mock = makeClient();
  const url = await getClientIdPhotoUrl({ client: mock.client, storagePath: 'identificacao/c1/x.jpg' });
  assert.equal(url, 'https://signed.example/photo');
  assert.ok(mock.storageCalls.some((call) => call[0] === 'createSignedUrl' && call[2] === 300));
  assert.equal(mock.storageCalls.some((call) => call[0] === 'getPublicUrl'), false);
});

test('troca da foto atual usa RPC dedicado e preserva histórico no backend', async () => {
  const mock = makeClient();
  await setCurrentClientIdPhoto({ client: mock.client, clienteId: 'c1', fotoId: 'p1' });
  assert.deepEqual(mock.rpcCalls[0], ['bc_cliente_set_current_id_photo', { p_cliente_id: 'c1', p_foto_id: 'p1' }]);
});
