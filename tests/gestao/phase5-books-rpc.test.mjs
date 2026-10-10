import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_books_rpc.sql', import.meta.url);
async function sql() { return (await readFile(migrationPath, 'utf8')).toLowerCase(); }

const rpcs = ['bc_comissao_set','bc_financeiro_comissoes_admin','bc_livro_fechar','bc_livro_reabrir','bc_livros_recalcular','bc_meus_livros_financeiros','bc_financeiro_livros_admin'];

test('commission and book RPCs use private definer plus public invoker wrappers', async () => {
  const source = await sql();
  for (const fn of rpcs) {
    assert.match(source, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(source, new RegExp(`private\\.${fn}_impl[\\s\\S]*security\\s+definer`));
    assert.match(source, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
    assert.match(source, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
  }
});

test('commission configuration is admin-only and audited', async () => {
  const source = await sql();
  assert.match(source, /bc_comissao_set_impl[\s\S]*not\s+private\.is_bc_admin\(\)/);
  assert.match(source, /p_percentual\s*<\s*0[\s\S]*p_percentual\s*>\s*100/);
  assert.match(source, /'comissao_updated'/);
  assert.match(source, /bc_financeiro_comissoes_admin_impl[\s\S]*private\.is_bc_admin\(\)/);
});

test('weekly close uses Sao Paulo receipt date, requires seven days and active commission', async () => {
  const source = await sql();
  assert.match(source, /p_periodo_fim\s*<>\s*p_periodo_inicio\s*\+\s*6/);
  assert.match(source, /recebido_at\s+at\s+time\s+zone\s+'america\/sao_paulo'/);
  assert.match(source, /r\.status\s*=\s*'ativo'/);
  assert.match(source, /comissao_profissional_procedimento/);
  assert.match(source, /c\.ativo\s*=\s*true/);
  assert.match(source, /comiss[aã]o[\s\S]*configurad/i);
});

test('close is idempotent and a receipt cannot be counted twice', async () => {
  const source = await sql();
  assert.match(source, /profissional_user_id\s*=\s*p_profissional_user_id[\s\S]*periodo_inicio\s*=\s*p_periodo_inicio[\s\S]*periodo_fim\s*=\s*p_periodo_fim/);
  assert.match(source, /if\s+v_livro_id\s+is\s+not\s+null[\s\S]*return\s+v_livro_id/);
  assert.match(source, /not\s+exists\s*\([\s\S]*livro_financeiro_itens[\s\S]*movimento_recebimento_id\s*=\s*r\.id/);
  assert.match(source, /'livro_closed'/);
});

test('reopen and recalculation are admin-only and paid books stay protected', async () => {
  const source = await sql();
  assert.match(source, /bc_livro_reabrir_impl[\s\S]*not\s+private\.is_bc_admin\(\)/);
  assert.match(source, /v_livro\.status\s*=\s*'pago'[\s\S]*estorn/i);
  assert.match(source, /status\s*=\s*'em_revisao'/);
  assert.match(source, /bc_livros_recalcular_impl[\s\S]*status\s*=\s*'em_revisao'/);
  assert.match(source, /p_procedimento_id\s+is\s+null\s+or\s+li\.procedimento_id\s*=\s*p_procedimento_id/);
  assert.match(source, /'livro_reopened'/);
  assert.match(source, /'livro_recalculated'/);
});

test('own books never return percentage, while admin detail can include applied percentage', async () => {
  const source = await sql();
  const ownStart = source.indexOf('private.bc_meus_livros_financeiros_impl');
  const adminStart = source.indexOf('private.bc_financeiro_livros_admin_impl');
  const ownBlock = source.slice(ownStart, adminStart);
  assert.ok(ownStart >= 0 && adminStart > ownStart);
  assert.doesNotMatch(ownBlock, /percentual_aplicado/);
  assert.match(source.slice(adminStart), /percentual_aplicado/);
  assert.match(source, /profissional_user_id\s*=\s*v_user_id/);
});
