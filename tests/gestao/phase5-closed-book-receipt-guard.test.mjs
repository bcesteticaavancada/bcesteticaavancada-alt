import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261011_bc_gestao_phase5_receipt_book_guard.sql', import.meta.url);

async function sql() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('recebimento não pode entrar silenciosamente em livro fechado ou pago', async () => {
  const source = await sql();
  assert.match(source, /create\s+or\s+replace\s+function\s+private\.bc_guard_recebimento_book_period/);
  assert.match(source, /america\/sao_paulo/);
  assert.match(source, /status\s+in\s*\(\s*'fechado'\s*,\s*'pago'\s*\)/);
  assert.match(source, /raise\s+exception[\s\S]*livro[\s\S]*(fechado|pago)/);
});

test('durante revisão, somente admin pode registrar movimento retroativo', async () => {
  const source = await sql();
  assert.match(source, /status\s*=\s*'em_revisao'/);
  assert.match(source, /not\s+private\.is_bc_admin\(\)/);
  assert.match(source, /raise\s+exception[\s\S]*revis[aã]o/);
});

test('proteção é trigger before insert na tabela recebimentos', async () => {
  const source = await sql();
  assert.match(source, /create\s+trigger\s+bc_recebimentos_book_period_guard/);
  assert.match(source, /before\s+insert\s+on\s+public\.recebimentos/);
  assert.match(source, /execute\s+function\s+private\.bc_guard_recebimento_book_period\(\)/);
});
