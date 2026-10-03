begin;

-- The public browser never writes directly to pre_anamneses. Authenticated
-- administrators may read records, but their direct UPDATE permission is
-- deliberately narrowed to the workflow status column only.
revoke all on table public.pre_anamneses from anon;
revoke insert, delete on table public.pre_anamneses from authenticated;
revoke update on table public.pre_anamneses from authenticated;
grant select on table public.pre_anamneses to authenticated;
grant update (status) on table public.pre_anamneses to authenticated;

-- admin_users is an authorization directory: authenticated users may only
-- read the row allowed by RLS; they cannot change their own authorization.
revoke all on table public.admin_users from anon;
revoke all on table public.admin_users from authenticated;
grant select on table public.admin_users to authenticated;

commit;
