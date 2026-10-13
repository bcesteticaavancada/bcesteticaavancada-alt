import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir=new URL('../../supabase/migrations/',import.meta.url);
async function loadMigration(){const names=await readdir(migrationsDir);const name=names.find((n)=>n.includes('phase6c_treatment_core')&&n.endsWith('.sql'));assert.ok(name,'migration phase6c_treatment_core deve existir');return (await readFile(new URL(name,migrationsDir),'utf8')).toLowerCase();}

test('core cria atendimento formal e entidades auxiliares versionadas',async()=>{
 const sql=await loadMigration();
 for(const table of ['clinical_treatments','clinical_treatment_components','clinical_treatment_health_confirmations','clinical_treatment_alert_reviews','clinical_treatment_versions','clinical_treatment_reopen_grants']) assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));
 for(const state of ['rascunho','pronto_para_iniciar','em_atendimento','finalizado']) assert.match(sql,new RegExp(state));
 assert.match(sql,/agendamento_id uuid/);
 assert.match(sql,/unique[^;]{0,180}agendamento_id|create unique index[^;]{0,180}agendamento_id/);
});

test('biblioteca passa a distinguir procedimento geral de restrito e Botox nasce restrito',async()=>{
 const sql=await loadMigration();
 assert.match(sql,/access_mode/);
 assert.match(sql,/general/);
 assert.match(sql,/restricted/);
 for(const botox of ['botox terço superior','botox full face','botox nefertiti']) assert.match(sql,new RegExp(botox));
 assert.match(sql,/procedure_professional_permissions/);
});

test('gate server-side verifica todos os requisitos e não bloqueia automaticamente mudança de saúde',async()=>{
 const sql=await loadMigration();
 assert.match(sql,/bc_treatment_gate/);
 for(const token of ['anamnese_invalida','saude_nao_confirmada','alertas_nao_revisados','profissional_nao_autorizada','consentimento_pendente','modulo_especifico_incompleto']) assert.match(sql,new RegExp(token));
 assert.match(sql,/clinical_treatment_health_confirmations/);
 assert.match(sql,/clinical_alerts/);
 assert.doesNotMatch(sql,/changed\s*=\s*true[^;]{0,250}(raise exception|profissional_nao_autorizada|contraind)/);
});

test('revisão de alertas copia estado ativo do servidor e gate detecta alerta novo',async()=>{
 const sql=await loadMigration();
 assert.match(sql,/alert_snapshot/);
 assert.match(sql,/where[^;]{0,240}clinical_alerts[^;]{0,240}active\s*=\s*true|from public\.clinical_alerts[^;]{0,240}active/);
 assert.match(sql,/jsonb_agg|array_agg/);
 assert.match(sql,/alertas_nao_revisados/);
});

test('consentimento do treatment é derivado dos componentes armazenados e não do browser',async()=>{
 const sql=await loadMigration();
 assert.match(sql,/bc_treatment_prepare_consent_impl\(p_treatment_id uuid\)/);
 assert.match(sql,/clinical_treatment_components/);
 assert.match(sql,/bc_treatment_prepare_consent_impl\(/);
 assert.match(sql,/consent_document_id/);
});

test('finalização gera snapshot imutável e documento treatment_record antes da assinatura profissional',async()=>{
 const sql=await loadMigration();
 assert.match(sql,/bc_treatment_finalize_impl/);
 assert.match(sql,/clinical_treatment_versions/);
 assert.match(sql,/treatment_record/);
 assert.match(sql,/aguardando_assinaturas/);
 assert.match(sql,/pending_version_id/);
 assert.match(sql,/pending_document_id/);
 assert.match(sql,/bc_treatment_complete_finalize_impl/);
 assert.match(sql,/clinical_signatures[^;]{0,240}signer_kind='profissional'/);
 assert.match(sql,/pronto_para_pdf/);
});

test('fixed congela preço-base e starting_at exige preço final positivo sem escrever financeiro',async()=>{
 const sql=await loadMigration();
 assert.match(sql,/price_mode_snapshot/);
 assert.match(sql,/base_price_snapshot/);
 assert.match(sql,/final_price/);
 assert.match(sql,/starting_at/);
 assert.match(sql,/final_price[^;]{0,300}(>\s*0|<=\s*0)/);
 assert.doesNotMatch(sql,/insert\s+into\s+public\.(recebimentos|pagamentos|commission|financial)/);
});

test('correção same-day e reabertura posterior preservam autor original e versão anterior',async()=>{
 const sql=await loadMigration();
 assert.match(sql,/america\/sao_paulo/);
 assert.match(sql,/bc_treatment_correct_same_day_impl/);
 assert.match(sql,/bc_treatment_create_reopen_grant_impl/);
 assert.match(sql,/bc_treatment_correct_reopened_impl/);
 assert.match(sql,/expires_at/);
 assert.match(sql,/author_user_id/);
 assert.match(sql,/current_version_id/);
 assert.doesNotMatch(sql,/delete\s+from\s+public\.clinical_treatment_versions/);
});

test('tabelas 6C usam RLS e browser escreve somente por wrappers autenticados',async()=>{
 const sql=await loadMigration();
 for(const table of ['clinical_treatments','clinical_treatment_components','clinical_treatment_health_confirmations','clinical_treatment_alert_reviews','clinical_treatment_versions','clinical_treatment_reopen_grants']){
   assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
   assert.match(sql,new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
 }
 for(const fn of ['bc_treatment_create','bc_treatment_get','bc_treatment_list_client','bc_treatment_update_draft','bc_treatment_confirm_health','bc_treatment_confirm_alerts','bc_treatment_prepare_consent','bc_treatment_mark_ready','bc_treatment_start','bc_treatment_finalize','bc_treatment_complete_finalize','bc_treatment_correct_same_day','bc_treatment_create_reopen_grant','bc_treatment_correct_reopened']){
   assert.match(sql,new RegExp(`create or replace function public\\.${fn}[\\s\\S]{0,700}security invoker`));
   assert.match(sql,new RegExp(`grant execute on function public\\.${fn}[\\s\\S]{0,260}authenticated`));
 }
});
