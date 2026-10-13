import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function load(fragment) {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes(fragment) && item.endsWith('.sql'));
  assert.ok(name, `migration ${fragment} deve existir`);
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('nome do procedimento faz parte do snapshot versionado e a publicação sincroniza a versão atual', async () => {
  const sql = await load('phase6c_procedure_name_snapshot');
  assert.match(sql, /alter\s+table\s+public\.procedure_versions[\s\S]*add\s+column\s+if\s+not\s+exists\s+nome\s+text/);
  assert.match(sql, /update\s+public\.procedure_versions[\s\S]*set\s+nome\s*=\s*p\.nome/);
  assert.match(sql, /alter\s+column\s+nome\s+set\s+not\s+null/);
  assert.match(sql, /insert\s+into\s+public\.procedure_versions[\s\S]*nome/);
  assert.match(sql, /update\s+public\.procedure_versions\s+set[\s\S]*nome\s*=\s*v_name/);
  assert.match(sql, /update\s+public\.procedimentos[\s\S]*set\s+nome\s*=\s*v_draft\.nome/);
});

test('guarda de imutabilidade também protege o nome publicado', async () => {
  const sql = await load('phase6c_procedure_name_snapshot');
  const start = sql.indexOf('bc_procedure_version_immutable_guard');
  assert.notEqual(start, -1);
  const block = sql.slice(start, start + 7000);
  assert.match(block, /new\.nome/);
  assert.match(block, /old\.nome/);
  assert.match(block, /published procedure versions are immutable/);
});
