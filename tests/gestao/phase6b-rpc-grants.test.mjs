import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function all6bSql() {
  const names = (await readdir(migrationsDir)).filter((n) => n.includes('phase6b') && n.endsWith('.sql'));
  assert.ok(names.length >= 4, 'migrations 6B devem existir');
  return (await Promise.all(names.map((name) => readFile(new URL(name, migrationsDir), 'utf8')))).join('\n').toLowerCase();
}

test('anon executa apenas os dois RPCs remotos e não recebe leitura direta clínica', async () => {
  const sql = await all6bSql();
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.bc_anamnese_remote_get[\s\S]*to\s+anon/);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.bc_anamnese_remote_save[\s\S]*to\s+anon/);
  for (const table of ['anamneses_gerais','anamnese_respostas','clinical_alerts','clinical_documents','clinical_signatures']) {
    assert.doesNotMatch(sql, new RegExp(`grant\\s+(select|insert|update|delete)[\\s\\S]*public\\.${table}[\\s\\S]*to\\s+anon`));
  }
});

test('wrappers autenticados são invoker e implementações privilegiadas ficam private', async () => {
  const sql = await all6bSql();
  for (const fn of ['bc_anamnese_begin','bc_anamnese_save_answers','bc_anamnese_submit_review','bc_anamnese_mark_reviewed','bc_anamnese_create_remote_link','bc_clinical_alert_create_manual','bc_clinical_document_finalize']) {
    assert.match(sql, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`));
    assert.match(sql, new RegExp(`public\\.${fn}[\\s\\S]*security\\s+invoker`));
  }
  assert.match(sql, /security\s+definer[\s\S]*set\s+search_path\s*=\s*pg_catalog/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /private\.is_bc_active_staff\(\)/);
});

test('authenticated recebe somente EXECUTE nos wrappers públicos 6B necessários', async () => {
  const sql = await all6bSql();
  assert.match(sql, /grant\s+execute[\s\S]*bc_anamnese_begin[\s\S]*authenticated/);
  assert.match(sql, /grant\s+execute[\s\S]*bc_clinical_alert_list[\s\S]*authenticated/);
  assert.match(sql, /grant\s+execute[\s\S]*bc_clinical_document_list[\s\S]*authenticated/);
});
