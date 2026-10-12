import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const indexUrl = new URL('../../supabase/functions/generate-anamnese-pdf/index.ts', import.meta.url);
const pdfUrl = new URL('../../supabase/functions/generate-anamnese-pdf/pdf.ts', import.meta.url);
const denoUrl = new URL('../../supabase/functions/generate-anamnese-pdf/deno.json', import.meta.url);

test('Edge Function recebe apenas documentId e valida Authorization/staff ativo', async () => {
  const source = await fs.readFile(indexUrl, 'utf8');
  assert.match(source, /Authorization/);
  assert.match(source, /documentId/);
  assert.match(source, /staff_profiles/);
  assert.match(source, /active/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /clienteId\s*[:=]/);
  assert.doesNotMatch(source, /profissao\s*[:=]\s*body/);
  assert.doesNotMatch(source, /conselho\s*[:=]\s*body/);
});

test('PDF usa dados server-side, assinaturas privadas e grava em documentos/anamnese', async () => {
  const source = await fs.readFile(indexUrl, 'utf8');
  assert.match(source, /clinical_documents/);
  assert.match(source, /clinical_signatures/);
  assert.match(source, /anamneses_gerais/);
  assert.match(source, /anamnese_respostas/);
  assert.match(source, /bc-prontuario-private/);
  assert.match(source, /documentos\/anamnese/);
  assert.match(source, /sha256/i);
  assert.match(source, /emitido/);
  assert.match(source, /erro_pdf/);
});

test('builder institucional existe separado e deno fixa dependências', async () => {
  const pdfSource = await fs.readFile(pdfUrl, 'utf8');
  const deno = JSON.parse(await fs.readFile(denoUrl, 'utf8'));
  assert.match(pdfSource, /export async function buildAnamnesePdf/);
  assert.match(pdfSource, /BC Estética Avançada/);
  assert.match(pdfSource, /Código do documento/);
  assert.ok(deno.imports?.['@supabase/supabase-js']);
  assert.ok(deno.imports?.['pdf-lib']);
});
