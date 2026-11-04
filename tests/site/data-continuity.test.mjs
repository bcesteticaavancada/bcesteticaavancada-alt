import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareSnapshots } from '../../scripts/ops/domain-migration/compare-snapshots.mjs';
import { SUPABASE_URL } from '../../gestao/js/config.js';
import { SUPABASE_URL as BOOKING_URL } from '../../agendamento/js/config.js';

// Entirely synthetic aggregate data: never include real patient records or a live snapshot.
const baseline = {
  schema_version: 1,
  project: 'tpqsmerlxquyrzrjbogj',
  row_counts: {
    'auth.users': 3,
    'public.clientes': 8,
    'public.staff_profiles': 3,
    'public.agendamentos': 2,
    'public.atendimentos': 2,
    'public.anamneses_gerais': 3,
    'public.anamnese_respostas': 18,
    'public.client_files': 3,
    'public.procedure_consents': 0,
    'public.treatment_external_consents': 2,
    'public.livros_financeiros': 0,
    'public.livro_financeiro_itens': 0,
    'private.bc_finance_expenses': 0,
    'private.bc_finance_attachments': 0,
    'storage.objects.bc-prontuario-private': 7,
    'storage.objects.bc-finance-private': 0,
  },
  private_buckets: { 'bc-prontuario-private': true, 'bc-finance-private': true },
  backup_active: true,
  backup_last_success_utc: '2026-10-28T23:00:00Z',
};

test('BC Gestão and agenda keep one official Supabase project', () => {
  assert.equal(SUPABASE_URL, 'https://tpqsmerlxquyrzrjbogj.supabase.co');
  assert.equal(BOOKING_URL, SUPABASE_URL);
});

test('continuity gate accepts equal synthetic counts and private buckets', () => {
  assert.equal(compareSnapshots(baseline, structuredClone(baseline)).ok, true);
});

test('continuity gate blocks deletion of clients, appointments, or users', () => {
  for (const entity of ['public.clientes', 'public.agendamentos', 'auth.users']) {
    const after = structuredClone(baseline);
    after.row_counts[entity]--;
    const result = compareSnapshots(baseline, after);
    assert.equal(result.ok, false);
    assert.ok(result.problems.some(x => x.includes(entity)));
  }
});

test('continuity gate blocks backend change and public storage', () => {
  const after = structuredClone(baseline);
  after.project = 'wrong-project';
  assert.equal(compareSnapshots(baseline, after).ok, false);
  after.project = baseline.project;
  after.private_buckets['bc-prontuario-private'] = false;
  assert.equal(compareSnapshots(baseline, after).ok, false);
});

test('continuity gate blocks missing metrics or disabled backup', () => {
  const after = structuredClone(baseline);
  delete after.row_counts['public.anamnese_respostas'];
  assert.equal(compareSnapshots(baseline, after).ok, false);
  after.row_counts['public.anamnese_respostas'] = baseline.row_counts['public.anamnese_respostas'];
  after.backup_active = false;
  assert.equal(compareSnapshots(baseline, after).ok, false);
});

test('read-only checkpoint SQL contains no write, DDL or permission change statements', () => {
  const sql = readFileSync(new URL('../../scripts/ops/domain-migration/readonly-snapshot.sql', import.meta.url), 'utf8');
  const uncommented = sql.split('\n').filter(x => !/^\s*--/.test(x)).join('\n');
  assert.match(uncommented, /^\s*WITH\s+counts\s+AS/);
  assert.doesNotMatch(uncommented, /\b(?:insert|update|delete|drop|truncate|alter|grant|revoke|create)\s+/i);
  assert.match(sql, /tpqsmerlxquyrzrjbogj/);
});
