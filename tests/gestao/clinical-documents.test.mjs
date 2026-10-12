import test from 'node:test';
import assert from 'node:assert/strict';

async function loadDocs() {
  try { return await import('../../gestao/js/clinical-documents-api.js'); }
  catch (error) { assert.fail(`clinical-documents-api.js deve existir: ${error?.code || error}`); }
}

test('documento clínico usa URL assinada curta e nunca getPublicUrl', async () => {
  const { getClinicalDocumentUrl } = await loadDocs();
  const calls = [];
  const client = {
    storage: { from: (bucket) => ({ createSignedUrl: async (path, expiresIn) => { calls.push({ bucket, path, expiresIn }); return { data: { signedUrl: 'https://signed.example' }, error: null }; } }) },
  };
  const url = await getClinicalDocumentUrl({ client, storagePath: 'documentos/anamnese/doc.pdf' });
  assert.equal(url, 'https://signed.example');
  assert.deepEqual(calls[0], { bucket: 'bc-prontuario-private', path: 'documentos/anamnese/doc.pdf', expiresIn: 300 });
});

test('PDF é solicitado à Edge Function apenas por documentId', async () => {
  const { generateAnamnesePdf } = await loadDocs();
  const calls = [];
  const client = { functions: { invoke: async (name, options) => { calls.push({ name, options }); return { data: { ok: true }, error: null }; } } };
  await generateAnamnesePdf({ client, documentId: 'd1' });
  assert.deepEqual(calls[0], { name: 'generate-anamnese-pdf', options: { body: { documentId: 'd1' } } });
});

test('assinatura registra apenas metadados e caminho privado via RPC', async () => {
  const { registerClinicalSignature } = await loadDocs();
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: 's1', error: null }; } };
  await registerClinicalSignature({ client, documentId: 'd1', signerKind: 'profissional', storagePath: 'assinaturas/d1/profissional.png', sha256: 'abc123' });
  assert.equal(calls[0].name, 'bc_clinical_signature_register');
  assert.deepEqual(calls[0].args, { p_document_id: 'd1', p_signer_kind: 'profissional', p_storage_path: 'assinaturas/d1/profissional.png', p_sha256: 'abc123' });
  assert.doesNotMatch(JSON.stringify(calls[0].args), /user_id|role|profissao|conselho/);
});
