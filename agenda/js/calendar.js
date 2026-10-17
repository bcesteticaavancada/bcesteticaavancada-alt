const CLINIC_TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function clinicToday(instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function currentClinicMonth() {
  return clinicToday().slice(0, 7);
}

export function shiftMonth(month, offset) {
  const { year, monthNumber } = parseMonth(month);
  if (!Number.isInteger(offset)) throw new Error('Deslocamento de mês inválido.');
  const index = year * 12 + monthNumber - 1 + offset;
  return `${Math.floor(index / 12)}-${String(((index % 12) + 12) % 12 + 1).padStart(2, '0')}`;
}

export function publicMonthBounds(today = clinicToday()) {
  const min = today.slice(0, 7);
  return { min, max: shiftMonth(min, 12) };
}

function parseMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Mês inválido.');
  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error('Mês inválido.');
  return { year, monthNumber };
}

export function monthLabel(month) {
  const { year, monthNumber } = parseMonth(month);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function buildMonthCells(month, days = [], today = clinicToday()) {
  const { year, monthNumber } = parseMonth(month);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const availability = new Map(days.map((item) => [item.date, item.available === true]));
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const isPast = date < today;
    const available = availability.get(date) === true && !isPast;
    cells.push({ date, day, available, disabled: !available, isPast, isToday: date === today });
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function renderPublicCalendar({ root, month, days = [], selectedDate = null, today = clinicToday(), busy = false, onSelect = () => {} }) {
  if (!root) return;
  const cells = buildMonthCells(month, busy ? [] : days, today);
  root.innerHTML = `
    <div class="agenda-calendar__weekdays" aria-hidden="true">
      ${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}
    </div>
    <div class="agenda-calendar__grid" role="group" aria-label="Calendário de ${monthLabel(month)}">
      ${cells.map((cell) => {
        if (!cell) return '<span class="agenda-calendar__blank" aria-hidden="true"></span>';
        const state = cell.available ? 'available' : 'disabled';
        const selected = cell.date === selectedDate;
        const label = `${cell.day} de ${monthLabel(month)}, ${cell.available ? 'horários livres' : cell.isPast ? 'data passada' : 'sem horários'}`;
        return `<button type="button" class="agenda-calendar__day is-${state}${selected ? ' is-selected' : ''}${cell.isToday ? ' is-today' : ''}" data-date="${cell.date}" ${cell.disabled ? 'disabled' : ''} ${cell.isToday ? 'aria-current="date"' : ''} aria-label="${label}" aria-pressed="${selected ? 'true' : 'false'}"><span>${cell.day}</span><i aria-hidden="true"></i></button>`;
      }).join('')}
    </div>`;

  root.querySelectorAll('[data-date]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => onSelect(button.dataset.date));
  });
}
