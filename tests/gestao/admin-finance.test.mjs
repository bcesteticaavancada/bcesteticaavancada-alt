import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../gestao/admin/index.html', import.meta.url);
const sourceUrl = new URL('../../gestao/js/admin-finance.js', import.meta.url);

async function load() { return Promise.all([readFile(htmlUrl,'utf8'), readFile(sourceUrl,'utf8')]); }

test('admin finance exposes filters, consolidated indicators and all phase 5 controls', async () => {
  const [html, source] = await load();
  for (const id of ['adminFinanceProfessional','adminFinanceFrom','adminFinanceTo','adminFinanceTotalReceived','adminFinanceTotalPending','adminCommissionForm','adminBookCloseForm','adminBookRecalcForm','adminPayoutCycleForm','adminPayoutCreateForm','adminFinanceReceipts','adminFinanceBooks','adminFinancePayouts']) {
    assert.match(html, new RegExp(`id=["']${id}["']`, 'i'));
  }
  for (const action of ['setCommission','closeBook','reopenBook','recalculateBooks','reverseReceipt','setPayoutCycle','createPayout','settlePayout','reversePayout']) {
    assert.match(source, new RegExp(action));
  }
});

test('admin finance receives authenticated admin profile and agenda staff map', async () => {
  const [html, source] = await load();
  assert.match(source, /initAdminFinance\s*\(\s*\{[\s\S]*profile[\s\S]*staffMap/);
  assert.match(source, /profile\.role\s*!==\s*['"]admin['"]/);
  assert.match(source, /staffMap\s+instanceof\s+Map/);
  assert.match(html, /initAdminFinance\s*\(\s*\{\s*client\s*,\s*profile\s*,\s*root\s*:\s*document\s*,\s*staffMap\s*:\s*agenda\.getStaffMap\(\)/);
});

test('finance panel loads its own stylesheet and audit financial entities remain readonly', async () => {
  const [html] = await load();
  assert.match(html, /assets\/finance\.css/);
  for (const entity of ['recebimentos','livros_financeiros','repasses','comissao_profissional_procedimento','config_repasses']) {
    assert.match(html, new RegExp(`option value=["']${entity}["']`, 'i'));
  }
});
