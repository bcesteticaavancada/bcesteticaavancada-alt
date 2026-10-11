import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase5_receipts_rpc.sql', import.meta.url);

async function sql() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('RPCs de recebimento usam wrapper invoker e implementação privada definer', async () => {
  const source = await sql();
  for (const fn of ['bc_recebimento_registrar','bc_recebimento_estornar','bc_meus_recebimentos','bc_financeiro_recebimentos_admin']) {
    assert.match(source, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
    assert.match(source, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(source, new RegExp(`private\\.${fn}_impl[\\s\\S]*security\\s+definer`));
    assert.match(source, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
  }
});

test('registro deriva identidade financeira do atendimento e restringe colaboradora ao próprio atendimento', async () => {
  const source = await sql();
  assert.match(source, /v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/);
  assert.match(source, /from\s+public\.atendimentos[\s\S]*where\s+id\s*=\s*p_atendimento_id/);
  assert.match(source, /v_atendimento\.colaboradora_user_id\s*<>\s*v_user_id/);
  assert.match(source, /profissional_user_id[\s\S]*v_atendimento\.colaboradora_user_id/);
  assert.match(source, /cliente_id[\s\S]*v_atendimento\.cliente_id/);
  assert.match(source, /procedimento_id[\s\S]*v_atendimento\.procedimento_id/);
  assert.match(source, /if\s+p_valor\s+is\s+null\s+or\s+p_valor\s*<=\s*0/);
});

test('estorno é admin-only e bloqueia recebimento já congelado', async () => {
  const source = await sql();
  assert.match(source, /bc_recebimento_estornar_impl[\s\S]*if[\s\S]*not\s+private\.is_bc_admin\(\)/);
  assert.match(source, /livro_financeiro_itens[\s\S]*livros_financeiros[\s\S]*status\s+in\s*\('fechado'\s*,\s*'pago'\)/);
  assert.match(source, /status\s*=\s*'estornado'/);
  assert.match(source, /estorno_motivo/);
});

test('movimentos recompõem pagamento agregado sem apagar histórico', async () => {
  const source = await sql();
  assert.match(source, /sum\s*\(r\.valor\)/);
  assert.match(source, /where\s+r\.pagamento_id\s*=\s*p_pagamento_id[\s\S]*r\.status\s*=\s*'ativo'/);
  assert.match(source, /update\s+public\.pagamentos[\s\S]*valor_recebido\s*=\s*v_total_recebido/);
  assert.match(source, /case[\s\S]*when\s+v_total_recebido\s*=\s*0\s+then\s+'pendente'[\s\S]*when\s+v_total_recebido\s*<\s*valor_total\s+then\s+'parcial'[\s\S]*else\s+'pago'/);
});

test('leitura própria não retorna percentual e leitura admin exige admin', async () => {
  const source = await sql();
  assert.match(source, /bc_meus_recebimentos_impl[\s\S]*profissional_user_id\s*=\s*v_user_id/);
  assert.doesNotMatch(source, /bc_meus_recebimentos_impl[\s\S]*percentual/);
  assert.match(source, /bc_financeiro_recebimentos_admin_impl[\s\S]*private\.is_bc_admin\(\)/);
  assert.match(source, /revoke\s+all\s+on\s+function\s+public\.bc_recebimento_registrar/);
  assert.match(source, /grant\s+execute\s+on\s+function\s+public\.bc_recebimento_registrar[\s\S]*to\s+authenticated/);
});
