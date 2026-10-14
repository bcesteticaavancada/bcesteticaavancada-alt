import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../../supabase/migrations/20261014013000_bc_gestao_treatment_reports.sql',import.meta.url);
async function sql(){return (await readFile(migrationUrl,'utf8')).toLowerCase();}

test('parecer é 1:1 por atendimento, estruturado e protegido por RLS',async()=>{
  const text=await sql();
  assert.match(text,/create\s+table\s+if\s+not\s+exists\s+public\.clinical_treatment_reports/i);
  assert.match(text,/treatment_id\s+uuid\s+not\s+null\s+unique/i);
  assert.match(text,/descricao_sessao\s+text\s+not\s+null/i);
  assert.match(text,/resposta_observada\s+text\s+not\s+null/i);
  assert.match(text,/orientacoes\s+text\s+not\s+null/i);
  assert.match(text,/retorno_necessario\s+boolean\s+not\s+null/i);
  assert.match(text,/retorno_sugerido_em\s+date/i);
  assert.match(text,/observacoes\s+text/i);
  assert.match(text,/created_by\s+uuid\s+not\s+null/i);
  assert.match(text,/enable\s+row\s+level\s+security/i);
  assert.match(text,/revoke\s+all\s+on\s+public\.clinical_treatment_reports\s+from\s+anon\s*,\s*authenticated/i);
});

test('upsert deriva autoria e só permite a profissional responsável em tratamento editável',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_report_upsert_impl/i);
  assert.match(text,/v_user\s+uuid\s*:?=\s*auth\.uid\s*\(\s*\)/i);
  assert.match(text,/v_user\s*<>\s*t\.profissional_user_id|t\.profissional_user_id\s*<>\s*v_user/i);
  assert.match(text,/t\.status\s*<>\s*'em_atendimento'/i);
  assert.match(text,/t\.pending_document_id\s+is\s+not\s+null/i);
  assert.match(text,/created_by[\s\S]*v_user/i);
  assert.match(text,/on\s+conflict\s*\(\s*treatment_id\s*\)[\s\S]*do\s+update/i);
});

test('parecer completo exige conteúdo clínico mínimo e retorno coerente',async()=>{
  const text=await sql();
  assert.match(text,/nullif\s*\(\s*trim\s*\(\s*p_payload\s*->>\s*'descricao_sessao'/i);
  assert.match(text,/nullif\s*\(\s*trim\s*\(\s*p_payload\s*->>\s*'resposta_observada'/i);
  assert.match(text,/nullif\s*\(\s*trim\s*\(\s*p_payload\s*->>\s*'orientacoes'/i);
  assert.match(text,/retorno_necessario/i);
  assert.match(text,/retorno_sugerido_em/i);
});

test('gate de finalização acrescenta parecer_pendente e roda antes de criar documento',async()=>{
  const text=await sql();
  assert.match(text,/create\s+or\s+replace\s+function\s+private\.bc_treatment_finalization_gate/i);
  assert.match(text,/clinical_treatment_reports/i);
  assert.match(text,/parecer_pendente/i);
  const gateIndex=text.indexOf('v_phase6d_reasons:=private.bc_treatment_finalization_gate');
  const insertDocIndex=text.indexOf('insert into public.clinical_documents');
  assert.ok(gateIndex>=0,'finalize deve consultar o gate');
  assert.ok(insertDocIndex>gateIndex,'documento só pode nascer depois do gate');
});

test('snapshot final inclui referência estruturada do parecer sem bytes ou URLs',async()=>{
  const text=await sql();
  assert.match(text,/clinical_treatment_reports[\s\S]*v_report/i);
  assert.match(text,/'report'\s*,\s*to_jsonb\s*\(\s*v_report\s*\)/i);
  assert.doesNotMatch(text,/getpublicurl|signedurl|storage_path[^\n]*report/i);
});

test('wrappers públicos são invoker, authenticated-only e leitura/escrita direta continuam fechadas',async()=>{
  const text=await sql();
  for(const name of ['bc_treatment_report_get','bc_treatment_report_upsert']){
    const pattern=new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}[\\s\\S]*?security\\s+invoker`,'i');
    assert.match(text,pattern);
  }
  assert.match(text,/revoke\s+(?:all|execute)[\s\S]*bc_treatment_report_get[\s\S]*from[\s\S]*anon/i);
  assert.match(text,/grant\s+execute[\s\S]*bc_treatment_report_get[\s\S]*to\s+authenticated/i);
  assert.match(text,/revoke\s+(?:all|execute)[\s\S]*bc_treatment_report_upsert[\s\S]*from[\s\S]*anon/i);
  assert.match(text,/grant\s+execute[\s\S]*bc_treatment_report_upsert[\s\S]*to\s+authenticated/i);
});
