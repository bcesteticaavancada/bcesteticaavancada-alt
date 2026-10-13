const BUCKET = 'bc-prontuario-private';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

function cleanRequired(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} é obrigatório.`);
  return clean;
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

function cleanFilenamePart(value, fallback = '') {
  const clean = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');
  return clean || fallback;
}

export function buildClinicalPdfDownloadFilename(patientName, dateValue = new Date().toISOString()) {
  const words = String(patientName ?? '').trim().split(/\s+/).filter(Boolean);
  const first = cleanFilenamePart(words[0], 'Paciente');
  const last = words.length > 1 ? cleanFilenamePart(words.at(-1)) : '';
  const parsed = new Date(dateValue || Date.now());
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `BC_${first}${last ? `_${last}` : ''}_${values.day}_${values.month}_${values.year}.pdf`;
}

export async function listClinicalDocuments({ client, clienteId }) {
  return unwrap(await client.rpc('bc_clinical_document_list', { p_cliente_id: clienteId })) || [];
}

export async function listClinicalSignatures({ client, documentId }) {
  return unwrap(await client.rpc('bc_clinical_signature_list', { p_document_id: documentId })) || [];
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

export async function prepareProcedureConsent({
  client,
  clienteId,
  procedureVersionId,
  componentVersionIds = [],
  componentKeys = [],
  cycleKey = null,
}) {
  return unwrap(await client.rpc('bc_treatment_prepare_consent', {
    p_cliente_id: cleanRequired(clienteId, 'Cliente'),
    p_procedure_version_id: cleanRequired(procedureVersionId, 'Versão do procedimento'),
    p_component_version_ids: cleanList(componentVersionIds),
    p_component_keys: cleanList(componentKeys),
    p_cycle_key: String(cycleKey ?? '').trim() || null,
  }));
}

export async function finalizeProcedureConsent({ client, documentId }) {
  return unwrap(await client.rpc('bc_treatment_consent_finalize', {
    p_document_id: cleanRequired(documentId, 'Documento'),
  }));
}

export async function generateAnamnesePdf({ client, documentId }) {
  return unwrap(await client.functions.invoke('generate-anamnese-pdf', { body: { documentId } }));
}

export async function generateClinicalPdf({ client, documentId }) {
  return unwrap(await client.functions.invoke('generate-clinical-pdf', {
    body: { documentId: cleanRequired(documentId, 'Documento') },
  }));
}

export async function getClinicalDocumentUrl({ client, storagePath, expiresIn = 300, downloadFilename = null }) {
  const options = downloadFilename ? { download: cleanRequired(downloadFilename, 'Nome do arquivo') } : undefined;
  const data = unwrap(await client.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn, options));
  return data?.signedUrl || data?.signedURL || null;
}

export async function uploadClinicalSignature({ client, documentId, signerKind, file }) {
  if (!file) throw new Error('Assinatura inválida.');
  const storagePath = `assinaturas/${documentId}/${signerKind}-${crypto.randomUUID()}.png`;
  const result = await client.storage.from(BUCKET).upload(storagePath, file, { upsert: false, contentType: 'image/png' });
  if (result.error) throw result.error;
  return storagePath;
}
