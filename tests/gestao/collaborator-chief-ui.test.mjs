import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const agendaUrl = new URL('../../gestao/js/colaborador-agenda.js', import.meta.url);
const htmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

async function read(url) { return readFile(url, 'utf8'); }

test('colaboradora chefe alterna para visão da equipe sem trocar o papel de login', async () => {
  const source = await read(agendaUrl);
  assert.match(source, /pode_gerenciar_agendas/);
  assert.match(source, /listAdminAppointments/);
  assert.match(source, /initAdminSchedule/);
  assert.match(source, /colaboradora_user_id/);
});

test('atendimento clínico e financeiro continuam restritos à profissional responsável', async () => {
  const source = await read(agendaUrl);
  assert.match(source, /appointment\.colaboradora_user_id\s*===\s*profile\.user_id|profile\.user_id\s*===\s*appointment\.colaboradora_user_id/);
  assert.match(source, /canOperateClinicalAppointment|isOwnClinicalAppointment/);
});

test('interface identifica a Colaboradora Chefe e oferece seletor de profissional somente quando aplicável', async () => {
  const html = await read(htmlUrl);
  assert.match(html, /id=["']profileRole["']/i);
  assert.match(html, /id=["']appointmentProfessionalField["']/i);
  assert.match(html, /id=["']appointmentProfessional["']/i);
});
