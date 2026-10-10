import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initCollaboratorAgenda,
  renderCollaboratorAppointments,
  renderAuthorizedHistory,
} from '../../gestao/js/colaborador-agenda.js';

const htmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

async function loadHtml() {
  return readFile(htmlUrl, 'utf8');
}

test('painel da colaboradora expõe hoje, próximos e detalhe sem financeiro', async () => {
  const html = await loadHtml();
  for (const id of ['todayAgendaList', 'nextAgendaList', 'appointmentDetail', 'appointmentDetailContent', 'historyTimeline']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /colaborador-agenda\.js/);
  assert.doesNotMatch(html, /financeiro|faturamento|pagamentos?|valor recebido/i);
  assert.doesNotMatch(html, /[?&](?:cliente|telefone|nome)=/i);
});

test('renderCollaboratorAppointments mostra estado vazio útil', () => {
  const html = renderCollaboratorAppointments([]);
  assert.match(html, /nenhum atendimento/i);
});

test('renderCollaboratorAppointments mostra só dados operacionais e abre por data attribute', () => {
  const html = renderCollaboratorAppointments([{
    id: 'a1',
    inicio: '2026-10-09T12:00:00Z',
    status: 'agendado',
    clientes: { nome: 'Cliente Teste', telefone: '31999999999' },
    procedimentos: { nome: 'Limpeza de pele' },
  }]);
  assert.match(html, /09:00/);
  assert.match(html, /Cliente Teste/);
  assert.match(html, /Limpeza de pele/);
  assert.match(html, /data-open-appointment=["']a1["']/);
  assert.doesNotMatch(html, /href=["'][^"']*(?:Cliente Teste|31999999999)/i);
});

test('renderCollaboratorAppointments escapa conteúdo vindo do banco', () => {
  const html = renderCollaboratorAppointments([{
    id: 'a1',
    inicio: '2026-10-09T12:00:00Z',
    status: 'agendado',
    clientes: { nome: '<script>x</script>' },
    procedimentos: { nome: '<b>Laser</b>' },
  }]);
  assert.doesNotMatch(html, /<script>|<b>/i);
  assert.match(html, /&lt;script&gt;/);
});

test('renderAuthorizedHistory monta timeline clínica autorizada com autoria nominal quando disponível', () => {
  const history = [{
    id: 'h1',
    data_atendimento: '2026-10-08T15:00:00Z',
    colaboradora_user_id: 'u2',
    queixa_objetivo: 'Sensibilidade',
    observacoes: 'Pele íntegra',
    reacoes: 'Leve eritema',
    intercorrencias: 'Nenhuma',
    feedback_cliente: 'Gostou do resultado',
    orientacoes: 'Usar FPS',
    recomendacao_proxima_sessao: '30 dias',
    procedimentos: { nome: 'Limpeza de pele' },
  }];
  const html = renderAuthorizedHistory(history, new Map([['u2', 'Alice']]));
  for (const text of ['Limpeza de pele', 'Alice', 'Sensibilidade', 'Leve eritema', 'Nenhuma', 'Gostou do resultado', 'Usar FPS', '30 dias']) {
    assert.match(html, new RegExp(text));
  }
});

test('renderAuthorizedHistory não quebra com histórico vazio', () => {
  const html = renderAuthorizedHistory([], new Map());
  assert.match(html, /nenhum histórico/i);
});

test('initCollaboratorAgenda é uma função explícita', () => {
  assert.equal(typeof initCollaboratorAgenda, 'function');
});
