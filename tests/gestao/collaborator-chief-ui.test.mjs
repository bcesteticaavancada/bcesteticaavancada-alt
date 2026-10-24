import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { isOwnClinicalAppointment } from '../../gestao/js/colaborador-agenda.js';

const agendaUrl = new URL('../../gestao/js/colaborador-agenda.js', import.meta.url);
const htmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

async function read(url) { return readFile(url, 'utf8'); }

test('colaboradora chefe alterna para visão da equipe sem trocar o papel de login', async () => {
  const source = await read(agendaUrl);
  assert.match(source, /pode_gerenciar_agendas/);
  assert.match(source, /listAdminAppointments/);
  assert.match(await read(new URL('../../gestao/js/dashboard-boot.js',import.meta.url)), /manager\?initAdminSchedule/);
  assert.match(source, /colaboradora_user_id/);
});

test('atendimento clínico e financeiro continuam restritos à profissional responsável', async () => {
  const source = await read(agendaUrl);
  assert.equal(isOwnClinicalAppointment({user_id:'chief'}, {colaboradora_user_id:'worker'}), false);
  assert.equal(isOwnClinicalAppointment({user_id:'chief'}, {colaboradora_user_id:'chief'}), true);
  assert.equal(isOwnClinicalAppointment(null, null), false);
  assert.match(source, /canOperateClinicalAppointment|isOwnClinicalAppointment/);
});

test('interface identifica a Colaboradora Chefe e oferece seletor de profissional somente quando aplicável', async () => {
  const html = await read(htmlUrl);
  assert.match(html, /id=["']profileRole["']/i);
  assert.match(html, /id=["']appointmentProfessionalField["']/i);
  assert.match(html, /id=["']appointmentProfessional["']/i);
});
