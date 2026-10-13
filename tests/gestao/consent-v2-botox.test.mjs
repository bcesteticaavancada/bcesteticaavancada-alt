import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20261013191000_bc_gestao_consent_v2_botox.sql', import.meta.url);
async function sql(){ return (await readFile(migrationUrl, 'utf8')).toLowerCase(); }

test('publica TCLE v2 para classes injetável e não injetável sem apagar v1', async () => {
  const text = await sql();
  assert.match(text, /consent_template_versions/);
  assert.match(text, /'nao_injetavel'\s*,\s*2/);
  assert.match(text, /'injetavel'\s*,\s*2/);
  assert.doesNotMatch(text, /delete\s+from\s+public\.consent_template_versions/i);
  assert.doesNotMatch(text, /update\s+public\.consent_template_versions/i);
});

test('TCLE não injetável v2 deixa claro riscos, ausência de garantia, intercorrência e consentimento revogável', async () => {
  const text = await sql();
  for (const needle of ['não injetável','resultado não é garantido','vermelhidão','edema','intercorrência','retirar meu consentimento']) {
    assert.ok(text.includes(needle), `faltou: ${needle}`);
  }
});

test('TCLE injetável v2 reforça rastreabilidade, riscos e necessidade de avaliação adicional', async () => {
  const text = await sql();
  for (const needle of ['injetável ou invasivo','produto regularizado','marca','lote','validade','infecção','reação alérgica','atendimento adicional']) {
    assert.ok(text.includes(needle), `faltou: ${needle}`);
  }
});

test('cria versão 2 somente dos três Botox e preserva versões publicadas anteriores', async () => {
  const text = await sql();
  for (const name of ['botox terço superior','botox full face','botox nefertiti']) {
    assert.ok(text.includes(name), `faltou procedimento: ${name}`);
  }
  assert.match(text, /max\(v\.version\)\s*\+\s*1/);
  assert.match(text, /current_version_id/);
  assert.doesNotMatch(text, /delete\s+from\s+public\.procedure_versions/i);
});

test('complemento Botox cobre histórico prévio, rastreabilidade, risco sistêmico e sinais de alarme', async () => {
  const text = await sql();
  for (const needle of [
    'toxina botulínica tipo a',
    'histórico de aplicações',
    'data, indicação e dose',
    'marca, fabricante, lote e validade',
    'botulismo',
    'horas ou semanas',
    'visão borrada',
    'pálpebras caídas',
    'fala arrastada',
    'dificuldade para engolir',
    'dificuldade para respirar',
    'procurar atendimento médico imediatamente',
    'sem garantia de resultado',
    'bula do produto efetivamente utilizado',
  ]) assert.ok(text.includes(needle), `faltou no complemento Botox: ${needle}`);
});

test('Botox v2 preserva requisitos clínicos 6D do procedimento anterior', async () => {
  const text = await sql();
  assert.match(text, /requires_general_anamnesis/);
  assert.match(text, /requires_photo/);
  assert.match(text, /requires_product_lot/);
  assert.match(text, /requires_equipment/);
  assert.match(text, /select[\s\S]+from\s+public\.procedure_versions[\s\S]+where\s+v\.id\s*=\s*p\.current_version_id/i);
});
