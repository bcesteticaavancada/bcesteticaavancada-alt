import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../../gestao/admin/index.html', import.meta.url);
const jsPath = new URL('../../gestao/js/admin-finance.js', import.meta.url);
const auditPath = new URL('../../gestao/js/admin-audit.js', import.meta.url);
async function read(path) { return readFile(path, 'utf8'); }

test('admin financeiro simples expõe saldo, pagar, despesa e download sem fechamento', async () => {
 const html=await read(htmlPath);for(const id of ['adminFinancePending','adminCommissionForm','adminExpenseForm','adminFinancePayments','adminFinanceRows','adminFinanceDownloadPDF','adminFinanceDownloadCSV'])assert.ok(html.includes(`id="${id}"`));
 assert.doesNotMatch(html,/id="adminBookCloseForm"|id="adminPayoutCycleForm"|id="adminPayoutCreateForm"/);
 const js=await read(jsPath);for(const token of ['payCommission','createExpense','applyCommission','reverseFinance','getFinanceReport','installFinanceAttachments'])assert.ok(js.includes(token));assert.doesNotMatch(js,/closeBook|createPayout|recalculateBooks/);
});

test('admin audit labels financial events and allows finance filtering', async () => {
  const audit = await read(auditPath);
  for (const action of ['recebimento_created','recebimento_reversed','comissao_updated','livro_closed','livro_reopened','livro_recalculated','repasse_cycle_updated','repasse_created','repasse_paid','repasse_reversed','finance_commission_paid','finance_expense_created','finance_attachment_completed']) {
    assert.match(audit, new RegExp(action));
  }
  const html = await read(htmlPath);
  assert.match(html, /option value="recebimentos"/i);
  assert.match(html, /option value="livros_financeiros"/i);
  assert.match(html, /option value="repasses"/i);
});
