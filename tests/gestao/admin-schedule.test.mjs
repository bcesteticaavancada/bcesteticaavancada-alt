import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initAdminSchedule,
  renderAdminSchedulePanel,
  monthDatesByWeekdays,
  copyAvailabilityToMonth,
} from '../../gestao/js/admin-schedule.js';

test('painel administrativo expõe calendário e controles mensais completos', () => {
  const html = renderAdminSchedulePanel();
  for (const id of [
    'adminScheduleRoot',
    'adminScheduleProfessional',
    'adminScheduleCalendar',
    'adminScheduleDayForm',
    'adminScheduleDayDate',
    'adminScheduleDayEnabled',
    'adminScheduleDayStart',
    'adminScheduleDayEnd',
    'adminScheduleBulkForm',
    'adminScheduleBulkDates',
    'adminScheduleBlockForm',
    'adminScheduleBlocks',
    'adminScheduleInactivationForm',
    'adminScheduleInactivations',
    'adminScheduleStatus',
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));

  assert.match(html, /data-admin-schedule-action=["']previous-month["']/);
  assert.match(html, /data-admin-schedule-action=["']next-month["']/);
  assert.match(html, /data-admin-schedule-action=["']apply-weekdays["']/);
  assert.match(html, /data-admin-schedule-action=["']copy-previous-month["']/);
  assert.match(html, /ferias/);
  assert.match(html, /motivos_pessoais/);
  assert.match(html, /motivo_medico/);
});

test('bulk por dias da semana gera somente datas do mês selecionado', () => {
  const dates = monthDatesByWeekdays('2026-10', [1, 3]);
  assert.ok(dates.length > 0);
  assert.ok(dates.every((date) => date.startsWith('2026-10-')));
  assert.ok(dates.includes('2026-10-05'));
  assert.ok(dates.includes('2026-10-07'));
  assert.equal(dates.includes('2026-10-06'), false);
});

test('cópia do mês anterior preserva configuração por dia civil e ignora dias inexistentes', () => {
  const copied = copyAvailabilityToMonth('2026-02', [
    { local_date: '2026-01-01', enabled: true, start_time: '09:00:00', end_time: '18:00:00' },
    { local_date: '2026-01-28', enabled: false, start_time: null, end_time: null },
    { local_date: '2026-01-31', enabled: true, start_time: '10:00:00', end_time: '16:00:00' },
  ]);
  assert.deepEqual(copied, [
    { localDate: '2026-02-01', enabled: true, startTime: '09:00:00', endTime: '18:00:00' },
    { localDate: '2026-02-28', enabled: false, startTime: null, endTime: null },
  ]);
});

test('initAdminSchedule é função', () => assert.equal(typeof initAdminSchedule, 'function'));
