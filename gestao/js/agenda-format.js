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

function clinicMidnightUtc(year, month, day) {
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = targetLocalAsUtc;

  // Two passes are enough to settle timezone/DST offset around midnight.
  for (let i = 0; i < 2; i += 1) {
    candidate = targetLocalAsUtc - zoneOffsetMs(new Date(candidate));
  }

  return new Date(candidate);
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

export function statusLabel(status) {
  const labels = {
    agendado: 'Agendado',
    atendido: 'Atendido',
    cancelado: 'Cancelado',
    faltou: 'Faltou',
  };
  return labels[status] ?? String(status ?? '');
}
