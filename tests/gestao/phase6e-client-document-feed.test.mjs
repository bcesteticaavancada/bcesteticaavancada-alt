import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261014011500_bc_gestao_client_document_feed.sql',import.meta.url);
async function sql(){return (await readFile(migrationUrl,'utf8')).toLowerCase();}

test('feed unifica clinical_documents e client_files sem alterar migrations anteriores',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_client_document_feed_impl/i);
  assert.match(text,/from\s+public\.clinical_documents/i);
  assert.match(text,/union\s+all/i);
  assert.match(text,/from\s+public\.client_files/i);
  for(const field of ['source_kind','source_id','title','category','origin','status','document_date','created_at','storage_path','mime_type','downloadable']) assert.ok(text.includes(field),`faltou ${field}`);
});

test('feed oculta arquivo externo anulado e mantém estados dos documentos BC',async()=>{
  const text=await sql();
  assert.match(text,/f\.voided_at\s+is\s+null/i);
  assert.match(text,/d\.status/i);
  assert.ok(text.includes("'bc_gestao'"));
  assert.ok(text.includes("'external'"));
  assert.match(text,/d\.status\s*=\s*'emitido'[\s\S]*d\.storage_path\s+is\s+not\s+null/i);
});

test('feed é autorizado no backend e não abre tabela externa diretamente',async()=>{
  const text=await sql();
  assert.match(text,/auth\.uid\s*\(\s*\)/i);
  assert.match(text,/private\.is_bc_active_staff\s*\(\s*\)/i);
  assert.match(text,/create\s+or\s+replace\s+function\s+public\.bc_client_document_feed/i);
  assert.match(text,/language\s+sql[\s\S]*security\s+invoker/i);
  assert.match(text,/revoke\s+execute[\s\S]*bc_client_document_feed[\s\S]*from\s+anon/i);
  assert.match(text,/grant\s+execute[\s\S]*bc_client_document_feed[\s\S]*to\s+authenticated/i);
  assert.doesNotMatch(text,/grant\s+select\s+on\s+public\.client_files\s+to\s+authenticated/i);
});
