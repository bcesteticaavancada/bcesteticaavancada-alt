-- Read-only catalog audit. Safe to run before/after 2026-10-30.
-- No patient, staff, appointment or financial rows are read.
select n.nspname as schema_name,c.relname as table_name,
       c.relrowsecurity as rls_enabled,r.rolname as role_name,
       has_table_privilege(r.oid,c.oid,'SELECT') as can_select,
       has_table_privilege(r.oid,c.oid,'INSERT') as can_insert,
       has_table_privilege(r.oid,c.oid,'UPDATE') as can_update,
       has_table_privilege(r.oid,c.oid,'DELETE') as can_delete,
       (select count(*) from pg_policies p
        where p.schemaname=n.nspname and p.tablename=c.relname) as policy_count
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join pg_roles r
where n.nspname in ('public','private') and c.relkind in ('r','p')
  and r.rolname in ('anon','authenticated','service_role')
order by n.nspname,c.relname,r.rolname;

select pg_get_userbyid(d.defaclrole) as creator_role,n.nspname as schema_name,
       d.defaclobjtype as object_type,d.defaclacl as default_acl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
where n.nspname='public' or d.defaclnamespace=0
order by 1,2,3;

select n.nspname as schema_name,c.relname as sequence_name,r.rolname as role_name,
       has_sequence_privilege(r.oid,c.oid,'USAGE') as can_use,
       has_sequence_privilege(r.oid,c.oid,'SELECT') as can_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join pg_roles r
where n.nspname in ('public','private') and c.relkind='S'
  and r.rolname in ('anon','authenticated','service_role')
order by 1,2,3;

select n.nspname as schema_name,p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,r.rolname as role_name,
       has_function_privilege(r.oid,p.oid,'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join pg_roles r
where n.nspname='public'
  and p.proname in ('bc_public_agenda_catalog','bc_public_agenda_professionals',
    'bc_public_agenda_slots','bc_public_agenda_month','bc_public_agenda_overview',
    'bc_public_agenda_book','bc_public_agenda_book_v2','bc_public_agenda_recover',
    'bc_pre_anamnese_rate_limit')
  and r.rolname in ('anon','authenticated','service_role')
order by 2,3,5;
