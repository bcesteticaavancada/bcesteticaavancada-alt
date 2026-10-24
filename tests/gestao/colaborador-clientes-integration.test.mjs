import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ownAppointmentPayload } from '../../gestao/js/colaborador-agenda.js';
const htmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);
const agendaSourceUrl = new URL('../../gestao/js/colaborador-agenda.js', import.meta.url);

test('colaboradora recebe Minha agenda, Clientes globais e somente o próprio financeiro', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const id of ['collaboratorAppointmentForm','collaboratorAppointmentClient','collaboratorAppointmentProcedure','clientsSearch','clientCreateForm','clientsList','clientEditor','clientHistoryTimeline','financeiro','currentAppointmentReceiptHost','collaboratorFinanceItems','collaboratorFinancePayments']) {
    assert.match(html,new RegExp(`id=["']${id}["']`));
  }
  assert.match(html,/dashboard-boot\.js/);
  assert.match(html,/dashboard-boot\.js/);
  assert.doesNotMatch(html,/appointmentCollaborator|data-toggle-client|Arquivar cliente/i);
  assert.doesNotMatch(html,/adminCommissionForm|adminPayoutCreateForm|adminFinanceReceipts/i);
});

test('cadastro rápido da colaboradora inclui os campos clínicos da fase 6A', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const name of ['nome','cpf','data_nascimento','telefone','email','responsavel_nome','responsavel_cpf','responsavel_parentesco','responsavel_telefone']) {
    assert.match(html,new RegExp(`name=["']${name}["']`));
  }
  assert.match(html,/id=["']clientAgePreview["']/);
  assert.match(html,/id=["']clientGuardianFields["']/);
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
  assert.match(await readFile(new URL('../../gestao/js/dashboard-boot.js',import.meta.url),'utf8'), /onClientsChanged:[\s\S]*get\('agenda'\)\?\.refreshClients/);
  assert.match(agendaSource, /return\s*\{[\s\S]*refreshClients[\s\S]*\}/);
});
