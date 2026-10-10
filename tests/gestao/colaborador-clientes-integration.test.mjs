import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ownAppointmentPayload } from '../../gestao/js/colaborador-agenda.js';
const htmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);
const agendaSourceUrl = new URL('../../gestao/js/colaborador-agenda.js', import.meta.url);

test('colaboradora recebe Minha agenda e Clientes globais sem financeiro nem arquivamento', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const id of ['collaboratorAppointmentForm','collaboratorAppointmentClient','collaboratorAppointmentProcedure','clientsSearch','clientCreateForm','clientsList','clientEditor','clientHistoryTimeline']) assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/clientes-panel\.js/);
  assert.doesNotMatch(html,/appointmentCollaborator|data-toggle-client|Arquivar cliente|Financeiro|pagamentos?/i);
});

test('payload de novo agendamento usa sempre o user_id da colaboradora', () => {
  const payload = ownAppointmentPayload({ user_id:'alice-id' }, { clienteId:'c1', procedimentoId:'p1', inicioIso:'I', fimIso:null, observacao:'x' });
  assert.deepEqual(payload,{clienteId:'c1',colaboradoraUserId:'alice-id',procedimentoId:'p1',inicioIso:'I',fimIso:null,observacao:'x'});
});

test('novo cliente compartilhado atualiza imediatamente o seletor da agenda da colaboradora', async () => {
  const [html, agendaSource] = await Promise.all([
    readFile(htmlUrl, 'utf8'),
    readFile(agendaSourceUrl, 'utf8'),
  ]);
  assert.match(html, /onClientsChanged\s*:\s*agenda\.refreshClients/);
  assert.match(agendaSource, /return\s*\{[\s\S]*refreshClients[\s\S]*\}/);
});
