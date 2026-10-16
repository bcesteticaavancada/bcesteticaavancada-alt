const CLINIC_TIME_ZONE = 'America/Sao_Paulo';
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ACTIVE_APPOINTMENT_STATUSES = new Set(['agendado', 'confirmado', 'em_atendimento', 'concluido']);

function parseMonth(month) {
  const match = MONTH_RE.exec(String(month ?? '').trim());
  if (!match) throw new Error('Mês inválido. Use YYYY-MM.');
  return { year: Number(match[1]), month: Number(match[2]) };
}

function two(value) {
  return String(value).padStart(2, '0');
}

function isoDate(year, month, day) {
  return `${year}-${two(month)}-${two(day)}`;
}

function datePartsInClinicTimeZone(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function endDateExclusiveAware(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return datePartsInClinicTimeZone(value);
  return datePartsInClinicTimeZone(new Date(date.getTime() - 1));
}

function dateInRange(date, start, end) {
  return Boolean(start && date >= start && (!end || date <= end));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function shiftMonth(month, delta) {
  const { year, month: number } = parseMonth(month);
  const amount = Number(delta);
  if (!Number.isInteger(amount)) throw new Error('Deslocamento de mês inválido.');
  const date = new Date(Date.UTC(year, number - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${two(date.getUTCMonth() + 1)}`;
}

export function monthLabel(month) {
  const { year, month: number } = parseMonth(month);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

export function buildMonthGrid(month, state = {}) {
  const { year, month: number } = parseMonth(month);
  const availabilityByDate = new Map(
    (Array.isArray(state.days) ? state.days : [])
      .filter((item) => item?.local_date)
      .map((item) => [String(item.local_date).slice(0, 10), item]),
  );
  const blocks = Array.isArray(state.blocks) ? state.blocks : [];
  const inactivations = Array.isArray(state.inactivations) ? state.inactivations : [];
  const appointments = Array.isArray(state.appointments) ? state.appointments : [];
  const appointmentDates = new Set(
    appointments
      .filter((item) => {
        const status = String(item?.status ?? 'agendado').toLowerCase();
        return !['cancelado', 'faltou'].includes(status) && (ACTIVE_APPOINTMENT_STATUSES.has(status) || Boolean(item?.inicio || item?.date));
      })
      .map((item) => datePartsInClinicTimeZone(item.inicio ?? item.date))
      .filter(Boolean),
  );

  const firstWeekday = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday }, (_, index) => ({
    key: `before-${index}`,
    date: null,
    day: null,
    outside: true,
  }));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = isoDate(year, number, day);
    const availability = availabilityByDate.get(date) ?? null;
    const blocked = blocks.some((block) => {
      const start = datePartsInClinicTimeZone(block?.starts_at);
      const end = endDateExclusiveAware(block?.ends_at);
      return dateInRange(date, start, end);
    });
    const inactive = inactivations.some((item) => {
      if (item?.reactivated_at) return false;
      const start = String(item?.starts_on ?? '').slice(0, 10);
      const end = item?.planned_ends_on ? String(item.planned_ends_on).slice(0, 10) : null;
      return dateInRange(date, start, end);
    });

    cells.push({
      key: date,
      date,
      day,
      outside: false,
      enabled: availability?.enabled === true,
      startTime: availability?.start_time ?? null,
      endTime: availability?.end_time ?? null,
      blocked,
      inactive,
      hasAppointments: appointmentDates.has(date),
      availability,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `after-${cells.length}`, date: null, day: null, outside: true });
  }
  return cells;
}

function cellClasses(cell, selectedDate) {
  const classes = ['schedule-calendar__day'];
  if (cell.enabled) classes.push('schedule-calendar__day--enabled');
  if (cell.blocked) classes.push('schedule-calendar__day--blocked');
  if (cell.inactive) classes.push('schedule-calendar__day--inactive');
  if (cell.hasAppointments) classes.push('schedule-calendar__day--has-appointments');
  if (cell.date === selectedDate) classes.push('schedule-calendar__day--selected');
  return classes.join(' ');
}

function cellLabel(cell) {
  const states = [];
  if (cell.enabled) states.push('disponível ao público');
  else states.push('sem disponibilidade pública');
  if (cell.blocked) states.push('com bloqueio');
  if (cell.inactive) states.push('agenda inativa');
  if (cell.hasAppointments) states.push('com compromissos');
  return `${cell.date}: ${states.join(', ')}`;
}

export function renderScheduleCalendar(model = {}) {
  const month = String(model.month ?? '').trim();
  const selectedDate = model.selectedDate ? String(model.selectedDate) : null;
  const grid = buildMonthGrid(month, model.state ?? {});
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const daysHtml = grid.map((cell) => {
    if (!cell.date) return '<div class="schedule-calendar__empty" aria-hidden="true"></div>';
    const flags = [
      cell.enabled ? '<span class="schedule-calendar__dot" data-state="enabled" title="Disponível"></span>' : '',
      cell.blocked ? '<span class="schedule-calendar__dot" data-state="blocked" title="Bloqueio"></span>' : '',
      cell.inactive ? '<span class="schedule-calendar__dot" data-state="inactive" title="Inativa"></span>' : '',
      cell.hasAppointments ? '<span class="schedule-calendar__dot" data-state="appointments" title="Compromissos"></span>' : '',
    ].join('');
    return `<button type="button" class="${cellClasses(cell, selectedDate)}" data-date="${escapeHtml(cell.date)}" aria-label="${escapeHtml(cellLabel(cell))}" aria-pressed="${cell.date === selectedDate ? 'true' : 'false'}"><span class="schedule-calendar__number">${cell.day}</span><span class="schedule-calendar__flags">${flags}</span></button>`;
  }).join('');

  return `<section class="schedule-calendar" data-month="${escapeHtml(month)}"><header class="schedule-calendar__header"><button type="button" class="schedule-calendar__nav" data-action="previous-month" aria-label="Mês anterior">‹</button><h3>${escapeHtml(monthLabel(month))}</h3><button type="button" class="schedule-calendar__nav" data-action="next-month" aria-label="Próximo mês">›</button></header><div class="schedule-calendar__weekdays">${weekdays.map((day) => `<span>${day}</span>`).join('')}</div><div class="schedule-calendar__grid">${daysHtml}</div></section>`;
}
