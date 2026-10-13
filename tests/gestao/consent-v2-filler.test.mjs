import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20261013195000_bc_gestao_consent_v2_filler.sql', import.meta.url);
async function sql(){ return (await readFile(migrationUrl, 'utf8')).toLowerCase(); }

test('cria nova versão somente de Harmonização Facial / Preenchimento e preserva histórico', async () => {
  const text = await sql();
  assert.ok(text.includes('harmonização facial / preenchimento'));
  assert.match(text, /max\(v\.version\)\s*\+\s*1/);
  assert.match(text, /current_version_id/);
  assert.doesNotMatch(text, /delete\s+from\s+public\.procedure_versions/i);
  assert.doesNotMatch(text, /botox terço superior|botox full face|botox nefertiti/i);
});

test('complemento diferencia materiais e vincula indicação, região e volume ao produto efetivamente utilizado', async () => {
  const text = await sql();
  for (const needle of [
    'preenchedores dérmicos',
    'ácido hialurônico',
    'hidroxiapatita de cálcio',
    'plla',
    'pmma',
    'produto efetivamente utilizado',
    'região anatômica',
    'quantidade',
    'instruções de uso',
    'registro na anvisa',
  ]) assert.ok(text.includes(needle), `faltou no complemento de preenchimento: ${needle}`);
});

test('complemento cobre eventos comuns, tardios e complicações vasculares graves', async () => {
  const text = await sql();
  for (const needle of [
    'dor',
    'edema',
    'hematoma',
    'assimetria',
    'infecção',
    'nódulos',
    'granulomas',
    'oclusão vascular',
    'isquemia',
    'necrose tecidual',
    'deficiência visual temporária ou permanente',
  ]) assert.ok(text.includes(needle), `faltou risco no complemento de preenchimento: ${needle}`);
});

test('complemento destaca sinais de alarme vascular e necessidade de atendimento imediato', async () => {
  const text = await sql();
  for (const needle of [
    'dor incomum ou intensa',
    'pele branca, cinza ou azulada',
    'alteração visual',
    'atendimento médico imediatamente',
  ]) assert.ok(text.includes(needle), `faltou sinal de alarme: ${needle}`);
});

test('complemento reforça rastreabilidade e não promete reversão universal', async () => {
  const text = await sql();
  for (const needle of [
    'marca',
    'fabricante',
    'lote',
    'validade',
    'cartão de rastreabilidade',
    'não há garantia de reversão',
    'hialuronidase',
  ]) assert.ok(text.includes(needle), `faltou rastreabilidade/limite terapêutico: ${needle}`);
});

test('nova versão preserva requisitos clínicos 6D do procedimento anterior', async () => {
  const text = await sql();
  assert.match(text, /requires_general_anamnesis/);
  assert.match(text, /requires_photo/);
  assert.match(text, /requires_product_lot/);
  assert.match(text, /requires_equipment/);
  assert.match(text, /select[\s\S]+from\s+public\.procedure_versions[\s\S]+where\s+v\.id\s*=\s*p\.current_version_id/i);
});
