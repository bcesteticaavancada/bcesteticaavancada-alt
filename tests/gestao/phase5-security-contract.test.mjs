import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('fase 5 habilita RLS em todas as novas tabelas financeiras', async () => {
  const sql = await loadMigration();
  for (const table of [
    'recebimentos',
    'comissao_profissional_procedimento',
    'livros_financeiros',
    'livro_financeiro_itens',
    'config_repasses',
    'repasses',
    'repasse_livros'
  ]) {
    assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`));
  }
});

test('fase 5 não concede leitura anônima e mantém comissão privada do admin', async () => {
  const sql = await loadMigration();
  assert.match(sql, /revoke\s+all\s+on\s+table[\s\S]*comissao_profissional_procedimento[\s\S]*from\s+anon/);
  assert.match(sql, /create\s+policy\s+"?comissao_admin_all"?[\s\S]*on\s+public\.comissao_profissional_procedimento[\s\S]*private\.is_bc_admin\(\)/);
  assert.doesNotMatch(sql, /create\s+policy\s+"?comissao_.*colaborador/i);
});

test('fase 5 permite à colaboradora somente superfícies financeiras próprias', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+policy\s+"?recebimentos_colaborador_select_proprio"?[\s\S]*profissional_user_id\s*=\s*auth\.uid\(\)/);
  assert.match(sql, /create\s+policy\s+"?livros_colaborador_select_proprio"?[\s\S]*profissional_user_id\s*=\s*auth\.uid\(\)/);
  assert.match(sql, /create\s+policy\s+"?repasses_colaborador_select_proprio"?[\s\S]*profissional_user_id\s*=\s*auth\.uid\(\)/);
  assert.doesNotMatch(sql, /livro_financeiro_itens_colaborador/i);
  assert.doesNotMatch(sql, /repasse_livros_colaborador/i);
});

test('fase 5 mantém escrita financeira estrutural sob controle administrativo', async () => {
  const sql = await loadMigration();
  for (const policy of ['recebimentos_admin_all','livros_admin_all','repasses_admin_all','config_repasses_admin_all']) {
    assert.match(sql, new RegExp(`create\\s+policy\\s+"?${policy}"?[\\s\\S]*private\\.is_bc_admin\\(\\)`));
  }
  assert.doesNotMatch(sql, /for\s+(insert|update|delete)[\s\S]*livros_financeiros[\s\S]*is_bc_active_colaborador/);
});
