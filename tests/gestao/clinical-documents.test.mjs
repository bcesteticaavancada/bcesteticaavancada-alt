import test from 'node:test';
import assert from 'node:assert/strict';

async function loadDocs() {
  try { return await import('../../gestao/js/clinical-documents-api.js'); }
  catch (error) { assert.fail(`clinical-documents-api.js deve existir: ${error?.code || error}`); }
}

test('documento clínico usa URL assinada de download com nome explícito', async () => {
  const { getClinicalDocumentUrl } = await loadDocs();
  const calls = [];
  const client = {
    storage: { from: (bucket) => ({ createSignedUrl: async (path, expiresIn, options) => { calls.push({ bucket, path, expiresIn, options }); return { data: { signedUrl: 'https://signed.example' }, error: null }; } }) },
  };
  const url = await getClinicalDocumentUrl({
    client,
    storagePath: 'documentos/anamnese/doc.pdf',
    downloadFilename: 'BC_Fernando_Faria_13_10_2026.pdf',
  });
  assert.equal(url, 'https://signed.example');
  assert.deepEqual(calls[0], {
    bucket: 'bc-prontuario-private',
    path: 'documentos/anamnese/doc.pdf',
    expiresIn: 300,
    options: { download: 'BC_Fernando_Faria_13_10_2026.pdf' },
  });
});

test('nome de download clínico segue BC_nome_sobrenome_dia_mes_ano.pdf', async () => {
  const { buildClinicalPdfDownloadFilename } = await loadDocs();
  assert.equal(
    buildClinicalPdfDownloadFilename('Fernando Victor Barbosa de Faria', '2026-10-13T12:00:00.000Z'),
    'BC_Fernando_Faria_13_10_2026.pdf',
  );
  assert.equal(
    buildClinicalPdfDownloadFilename('Álice da Rocha', '2026-10-13T12:00:00.000Z'),
    'BC_Alice_Rocha_13_10_2026.pdf',
  );
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
 
test('via profissional para assinatura externa pede PDF sem finalizar documento', async () => {
  const { generateProfessionalSignedConsentPdf } = await loadDocs();
  const calls=[];
  const client={functions:{invoke:async (name,options)=>{calls.push({name,options});return {data:new Blob(['%PDF-1.7'],{type:'application/pdf'}),error:null};}}};
  const pdf=await generateProfessionalSignedConsentPdf({client,documentId:'d1'});
  assert.equal(pdf.type,'application/pdf');
  assert.deepEqual(calls,[{name:'generate-clinical-pdf',options:{body:{documentId:'d1',mode:'professional_signed_for_external'}}}]);
});

test('via externa rejeita payload que não seja PDF', async () => {
  const { generateProfessionalSignedConsentPdf } = await loadDocs();
  const client={functions:{invoke:async()=>({data:{ok:true},error:null})}};
  await assert.rejects(()=>generateProfessionalSignedConsentPdf({client,documentId:'d1'}),/não retornou o PDF/i);
});
