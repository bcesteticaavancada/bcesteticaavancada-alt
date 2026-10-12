const BUCKET = 'bc-prontuario-private';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function listClinicalDocuments({ client, clienteId }) {
  return unwrap(await client.rpc('bc_clinical_document_list', { p_cliente_id: clienteId })) || [];
}

export async function registerClinicalSignature({ client, documentId, signerKind, storagePath, sha256 }) {
  return unwrap(await client.rpc('bc_clinical_signature_register', {
    p_document_id: documentId,
    p_signer_kind: signerKind,
    p_storage_path: storagePath,
    p_sha256: sha256,
  }));
}

export async function finalizeAnamneseDocument({ client, documentId }) {
  return unwrap(await client.rpc('bc_clinical_document_finalize', { p_document_id: documentId }));
}

export async function generateAnamnesePdf({ client, documentId }) {
  return unwrap(await client.functions.invoke('generate-anamnese-pdf', { body: { documentId } }));
}

export async function getClinicalDocumentUrl({ client, storagePath, expiresIn = 300 }) {
  const data = unwrap(await client.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn));
  return data?.signedUrl || data?.signedURL || null;
}

export async function uploadClinicalSignature({ client, documentId, signerKind, file }) {
  if (!file) throw new Error('Assinatura inválida.');
  const ext = file.type === 'image/png' ? 'png' : 'png';
  const storagePath = `assinaturas/${documentId}/${signerKind}-${crypto.randomUUID()}.${ext}`;
  const result = await client.storage.from(BUCKET).upload(storagePath, file, { upsert: false, contentType: 'image/png' });
  if (result.error) throw result.error;
  return storagePath;
}
