import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20261014010000_bc_gestao_bioestimulador_consent.sql', import.meta.url);
async function sql(){ return (await readFile(migrationUrl, 'utf8')).toLowerCase(); }

test('publica nova versão de Bioestimulador preservando a versão anterior', async () => {
  const text = await sql();
  assert.ok(text.includes('bioestimulador'));
  assert.match(text, /max\(v\.version\)\s*\+\s*1/);
  assert.match(text, /current_version_id/);
  assert.match(text, /superseded/);
  assert.match(text, /published/);
  assert.doesNotMatch(text, /delete\s+from\s+public\.procedure_versions/i);
});

test('Bioestimulador mantém classe injetável e requisitos clínicos existentes', async () => {
  const text = await sql();
  assert.match(text, /classe_documental/);
  assert.match(text, /requires_general_anamnesis/);
  assert.match(text, /requires_photo/);
  assert.match(text, /requires_product_lot/);
  assert.match(text, /requires_equipment/);
  assert.match(text, /select[\s\S]+from\s+public\.procedure_versions[\s\S]+where\s+v\.id\s*=\s*p\.current_version_id/i);
});

test('complemento de Bioestimulador cobre resposta gradual, eventos locais, nódulos e granulomas', async () => {
  const text = await sql();
  for (const needle of [
    'resposta gradual',
    'sem garantia de resultado',
    'dor',
    'edema',
    'hematoma',
    'assimetria',
    'infecção',
    'nódulos',
    'granulomas',
    'eventos tardios',
  ]) assert.ok(text.includes(needle), `faltou no complemento Bioestimulador: ${needle}`);
});

test('complemento exige rastreabilidade e não promete reversão universal', async () => {
  const text = await sql();
  for (const needle of [
    'marca',
    'fabricante',
    'substância',
    'lote',
    'validade',
    'quantidade',
    'região tratada',
    'bula',
    'não existe reversão universal',
  ]) assert.ok(text.includes(needle), `faltou no complemento Bioestimulador: ${needle}`);
});

test('complemento não trata PMMA como bioestimulador estético genérico e preserva direitos', async () => {
  const text = await sql();
  assert.ok(text.includes('pmma'));
  assert.ok(text.includes('não deve ser tratado como bioestimulador estético genérico'));
  assert.ok(text.includes('não representa renúncia a direitos'));
  assert.ok(text.includes('não exonera a responsabilidade'));
});
