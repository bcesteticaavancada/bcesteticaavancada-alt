import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../../gestao/admin/index.html', import.meta.url);
const jsPath = new URL('../../gestao/js/admin-finance.js', import.meta.url);
const auditPath = new URL('../../gestao/js/admin-audit.js', import.meta.url);
async function read(path) { return readFile(path, 'utf8'); }

test('admin dashboard activates full finance controls', async () => {
  const html = await read(htmlPath);
  for (const id of ['adminFinanceProfessional','adminCommissionForm','adminBookCloseForm','adminPayoutCycleForm','adminPayoutCreateForm','adminFinanceReceipts','adminFinanceBooks','adminFinancePayouts']) {
    assert.match(html, new RegExp(`id=["']${id}["']`, 'i'));
  }
  assert.match(html, /initAdminFinance/);
  assert.doesNotMatch(html, /módulo propositalmente não ativado/i);
});

test('admin finance module exposes commission book receipt and payout actions', async () => {
  const js = await read(jsPath);
  for (const token of ['setCommission','closeBook','reopenBook','recalculateBooks','reverseReceipt','setPayoutCycle','createPayout','settlePayout','reversePayout']) {
    assert.match(js, new RegExp(token));
  }
  assert.match(js, /listAdminReceipts/);
  assert.match(js, /listAdminBooks/);
  assert.match(js, /listAdminPayouts/);
  assert.match(js, /listAdminCommissions/);
});

test('admin audit labels financial events and allows finance filtering', async () => {
  const audit = await read(auditPath);
  for (const action of ['recebimento_created','recebimento_reversed','comissao_updated','livro_closed','livro_reopened','livro_recalculated','repasse_cycle_updated','repasse_created','repasse_paid','repasse_reversed']) {
    assert.match(audit, new RegExp(action));
  }
  const html = await read(htmlPath);
  assert.match(html, /option value="recebimentos"/i);
  assert.match(html, /option value="livros_financeiros"/i);
  assert.match(html, /option value="repasses"/i);
});
