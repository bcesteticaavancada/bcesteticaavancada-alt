import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../gestao/admin/index.html', import.meta.url);
const sourceUrl = new URL('../../gestao/js/admin-finance.js', import.meta.url);

async function load() { return Promise.all([readFile(htmlUrl,'utf8'), readFile(sourceUrl,'utf8')]); }

test('admin finance exposes filters, consolidated indicators and all phase 5 controls', async () => {
  const [html, source] = await load();
  for (const id of ['adminFinanceFrom','adminFinanceTo','adminFinanceTotalReceived','adminFinanceTotalExpense','adminFinanceTotalBalance','adminCommissionForm','adminExpenseForm','adminFinancePending','adminFinancePayments','adminFinanceRows']) {
    assert.match(html, new RegExp(`id=["']${id}["']`, 'i'));
  }
  for (const action of ['applyCommission','payCommission','createExpense','reverseFinance','downloadFinanceReport']) {
    assert.match(source, new RegExp(action));
  }
});

test('admin finance usa perfil admin e nomes retornados pelo servidor', async () => {
  const [html, source] = await load();
  assert.match(source, /initAdminFinance[\s\S]*profile/);
  assert.match(source, /profile.role!=='admin'/);
  assert.match(source, /professional_name/);
  assert.match(html, /requireRole\('admin'/);

});

test('finance panel loads its own stylesheet and audit financial entities remain readonly', async () => {
  const [html] = await load();
  assert.match(html, /assets\/finance\.css/);
  for (const entity of ['recebimentos','livros_financeiros','repasses','comissao_profissional_procedimento','config_repasses']) {
    assert.match(html, new RegExp(`option value=["']${entity}["']`, 'i'));
  }
});
