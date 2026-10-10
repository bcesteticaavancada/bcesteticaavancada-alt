import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initAdminAgenda,
  renderAdminAppointments,
  renderProfessionalOptions,
  filterAdminAppointments,
} from '../../gestao/js/admin-agenda.js';
const adminHtmlUrl = new URL('../../gestao/admin/index.html', import.meta.url);
async function loadAdminHtml(){ return readFile(adminHtmlUrl,'utf8'); }

test('painel admin expõe agenda geral com filtro, edição e clientes compartilhados', async () => {
  const html = await loadAdminHtml();
  for (const id of ['adminAgendaDate','adminAgendaProfessionalFilter','adminAgendaList','adminAppointmentEditForm','appointmentForm','appointmentClient','appointmentCollaborator','appointmentProcedure','clientsSearch','clientCreateForm','clientEditor','clientHistoryTimeline','auditoria','auditList']) {
    assert.match(html,new RegExp(`id=["']${id}["']`));
  }
  assert.match(html,/clientes-panel\.js/);
  assert.match(html,/admin-audit\.js/);
  assert.doesNotMatch(html,/service_role|secret|sk_[a-z0-9]/i);
});

test('opções de profissionais incluem Todas, Mel admin e colaboradoras', () => {
  const html = renderProfessionalOptions([
    { user_id:'mel-id', display_name:'Mel' },
    { user_id:'alice-id', display_name:'Alice' },
  ], { includeAll:true });
  assert.match(html,/>Todas</);
  assert.match(html,/value="mel-id"[^>]*>Mel</);
  assert.match(html,/value="alice-id"[^>]*>Alice</);
});

test('filtro da agenda pode mostrar todas ou apenas Mel', () => {
  const rows=[{id:'1',colaboradora_user_id:'mel-id'},{id:'2',colaboradora_user_id:'alice-id'}];
  assert.equal(filterAdminAppointments(rows,'').length,2);
  assert.deepEqual(filterAdminAppointments(rows,'mel-id').map(x=>x.id),['1']);
});

test('renderAdminAppointments expõe edição e dados operacionais', () => {
  const html=renderAdminAppointments([{id:'a1',inicio:'2026-10-09T12:00:00Z',status:'agendado',colaboradora_user_id:'mel-id',clientes:{nome:'Cliente'},procedimentos:{nome:'Botox'}}],new Map([['mel-id','Mel']]));
  assert.match(html,/09:00/); assert.match(html,/Mel/); assert.match(html,/Botox/); assert.match(html,/data-admin-edit=["']a1["']/);
});

test('initAdminAgenda é função',()=>assert.equal(typeof initAdminAgenda,'function'));
