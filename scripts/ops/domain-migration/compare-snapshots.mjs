#!/usr/bin/env node
// Offline, read-only comparison of aggregate snapshots. Never prints source records.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PROJECT = 'tpqsmerlxquyrzrjbogj';
const BUCKETS = ['bc-prontuario-private', 'bc-finance-private'];
const CRITICAL = [
  'auth.users',
  'public.clientes',
  'public.staff_profiles',
  'public.agendamentos',
  'public.atendimentos',
  'public.anamneses_gerais',
  'public.anamnese_respostas',
  'public.client_files',
  'public.procedure_consents',
  'public.treatment_external_consents',
  'public.livros_financeiros',
  'public.livro_financeiro_itens',
  'private.bc_finance_expenses',
  'private.bc_finance_attachments',
  'storage.objects.bc-prontuario-private',
  'storage.objects.bc-finance-private',
];

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function compareSnapshots(before, after) {
  const problems = [];
  for (const [label, value] of [['before', before], ['after', after]]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      problems.push(label + ': expected a snapshot object');
      continue;
    }
    if (value.schema_version !== 1 || value.project !== PROJECT) {
      problems.push(label + ': unexpected snapshot version or Supabase project');
    }
    for (const key of CRITICAL) {
      if (!safeInteger(value.row_counts?.[key])) problems.push(label + ': missing/invalid total for ' + key);
    }
    for (const bucket of BUCKETS) {
      if (value.private_buckets?.[bucket] !== true) {
        problems.push(label + ': ' + bucket + ' is missing or not private');
      }
    }
    if (value.backup_active !== true) problems.push(label + ': clinical backup cron is not active');
  }
  if (problems.length) return { ok: false, problems };
  // Strict only for a controlled no-write cutover window. Equal counts alone
  // do not certify individual row integrity or full recoverability.
  for (const key of CRITICAL) {
    if (before.row_counts[key] !== after.row_counts[key]) {
      problems.push('changed total for ' + key + ': requires manual review');
    }
  }
  const oldSuccess = Date.parse(before.backup_last_success_utc);
  const newSuccess = Date.parse(after.backup_last_success_utc);
  if (!Number.isFinite(oldSuccess) || !Number.isFinite(newSuccess) || newSuccess < oldSuccess) {
    problems.push('clinical backup last-success timestamp missing or regressed');
  }
  return { ok: problems.length === 0, problems };
}

function main(argv) {
  if (argv.length !== 2) {
    console.error('Usage: node compare-snapshots.mjs <before-private.json> <after-private.json>');
    process.exitCode = 2;
    return;
  }
  try {
    const result = compareSnapshots(...argv.map(path => JSON.parse(readFileSync(path, 'utf8'))));
    if (result.ok) {
      console.log('PASS: same Supabase project, stable aggregate totals, private buckets and active backup.');
      console.log('NOTE: this does NOT certify individual records, logins or database restore; run manual gate tests.');
    } else {
      console.error('BLOCK CUTOVER: ' + result.problems.length + ' preservation checks did not pass.');
      for (const problem of result.problems) console.error('- ' + problem);
      process.exitCode = 1;
    }
  } catch {
    console.error('BLOCK CUTOVER: invalid or unreadable snapshot file.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
