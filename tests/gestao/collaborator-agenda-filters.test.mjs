import test from 'node:test';
import assert from 'node:assert/strict';
import * as agenda from '../../gestao/js/colaborador-agenda.js';

test('colaboradora e chefe podem selecionar dia de meses futuros para gerir compromissos', () => {
  assert.equal(typeof agenda.collaboratorAgendaRanges, 'function');
  const { day, next } = agenda.collaboratorAgendaRanges('2027-03-10');
  assert.deepEqual(day, { fromIso: '2027-03-10T03:00:00.000Z', toIso: '2027-03-11T03:00:00.000Z' });
  assert.equal(next.fromIso, '2027-03-11T03:00:00.000Z');
  assert.throws(() => agenda.collaboratorAgendaRanges('2027-02-31'), /Data/);
});

test('filtro de profissional oferece todas para chefe e mantém comum na própria agenda', () => {
  assert.equal(typeof agenda.filterCollaboratorAppointments, 'function');
  const rows = [{ id: 'a', colaboradora_user_id: 'chief' }, { id: 'b', colaboradora_user_id: 'worker' }];
  const chief = { user_id: 'chief', role: 'colaborador', pode_gerenciar_agendas: true };
  assert.deepEqual(agenda.filterCollaboratorAppointments(rows, chief, ''), rows);
  assert.deepEqual(agenda.filterCollaboratorAppointments(rows, chief, 'worker'), [rows[1]]);
  assert.deepEqual(agenda.filterCollaboratorAppointments(rows, { user_id: 'worker', role: 'colaborador' }, 'chief'), [rows[1]]);
});
