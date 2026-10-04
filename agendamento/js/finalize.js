import { clearDraft } from './state.js';
import { validateSubmission } from './validation.js';
import { FORM_VERSION } from './config.js';
import {
  buildSubmissionPayload,
  clearSubmissionToken,
  getOrCreateSubmissionToken,
  submitPreAnamnese,
} from './api.js';

export function createSubmissionGate() {
  let inFlight = null;
  return function run(task) {
    if (inFlight) return inFlight;
    try {
      inFlight = Promise.resolve(task()).finally(() => {
        inFlight = null;
      });
      return inFlight;
    } catch (error) {
      inFlight = null;
      throw error;
    }
  };
}

export async function finalizePreAnamnese({
  state,
  signaturePad,
  storage,
  cryptoImpl = globalThis.crypto,
  sourceVersion = FORM_VERSION,
  submitImpl = submitPreAnamnese,
}) {
  const validation = validateSubmission(state);
  if (!validation.valid) {
    const error = new Error('Revise os campos obrigatórios antes de finalizar.');
    error.details = validation.errors;
    throw error;
  }
  if (!signaturePad || signaturePad.isValid?.() !== true) {
    throw new Error('Faça uma rubrica válida antes de finalizar.');
  }

  const signatureDataUrl = signaturePad.toDataUrl();
  if (!signatureDataUrl) throw new Error('Não foi possível preparar a rubrica. Tente novamente.');
  const submissionToken = getOrCreateSubmissionToken(storage, cryptoImpl);
  const payload = buildSubmissionPayload(state.values, signatureDataUrl, sourceVersion, submissionToken);
  const result = await submitImpl(payload);
  clearDraft(storage);
  clearSubmissionToken(storage);
  return result;
}
