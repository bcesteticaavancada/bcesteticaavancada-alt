export const TREATMENT_STATES = ['rascunho','pronto_para_iniciar','em_atendimento','finalizado'];

const TEXT_FIELDS = [
  'queixa_dia','objetivo','avaliacao_profissional','regiao','resposta_imediata',
  'intercorrencias_ato','orientacoes','retorno','evolucao','feedback','observacoes',
];

function cleanText(value){ return String(value ?? '').trim(); }

function parseMoney(value){
  if (value === null || value === undefined || cleanText(value) === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = cleanText(value).replace(/\s+/g,'').replace(/^R\$/i,'');
  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) normalized = raw.replace(/\./g,'').replace(',','.');
  else if (raw.includes(',')) normalized = raw.replace(',','.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

function objectOrEmpty(value){
  return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
}

function validAnamnese(anamnese, now = new Date()){
  if (!anamnese || anamnese.status !== 'finalizada' || !anamnese.valid_until) return false;
  const until = new Date(anamnese.valid_until);
  return Number.isFinite(until.getTime()) && until.getTime() >= now.getTime();
}

export function deriveTreatmentGate({
  requiresAnamnese = true,
  anamnese = null,
  healthConfirmation = null,
  alertsReviewed = false,
  permission = false,
  consent = null,
  specificModule = false,
  now = new Date(),
} = {}){
  const reasons = [];
  if (requiresAnamnese && !validAnamnese(anamnese, now)) reasons.push('anamnese_invalida');
  if (!healthConfirmation?.confirmed_at) reasons.push('saude_nao_confirmada');
  if (!alertsReviewed) reasons.push('alertas_nao_revisados');
  if (!permission) reasons.push('profissional_nao_autorizada');
  if (consent?.status !== 'finalizado') reasons.push('consentimento_pendente');
  if (!specificModule) reasons.push('modulo_especifico_incompleto');
  return { ready: reasons.length === 0, reasons };
}

export function normalizeTreatmentDraft(input = {}){
  const output = {};
  for (const field of TEXT_FIELDS) output[field] = cleanText(input[field]);
  output.final_price = parseMoney(input.final_price);
  output.specific_data = objectOrEmpty(input.specific_data);
  output.technical_data = objectOrEmpty(input.technical_data);
  return output;
}

export function validateTreatmentDraft(input = {}){
  const value = normalizeTreatmentDraft(input);
  const errors = {};
  if (!value.objetivo) errors.objetivo = 'Objetivo é obrigatório.';
  if (!value.regiao) errors.regiao = 'Região é obrigatória.';

  const mode = cleanText(input.price_mode);
  const base = parseMoney(input.base_price);
  if (mode === 'fixed') {
    if (!Number.isFinite(base) || base <= 0) errors.base_price = 'Preço-base inválido.';
    else value.final_price = base;
  } else if (mode === 'starting_at') {
    if (!Number.isFinite(value.final_price) || value.final_price <= 0) errors.final_price = 'Preço final deve ser informado.';
  }
  return { valid: Object.keys(errors).length === 0, errors, value };
}
