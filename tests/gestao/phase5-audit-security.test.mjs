import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hardeningUrl = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_audit_hardening.sql', import.meta.url);
const receiptsUrl = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql', import.meta.url);
const booksUrl = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql', import.meta.url);
const payoutsUrl = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_payouts_rpc.sql', import.meta.url);

async function source(url) { return (await readFile(url, 'utf8')).toLowerCase(); }

test('financial audit events are emitted for every sensitive phase 5 mutation', async () => {
  const combined = [await source(receiptsUrl), await source(booksUrl), await source(payoutsUrl)].join('\n');
  for (const action of [
    'recebimento_created','recebimento_reversed','comissao_updated','livro_closed','livro_reopened',
    'livro_recalculated','repasse_cycle_updated','repasse_created','repasse_paid','repasse_reversed',
  ]) assert.match(combined, new RegExp(`['"]${action}['"]`));
});

test('audit hardening keeps log immutable for authenticated and globally readable only by admin RLS', async () => {
  const sql = await source(hardeningUrl);
  assert.match(sql, /alter\s+table\s+public\.audit_log\s+enable\s+row\s+level\s+security/);
  assert.match(sql, /revoke\s+insert\s*,\s*update\s*,\s*delete\s*,\s*truncate[\s\S]*on\s+public\.audit_log[\s\S]*from\s+anon\s*,\s*authenticated/);
  assert.match(sql, /grant\s+select\s+on\s+public\.audit_log\s+to\s+authenticated/);
  assert.match(sql, /create\s+policy\s+"?audit_log_admin_select"?[\s\S]*using\s*\(private\.is_bc_admin\(\)\)/);
});

test('hardening reasserts phase 5 wrapper grants and blocks direct financial table access', async () => {
  const sql = await source(hardeningUrl);
  for (const table of ['recebimentos','comissao_profissional_procedimento','livros_financeiros','livro_financeiro_itens','config_repasses','repasses','repasse_livros']) {
    assert.match(sql, new RegExp(`revoke[\\s\\S]*on\\s+(?:table\\s+)?public\\.${table}[\\s\\S]*from\\s+anon\\s*,\\s*authenticated`));
  }
  for (const fn of ['bc_recebimento_registrar','bc_recebimento_estornar','bc_meus_recebimentos','bc_financeiro_recebimentos_admin','bc_comissao_set','bc_financeiro_comissoes_admin','bc_livro_fechar','bc_livro_reabrir','bc_livros_recalcular','bc_meus_livros_financeiros','bc_financeiro_livros_admin','bc_config_repasse_set','bc_repasse_criar','bc_repasse_baixar','bc_repasse_estornar','bc_meus_repasses','bc_financeiro_repasses_admin']) {
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*from\\s+public\\s*,\\s*anon`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*to\\s+authenticated`));
  }
});
