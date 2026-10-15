import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schemaUrl = new URL('../../supabase/migrations/20261014180000_bc_gestao_public_agenda_schema.sql', import.meta.url);
const engineUrl = new URL('../../supabase/migrations/20261014184500_bc_gestao_public_agenda_engine.sql', import.meta.url);
const authUrl = new URL('../../gestao/js/auth.js', import.meta.url);
const collaboratorHtmlUrl = new URL('../../gestao/colaborador/index.html', import.meta.url);

async function read(url) { return readFile(url, 'utf8'); }

test('schema mantém colaboradora chefe como colaborador com capacidade explícita', async () => {
  const sql = (await read(schemaUrl)).toLowerCase();
  assert.match(sql, /alter\s+table\s+public\.staff_profiles[\s\S]*pode_gerenciar_agendas\s+boolean\s+not\s+null\s+default\s+false/i);
  assert.doesNotMatch(sql, /role[^;]*colaboradora_chefe|colaboradora_chefe[^;]*role/i);
});

test('engine permite gerir outra agenda somente para admin ou capacidade explícita', async () => {
  const sql = (await read(engineUrl)).toLowerCase();
  assert.match(sql, /pode_gerenciar_agendas/);
  assert.match(sql, /bc_schedule_can_manage/);
  assert.match(sql, /bc_agendamento_create_impl[\s\S]*bc_schedule_can_manage/i);
  assert.match(sql, /bc_agendamento_link_cliente_impl[\s\S]*bc_schedule_can_manage/i);
});

test('perfil autenticado carrega a capacidade sem criar terceiro papel', async () => {
  const source = await read(authUrl);
  assert.match(source, /pode_gerenciar_agendas/);
  assert.match(source, /VALID_ROLES\s*=\s*new Set\(\[['"]admin['"],\s*['"]colaborador['"]\]\)/);
});

test('área colaboradora reconhece a chefe sem liberar financeiro administrativo', async () => {
  const html = await read(collaboratorHtmlUrl);
  assert.match(html, /pode_gerenciar_agendas/);
  assert.match(html, /Colaboradora Chefe/i);
  assert.match(html, /colaborador-finance\.js/i);
  assert.doesNotMatch(html, /admin-finance\.js/i);
});
