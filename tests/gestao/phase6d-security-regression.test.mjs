import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path){return await readFile(new URL(`../../${path}`,import.meta.url),'utf8');}

const browserModules=[
  'gestao/js/treatment-photos-api.js','gestao/js/treatment-products-api.js','gestao/js/treatment-equipment-api.js',
  'gestao/js/treatment-intercurrences-api.js','gestao/js/treatment-6d-panel.js','gestao/js/treatment-panel.js',
];
const migrations=[
  'supabase/migrations/20261013170000_bc_gestao_phase6d_photos.sql',
  'supabase/migrations/20261013171000_bc_gestao_phase6d_products.sql',
  'supabase/migrations/20261013172000_bc_gestao_phase6d_equipment.sql',
  'supabase/migrations/20261013173000_bc_gestao_phase6d_intercurrences.sql',
  'supabase/migrations/20261013174000_bc_gestao_phase6d_treatment_integration.sql',
];

test('browser 6D nunca expõe service role nem usa URL pública de Storage',async()=>{
  for(const path of browserModules){
    const text=await read(path);
    assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i,`${path} não pode conter service role`);
    assert.doesNotMatch(text,/getPublicUrl\s*\(/,`${path} não pode gerar URL pública`);
  }
});

test('tabelas clínicas 6D permanecem RPC-only para authenticated',async()=>{
  const text=(await Promise.all(migrations.map(read))).join('\n');
  for(const table of ['clinical_treatment_photos','clinical_products','clinical_product_lots','clinical_treatment_product_usages','clinical_equipment','clinical_treatment_equipment_usages','clinical_intercurrences','clinical_intercurrence_updates','clinical_treatment_intercurrence_confirmations']){
    assert.match(text,new RegExp(`revoke\\s+all\\s+on\\s+(?:table\\s+)?public\\.${table}\\s+from\\s+anon\\s*,\\s*authenticated`,'i'),`${table} deve revogar acesso direto`);
    assert.doesNotMatch(text,new RegExp(`grant\\s+(?:insert|update|delete|all)[^;]*public\\.${table}[^;]*authenticated`,'i'),`${table} não pode liberar escrita direta`);
  }
});

test('Storage de foto é privado, escopado e recusa upload após freeze',async()=>{
  const text=await read(migrations[0]);
  assert.match(text,/bucket_id\s*=\s*'bc-prontuario-private'/i);
  assert.match(text,/\(storage\.foldername\(name\)\)\[1\]\s*=\s*'fotos-clinicas'/i);
  assert.match(text,/t\.cliente_id::text\s*=\s*\(storage\.foldername\(name\)\)\[2\]/i);
  assert.match(text,/t\.id::text\s*=\s*\(storage\.foldername\(name\)\)\[3\]/i);
  assert.match(text,/t\.profissional_user_id\s*=\s*auth\.uid\(\)/i);
  assert.match(text,/t\.pending_document_id\s+is\s+null/i);
  assert.doesNotMatch(text,/for\s+(?:update|delete)[\s\S]{0,200}fotos-clinicas/i);
});

test('snapshot de fotos congela só metadados, sem storage_path ou URL',async()=>{
  const text=await read(migrations[4]);
  const match=text.match(/select\s+coalesce\(jsonb_agg\(jsonb_build_object\(([\s\S]*?)\)\s+order\s+by\s+x\.captured_at[\s\S]*?into\s+v_photos/i);
  assert(match,'bloco de snapshot das fotos não encontrado');
  assert.match(match[1],/'id'[^]*'kind'[^]*'region'[^]*'view'[^]*'caption'[^]*'captured_at'/i);
  assert.doesNotMatch(match[1],/storage_path|signed|url|mime_type/i);
});

test('PDF 6D não introduz download/embedding de foto clínica',async()=>{
  const pdf=await read('supabase/functions/generate-clinical-pdf/pdf.ts');
  const helper=pdf.match(/export function buildTreatment6dSections[\s\S]*?return sections;\n}/)?.[0]||'';
  assert(helper);
  assert.doesNotMatch(helper,/storage_path|signedUrl|getPublicUrl|embedJpg|embedPng/i);
  assert.match(helper,/Fotos clínicas/i);
});
