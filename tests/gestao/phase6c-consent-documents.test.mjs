import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  prepareProcedureConsent,
  finalizeProcedureConsent,
} from '../../gestao/js/clinical-documents-api.js';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);

async function loadMigration() {
  const names = await readdir(migrationsDir);
  const name = names.find((item) => item.includes('phase6c_documents') && item.endsWith('.sql'));
  assert.ok(name, 'migration phase6c_documents deve existir');
  return (await readFile(new URL(name, migrationsDir), 'utf8')).toLowerCase();
}

function rpcClient(result = { data: 'ok', error: null }) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(name, payload) {
        calls.push([name, payload]);
        return result;
      },
    },
  };
}

test('6C cria templates versionados e vínculo de consentimento sem alterar anamnese 6B', async () => {
  const sql = await loadMigration();
  assert.match(sql, /create table if not exists public\.consent_template_versions/);
  assert.match(sql, /create table if not exists public\.procedure_consents/);
  assert.match(sql, /consentimento_procedimento/);
  assert.match(sql, /anamnese_geral/);
  assert.doesNotMatch(sql, /drop table[^;]*clinical_documents/);
});

test('seed publica dois TCLEs mestres institucionais v1', async () => {
  const sql = await loadMigration();
  for (const klass of ['injetavel', 'nao_injetavel']) {
    assert.match(sql, new RegExp(`['"]${klass}['"][\\s\\S]{0,800}1`));
  }
  assert.match(sql, /resultado[^;]{0,180}(não|nao)[^;]{0,100}garant/);
  assert.match(sql, /produto[^;]{0,180}regulariz/);
  assert.match(sql, /riscos/);
  assert.match(sql, /orientações|orientacoes/);
});

test('prepare resolve classe server-side por versão e componentes reais/dinâmicos', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_treatment_prepare_consent_impl/);
  assert.match(sql, /procedure_versions/);
  assert.match(sql, /procedure_version_components/);
  assert.match(sql, /component_options/);
  assert.match(sql, /classe_documental/);
  assert.match(sql, /injetavel/);
});

test('reuso não injetável exige ciclo explícito e mesmas versões; injetável nunca reutiliza', async () => {
  const sql = await loadMigration();
  assert.match(sql, /p_cycle_key/);
  assert.match(sql, /v_class\s*=\s*'nao_injetavel'/);
  assert.match(sql, /procedure_version_id\s*=\s*p_procedure_version_id/);
  assert.match(sql, /consent_template_version_id\s*=\s*v_template\.id/);
  assert.match(sql, /cycle_key\s*=\s*nullif/);
});

test('finalização do TCLE exige assinaturas e mantém fluxo separado da anamnese', async () => {
  const sql = await loadMigration();
  assert.match(sql, /bc_treatment_consent_finalize_impl/);
  assert.match(sql, /clinical_signatures/);
  assert.match(sql, /signer_kind='profissional'/);
  assert.match(sql, /signer_kind=v_expected_kind/);
  assert.match(sql, /pronto_para_pdf/);
  assert.match(sql, /document_type='consentimento_procedimento'/);
});

test('RPCs públicas são invoker e não abrem escrita direta de consentimentos', async () => {
  const sql = await loadMigration();
  for (const fn of ['bc_treatment_prepare_consent','bc_treatment_consent_finalize']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}[\\s\\S]{0,500}security invoker`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]{0,180}authenticated`));
  }
  assert.match(sql, /revoke all on public\.procedure_consents from anon, authenticated/);
});

test('API prepara consentimento sem enviar autoria ou classe forjada', async () => {
  const mock = rpcClient();
  await prepareProcedureConsent({
    client: mock.client,
    clienteId: 'c1',
    procedureVersionId: 'pv1',
    componentVersionIds: ['pv2'],
    componentKeys: ['via_injetavel'],
    cycleKey: 'ciclo-1',
    profissionalUserId: 'NUNCA-ENVIAR',
    consentClass: 'NUNCA-ENVIAR',
  });
  assert.deepEqual(mock.calls[0], ['bc_treatment_prepare_consent', {
    p_cliente_id: 'c1',
    p_procedure_version_id: 'pv1',
    p_component_version_ids: ['pv2'],
    p_component_keys: ['via_injetavel'],
    p_cycle_key: 'ciclo-1',
  }]);
  assert.equal(JSON.stringify(mock.calls[0]).includes('NUNCA-ENVIAR'), false);
});

test('API finaliza consentimento apenas pelo documentId', async () => {
  const mock = rpcClient();
  await finalizeProcedureConsent({ client: mock.client, documentId: 'd1' });
  assert.deepEqual(mock.calls[0], ['bc_treatment_consent_finalize', { p_document_id: 'd1' }]);
});
