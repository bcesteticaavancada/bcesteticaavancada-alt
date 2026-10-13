import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadSeed() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_catalog_seed') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_catalog_seed deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

const catalog = [
  ['Limpeza de pele', 'fixed', 190, 'nao_injetavel'],
  ['Limpeza de pele com peeling', 'fixed', 219, 'nao_injetavel'],
  ['Massagem (relaxante, drenagem ou redutora)', 'fixed', 195, 'nao_injetavel'],
  ['Peeling', 'starting_at', 195, 'nao_injetavel'],
  ['Black peel', 'fixed', 390, 'nao_injetavel'],
  ['Despigmentação', 'starting_at', 250, 'nao_injetavel'],
  ['Botox terço superior', 'fixed', 990, 'injetavel'],
  ['Botox full face', 'fixed', 1390, 'injetavel'],
  ['Botox Nefertiti', 'fixed', 690, 'injetavel'],
  ['Skinbooster', 'starting_at', 490, 'injetavel'],
  ['Bioestimulador', 'starting_at', 1390, 'injetavel'],
  ['Aplicação de enzimas', 'starting_at', 390, 'injetavel'],
  ['Profhilo', 'fixed', 990, 'injetavel'],
  ['Microagulhamento', 'starting_at', 490, 'injetavel'],
  ['Ultrassom microfocado', 'starting_at', 990, 'nao_injetavel'],
  ['Radiofrequência / criofrequência fracionada', 'starting_at', 490, 'nao_injetavel'],
  ['Fort Hair™', 'fixed', 490, null],
  ['Fort Hair Plus™', 'fixed', 990, 'injetavel'],
  ['Fort Brow™', 'fixed', 390, null],
  ['Sculpt Cryo™', 'fixed', 590, 'nao_injetavel'],
  ['Reset Glow™', 'fixed', 190, 'nao_injetavel'],
  ['Monaco Glow™', 'fixed', 890, null],
  ['Skin Reset™', 'starting_at', 1990, 'injetavel'],
  ['Face Reset™', 'starting_at', 2990, 'injetavel'],
  ['Jato de Plasma', 'starting_at', 190, 'nao_injetavel'],
  ['Harmonização Facial / Preenchimento', 'starting_at', 990, 'injetavel'],
  ['Lipo de Papada', 'starting_at', 390, 'injetavel'],
  ['Tratamento para Estrias', 'starting_at', 390, 'injetavel'],
  ['Tratamento de Vasinhos', 'fixed', 180, null],
  ['Remoção a Laser', 'starting_at', 250, 'nao_injetavel'],
];

function sqlLiteral(text) {
  return `'${String(text).replaceAll("'", "''").toLowerCase()}'`;
}

test('seed contém os 30 itens oficiais com preço e modo aprovados', async () => {
  const sql = await loadSeed();
  assert.equal(catalog.length, 30);

  for (const [name, priceMode, price, documentClass] of catalog) {
    const start = sql.indexOf(sqlLiteral(name));
    assert.notEqual(start, -1, `${name} deve existir no seed`);
    const block = sql.slice(start, start + 1100);
    assert.match(block, new RegExp(`\\b${priceMode}\\b`), `${name} deve usar ${priceMode}`);
    assert.match(block, new RegExp(`\\b${price}(?:\\.0+)?\\b`), `${name} deve usar preço ${price}`);
    if (documentClass) assert.match(block, new RegExp(`\\b${documentClass}\\b`), `${name} deve usar ${documentClass}`);
  }
});

test('Hidratação Facial vira apenas alias histórico de Reset Glow', async () => {
  const sql = await loadSeed();
  assert.match(sql, /hidratação facial[\s\S]*reset glow™/i);
  assert.match(sql, /procedure_aliases/);
  assert.doesNotMatch(sql, /\(\s*'hidratação facial'\s*,\s*'(?:injetavel|nao_injetavel)'/i);
});

test('protocolos com via variável exigem composição da sessão em vez de classe inventada', async () => {
  const sql = await loadSeed();
  for (const name of ['Fort Hair™', 'Fort Brow™', 'Monaco Glow™', 'Tratamento de Vasinhos']) {
    const start = sql.indexOf(sqlLiteral(name));
    assert.notEqual(start, -1);
    const block = sql.slice(start, start + 1500);
    assert.match(block, /compound/);
    assert.match(block, /component_options|componentes_sessao|session_components/);
  }
});

test('biblioteca nasce preenchida com ficha e referência operacional, não como construtor vazio', async () => {
  const sql = await loadSeed();
  assert.match(sql, /specific_schema/);
  assert.match(sql, /technical_schema/);
  assert.match(sql, /['"]fields['"]/);
  assert.match(sql, /['"]reference_steps['"]/);
  assert.match(sql, /requires_general_anamnesis/);
  assert.match(sql, /pre_guidance/);
  assert.match(sql, /post_guidance/);
});

test('normalização do catálogo arquiva legados sem apagar histórico', async () => {
  const sql = await loadSeed();
  assert.doesNotMatch(sql, /delete\s+from\s+public\.procedimentos/);
  for (const legacy of ['Drenagem Linfatica', 'Massagem Redutora', 'Massagem Relaxante', 'Procedimento Homologação']) {
    assert.match(sql, new RegExp(`${legacy.toLowerCase()}[\\s\\S]{0,500}archived_at|archived_at[\\s\\S]{0,500}${legacy.toLowerCase()}`));
  }
});