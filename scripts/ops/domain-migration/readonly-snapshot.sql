-- BC Estética: aggregate continuity checkpoint (READ ONLY).
-- Project: bc-estetica-gestao / tpqsmerlxquyrzrjbogj.
-- Run twice, before and after cutover, during a controlled no-write window.
-- Never commit the results to a public repository. No identifiers or patient rows are read.
WITH counts AS (
  SELECT 'auth.users' AS entity, count(*)::int AS total FROM auth.users
  UNION ALL SELECT 'public.clientes',count(*)::int FROM public.clientes
  UNION ALL SELECT 'public.staff_profiles',count(*)::int FROM public.staff_profiles
  UNION ALL SELECT 'public.agendamentos',count(*)::int FROM public.agendamentos
  UNION ALL SELECT 'public.atendimentos',count(*)::int FROM public.atendimentos
  UNION ALL SELECT 'public.anamneses_gerais',count(*)::int FROM public.anamneses_gerais
  UNION ALL SELECT 'public.anamnese_respostas',count(*)::int FROM public.anamnese_respostas
  UNION ALL SELECT 'public.client_files',count(*)::int FROM public.client_files
  UNION ALL SELECT 'public.procedure_consents',count(*)::int FROM public.procedure_consents
  UNION ALL SELECT 'public.treatment_external_consents',count(*)::int FROM public.treatment_external_consents
  UNION ALL SELECT 'public.livros_financeiros',count(*)::int FROM public.livros_financeiros
  UNION ALL SELECT 'public.livro_financeiro_itens',count(*)::int FROM public.livro_financeiro_itens
  UNION ALL SELECT 'private.bc_finance_expenses',count(*)::int FROM private.bc_finance_expenses
  UNION ALL SELECT 'private.bc_finance_attachments',count(*)::int FROM private.bc_finance_attachments
  UNION ALL SELECT 'storage.objects.bc-prontuario-private',count(*)::int
    FROM storage.objects WHERE bucket_id='bc-prontuario-private'
  UNION ALL SELECT 'storage.objects.bc-finance-private',count(*)::int
    FROM storage.objects WHERE bucket_id='bc-finance-private'
),
private_buckets AS (
  SELECT name, NOT public AS is_private FROM storage.buckets
  WHERE name IN ('bc-prontuario-private', 'bc-finance-private')
)
SELECT jsonb_build_object(
  'schema_version', 1,
  'project', 'tpqsmerlxquyrzrjbogj',
  'captured_at_utc', to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'row_counts', (SELECT jsonb_object_agg(entity,total) FROM counts),
  'private_buckets', (SELECT jsonb_object_agg(name,is_private) FROM private_buckets),
  'backup_active', (SELECT active FROM cron.job WHERE jobname='bc-drive-backup-hourly-v1'),
  'backup_last_success_utc', (
    SELECT to_char(last_success_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
    FROM private.bc_drive_backup_control LIMIT 1)
) AS snapshot;
