import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { normalizeCpf } from './cpf.js';

export const SUBMISSION_TOKEN_KEY = 'bc.preAnamnese.submissionToken.v1';

const SAFE_FILENAME_PART = /[^\p{L}\p{N}._-]+/gu;

function cleanFilenamePart(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(SAFE_FILENAME_PART, '')
    .replace(/^[._-]+|[._-]+$/g, '');
}

function beloHorizonteDate(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createSubmissionToken(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.randomUUID) throw new Error('Este navegador não suporta geração segura de identificador.');
  return cryptoImpl.randomUUID();
}

export function getOrCreateSubmissionToken(storage, cryptoImpl = globalThis.crypto) {
  const current = storage?.getItem?.(SUBMISSION_TOKEN_KEY);
  if (current && /^[A-Za-z0-9_-]{16,128}$/.test(current)) return current;
  const created = createSubmissionToken(cryptoImpl);
  storage?.setItem?.(SUBMISSION_TOKEN_KEY, created);
  return created;
}

export function clearSubmissionToken(storage) {
  storage?.removeItem?.(SUBMISSION_TOKEN_KEY);
}

export function buildSubmissionPayload(values, signatureDataUrl, sourceVersion, submissionToken) {
  const procedures = Array.isArray(values?.procedimentos) ? values.procedimentos : [values?.procedimentos].filter(Boolean);
  const { cpf: _cpf, dataAuthorization: _dataAuthorization, website: _website, ...answers } = values || {};
  return {
    patient: {
      name: String(values?.nome || '').trim(),
      cpf: normalizeCpf(values?.cpf),
      birthDate: String(values?.nascimento || '').trim(),
      age: Number(values?.idade || 0),
      phone: String(values?.whatsapp || '').trim(),
      email: String(values?.email || '').trim(),
    },
    procedure: procedures.map(String).join(', '),
    answers,
    consents: {
      truthful: values?.consentimento1 === true,
      dataProcessing: values?.consentimento2 === true,
      dataAuthorization: values?.dataAuthorization === true,
    },
    signatureDataUrl,
    sourceVersion,
    submissionToken,
    website: String(values?.website || ''),
  };
}

export function filenameForCode(publicCode) {
  const safe = String(publicCode || 'BC-pre-anamnese').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
  return `${safe}.pdf`;
}

export function filenameForPatient(patientName, createdAt, fallbackCode = '') {
  const date = beloHorizonteDate(createdAt);
  if (!date) return filenameForCode(fallbackCode);
  const words = String(patientName ?? '').trim().split(/\s+/).filter(Boolean);
  const first = cleanFilenamePart(words[0] ?? 'Paciente') || 'Paciente';
  const last = cleanFilenamePart(words.length > 1 ? words.at(-1) : '');
  const person = last && last !== first ? `${first}-${last}` : first;
  return `BC-Ficha${date}${person}.pdf`;
}

export async function submitPreAnamnese(payload, fetchImpl = fetch, config = {}) {
  const url = config.url || `${SUPABASE_URL}/functions/v1/submit-pre-anamnese`;
  const key = config.key || SUPABASE_PUBLISHABLE_KEY;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', apikey: key },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const message = data?.error || data?.message || `Não foi possível enviar a ficha (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data?.errors || null;
    throw error;
  }
  return data;
}

export async function fetchPdfBlob(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error('Não foi possível obter o PDF.');
  return response.blob();
}

export async function downloadPdf(url, filename, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const documentImpl = deps.documentImpl || document;
  const URLImpl = deps.URLImpl || URL;
  const blob = await fetchPdfBlob(url, fetchImpl);
  const objectUrl = URLImpl.createObjectURL(blob);
  try {
    const anchor = documentImpl.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    documentImpl.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URLImpl.revokeObjectURL(objectUrl), 1000);
  }
}

export async function sharePdf(url, filename, navigatorImpl = navigator, fetchImpl = fetch) {
  if (!navigatorImpl?.share) return false;
  const blob = await fetchPdfBlob(url, fetchImpl);
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigatorImpl.canShare && !navigatorImpl.canShare({ files: [file] })) return false;
  await navigatorImpl.share({ files: [file], title: 'BC Estética — Pré-anamnese', text: 'Ficha de Pré-Anamnese BC Estética' });
  return true;
}
