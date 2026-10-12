import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const guardUrl = new URL('../../supabase/migrations/20261012_bc_gestao_phase6b_signature_storage_guard.sql', import.meta.url);
const edgeUrl = new URL('../../supabase/functions/generate-anamnese-pdf/index.ts', import.meta.url);

test('registro de assinatura exige objeto já existente no bucket privado', async () => {
  const sql = await fs.readFile(guardUrl, 'utf8');
  assert.match(sql, /storage\.objects/i);
  assert.match(sql, /bucket_id\s*=\s*'bc-prontuario-private'/i);
  assert.match(sql, /name\s*=\s*p_storage_path/i);
  assert.match(sql, /Arquivo de assinatura não encontrado/i);
});

test('Edge Function confere SHA-256 real de cada assinatura antes do PDF', async () => {
  const source = await fs.readFile(edgeUrl, 'utf8');
  assert.match(source, /sha256Hex\(signatureBytes\)/);
  assert.match(source, /signature\.sha256/i);
  assert.match(source, /Integridade da assinatura inválida/i);
  assert.match(source, /Assinatura privada não encontrada/i);
});
