import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function load(fragment) {
  const names = await readdir(migrationsDir);
  const name = names.find((x) => x.includes(fragment) && x.endsWith('.sql'));
  assert.ok(name, `migration ${fragment} deve existir`);
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

test('fase 6B cria núcleo versionado da anamnese e identidade profissional', async () => {
  const sql = await load('bc_gestao_phase6b_anamnese_core');
  for (const column of ['profissao text','conselho text','registro_conselho text']) assert.match(sql, new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${column.replace(' ', '\\s+')}`));
  for (const table of ['anamnese_template_versions','anamneses_gerais','anamnese_respostas','anamnese_confirmacoes_clinicas']) assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`));
  assert.match(sql, /unique[\s\S]*cliente_id[\s\S]*version/);
  assert.match(sql, /valid_until/);
  assert.match(sql, /interval\s+'12\s+months'/);
});

test('fase 6B cria alertas clínicos sem decisão automática', async () => {
  const sql = await load('bc_gestao_phase6b_alertas');
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.clinical_alerts/);
  assert.match(sql, /critico|atencao|informativo/);
  assert.match(sql, /alergia|medicamento|gestacao|amamentacao|herpes|queloide/);
  assert.doesNotMatch(sql, /procedimento\s+liberado|procedimento\s+contraindicado/);
});

test('fase 6B persiste documentos e assinaturas de forma imutável', async () => {
  const sql = await load('bc_gestao_phase6b_documentos_assinaturas');
  for (const table of ['clinical_documents','clinical_signatures']) assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`));
  assert.match(sql, /bc-prontuario-private/);
  assert.match(sql, /paciente|responsavel|profissional/);
  assert.match(sql, /sha256/);
  assert.doesNotMatch(sql, /create\s+policy[^;]*on\s+public\.clinical_signatures[^;]*for\s+update/);
  assert.doesNotMatch(sql, /create\s+policy[^;]*on\s+public\.clinical_signatures[^;]*for\s+delete/);
});

test('fase 6B link remoto guarda hash e expira em 72 horas', async () => {
  const sql = await load('bc_gestao_phase6b_remote_links');
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.anamnese_remote_links/);
  assert.match(sql, /token_hash/);
  assert.match(sql, /digest\s*\(/);
  assert.match(sql, /interval\s+'72\s+hours'/);
  assert.doesNotMatch(sql, /\btoken\s+text\b/);
  assert.match(sql, /bc_anamnese_remote_get/);
  assert.match(sql, /bc_anamnese_remote_save/);
});

test('todas as tabelas públicas 6B habilitam RLS', async () => {
  const fragments = ['bc_gestao_phase6b_anamnese_core','bc_gestao_phase6b_alertas','bc_gestao_phase6b_documentos_assinaturas','bc_gestao_phase6b_remote_links'];
  const sql = (await Promise.all(fragments.map(load))).join('\n');
  for (const table of ['anamnese_template_versions','anamneses_gerais','anamnese_respostas','anamnese_confirmacoes_clinicas','clinical_alerts','clinical_documents','clinical_signatures','anamnese_remote_links']) {
    assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`));
  }
});
