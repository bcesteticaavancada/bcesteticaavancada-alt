import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthGrid,
  monthLabel,
  shiftMonth,
  renderScheduleCalendar,
} from '../../gestao/js/schedule-calendar.js';

function realDays(grid) {
  return grid.filter((cell) => cell.date);
}

test('grade mensal respeita fevereiro, meses de 30/31 dias e fecha semanas completas', () => {
  assert.equal(realDays(buildMonthGrid('2027-02', {})).length, 28);
  assert.equal(realDays(buildMonthGrid('2028-02', {})).length, 29);
  assert.equal(realDays(buildMonthGrid('2026-04', {})).length, 30);
  assert.equal(realDays(buildMonthGrid('2026-10', {})).length, 31);
  assert.equal(buildMonthGrid('2026-10', {}).length % 7, 0);
});

test('navegação de mês atravessa virada de ano sem depender do fuso do aparelho', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
  assert.match(monthLabel('2028-02'), /fevereiro.*2028/i);
});

test('células agregam disponibilidade, bloqueio, inativação e compromissos', () => {
  const grid = buildMonthGrid('2026-10', {
    days: [
      { local_date: '2026-10-05', enabled: true, start_time: '09:00:00', end_time: '18:00:00' },
      { local_date: '2026-10-06', enabled: false, start_time: null, end_time: null },
    ],
    blocks: [
      { id: 'b1', starts_at: '2026-10-05T15:00:00Z', ends_at: '2026-10-05T16:00:00Z' },
    ],
    inactivations: [
      { id: 'i1', starts_on: '2026-10-07', planned_ends_on: '2026-10-08', reactivated_at: null },
    ],
    appointments: [
      { id: 'a1', inicio: '2026-10-05T14:00:00Z', status: 'agendado' },
      { id: 'a2', inicio: '2026-10-06T14:00:00Z', status: 'cancelado' },
    ],
  });

  const byDate = new Map(realDays(grid).map((cell) => [cell.date, cell]));
  assert.equal(byDate.get('2026-10-05').enabled, true);
  assert.equal(byDate.get('2026-10-05').blocked, true);
  assert.equal(byDate.get('2026-10-05').hasAppointments, true);
  assert.equal(byDate.get('2026-10-06').enabled, false);
  assert.equal(byDate.get('2026-10-06').hasAppointments, false);
  assert.equal(byDate.get('2026-10-07').inactive, true);
  assert.equal(byDate.get('2026-10-08').inactive, true);
  assert.equal(byDate.get('2026-10-09').inactive, false);
});

test('renderização traz cabeçalho, navegação e estados acessíveis por data', () => {
  const html = renderScheduleCalendar({
    month: '2026-10',
    state: { days: [{ local_date: '2026-10-05', enabled: true }] },
  });
  assert.match(html, /outubro.*2026/i);
  assert.match(html, /data-action="previous-month"/i);
  assert.match(html, /data-action="next-month"/i);
  assert.match(html, /data-date="2026-10-05"/i);
  assert.match(html, /schedule-calendar__day--enabled/i);
  assert.match(html, /aria-label=/i);
});
