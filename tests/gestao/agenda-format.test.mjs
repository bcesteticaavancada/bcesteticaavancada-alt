import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClinicDateTime,
  clinicDayRange,
  statusLabel,
} from '../../gestao/js/agenda-format.js';

test('formatClinicDateTime usa America/Sao_Paulo quando UTC já virou o dia', () => {
  const value = formatClinicDateTime('2026-10-10T01:30:00Z');
  assert.match(value, /09\/10\/2026/);
  assert.match(value, /22:30/);
});

test('formatClinicDateTime apresenta horário comercial no fuso da clínica', () => {
  const value = formatClinicDateTime('2026-10-09T12:00:00Z');
  assert.match(value, /09\/10\/2026/);
  assert.match(value, /09:00/);
});

test('clinicDayRange delimita meia-noite a meia-noite da clínica sem depender do dispositivo', () => {
  const range = clinicDayRange(new Date('2026-10-09T12:00:00Z'));
  assert.deepEqual(range, {
    fromIso: '2026-10-09T03:00:00.000Z',
    toIso: '2026-10-10T03:00:00.000Z',
  });
});

test('statusLabel mantém os quatro estados operacionais aprovados', () => {
  assert.equal(statusLabel('agendado'), 'Agendado');
  assert.equal(statusLabel('atendido'), 'Atendido');
  assert.equal(statusLabel('cancelado'), 'Cancelado');
  assert.equal(statusLabel('faltou'), 'Faltou');
  assert.equal(statusLabel('desconhecido'), 'desconhecido');
});
