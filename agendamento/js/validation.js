import { isValidCpf } from './cpf.js';
function text(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function result(errors) {
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep(stepId, state) {
  const values = state?.values ?? {};
  const errors = {};

  if (stepId === 'step1') {
    if (!text(values.nome)) errors.nome = 'Informe seu nome completo.';
    if (!text(values.nascimento)) errors.nascimento = 'Informe sua data de nascimento.';
    if (!text(values.idade)) errors.idade = 'Informe sua idade.';
    if (!text(values.whatsapp)) errors.whatsapp = 'Informe um WhatsApp para contato.';
    if (!isValidCpf(values.cpf)) errors.cpf = 'Informe um CPF válido.';
    if (values.dataAuthorization !== true) errors.dataAuthorization = 'Autorize o tratamento dos dados para continuar.';
    const procedures = Array.isArray(values.procedimentos) ? values.procedimentos : [];
    if (procedures.length === 0) errors.procedimentos = 'Selecione pelo menos um procedimento ou orientação profissional.';
    if (procedures.includes('Outro') && !text(values.outroProc)) errors.outroProc = 'Descreva o procedimento de interesse.';
  }

  if (stepId === 'step7') {
    if (values.consentimento1 !== true) errors.consentimento1 = 'Confirme que as informações fornecidas são verdadeiras para finalizar.';
    if (values.consentimento2 !== true) errors.consentimento2 = 'Confirme o tratamento das informações para finalizar.';
  }

  return result(errors);
}

export function validateSubmission(state) {
  const combined = {
    ...validateStep('step1', state).errors,
    ...validateStep('step7', state).errors,
  };
  return result(combined);
}
