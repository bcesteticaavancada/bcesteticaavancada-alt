import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../../gestao/colaborador/index.html', import.meta.url);
const jsPath = new URL('../../gestao/js/colaborador-finance.js', import.meta.url);
async function read(path) { return readFile(path, 'utf8'); }

test('collaborator dashboard exposes own finance section and current appointment receipt form', async () => {
  const html = await read(htmlPath);
  assert.match(html, /href="#financeiro"/i);
  assert.match(html, /id="financeiro"/i);
  assert.match(html, /id="currentAppointmentReceiptForm"/i);
  assert.match(html, /id="collaboratorFinanceReceipts"/i);
  assert.match(html, /id="collaboratorFinanceBooks"/i);
  assert.match(html, /id="collaboratorFinancePayouts"/i);
  assert.match(html, /initCollaboratorFinance/);
});

test('collaborator finance code uses only own finance APIs and never references commission percentage', async () => {
  const js = await read(jsPath);
  assert.match(js, /registerReceipt/);
  assert.match(js, /listOwnReceipts/);
  assert.match(js, /listOwnBooks/);
  assert.match(js, /listOwnPayouts/);
  assert.doesNotMatch(js, /percentual|comiss[aã]o/i);
  assert.doesNotMatch(js, /listAdmin|setCommission|reverseReceipt|settlePayout|reversePayout/);
});

test('collaborator finance registration derives the receipt target from the currently opened appointment', async () => {
  const js = await read(jsPath);
  assert.match(js, /getCurrentAppointment/);
  assert.match(js, /const\s+appointment\s*=\s*getCurrentAppointment\(\)/);
  assert.match(js, /atendimentoId\s*:\s*appointment\.id/);
  assert.match(js, /appointment\.colaboradora_user_id[\s\S]*profile\.user_id/);
  assert.doesNotMatch(js, /from\(['"]atendimentos['"]\)/);
});
