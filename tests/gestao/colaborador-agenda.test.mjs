import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initCollaboratorAgenda,
  renderCollaboratorAppointments,
  renderAuthorizedHistory,
  renderAppointmentDetail,
  canOpenClinicalAppointment,
  linkPendingPublicBooking,
} from '../../gestao/js/colaborador-agenda.js';

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
  const html = renderCollaboratorAppointments([{ id:'a1', inicio:'2026-10-09T12:00:00Z', status:'agendado', cliente_id:'c1', clientes:{ nome:'Cliente Teste' }, procedimentos:{ nome:'Limpeza de pele' } }]);
  assert.match(html, /09:00/);
  assert.match(html, /Cliente Teste/);
  assert.match(html, /Limpeza de pele/);
  assert.match(html, /data-open-appointment=["']a1["']/);
  assert.match(html, /Abrir atendimento/i);
});

test('reserva pública pendente usa snapshot, sinaliza origem e não oferece abrir atendimento clínico', () => {
  const appointment = {
    id:'site-1', inicio:'2026-10-09T12:00:00Z', status:'agendado', origem:'site', cliente_id:null,
    clientes:null, public_booking_name:'Cliente Site', public_booking_phone:'(31) 99999-0000', procedimentos:{ nome:'Bioestimulador' },
  };
  const html = renderCollaboratorAppointments([appointment]);
  assert.match(html, /Cliente Site/);
  assert.match(html, /\(31\) 99999-0000/);
  assert.match(html, />Site</i);
  assert.match(html, /Cadastro pendente/i);
  assert.match(html, /Vincular cliente/i);
  assert.doesNotMatch(html, />Abrir atendimento</i);
  assert.equal(canOpenClinicalAppointment(appointment), false);
  assert.equal(canOpenClinicalAppointment({ ...appointment, cliente_id:'c1', clientes:{ id:'c1', nome:'Cliente Oficial' } }), true);
});

test('detalhe pendente exige escolha explícita de cadastro e mantém ficha clínica bloqueada', () => {
  const html = renderAppointmentDetail({
    id:'site-1', inicio:'2026-10-09T12:00:00Z', status:'agendado', origem:'site', cliente_id:null,
    public_booking_name:'Cliente Site', public_booking_phone:'(31) 99999-0000', procedimentos:{ nome:'Bioestimulador' },
  }, [], [{ id:'c1', nome:'Ana Oficial' }, { id:'c2', nome:'Bia Oficial' }]);
  assert.match(html, /Cliente Site/);
  assert.match(html, /Cadastro pendente/i);
  assert.match(html, /data-public-booking-link/i);
  assert.match(html, /name=["']cliente_id["']/);
  assert.match(html, /Ana Oficial/);
  assert.match(html, /Bia Oficial/);
  assert.match(html, /Vincular cliente/i);
  assert.match(html, /ficha clínica.*bloquead/i);
});

test('vínculo de reserva pública chama somente a RPC canônica', async () => {
  const calls = [];
  const client = {
    from(){ return {}; },
    async rpc(name, payload){ calls.push([name,payload]); return { data:'site-1', error:null }; },
  };
  const result = await linkPendingPublicBooking({ client, appointmentId:'site-1', clienteId:'c1' });
  assert.equal(result, 'site-1');
  assert.deepEqual(calls, [['bc_agendamento_link_cliente', { p_agendamento_id:'site-1', p_cliente_id:'c1' }]]);
});

test('renderCollaboratorAppointments escapa conteúdo', () => {
  const html = renderCollaboratorAppointments([{ id:'a1', inicio:'2026-10-09T12:00:00Z', status:'agendado', cliente_id:'c1', clientes:{ nome:'<script>x<\/script>' }, procedimentos:{ nome:'<b>Laser<\/b>' } }]);
  assert.doesNotMatch(html, /<script>|<b>/i);
  assert.match(html, /&lt;script&gt;/);
});

test('renderAuthorizedHistory monta timeline clínica compartilhada', () => {
  const history = [{ id:'h1', data_atendimento:'2026-10-08T15:00:00Z', colaboradora_user_id:'u2', queixa_objetivo:'Sensibilidade', observacoes:'Pele íntegra', reacoes:'Leve eritema', intercorrencias:'Nenhuma', feedback_cliente:'Gostou', orientacoes:'FPS', recomendacao_proxima_sessao:'30 dias', procedimentos:{ nome:'Limpeza de pele' } }];
  const html = renderAuthorizedHistory(history, new Map([['u2','Alice']]));
  for (const text of ['Limpeza de pele','Alice','Sensibilidade','Leve eritema','Nenhuma','Gostou','FPS','30 dias']) assert.match(html, new RegExp(text));
});

test('initCollaboratorAgenda é função', () => assert.equal(typeof initCollaboratorAgenda, 'function'));

test('reserva Site pendente permite remarcar e cancelar antes de vincular prontuário', () => {
  const html=renderAppointmentDetail({id:'a1',origem:'agenda',booking_channel:'site',cliente_id:null,status:'agendado',inicio:'2026-10-16T15:00:00Z',public_booking_name:'Pessoa CI'},[{id:'p1',nome:'Teste'}]);
  assert.match(html,/data-public-booking-link/);
  assert.match(html,/data-own-appointment-edit/);
  assert.match(html,/data-collab-status="cancelado"/);
});
