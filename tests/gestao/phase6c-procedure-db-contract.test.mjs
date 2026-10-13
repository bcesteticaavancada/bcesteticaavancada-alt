import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration(fragment) {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes(fragment) && item.endsWith('.sql'));
  assert.ok(name, `migration ${fragment} deve existir`);
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('6C cria camada versionada sem substituir a identidade estável de procedimentos', async () => {
  const sql = await loadMigration('phase6c_procedure_library');

  assert.match(sql, /alter\s+table\s+public\.procedimentos[\s\S]*add\s+column\s+if\s+not\s+exists\s+current_version_id\s+uuid/);
  assert.match(sql, /alter\s+table\s+public\.procedimentos[\s\S]*add\s+column\s+if\s+not\s+exists\s+archived_at\s+timestamptz/);

  for (const table of [
    'procedure_versions',
    'procedure_professional_permissions',
    'procedure_version_components',
    'procedure_aliases',
  ]) {
    assert.match(sql, new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}`));
    assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`));
  }

  assert.match(sql, /classe_documental[\s\S]*(?:injetavel|injetável)[\s\S]*nao_injetavel/);
  assert.match(sql, /price_mode[\s\S]*fixed[\s\S]*starting_at/);
  assert.match(sql, /protocol_mode[\s\S]*simple[\s\S]*compound/);
  assert.match(sql, /specific_schema\s+jsonb/);
  assert.match(sql, /technical_schema\s+jsonb/);
  assert.match(sql, /consent_supplement\s+text/);
});

test('6C adiciona capacidade de gestão separada de autorização clínica', async () => {
  const sql = await loadMigration('phase6c_procedure_library');

  assert.match(sql, /alter\s+table\s+public\.staff_profiles[\s\S]*add\s+column\s+if\s+not\s+exists\s+pode_gerenciar_procedimentos\s+boolean[\s\S]*default\s+false/);
  assert.match(sql, /procedure_professional_permissions[\s\S]*professional_user_id/);
  assert.match(sql, /allowed\s+boolean/);
  assert.match(sql, /granted_by/);
  assert.match(sql, /revoked_at/);

  assert.match(sql, /bc_staff_set_procedure_manager/);
  assert.match(sql, /bc_procedure_set_execution_permission/);
  assert.doesNotMatch(sql, /pode_gerenciar_procedimentos\s*=\s*true[\s\S]{0,200}allowed\s*=\s*true/);
});

test('versão publicada é tratada como histórica e publicação sincroniza procedimento estável', async () => {
  const sql = await loadMigration('phase6c_procedure_library');

  assert.match(sql, /status[\s\S]*draft[\s\S]*published[\s\S]*superseded/);
  assert.match(sql, /bc_procedure_publish/);
  assert.match(sql, /current_version_id/);
  assert.match(sql, /update\s+public\.procedimentos[\s\S]*nome[\s\S]*ativo[\s\S]*duracao_padrao/);
  assert.match(sql, /superseded/);

  const immutableGuard = /published[\s\S]*(?:raise\s+exception|trigger|immutable|imut[aá]vel)/;
  assert.match(sql, immutableGuard);
  assert.doesNotMatch(sql, /on\s+public\.procedure_versions\s+for\s+delete\s+to\s+authenticated[\s\S]*using\s*\(\s*true\s*\)/);
});

test('novas tabelas públicas 6C não ficam com escrita clínica direta aberta ao browser', async () => {
  const sql = await loadMigration('phase6c_procedure_library');

  for (const table of [
    'procedure_versions',
    'procedure_professional_permissions',
    'procedure_version_components',
    'procedure_aliases',
  ]) {
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on(?:\\s+table)?\\s+public\\.${table}[\\s\\S]*from\\s+anon`));
    assert.doesNotMatch(sql, new RegExp(`grant\\s+(?:insert|update|delete|all)[^;]*on(?:\\s+table)?\\s+public\\.${table}[^;]*to\\s+authenticated`));
  }
});
