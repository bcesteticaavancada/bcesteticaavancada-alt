import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../../gestao/colaborador/index.html', import.meta.url);
const jsPath = new URL('../../gestao/js/colaborador-finance.js', import.meta.url);

async function read(path) { return readFile(path, 'utf8'); }

test('collaborator dashboard exposes own finance section and initializes it', async () => {
  const html = await read(htmlPath);
  assert.match(html, /href="#financeiro"/i);
  assert.match(html, /id="financeiro"/i);
  assert.match(html, /id="collaboratorReceiptForm"/i);
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
  assert.doesNotMatch(js, /percentual/i);
  assert.doesNotMatch(js, /listAdmin|setCommission|reverseReceipt|settlePayout|reversePayout/);
});

test('collaborator finance registration resolves an attendance owned by the authenticated professional', async () => {
  const js = await read(jsPath);
  assert.match(js, /from\(['"]atendimentos['"]\)/);
  assert.match(js, /eq\(['"]colaboradora_user_id['"],\s*profile\.user_id\)/);
  assert.match(js, /pago|recebimento|valor/i);
});
