import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initCollaboratorSchedule,
  renderCollaboratorSchedulePanel,
  ownScheduleProfessionalId,
} from '../../gestao/js/colaborador-schedule.js';

test('alvo da disponibilidade é sempre o user_id do perfil autenticado', () => {
  assert.equal(ownScheduleProfessionalId({ user_id: 'alice-id' }), 'alice-id');
  assert.throws(() => ownScheduleProfessionalId({}), /profissional/i);
});

test('painel da colaboradora não oferece seletor de outra profissional', () => {
  const html = renderCollaboratorSchedulePanel();
  assert.match(html, /id=["']collaboratorScheduleRoot["']/);
  assert.match(html, /id=["']collaboratorScheduleCalendar["']/);
  assert.match(html, /id=["']collaboratorScheduleDayForm["']/);
  assert.match(html, /id=["']collaboratorScheduleBlockForm["']/);
  assert.match(html, /id=["']collaboratorScheduleInactivationForm["']/);
  assert.match(html, /data-collaborator-schedule-action=["']previous-month["']/);
  assert.match(html, /data-collaborator-schedule-action=["']next-month["']/);
  assert.doesNotMatch(html, /<select[^>]+professional/i);
});

test('painel permite bloqueio, inativação e reativação da própria agenda', () => {
  const html = renderCollaboratorSchedulePanel();
  assert.match(html, /Criar bloqueio/i);
  assert.match(html, /Inativar agenda/i);
  assert.match(html, /Reativar agenda agora/i);
  assert.match(html, /ferias/);
  assert.match(html, /motivo_medico/);
});

test('initCollaboratorSchedule é função', () => {
  assert.equal(typeof initCollaboratorSchedule, 'function');
});
