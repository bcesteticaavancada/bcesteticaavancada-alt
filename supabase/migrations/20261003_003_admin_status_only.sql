begin;

revoke update on table public.pre_anamneses from authenticated;
grant update (status) on table public.pre_anamneses to authenticated;

commit;
