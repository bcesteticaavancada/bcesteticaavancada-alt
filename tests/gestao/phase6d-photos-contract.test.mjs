import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20261013170000_bc_gestao_phase6d_photos.sql', import.meta.url);

async function sql(){ return await readFile(migrationUrl, 'utf8'); }

test('6D fotos cria metadados clínicos privados e anulação lógica', async () => {
  const text = await sql();
  for (const needle of [
    'create table if not exists public.clinical_treatment_photos',
    "check (kind in ('antes','depois','adicional'))",
    'voided_at timestamptz',
    'voided_by uuid',
    'void_reason text',
    'alter table public.clinical_treatment_photos enable row level security',
    "mime_type in ('image/jpeg','image/png','image/webp')",
    'size_bytes > 0 and size_bytes <= 8388608',
  ]) assert.match(text.toLowerCase(), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').toLowerCase()));
});

test('6D fotos restringe Storage ao caminho cliente/atendimento e sem update/delete', async () => {
  const text = await sql();
  assert.match(text, /fotos-clinicas/);
  assert.match(text, /storage\.foldername\(name\)/i);
  assert.match(text, /profissional_user_id\s*=\s*auth\.uid\(\)/i);
  assert.match(text, /status\s+in\s*\('rascunho','pronto_para_iniciar','em_atendimento'\)/i);
  assert.match(text, /storage\.extension\(name\).*jpg.*jpeg.*png.*webp/is);
  assert.doesNotMatch(text, /create\s+policy[\s\S]{0,180}for\s+update[\s\S]{0,180}fotos-clinicas/i);
  assert.doesNotMatch(text, /create\s+policy[\s\S]{0,180}for\s+delete[\s\S]{0,180}fotos-clinicas/i);
});

test('6D fotos expõe apenas RPCs de listar, registrar e anular', async () => {
  const text = await sql();
  for (const fn of ['bc_treatment_photo_list','bc_treatment_photo_register','bc_treatment_photo_void']) {
    assert.match(text, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`, 'i'));
    assert.match(text, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}`, 'i'));
  }
  assert.match(text, /audit_log/i);
});
