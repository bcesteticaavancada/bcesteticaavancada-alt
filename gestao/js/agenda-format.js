export const CLINIC_TIME_ZONE = 'America/Sao_Paulo';

const displayFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CLINIC_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Data ou horário inválido.');
  return date;
}

function partsMap(date) {
  return Object.fromEntries(
    datePartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
}

function zoneOffsetMs(date) {
  const parts = partsMap(date);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const wholeSecondUtc = Math.floor(date.getTime() / 1000) * 1000;
  return localAsUtc - wholeSecondUtc;
}

function localPartsToUtc(year, month, day, hour = 0, minute = 0, second = 0) {
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = targetLocalAsUtc;

  // Recalcula o offset no instante alvo para não depender do fuso do aparelho.
  for (let i = 0; i < 2; i += 1) {
    candidate = targetLocalAsUtc - zoneOffsetMs(new Date(candidate));
  }

  return new Date(candidate);
}

function clinicMidnightUtc(year, month, day) {
  return localPartsToUtc(year, month, day, 0, 0, 0);
}

export function formatClinicDateTime(iso) {
  return displayFormatter.format(asDate(iso));
}

export function clinicDayRange(date = new Date()) {
  const current = asDate(date);
  const parts = partsMap(current);
  const from = clinicMidnightUtc(parts.year, parts.month, parts.day);

  const nextCalendarDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const to = clinicMidnightUtc(
    nextCalendarDay.getUTCFullYear(),
    nextCalendarDay.getUTCMonth() + 1,
    nextCalendarDay.getUTCDate(),
  );

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

export function clinicLocalDateTimeToIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? '').trim());
  if (!match) throw new Error('Data ou horário local inválido.');

  const [, year, month, day, hour, minute, second = '0'] = match;
  const numbers = [year, month, day, hour, minute, second].map(Number);
  const [y, m, d, h, min, s] = numbers;

  if (m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) {
    throw new Error('Data ou horário local inválido.');
  }

  const utc = localPartsToUtc(y, m, d, h, min, s);
  const roundTrip = partsMap(utc);
  if (
    roundTrip.year !== y
    || roundTrip.month !== m
    || roundTrip.day !== d
    || roundTrip.hour !== h
    || roundTrip.minute !== min
    || roundTrip.second !== s
  ) {
    throw new Error('Data ou horário local inválido.');
  }

  return utc.toISOString();
}

export function statusLabel(status) {
  const labels = {
    agendado: 'Agendado',
    atendido: 'Atendido',
    cancelado: 'Cancelado',
    faltou: 'Faltou',
  };
  return labels[status] ?? String(status ?? '');
}
