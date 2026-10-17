const CLINIC_TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function clinicToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function currentClinicMonth() {
  return clinicToday().slice(0, 7);
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
    cells.push({ date, day, available, disabled: !available, isPast });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function renderPublicCalendar({ root, month, days = [], selectedDate = null, onSelect = () => {} }) {
  if (!root) return;
  const cells = buildMonthCells(month, days);
  root.innerHTML = `
    <div class="agenda-calendar__heading">
      <strong>${monthLabel(month)}</strong>
      <span>Somente horários disponíveis neste mês</span>
    </div>
    <div class="agenda-calendar__weekdays" aria-hidden="true">
      ${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}
    </div>
    <div class="agenda-calendar__grid" role="grid" aria-label="Calendário de ${monthLabel(month)}">
      ${cells.map((cell) => {
        if (!cell) return '<span class="agenda-calendar__blank" aria-hidden="true"></span>';
        const state = cell.available ? 'available' : 'disabled';
        const selected = cell.date === selectedDate;
        return `<button type="button" class="agenda-calendar__day is-${state}${selected ? ' is-selected' : ''}" data-date="${cell.date}" ${cell.disabled ? 'disabled' : ''} aria-pressed="${selected ? 'true' : 'false'}"><span>${cell.day}</span><small>${cell.available ? 'Livre' : cell.isPast ? 'Passou' : 'Indisponível'}</small></button>`;
      }).join('')}
    </div>`;

  root.querySelectorAll('[data-date]:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => onSelect(button.dataset.date));
  });
}
