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

test('fase 5 cria as sete entidades financeiras com chaves e referências principais', async () => {
  const sql = await loadMigration();
  for (const table of tables) {
    assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`));
  }
  assert.match(sql, /recebimentos[\s\S]*pagamento_id\s+uuid\s+not\s+null\s+references\s+public\.pagamentos/);
  assert.match(sql, /recebimentos[\s\S]*atendimento_id\s+uuid\s+not\s+null\s+references\s+public\.atendimentos/);
  assert.match(sql, /recebimentos[\s\S]*profissional_user_id\s+uuid\s+not\s+null\s+references\s+auth\.users/);
  assert.match(sql, /livro_financeiro_itens[\s\S]*movimento_recebimento_id\s+uuid\s+not\s+null\s+references\s+public\.recebimentos/);
  assert.match(sql, /repasse_livros[\s\S]*repasse_id\s+uuid\s+not\s+null\s+references\s+public\.repasses/);
  assert.match(sql, /repasse_livros[\s\S]*livro_id\s+uuid\s+not\s+null\s+references\s+public\.livros_financeiros/);
});

test('fase 5 valida valores, estados, percentuais e período semanal', async () => {
  const sql = await loadMigration();
  assert.match(sql, /check\s*\(valor\s*>\s*0\)/);
  assert.match(sql, /check\s*\(percentual\s*>=\s*0\s+and\s+percentual\s*<=\s*100\)/);
  assert.match(sql, /ciclo_dias\s+integer\s+not\s+null[\s\S]*check\s*\(ciclo_dias\s+in\s*\(7\s*,\s*15\s*,\s*30\)\)/);
  assert.match(sql, /periodo_fim\s+date\s+not\s+null[\s\S]*check\s*\(periodo_fim\s*=\s*periodo_inicio\s*\+\s*6\)/);
  assert.match(sql, /status\s+text\s+not\s+null\s+default\s+'aberto'[\s\S]*'fechado'[\s\S]*'em_revisao'[\s\S]*'pago'/);
  assert.match(sql, /status\s+text\s+not\s+null\s+default\s+'aberto'[\s\S]*'estornado'/);
});

test('fase 5 impede duplicidades financeiras essenciais', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+unique\s+index[\s\S]*comissao_profissional_procedimento[\s\S]*profissional_user_id\s*,\s*procedimento_id[\s\S]*where\s+ativo\s*=\s*true/);
  assert.match(sql, /unique\s*\(movimento_recebimento_id\)/);
  assert.match(sql, /unique\s*\(profissional_user_id\s*,\s*periodo_inicio\s*,\s*periodo_fim\)/);
  assert.match(sql, /create\s+unique\s+index[\s\S]*repasse_livros[\s\S]*livro_id[\s\S]*where\s+ativo\s*=\s*true/);
});
