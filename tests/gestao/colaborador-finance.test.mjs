import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);
const sourceUrl = new URL('../../gestao/js/colaborador-finance.js', import.meta.url);

async function load() {
  return Promise.all([readFile(htmlUrl, 'utf8'), readFile(sourceUrl, 'utf8')]);
}

test('Meu financeiro mostra Produção recebida, A receber e Pago sem comissão/percentual', async () => {
  const [html, source] = await load();
  assert.match(html, />Meu financeiro</i);
  assert.match(html, /Produção recebida/i);
  assert.match(html, />A receber</i);
  assert.match(html, />Pago</i);
  assert.match(html, /id=["']collaboratorFinanceReceipts["']/);
  assert.match(html, /id=["']collaboratorFinanceBooks["']/);
  assert.match(html, /id=["']collaboratorFinancePayouts["']/);
  assert.doesNotMatch(html, /percentual|comissão/i);
  assert.doesNotMatch(source, /percentual|comiss[aã]o/i);
});

test('registro de recebimento usa o atendimento atualmente aberto na agenda', async () => {
  const [html, source] = await load();
  assert.match(html, /id=["']currentAppointmentReceiptForm["']/);
  assert.match(source, /getCurrentAppointment/);
  assert.match(source, /const\s+appointment\s*=\s*getCurrentAppointment\(\)/);
  assert.match(source, /atendimentoId\s*:\s*appointment\.id/);
  assert.doesNotMatch(source, /listOwnAttendances/);
});

test('inicialização financeira recebe getCurrentAppointment da agenda e expõe refreshReceipts', async () => {
  const [html, source] = await load();
  assert.match(html, /getCurrentAppointment\s*:\s*agenda\.getCurrentAppointment/);
  assert.match(source, /export\s+async\s+function\s+initCollaboratorFinance\s*\(\s*\{[\s\S]*getCurrentAppointment/);
  assert.match(source, /return\s*\{[\s\S]*refresh[\s\S]*refreshReceipts[\s\S]*\}/);
});
