import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_payouts_rpc.sql', import.meta.url);
async function sql() { return (await readFile(migrationPath, 'utf8')).toLowerCase(); }
const rpcs = ['bc_config_repasse_set','bc_repasse_criar','bc_repasse_baixar','bc_repasse_estornar','bc_meus_repasses','bc_financeiro_repasses_admin'];

test('payout RPCs use public invoker and private definer pattern', async () => {
  const source = await sql();
  for (const fn of rpcs) {
    assert.match(source, new RegExp(`private\\.${fn}_impl[\\s\\S]*security\\s+definer`));
    assert.match(source, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
    assert.match(source, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*to\\s+authenticated`));
  }
});

test('payout cycle is admin-only and accepts only 7 15 or 30 days', async () => {
  const source = await sql();
  assert.match(source, /bc_config_repasse_set_impl[\s\S]*not\s+private\.is_bc_admin\(\)/);
  assert.match(source, /p_ciclo_dias\s+not\s+in\s*\(7\s*,\s*15\s*,\s*30\)/);
  assert.match(source, /'repasse_cycle_updated'/);
});

test('creating payout accepts only closed books from one professional and blocks duplicate active links', async () => {
  const source = await sql();
  assert.match(source, /bc_repasse_criar_impl[\s\S]*not\s+private\.is_bc_admin\(\)/);
  assert.match(source, /status\s*<>\s*'fechado'/);
  assert.match(source, /profissional_user_id\s*<>\s*p_profissional_user_id/);
  assert.match(source, /repasse_livros[\s\S]*ativo\s*=\s*true/);
  assert.match(source, /ciclo_dias/);
  assert.match(source, /'repasse_created'/);
});

test('settlement marks payout and linked books paid and cannot repeat', async () => {
  const source = await sql();
  assert.match(source, /bc_repasse_baixar_impl[\s\S]*v_repasse\.status\s*<>\s*'aberto'/);
  assert.match(source, /update\s+public\.repasses[\s\S]*status\s*=\s*'pago'/);
  assert.match(source, /update\s+public\.livros_financeiros[\s\S]*status\s*=\s*'pago'/);
  assert.match(source, /'repasse_paid'/);
});

test('reversal marks batch reversed, releases links and moves books to review', async () => {
  const source = await sql();
  assert.match(source, /bc_repasse_estornar_impl[\s\S]*v_repasse\.status\s*=\s*'estornado'/);
  assert.match(source, /update\s+public\.repasse_livros[\s\S]*ativo\s*=\s*false/);
  assert.match(source, /update\s+public\.livros_financeiros[\s\S]*status\s*=\s*'em_revisao'/);
  assert.match(source, /'repasse_reversed'/);
});

test('own payout list is scoped to auth user and has no commission percentage', async () => {
  const source = await sql();
  const ownStart = source.indexOf('private.bc_meus_repasses_impl');
  const adminStart = source.indexOf('private.bc_financeiro_repasses_admin_impl');
  const ownBlock = source.slice(ownStart, adminStart);
  assert.ok(ownStart >= 0 && adminStart > ownStart);
  assert.match(ownBlock, /profissional_user_id\s*=\s*v_user_id/);
  assert.doesNotMatch(ownBlock, /percentual/);
  assert.match(source.slice(adminStart), /private\.is_bc_admin\(\)/);
});
