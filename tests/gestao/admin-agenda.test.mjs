import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initAdminAgenda,
  renderAdminAppointments,
} from '../../gestao/js/admin-agenda.js';

const adminHtmlUrl = new URL('../../gestao/admin/index.html', import.meta.url);

async function loadAdminHtml() {
  return readFile(adminHtmlUrl, 'utf8');
}

test('painel admin expõe agenda, cadastros e novo agendamento sem credencial privilegiada', async () => {
  const html = await loadAdminHtml();
  for (const id of [
    'adminAgendaDate',
    'adminAgendaList',
    'clientForm',
    'clientNome',
    'clientTelefone',
    'clientEmail',
    'procedureForm',
    'procedureNome',
    'procedureDuration',
    'appointmentForm',
    'appointmentClient',
    'appointmentCollaborator',
    'appointmentProcedure',
    'appointmentStart',
    'appointmentEnd',
    'appointmentNote',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /admin-agenda\.js/);
  assert.doesNotMatch(html, /service_role|secret|sk_[a-z0-9]/i);
});

test('renderAdminAppointments mostra estado vazio útil', () => {
  const html = renderAdminAppointments([], new Map());
  assert.match(html, /nenhum atendimento/i);
});

test('renderAdminAppointments apresenta horário, cliente, procedimento, profissional e status', () => {
  const html = renderAdminAppointments([
    {
      id: 'a1',
      inicio: '2026-10-09T12:00:00Z',
      status: 'agendado',
      colaboradora_user_id: 'u1',
      clientes: { nome: 'Cliente Teste' },
      procedimentos: { nome: 'Limpeza de pele' },
    },
  ], new Map([['u1', 'Alice']]));
  assert.match(html, /09:00/);
  assert.match(html, /Cliente Teste/);
  assert.match(html, /Limpeza de pele/);
  assert.match(html, /Alice/);
  assert.match(html, /Agendado/);
});

test('renderAdminAppointments escapa conteúdo vindo do banco', () => {
  const html = renderAdminAppointments([
    {
      id: 'a1',
      inicio: '2026-10-09T12:00:00Z',
      status: 'agendado',
      colaboradora_user_id: 'u1',
      clientes: { nome: '<script>alert(1)</script>' },
      procedimentos: { nome: '<b>Procedimento</b>' },
    },
  ], new Map([['u1', '<img src=x>']]));
  assert.doesNotMatch(html, /<script>|<img|<b>/i);
  assert.match(html, /&lt;script&gt;/);
});

test('initAdminAgenda é uma função de inicialização explícita', () => {
  assert.equal(typeof initAdminAgenda, 'function');
});
