import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
  foundation: new URL('../../supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql', import.meta.url),
  receipts: new URL('../../supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql', import.meta.url),
  books: new URL('../../supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql', import.meta.url),
  payouts: new URL('../../supabase/migrations/20261010_bc_gestao_phase5_payouts_rpc.sql', import.meta.url),
  hardening: new URL('../../supabase/migrations/20261010_bc_gestao_phase5_audit_hardening.sql', import.meta.url),
};
async function sql(name) { return (await readFile(files[name], 'utf8')).toLowerCase(); }

test('two partial receipts in different weeks are independently eligible exactly once', async () => {
  const [foundation, receipts, books] = await Promise.all([sql('foundation'), sql('receipts'), sql('books')]);
  assert.match(foundation, /recebimentos[\s\S]*pagamento_id[\s\S]*recebido_at/);
  assert.match(receipts, /sum\s*\(r\.valor\)[\s\S]*r\.status\s*=\s*'ativo'/);
  assert.match(books, /recebido_at\s+at\s+time\s+zone\s+'america\/sao_paulo'[\s\S]*between\s+p_periodo_inicio\s+and\s+p_periodo_fim/);
  assert.match(foundation, /unique\s*\(movimento_recebimento_id\)/);
  assert.match(books, /not\s+exists\s*\([\s\S]*movimento_recebimento_id\s*=\s*r\.id/);
});

test('commission is resolved server-side and frozen per weekly book item while own APIs omit percentage', async () => {
  const books = await sql('books');
  assert.match(books, /join\s+public\.comissao_profissional_procedimento[\s\S]*c\.percentual/);
  assert.match(books, /percentual_aplicado[\s\S]*valor_repasse/);
  const ownStart = books.indexOf('private.bc_meus_livros_financeiros_impl');
  const adminStart = books.indexOf('private.bc_financeiro_livros_admin_impl');
  assert.ok(ownStart >= 0 && adminStart > ownStart);
  assert.doesNotMatch(books.slice(ownStart, adminStart), /percentual_aplicado/);
  assert.match(books.slice(adminStart), /percentual_aplicado/);
});

test('15-day payout can aggregate closed weekly books and settlement marks both payout and books paid', async () => {
  const payouts = await sql('payouts');
  assert.match(payouts, /p_ciclo_dias\s+not\s+in\s*\(7\s*,\s*15\s*,\s*30\)/);
  assert.match(payouts, /lf\.status\s*<>\s*'fechado'/);
  assert.match(payouts, /repasse_livros[\s\S]*ativo\s*=\s*true/);
  assert.match(payouts, /update\s+public\.repasses[\s\S]*status\s*=\s*'pago'/);
  assert.match(payouts, /update\s+public\.livros_financeiros[\s\S]*status\s*=\s*'pago'/);
});

test('paid books cannot be recalculated until explicit payout reversal moves them to review', async () => {
  const [books, payouts] = await Promise.all([sql('books'), sql('payouts')]);
  assert.match(books, /v_livro\.status\s*=\s*'pago'[\s\S]*estorn/i);
  assert.match(books, /bc_livros_recalcular_impl[\s\S]*status\s*<>\s*'em_revisao'/);
  assert.match(payouts, /bc_repasse_estornar_impl[\s\S]*status\s*=\s*'em_revisao'/);
});

test('cross-role privacy is enforced by server-side auth and direct tables stay closed', async () => {
  const [receipts, books, payouts, hardening] = await Promise.all([sql('receipts'), sql('books'), sql('payouts'), sql('hardening')]);
  assert.match(receipts, /v_atendimento\.colaboradora_user_id\s*<>\s*v_user_id/);
  assert.match(receipts, /profissional_user_id\s*=\s*v_user_id/);
  assert.match(books, /profissional_user_id\s*=\s*v_user_id/);
  assert.match(payouts, /profissional_user_id\s*=\s*v_user_id/);
  assert.match(hardening, /revoke\s+all\s+on\s+table\s+public\.comissao_profissional_procedimento\s+from\s+anon\s*,\s*authenticated/);
});

test('sensitive mutations have an immutable financial audit trail', async () => {
  const combined = [await sql('receipts'), await sql('books'), await sql('payouts')].join('\n');
  for (const action of ['recebimento_created','recebimento_reversed','comissao_updated','livro_closed','livro_reopened','livro_recalculated','repasse_created','repasse_paid','repasse_reversed']) {
    assert.match(combined, new RegExp(action));
  }
});
