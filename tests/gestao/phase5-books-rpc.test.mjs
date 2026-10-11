import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('fase 5 cria RPCs públicas e implementações privadas de comissão/livros', async () => {
  const sql = await loadMigration();
  for (const fn of [
    'bc_comissao_set',
    'bc_financeiro_comissoes_admin',
    'bc_livro_fechar',
    'bc_livro_reabrir',
    'bc_livros_recalcular',
    'bc_meus_livros_financeiros',
    'bc_financeiro_livros_admin',
  ]) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
  }
});

test('comissão é administrada apenas pela Mel e mantém histórico por regra ativa', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_comissao_set_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /p_percentual\s*<\s*0[\s\S]*p_percentual\s*>\s*100/);
  assert.match(sql, /update\s+public\.comissao_profissional_procedimento[\s\S]*set\s+ativo\s*=\s*false/);
  assert.match(sql, /insert\s+into\s+public\.comissao_profissional_procedimento/);
  assert.match(sql, /bc_financeiro_comissoes_admin_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
});

test('fechamento exige 7 dias, usa data local de São Paulo e somente recebimentos ativos', async () => {
  const sql = await loadMigration();
  assert.match(sql, /p_periodo_fim\s*<>\s*p_periodo_inicio\s*\+\s*6/);
  assert.match(sql, /america\/sao_paulo/i);
  assert.match(sql, /public\.recebimentos[\s\S]*status\s*=\s*'ativo'/);
  assert.match(sql, /comissao_profissional_procedimento[\s\S]*ativo\s*=\s*true/);
  assert.match(sql, /raise\s+exception[\s\S]*comiss[aã]o/i);
});

test('fechamento é idempotente e cada movimento entra no máximo uma vez', async () => {
  const sql = await loadMigration();
  assert.match(sql, /status\s+in\s*\('fechado'\s*,\s*'pago'\)[\s\S]*return\s+v_livro\.id/);
  assert.match(sql, /insert\s+into\s+public\.livro_financeiro_itens[\s\S]*movimento_recebimento_id/);
  assert.match(sql, /not\s+exists\s*\([\s\S]*livro_financeiro_itens/);
});

test('reabertura e recálculo são admin-only e recálculo atua apenas em livros em revisão', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_livro_reabrir_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /set\s+status\s*=\s*'em_revisao'/);
  assert.match(sql, /v_livro\.status\s*=\s*'pago'[\s\S]*raise\s+exception/);
  assert.match(sql, /bc_livros_recalcular_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /status\s*=\s*'em_revisao'/);
  assert.match(sql, /p_procedimento_id\s+is\s+null[\s\S]*procedimento_id\s*=\s*p_procedimento_id/);
});

test('leitura própria de livros não expõe percentual', async () => {
  const sql = await loadMigration();
  const start = sql.indexOf('private.bc_meus_livros_financeiros_impl');
  const end = sql.indexOf('create or replace function public.bc_meus_livros_financeiros', start);
  const body = sql.slice(start, end);
  assert.match(body, /profissional_user_id\s*=\s*v_user_id/);
  assert.doesNotMatch(body, /percentual/);
  assert.match(sql, /bc_financeiro_livros_admin_impl[\s\S]*percentual_aplicado/);
});
