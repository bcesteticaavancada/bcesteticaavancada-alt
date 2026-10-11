import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('fase 5 cria wrappers públicos e implementações privadas para recebimentos', async () => {
  const sql = await loadMigration();
  for (const fn of ['bc_recebimento_registrar', 'bc_recebimento_estornar', 'bc_meus_recebimentos', 'bc_financeiro_recebimentos_admin']) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(sql, new RegExp(`private\\.${fn}_impl[\\s\\S]*security\\s+definer`));
    assert.match(sql, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
  }
  assert.match(sql, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public\s*,\s*auth\s*,\s*private/);
});

test('registro deriva identidade clínica no banco e colaboradora só registra atendimento próprio', async () => {
  const sql = await loadMigration();
  assert.match(sql, /v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/);
  assert.match(sql, /from\s+public\.atendimentos[\s\S]*where\s+id\s*=\s*p_atendimento_id/);
  assert.match(sql, /if\s+not\s+private\.is_bc_admin\(\)[\s\S]*v_atendimento\.colaboradora_user_id\s*<>\s*v_user_id/);
  for (const derived of ['cliente_id','colaboradora_user_id','procedimento_id','agendamento_id']) {
    assert.match(sql, new RegExp(`v_atendimento\\.${derived}`));
  }
  assert.match(sql, /p_valor\s*<=\s*0/);
  assert.match(sql, /created_by[\s\S]*v_user_id/);
});

test('registro e estorno recompõem o agregado de pagamentos sem apagar movimentos', async () => {
  const sql = await loadMigration();
  assert.match(sql, /sum\s*\(r\.valor\)[\s\S]*r\.status\s*=\s*'ativo'/);
  assert.match(sql, /update\s+public\.pagamentos[\s\S]*valor_recebido/);
  assert.match(sql, /status\s*=\s*case[\s\S]*'pendente'[\s\S]*'parcial'[\s\S]*'pago'/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.recebimentos/);
});

test('estorno é admin-only e bloqueia movimento já congelado em livro', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_recebimento_estornar_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /livro_financeiro_itens[\s\S]*livros_financeiros[\s\S]*status\s+in\s*\('fechado'\s*,\s*'pago'\)/);
  assert.match(sql, /status\s*=\s*'estornado'[\s\S]*estornado_at[\s\S]*estornado_by/);
});

test('leituras de colaboradora não retornam percentual e leitura admin é explicitamente protegida', async () => {
  const sql = await loadMigration();
  const ownStart = sql.indexOf('private.bc_meus_recebimentos_impl');
  const ownEnd = sql.indexOf('create or replace function public.bc_meus_recebimentos', ownStart);
  const ownBody = sql.slice(ownStart, ownEnd);
  assert.match(ownBody, /profissional_user_id\s*=\s*v_user_id/);
  assert.doesNotMatch(ownBody, /percentual/);
  assert.match(sql, /bc_financeiro_recebimentos_admin_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
});

test('RPCs públicas de recebimento são somente authenticated', async () => {
  const sql = await loadMigration();
  for (const fn of ['bc_recebimento_registrar', 'bc_recebimento_estornar', 'bc_meus_recebimentos', 'bc_financeiro_recebimentos_admin']) {
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*from\\s+public`));
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*from\\s+anon`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*to\\s+authenticated`));
  }
});
