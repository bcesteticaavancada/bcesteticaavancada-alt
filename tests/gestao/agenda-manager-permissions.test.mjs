import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
const authUrl = new URL('../../gestao/js/auth.js', import.meta.url);
const collaboratorHtmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

async function read(url) { return readFile(url, 'utf8'); }

async function loadMigration(fragment) {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes(fragment) && item.endsWith('.sql'));
  assert.ok(name, `migration ${fragment} deve existir`);
  return (await read(new URL(name, migrationsDir))).toLowerCase();
}

test('colaboradora chefe continua colaborador e ganha somente capacidade explícita de agenda', async () => {
  const sql = await loadMigration('bc_gestao_agenda_v2_permissions');
  assert.match(sql, /alter\s+table\s+public\.staff_profiles[\s\S]*pode_gerenciar_agendas\s+boolean\s+not\s+null\s+default\s+false/i);
  assert.match(sql, /sp\.role\s*=\s*'colaborador'[\s\S]*sp\.pode_gerenciar_agendas\s*=\s*true/i);
  assert.doesNotMatch(sql, /role[^;]*colaboradora_chefe|colaboradora_chefe[^;]*role/i);
});

test('backend reutiliza capacidade de agenda para criar, editar, vincular e gerir status', async () => {
  const sql = await loadMigration('bc_gestao_agenda_v2_permissions');
  assert.match(sql, /bc_can_manage_all_agendas/);
  assert.match(sql, /bc_schedule_can_manage/);
  assert.match(sql, /bc_agendamento_create_impl[\s\S]*bc_schedule_can_manage/i);
  assert.match(sql, /bc_agendamento_update_impl[\s\S]*bc_schedule_can_manage/i);
  assert.match(sql, /bc_agendamento_link_cliente_impl[\s\S]*bc_schedule_can_manage/i);
  assert.match(sql, /bc_set_agendamento_status_impl[\s\S]*bc_schedule_can_manage/i);
});

test('permissão amplia somente leitura operacional da agenda sem mexer em políticas clínicas/financeiras', async () => {
  const sql = await loadMigration('bc_gestao_agenda_v2_permissions');
  assert.match(sql, /alter\s+policy\s+["']?agendamentos_colaborador_select["']?[\s\S]*bc_can_manage_all_agendas/i);
  assert.doesNotMatch(sql, /alter\s+policy\s+["']?clientes_/i);
  assert.doesNotMatch(sql, /alter\s+policy\s+["']?(?:pagamentos|recebimentos|repasses|atendimentos)_/i);
  assert.doesNotMatch(sql, /bc_registrar_atendimento_impl/i);
});

test('perfil autenticado apresenta Colaboradora Chefe sem criar papel clínico adicional', async () => {
  const source = await read(authUrl);
  assert.match(source, /pode_gerenciar_agendas/);
  assert.match(source, /Colaboradora Chefe/);
  assert.match(source, /profile\?\.role !== 'colaborador'/);
  assert.doesNotMatch(source, /['"]colaboradora_chefe['"]/);
});

test('área colaboradora mantém módulo financeiro de colaboradora, não o administrativo', async () => {
  const html = await read(collaboratorHtmlUrl);
  assert.match(html, /dashboard-boot\.js/i);
  const boot=await read(new URL('../../gestao/js/dashboard-boot.js',import.meta.url));
  assert.match(boot,/const admin=profile.role==='admin'/);
  assert.match(boot,/admin\?initAdminFinance:initCollaboratorFinance/);
  assert.doesNotMatch(html, /admin-finance\.js/i);
});
