alter table public.pre_anamneses
  add column if not exists patient_cpf text,
  add column if not exists data_authorization_accepted_at timestamptz,
  add column if not exists rubric_sha256 text,
  add column if not exists payload_sha256 text,
  add column if not exists rubric_confirmed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pre_anamneses_patient_cpf_format'
      and conrelid = 'public.pre_anamneses'::regclass
  ) then
    alter table public.pre_anamneses
      add constraint pre_anamneses_patient_cpf_format
      check (patient_cpf is null or patient_cpf ~ '^[0-9]{11}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pre_anamneses_rubric_sha256_format'
      and conrelid = 'public.pre_anamneses'::regclass
  ) then
    alter table public.pre_anamneses
      add constraint pre_anamneses_rubric_sha256_format
      check (rubric_sha256 is null or rubric_sha256 ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pre_anamneses_payload_sha256_format'
      and conrelid = 'public.pre_anamneses'::regclass
  ) then
    alter table public.pre_anamneses
      add constraint pre_anamneses_payload_sha256_format
      check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end
$$;
