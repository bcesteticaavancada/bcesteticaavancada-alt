import { normalizeCpf, isValidCpf } from './cpf.ts';
export { normalizeCpf, isValidCpf } from './cpf.ts';

export type SubmissionPatient = {
  name: string;
  cpf: string;
  birthDate: string;
  age: number;
  phone: string;
  email?: string;
};

export type ValidSubmission = {
  patient: SubmissionPatient;
  procedure: string;
  answers: Record<string, unknown>;
  consents: Record<string, unknown> & { truthful: true; dataProcessing: true; dataAuthorization: true };
  signatureDataUrl: string;
  sourceVersion: string;
  submissionToken: string;
  website?: string;
};

export type ValidationResult =
  | { valid: true; data: ValidSubmission; errors: Record<string, never> }
  | { valid: false; data: null; errors: Record<string, string> };

const MAX_JSON_BYTES = 2_900_000;
const MAX_TEXT_LENGTH = 20_000;
const MAX_SIGNATURE_DATA_URL_CHARS = 2_796_300;
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function normalizeText(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function normalizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => normalizeUnknown(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 300)) {
      const safeKey = normalizeText(key).slice(0, 120);
      if (safeKey) out[safeKey] = normalizeUnknown(child, depth + 1);
    }
    return out;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean' || value === null) return value;
  return null;
}

function hasOversizedText(value: unknown, depth = 0): boolean {
  if (depth > 12) return true;
  if (typeof value === 'string') return value.length > MAX_TEXT_LENGTH;
  if (Array.isArray(value)) return value.some((item) => hasOversizedText(item, depth + 1));
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some((item) => hasOversizedText(item, depth + 1));
  return false;
}

function jsonSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function validateSubmission(input: unknown): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, data: null, errors: { payload: 'Payload inválido.' } };
  }

  const raw = input as Record<string, unknown>;
  const textOnlyPayload = { ...raw, signatureDataUrl: '' };
  if (jsonSize(input) > MAX_JSON_BYTES || hasOversizedText(textOnlyPayload)) {
    errors.payload = 'O conteúdo enviado excede o limite permitido.';
  }

  if (normalizeText(String(raw.website ?? ''))) errors.website = 'Submissão recusada.';

  const patientRaw = raw.patient && typeof raw.patient === 'object' && !Array.isArray(raw.patient)
    ? raw.patient as Record<string, unknown>
    : {};
  const patient = {
    name: normalizeText(String(patientRaw.name ?? '')).slice(0, 160),
    cpf: normalizeCpf(patientRaw.cpf),
    birthDate: normalizeText(String(patientRaw.birthDate ?? '')).slice(0, 20),
    age: Number(patientRaw.age ?? 0),
    phone: normalizeText(String(patientRaw.phone ?? '')).slice(0, 40),
    email: normalizeText(String(patientRaw.email ?? '')).slice(0, 254),
  };

  if (patient.name.length < 2) errors.patientName = 'Informe o nome completo.';
  if (!isValidCpf(patient.cpf)) errors.patientCpf = 'Informe um CPF válido.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(patient.birthDate)) errors.birthDate = 'Informe uma data de nascimento válida.';
  if (!Number.isInteger(patient.age) || patient.age < 1 || patient.age > 120) errors.age = 'Informe uma idade válida.';
  if (patient.phone.replace(/\D/g, '').length < 8) errors.phone = 'Informe um telefone válido.';
  if (patient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) errors.email = 'Informe um e-mail válido.';

  const procedure = normalizeText(String(raw.procedure ?? '')).slice(0, 300);
  if (!procedure) errors.procedure = 'Informe o procedimento de interesse.';

  const answers = normalizeUnknown(raw.answers ?? {}) as Record<string, unknown>;
  const consents = normalizeUnknown(raw.consents ?? {}) as Record<string, unknown>;
  if (consents.truthful !== true) errors.consentTruthful = 'Confirme a veracidade das informações.';
  if (consents.dataProcessing !== true) errors.consentDataProcessing = 'Confirme o tratamento das informações para atendimento.';
  if (consents.dataAuthorization !== true) errors.dataAuthorization = 'Autorize o tratamento dos dados para continuar.';

  const signatureDataUrl = String(raw.signatureDataUrl ?? '');
  if (!PNG_DATA_URL.test(signatureDataUrl) || signatureDataUrl.length > MAX_SIGNATURE_DATA_URL_CHARS) {
    errors.signatureDataUrl = 'Rubrica de confirmação inválida.';
  }

  const sourceVersion = normalizeText(String(raw.sourceVersion ?? '')).slice(0, 80);
  if (!sourceVersion) errors.sourceVersion = 'Versão do formulário ausente.';

  const submissionToken = normalizeText(String(raw.submissionToken ?? '')).slice(0, 128);
  if (!TOKEN_RE.test(submissionToken)) errors.submissionToken = 'Token de envio inválido.';

  if (Object.keys(errors).length) return { valid: false, data: null, errors };

  return {
    valid: true,
    errors: {},
    data: {
      patient,
      procedure,
      answers,
      consents: consents as ValidSubmission['consents'],
      signatureDataUrl,
      sourceVersion,
      submissionToken,
      website: '',
    },
  };
}
