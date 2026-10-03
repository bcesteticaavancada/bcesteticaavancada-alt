begin;
alter table public.pre_anamneses add column if not exists submission_token text;
create unique index if not exists pre_anamneses_submission_token_uidx
  on public.pre_anamneses (submission_token)
  where submission_token is not null;
commit;
