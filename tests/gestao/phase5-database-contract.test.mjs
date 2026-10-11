import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_financial_foundation.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('fase 5 cria entidades financeiras separadas e rastreáveis', async () => {
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
    assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`));
  }
});

test('fase 5 protege valores, estados e ciclos por constraints explícitas', async () => {
  const sql = await loadMigration();
  assert.match(sql, /valor\s+numeric\(12,2\)\s+not\s+null\s+check\s*\(valor\s*>\s*0\)/);
  assert.match(sql, /status\s+text\s+not\s+null\s+default\s+'ativo'[\s\S]*status\s+in\s*\('ativo'\s*,\s*'estornado'\)/);
  assert.match(sql, /percentual\s+numeric\(5,2\)\s+not\s+null\s+check\s*\(percentual\s*>=\s*0\s+and\s+percentual\s*<=\s*100\)/);
  assert.match(sql, /periodo_fim\s+date\s+not\s+null[\s\S]*check\s*\(periodo_fim\s*=\s*periodo_inicio\s*\+\s*6\)/);
  assert.match(sql, /ciclo_dias\s+integer\s+not\s+null[\s\S]*ciclo_dias\s+in\s*\(7\s*,\s*15\s*,\s*30\)/);
  assert.match(sql, /repasses[\s\S]*status\s+text\s+not\s+null\s+default\s+'aberto'[\s\S]*status\s+in\s*\('aberto'\s*,\s*'pago'\s*,\s*'estornado'\)/);
});

test('fase 5 impede duplicidade de regra, movimento em livro e livro em repasse', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+unique\s+index[\s\S]*comissao_profissional_procedimento[\s\S]*profissional_user_id[\s\S]*procedimento_id[\s\S]*where\s+ativo\s*=\s*true/);
  assert.match(sql, /unique\s*\(movimento_recebimento_id\)/);
  assert.match(sql, /unique\s*\(livro_id\)/);
});

test('fase 5 cria índices para filtros operacionais e fechamento semanal', async () => {
  const sql = await loadMigration();
  for (const fragment of [
    'idx_recebimentos_profissional_recebido_at',
    'idx_recebimentos_pagamento_id',
    'idx_livros_financeiros_profissional_periodo',
    'idx_repasses_profissional_periodo'
  ]) {
    assert.match(sql, new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${fragment}`));
  }
});
