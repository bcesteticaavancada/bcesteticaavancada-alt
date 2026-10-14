import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getScheduleMonth,
  upsertAvailabilityDay,
  applyAvailabilityDays,
  createScheduleBlock,
  deleteScheduleBlock,
  createAgendaInactivation,
  reactivateAgenda,
  linkPublicAppointment,
} from '../../gestao/js/schedule-api.js';

function makeClient(result = { data: null, error: null }) {
  const calls = [];
  return {
    calls,
    client: {
      from() { return {}; },
      async rpc(name, payload = {}) {
        calls.push([name, payload]);
        return result;
      },
    },
  };
}

test('wrappers de disponibilidade chamam RPCs canônicos com payload mínimo', async () => {
  const mock = makeClient({ data: 'ok', error: null });

  await getScheduleMonth({ client: mock.client, professionalUserId: 'u1', month: '2026-11-01' });
  await upsertAvailabilityDay({ client: mock.client, professionalUserId: 'u1', localDate: '2026-11-03', enabled: true, startTime: '09:00', endTime: '18:00' });
  await applyAvailabilityDays({ client: mock.client, professionalUserId: 'u1', dates: ['2026-11-03', '2026-11-04'], enabled: false, startTime: null, endTime: null });

  assert.deepEqual(mock.calls.slice(0, 3), [
    ['bc_schedule_month_get', { p_professional_user_id: 'u1', p_month: '2026-11-01' }],
    ['bc_schedule_day_upsert', { p_professional_user_id: 'u1', p_local_date: '2026-11-03', p_enabled: true, p_start_time: '09:00', p_end_time: '18:00' }],
    ['bc_schedule_days_apply', { p_professional_user_id: 'u1', p_local_dates: ['2026-11-03', '2026-11-04'], p_enabled: false, p_start_time: null, p_end_time: null }],
  ]);
});

test('wrappers de bloqueio e inativação não enviam autoria pelo navegador', async () => {
  const mock = makeClient({ data: 'id-1', error: null });

  await createScheduleBlock({ client: mock.client, professionalUserId: 'u1', startsAt: '2026-11-03T12:00:00Z', endsAt: '2026-11-03T13:00:00Z', blockType: 'pessoal', internalNote: ' compromisso ' });
  await deleteScheduleBlock({ client: mock.client, blockId: 'b1' });
  await createAgendaInactivation({ client: mock.client, professionalUserId: 'u1', startsOn: '2026-11-10', plannedEndsOn: '2026-11-15', reason: 'ferias', internalNote: ' descanso ' });
  await reactivateAgenda({ client: mock.client, inactivationId: 'i1' });

  assert.deepEqual(mock.calls, [
    ['bc_schedule_block_create', { p_professional_user_id: 'u1', p_starts_at: '2026-11-03T12:00:00Z', p_ends_at: '2026-11-03T13:00:00Z', p_block_type: 'pessoal', p_internal_note: 'compromisso' }],
    ['bc_schedule_block_delete', { p_block_id: 'b1' }],
    ['bc_agenda_inactivation_create', { p_professional_user_id: 'u1', p_starts_on: '2026-11-10', p_planned_ends_on: '2026-11-15', p_reason: 'ferias', p_internal_note: 'descanso' }],
    ['bc_agenda_reactivate', { p_inactivation_id: 'i1' }],
  ]);
  assert.equal(/created_by|actor_user_id/i.test(JSON.stringify(mock.calls)), false);
});

test('vínculo de reserva pública é decidido somente pela RPC', async () => {
  const mock = makeClient({ data: 'a1', error: null });
  const result = await linkPublicAppointment({ client: mock.client, appointmentId: 'a1', clienteId: 'c1' });
  assert.equal(result, 'a1');
  assert.deepEqual(mock.calls, [['bc_agendamento_link_cliente', { p_agendamento_id: 'a1', p_cliente_id: 'c1' }]]);
});

test('erros das RPCs de agenda são propagados como falha', async () => {
  const mock = makeClient({ data: null, error: { message: 'denied' } });
  await assert.rejects(
    () => deleteScheduleBlock({ client: mock.client, blockId: 'b1' }),
    /denied/i,
  );
});
