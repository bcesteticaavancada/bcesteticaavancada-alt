import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20261014011000_bc_gestao_client_files.sql', import.meta.url);
async function sql(){ return (await readFile(migrationUrl,'utf8')).toLowerCase(); }

test('client_files guarda metadata privada, hash e anulação lógica', async()=>{
  const text=await sql();
  assert.match(text,/create\s+table\s+if\s+not\s+exists\s+public\.client_files/i);
  for(const field of ['cliente_id','title','category','origin','document_date','storage_path','mime_type','size_bytes','sha256','uploaded_by','created_at','voided_at','voided_by','void_reason']) assert.ok(text.includes(field),`faltou ${field}`);
  for(const value of ['tcle_externo','exame_documento_apresentado','documento_digitalizado','relatorio_externo','outro_clinico']) assert.ok(text.includes(value),`faltou categoria ${value}`);
  for(const value of ['gov_br','digitalizado','upload_manual','outro']) assert.ok(text.includes(value),`faltou origem ${value}`);
  for(const type of ['application/pdf','image/jpeg','image/png','image/webp']) assert.ok(text.includes(type),`faltou MIME ${type}`);
  assert.match(text,/size_bytes\s*>\s*0[\s\S]*8388608/i);
  assert.match(text,/sha256[\s\S]*64/i);
  assert.doesNotMatch(text,/delete\s+from\s+public\.client_files/i);
});

test('client_files é RLS/RPC-only e wrappers não abrem anon', async()=>{
  const text=await sql();
  assert.match(text,/alter\s+table\s+public\.client_files\s+enable\s+row\s+level\s+security/i);
  assert.match(text,/revoke\s+all\s+on\s+public\.client_files\s+from\s+anon\s*,\s*authenticated/i);
  for(const signature of [
    /public\.bc_client_file_register\s*\(/i,
    /public\.bc_client_file_void\s*\(/i,
  ]) assert.match(text,signature);
  assert.match(text,/language\s+sql[\s\S]*security\s+invoker/i);
  assert.match(text,/grant\s+execute[\s\S]*bc_client_file_register[\s\S]*to\s+authenticated/i);
  assert.match(text,/grant\s+execute[\s\S]*bc_client_file_void[\s\S]*to\s+authenticated/i);
  assert.match(text,/revoke\s+execute[\s\S]*bc_client_file_register[\s\S]*from\s+anon/i);
  assert.match(text,/revoke\s+execute[\s\S]*bc_client_file_void[\s\S]*from\s+anon/i);
});

test('registro deriva autoria no backend e valida objeto real no Storage', async()=>{
  const text=await sql();
  assert.match(text,/private\.bc_client_file_register_impl/i);
  assert.match(text,/auth\.uid\s*\(\s*\)/i);
  assert.match(text,/private\.is_bc_active_staff\s*\(\s*\)/i);
  assert.match(text,/arquivos-clientes\//i);
  assert.match(text,/from\s+storage\.objects/i);
  assert.match(text,/bucket_id\s*=\s*'bc-prontuario-private'/i);
  assert.match(text,/metadata[\s\S]*mimetype/i);
  assert.match(text,/metadata[\s\S]*size/i);
  assert.match(text,/p_sha256/i);
  assert.match(text,/uploaded_by[\s\S]*v_user/i);
});

test('Storage permite somente equipe ativa no caminho arquivos-clientes e tipos aprovados', async()=>{
  const text=await sql();
  assert.match(text,/create\s+policy\s+bc_client_files_insert/i);
  assert.match(text,/create\s+policy\s+bc_client_files_read/i);
  assert.match(text,/bucket_id\s*=\s*'bc-prontuario-private'/i);
  assert.match(text,/storage\.foldername\s*\(\s*name\s*\)\s*\)\s*\[\s*1\s*\]\s*=\s*'arquivos-clientes'/i);
  assert.match(text,/storage\.extension\s*\(\s*name\s*\)[\s\S]*pdf[\s\S]*jpg[\s\S]*jpeg[\s\S]*png[\s\S]*webp/i);
  assert.match(text,/private\.is_bc_active_staff\s*\(\s*\)/i);
});

test('anulação exige motivo, preserva objeto e audita apenas metadata mínima', async()=>{
  const text=await sql();
  assert.match(text,/private\.bc_client_file_void_impl/i);
  assert.match(text,/nullif\s*\(\s*trim\s*\(\s*p_reason\s*\)/i);
  assert.match(text,/set\s+voided_at\s*=\s*now\(\)[\s\S]*voided_by\s*=\s*v_user[\s\S]*void_reason/i);
  assert.match(text,/client_file_voided/i);
  assert.doesNotMatch(text,/storage\.objects[\s\S]*delete/i);
});
