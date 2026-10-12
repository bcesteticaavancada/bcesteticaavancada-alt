const DOCUMENT_CLASSES = new Set(['injetavel', 'nao_injetavel']);
const PRICE_MODES = new Set(['fixed', 'starting_at']);
const PROTOCOL_MODES = new Set(['simple', 'compound']);

function cleanText(value) {
  return String(value ?? '').trim();
}

function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = cleanText(value)
    .replace(/\s+/g, '')
    .replace(/^R\$/i, '');
  if (!raw) return NaN;

  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.');
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

function parseDuration(value) {
  if (value === null || value === undefined || cleanText(value) === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : NaN;
}

function normalizeComponentIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanText).filter(Boolean))];
}

export function normalizeProcedureDraft(input = {}) {
  const basePrice = parseMoney(input.base_price);
  const duration = parseDuration(input.suggested_duration);
  return {
    ...input,
    nome: cleanText(input.nome),
    classe_documental: cleanText(input.classe_documental).toLowerCase(),
    price_mode: cleanText(input.price_mode).toLowerCase(),
    base_price: basePrice,
    suggested_duration: duration,
    protocol_mode: cleanText(input.protocol_mode || 'simple').toLowerCase(),
    component_version_ids: normalizeComponentIds(input.component_version_ids),
  };
}

export function validateProcedureDraft(input = {}) {
  const draft = normalizeProcedureDraft(input);
  const errors = {};

  if (!draft.nome) errors.nome = 'Nome do procedimento é obrigatório.';
  if (!DOCUMENT_CLASSES.has(draft.classe_documental)) {
    errors.classe_documental = 'Classe documental inválida.';
  }
  if (!PRICE_MODES.has(draft.price_mode)) {
    errors.price_mode = 'Modo de preço inválido.';
  }
  if (!Number.isFinite(draft.base_price) || draft.base_price <= 0) {
    errors.base_price = 'Preço-base deve ser maior que zero.';
  }
  if (draft.suggested_duration !== null
      && (!Number.isInteger(draft.suggested_duration) || draft.suggested_duration <= 0)) {
    errors.suggested_duration = 'Duração sugerida deve ser um número inteiro positivo.';
  }
  if (!PROTOCOL_MODES.has(draft.protocol_mode)) {
    errors.protocol_mode = 'Modo de protocolo inválido.';
  }
  if (draft.protocol_mode === 'compound' && draft.component_version_ids.length === 0) {
    errors.component_version_ids = 'Protocolos compostos exigem ao menos um componente.';
  }

  return { valid: Object.keys(errors).length === 0, errors, value: draft };
}

export function deriveConsentClass({ procedureVersion = {}, componentVersions = [] } = {}) {
  const base = cleanText(procedureVersion.classe_documental).toLowerCase();
  if (base === 'injetavel') return 'injetavel';

  const components = Array.isArray(componentVersions) ? componentVersions : [];
  if (components.some((item) => cleanText(item?.classe_documental).toLowerCase() === 'injetavel')) {
    return 'injetavel';
  }
  return 'nao_injetavel';
}

export function formatProcedurePrice(procedureVersion = {}) {
  const value = parseMoney(procedureVersion.base_price);
  if (!Number.isFinite(value)) return '';
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).replace(/\u00a0/g, ' ');
  return procedureVersion.price_mode === 'starting_at' ? `A partir de ${formatted}` : formatted;
}
