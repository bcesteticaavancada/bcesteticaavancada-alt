const ACTIONS = new Set(['catalog', 'professionals', 'month', 'slots', 'book']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function asObject(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Requisição inválida.');
  return raw;
}

function cleanString(value) {
  return String(value ?? '').trim();
}

function requiredUuid(value, label) {
  const clean = cleanString(value);
  if (!UUID_RE.test(clean)) throw new Error(`${label} inválido.`);
  return clean;
}

function validateMonth(value) {
  const clean = cleanString(value);
  if (!MONTH_RE.test(clean)) throw new Error('Mês inválido.');
  return clean;
}

function validateDate(value) {
  const clean = cleanString(value);
  const match = DATE_RE.exec(clean);
  if (!match) throw new Error('Data inválida.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() + 1 !== month || candidate.getUTCDate() !== day) {
    throw new Error('Data inválida.');
  }
  return clean;
}

function validateTime(value) {
  const clean = cleanString(value);
  const match = TIME_RE.exec(clean);
  if (!match) throw new Error('Horário inválido.');
  if (Number(match[2]) % 15 !== 0) throw new Error('Horário inválido.');
  return clean;
}

function normalizeName(value) {
  const clean = cleanString(value).replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 160) throw new Error('Nome inválido.');
  return clean;
}

export function normalizePhone(value) {
  const digits = cleanString(value).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) throw new Error('WhatsApp / telefone inválido.');
  return digits;
}

export function sanitizePublicAgendaPayload(raw) {
  const input = asObject(raw);
  const action = cleanString(input.action);
  if (!ACTIONS.has(action)) throw new Error('Ação inválida.');

  if (action === 'catalog') return { action };

  const procedureId = requiredUuid(input.procedureId, 'Procedimento');
  if (action === 'professionals') return { action, procedureId };

  const professionalId = requiredUuid(input.professionalId, 'Profissional');
  if (action === 'month') {
    return { action, procedureId, professionalId, month: validateMonth(input.month) };
  }
  if (action === 'slots') {
    return { action, procedureId, professionalId, date: validateDate(input.date) };
  }

  const website = cleanString(input.website);
  if (website) throw new Error('Requisição inválida.');
  return {
    action,
    procedureId,
    professionalId,
    date: validateDate(input.date),
    time: validateTime(input.time),
    name: normalizeName(input.name),
    phone: normalizePhone(input.phone),
    website: '',
  };
}

export function validatePublicAgendaPayload(raw) {
  return sanitizePublicAgendaPayload(raw);
}
