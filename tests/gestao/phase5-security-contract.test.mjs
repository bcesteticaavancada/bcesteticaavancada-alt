import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

const tables = [
  'recebimentos',
  'comissao_profissional_procedimento',
  'livros_financeiros',
  'livro_financeiro_itens',
  'config_repasses',
  'repasses',
  'repasse_livros',
];

test('todas as tabelas financeiras usam RLS', async () => {
  const sql = await loadMigration();
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`));
  }
});

test('fase 5 não abre tabelas financeiras diretamente para anon ou authenticated', async () => {
  const sql = await loadMigration();
  assert.match(sql, /revoke\s+all\s+on\s+table[\s\S]*recebimentos[\s\S]*from\s+anon\s*,\s*authenticated/);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete)[\s\S]*comissao_profissional_procedimento[\s\S]*to\s+authenticated/);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete)[\s\S]*livro_financeiro_itens[\s\S]*to\s+authenticated/);
});

test('percentuais permanecem em estruturas privadas sem policy de leitura da colaboradora', async () => {
  const sql = await loadMigration();
  assert.match(sql, /comissao_profissional_procedimento[\s\S]*percentual\s+numeric/);
  assert.match(sql, /livro_financeiro_itens[\s\S]*percentual_aplicado\s+numeric/);
  assert.doesNotMatch(sql, /create\s+policy[\s\S]*comissao_profissional_procedimento[\s\S]*is_bc_active_colaborador/);
  assert.doesNotMatch(sql, /create\s+policy[\s\S]*livro_financeiro_itens[\s\S]*is_bc_active_colaborador/);
});

test('foundation preserva autoria e índices para consultas financeiras', async () => {
  const sql = await loadMigration();
  assert.match(sql, /created_by\s+uuid\s+not\s+null\s+references\s+auth\.users/);
  assert.match(sql, /idx_recebimentos_profissional_recebido_at/);
  assert.match(sql, /idx_livros_financeiros_profissional_periodo/);
  assert.match(sql, /idx_repasses_profissional_periodo/);
});
