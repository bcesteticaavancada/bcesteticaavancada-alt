import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20261010_bc_gestao_phase4_shared_clients_audit.sql', import.meta.url);

async function loadMigration() {
  return (await readFile(migrationPath, 'utf8')).toLowerCase();
}

test('fase 4 adiciona capacidade de atendimento, arquivamento seguro e audit log', async () => {
  const sql = await loadMigration();
  assert.match(sql, /alter\s+table\s+public\.staff_profiles[\s\S]*add\s+column\s+if\s+not\s+exists\s+atende_clientes\s+boolean\s+not\s+null\s+default\s+false/);
  assert.match(sql, /alter\s+table\s+public\.clientes[\s\S]*add\s+column\s+if\s+not\s+exists\s+ativo\s+boolean\s+not\s+null\s+default\s+true/);
  assert.match(sql, /add\s+column\s+if\s+not\s+exists\s+arquivado_at\s+timestamptz/);
  assert.match(sql, /add\s+column\s+if\s+not\s+exists\s+arquivado_by\s+uuid/);
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.audit_log/);
  assert.match(sql, /alter\s+table\s+public\.audit_log\s+enable\s+row\s+level\s+security/);
  assert.doesNotMatch(sql, /grant\s+(update|delete)[\s\S]*audit_log[\s\S]*to\s+authenticated/);
});

test('fase 4 expõe wrappers invoker e implementações privadas definer para escrita sensível', async () => {
  const sql = await loadMigration();
  for (const fn of ['bc_cliente_create', 'bc_cliente_update', 'bc_cliente_set_active', 'bc_agendamento_create', 'bc_agendamento_update']) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`));
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${fn}_impl\\s*\\(`));
    assert.match(sql, new RegExp(`private\\.${fn}_impl[\\s\\S]*security\\s+definer`));
    assert.match(sql, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*to\\s+authenticated`));
    assert.doesNotMatch(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*to\\s+anon`));
  }
  assert.match(sql, /set\s+search_path\s*=\s*pg_catalog\s*,\s*public\s*,\s*auth\s*,\s*private/);
});

test('fase 4 restringe agenda da colaboradora à própria identidade e bloqueia cliente arquivado', async () => {
  const sql = await loadMigration();
  assert.match(sql, /v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/);
  assert.match(sql, /if\s+not\s+private\.is_bc_admin\(\)[\s\S]*p_colaboradora_user_id\s*<>\s*v_user_id/);
  assert.match(sql, /if\s+not\s+v_cliente_ativo[\s\S]*cliente\s+arquivado/i);
  assert.match(sql, /v_agendamento\.colaboradora_user_id\s*<>\s*v_user_id/);
});

test('fase 4 mantém arquivamento de cliente exclusivo do admin e diretório inclui admin atendente', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_cliente_set_active_impl[\s\S]*if\s+not\s+private\.is_bc_admin\(\)/);
  assert.match(sql, /sp\.active\s*=\s*true/);
  assert.match(sql, /sp\.atende_clientes\s*=\s*true/);
  assert.doesNotMatch(sql, /sp\.role\s*=\s*'colaborador'/);
});

test('fase 4 compartilha leitura de clientes e histórico sem abrir pagamentos', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create\s+policy\s+"?clientes_equipe_select"?[\s\S]*for\s+select[\s\S]*private\.is_bc_active_staff\(\)/);
  assert.match(sql, /create\s+policy\s+"?atendimentos_equipe_select"?[\s\S]*for\s+select[\s\S]*private\.is_bc_active_staff\(\)/);
  assert.doesNotMatch(sql, /create\s+policy\s+"?pagamentos_.*colaborador/i);
});

test('fase 4 audita operações críticas usando auth.uid sem copiar texto clínico integral', async () => {
  const sql = await loadMigration();
  for (const action of ['cliente_created','cliente_updated','cliente_archived','cliente_reactivated','agendamento_created','agendamento_updated','agendamento_status_changed','atendimento_created']) {
    assert.match(sql, new RegExp(`'${action}'`));
  }
  assert.match(sql, /actor_user_id[\s\S]*auth\.uid\(\)/);
  assert.match(sql, /atendimento_created[\s\S]*jsonb_build_object[\s\S]*'agendamento_id'/);
  assert.doesNotMatch(sql, /atendimento_created[\s\S]*queixa_objetivo[\s\S]*new_data/);
});
