import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadDocsMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((x) => x.includes('bc_gestao_phase6b_documentos_assinaturas') && x.endsWith('.sql'));
  assert.ok(name, 'migration documentos/assinaturas deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('Storage 6B reutiliza bucket privado e restringe pastas de assinatura/documento à equipe ativa', async () => {
  const sql = await loadDocsMigration();
  assert.match(sql, /bc-prontuario-private/);
  assert.match(sql, /storage\.foldername\(name\)[\s\S]*(assinaturas|documentos)/);
  assert.match(sql, /private\.is_bc_active_staff\(\)/);
  assert.match(sql, /for\s+select[\s\S]*to\s+authenticated/);
  assert.match(sql, /for\s+insert[\s\S]*to\s+authenticated/);
  assert.doesNotMatch(sql, /public\s*=\s*true/);
});

test('não existe grant ou policy anon para objetos clínicos do bucket', async () => {
  const sql = await loadDocsMigration();
  assert.doesNotMatch(sql, /on\s+storage\.objects[\s\S]*to\s+anon[\s\S]*(assinaturas|documentos)/);
});
