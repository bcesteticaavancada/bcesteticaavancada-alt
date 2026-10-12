export function normalizeProcedureDraft(input = {}) {
  return { ...input };
}

export function validateProcedureDraft() {
  return {
    valid: false,
    errors: { not_implemented: 'Domínio 6C ainda não implementado.' },
  };
}

export function deriveConsentClass() {
  return 'nao_injetavel';
}

export function formatProcedurePrice() {
  return '';
}
