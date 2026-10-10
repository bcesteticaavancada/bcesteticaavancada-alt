import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initCollaboratorAgenda, renderCollaboratorAppointments, renderAuthorizedHistory } from '../../gestao/js/colaborador-agenda.js';

const htmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);
async function loadHtml() { return readFile(htmlUrl, 'utf8'); }

test('painel da colaboradora expõe agenda, clientes, detalhe e somente o próprio financeiro', async () => {
  const html = await loadHtml();
  for (const id of ['todayAgendaList','nextAgendaList','appointmentDetail','appointmentDetailContent','historyTimeline','clientsList','financeiro','currentAppointmentReceiptForm','collaboratorFinanceReceipts','collaboratorFinanceBooks','collaboratorFinancePayouts']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /colaborador-agenda\.js/);
  assert.match(html, /colaborador-finance\.js/);
  assert.doesNotMatch(html, /adminCommissionForm|adminPayoutCreateForm|adminFinanceReceipts|percentual|comiss[aã]o/i);
});

test('renderCollaboratorAppointments mostra estado vazio útil', () => assert.match(renderCollaboratorAppointments([]), /nenhum atendimento/i));

test('renderCollaboratorAppointments mostra dados operacionais e abre por data attribute', () => {
  const html = renderCollaboratorAppointments([{ id:'a1', inicio:'2026-10-09T12:00:00Z', status:'agendado', clientes:{ nome:'Cliente Teste' }, procedimentos:{ nome:'Limpeza de pele' } }]);
  assert.match(html, /09:00/);
  assert.match(html, /Cliente Teste/);
  assert.match(html, /Limpeza de pele/);
  assert.match(html, /data-open-appointment=["']a1["']/);
});

test('renderCollaboratorAppointments escapa conteúdo', () => {
  const html = renderCollaboratorAppointments([{ id:'a1', inicio:'2026-10-09T12:00:00Z', status:'agendado', clientes:{ nome:'<script>x<\/script>' }, procedimentos:{ nome:'<b>Laser<\/b>' } }]);
  assert.doesNotMatch(html, /<script>|<b>/i);
  assert.match(html, /&lt;script&gt;/);
});

test('renderAuthorizedHistory monta timeline clínica compartilhada', () => {
  const history = [{ id:'h1', data_atendimento:'2026-10-08T15:00:00Z', colaboradora_user_id:'u2', queixa_objetivo:'Sensibilidade', observacoes:'Pele íntegra', reacoes:'Leve eritema', intercorrencias:'Nenhuma', feedback_cliente:'Gostou', orientacoes:'FPS', recomendacao_proxima_sessao:'30 dias', procedimentos:{ nome:'Limpeza de pele' } }];
  const html = renderAuthorizedHistory(history, new Map([['u2','Alice']]));
  for (const text of ['Limpeza de pele','Alice','Sensibilidade','Leve eritema','Nenhuma','Gostou','FPS','30 dias']) assert.match(html, new RegExp(text));
});

test('initCollaboratorAgenda é função', () => assert.equal(typeof initCollaboratorAgenda, 'function'));
