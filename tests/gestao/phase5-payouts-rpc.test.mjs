import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_payouts_rpc.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('fase 5 cria RPCs públicas e implementações privadas de repasse', async () => {
  const sql = await loadMigration();
  for (const fn of [
    'bc_config_repasse_set',
    'bc_repasse_criar',
    'bc_repasse_baixar',
    'bc_repasse_estornar',
    'bc_meus_repasses',
    'bc_financeiro_repasses_admin',
  ]) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
  }
});

test('ciclo de repasse aceita somente 7, 15 ou 30 dias e é admin-only', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_config_repasse_set_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /p_ciclo_dias\s+not\s+in\s*\(7\s*,\s*15\s*,\s*30\)/);
  assert.match(sql, /insert\s+into\s+public\.config_repasses[\s\S]*on\s+conflict\s*\(profissional_user_id\)/);
  assert.match(sql, /repasse_cycle_updated/);
});

test('lote de repasse aceita apenas livros fechados da mesma profissional e não duplica livro ativo', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_repasse_criar_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /array_length\s*\(p_livro_ids\s*,\s*1\)/);
  assert.match(sql, /livros_financeiros[\s\S]*status\s*<>\s*'fechado'/);
  assert.match(sql, /profissional_user_id\s*<>\s*p_profissional_user_id/);
  assert.match(sql, /repasse_livros[\s\S]*ativo\s*=\s*true/);
  assert.match(sql, /insert\s+into\s+public\.repasses/);
  assert.match(sql, /insert\s+into\s+public\.repasse_livros/);
});

test('baixa marca lote e livros como pagos e é idempotentemente protegida', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_repasse_baixar_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /v_repasse\.status\s*<>\s*'aberto'/);
  assert.match(sql, /update\s+public\.repasses[\s\S]*status\s*=\s*'pago'[\s\S]*pago_at[\s\S]*pago_by/);
  assert.match(sql, /update\s+public\.livros_financeiros[\s\S]*status\s*=\s*'pago'/);
  assert.match(sql, /repasse_paid/);
});

test('estorno preserva histórico, desativa vínculos e move livros para revisão', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_repasse_estornar_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /status\s*=\s*'estornado'[\s\S]*estornado_at[\s\S]*estornado_by/);
  assert.match(sql, /update\s+public\.repasse_livros[\s\S]*set\s+ativo\s*=\s*false/);
  assert.match(sql, /update\s+public\.livros_financeiros[\s\S]*status\s*=\s*'em_revisao'/);
  assert.match(sql, /repasse_reversed/);
});

test('leitura própria de repasses é filtrada por auth.uid e não expõe comissão', async () => {
  const sql = await loadMigration();
  const start = sql.indexOf('private.bc_meus_repasses_impl');
  const end = sql.indexOf('create or replace function public.bc_meus_repasses', start);
  const body = sql.slice(start, end);
  assert.match(body, /profissional_user_id\s*=\s*v_user_id/);
  assert.doesNotMatch(body, /percentual/);
  assert.match(sql, /bc_financeiro_repasses_admin_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
});

test('vínculo livro-repasse usa unicidade apenas enquanto ativo para permitir novo lote após estorno', async () => {
  const sql = await loadMigration();
  assert.match(sql, /drop\s+constraint\s+if\s+exists\s+repasse_livros_livro_id_key/);
  assert.match(sql, /add\s+column\s+if\s+not\s+exists\s+ativo\s+boolean\s+not\s+null\s+default\s+true/);
  assert.match(sql, /create\s+unique\s+index[\s\S]*repasse_livros[\s\S]*livro_id[\s\S]*where\s+ativo\s*=\s*true/);
});
