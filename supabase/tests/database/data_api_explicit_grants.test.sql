-- Disposable replay only. Every fixture and probe is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is((
  select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
),0,'Every exposed public table retains RLS');

select is((
  select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege
  where n.nspname='public' and c.relkind in ('r','p')
    and not has_table_privilege('service_role',c.oid,privilege)
),0,'service_role has explicit DML on each current public table, even without auto-grants');

select is((
  select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege
  where n.nspname='public' and c.relkind in ('r','p')
    and has_table_privilege('anon',c.oid,privilege)
),0,'anon cannot directly access patient, agenda, staff or financial tables');

select is((
  select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join unnest(array['INSERT','UPDATE','DELETE']) privilege
  where n.nspname='public' and c.relkind in ('r','p')
    and c.relname not in ('staff_profiles','clientes','procedimentos','agendamentos','atendimentos','pagamentos')
    and has_table_privilege('authenticated',c.oid,privilege)
),0,'authenticated has no new table-wide write grants outside the six core tables');

select is((
  select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and c.relname not in (
      'staff_profiles','clientes','procedimentos','agendamentos','atendimentos','pagamentos',
      'audit_log','cliente_identificacao_fotos','anamnese_template_versions','anamneses_gerais',
      'anamnese_respostas','anamnese_confirmacoes_clinicas','clinical_alerts','clinical_documents',
      'clinical_signatures','procedure_versions','procedure_version_components','procedure_aliases',
      'procedure_professional_permissions','admin_users','pre_anamneses')
    and has_table_privilege('authenticated',c.oid,'SELECT')
),0,'RPC-only tables stay closed even where a SELECT policy exists');

select ok(not has_column_privilege('authenticated','public.pre_anamneses','patient_name','UPDATE'),
  'Legacy anamnesis does not permit editing clinical content');
select ok(has_column_privilege('authenticated','public.pre_anamneses','status','UPDATE'),
  'Legacy status-only update grant survives replay');

select is((
  select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join (values ('anon'),('authenticated')) r(role_name)
  where n.nspname='private' and c.relkind in ('r','p')
    and has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE')
),0,'Private anti-abuse and booking tables have no browser grants');
select is((
  select count(*)::integer from (values ('anon'),('authenticated')) r(role_name)
  cross join unnest(array['USAGE','SELECT','UPDATE']) privilege
  where has_sequence_privilege(r.role_name,'private.public_booking_rate_limits_id_seq',privilege)
),0,'Private identity sequence remains inaccessible to both browser roles');

\ir ../fixtures/agenda.psql
insert into auth.users(id,email) values
 ('a4000000-0000-4000-8000-000000000001','outsider-data-api@example.invalid'),
 ('a4000000-0000-4000-8000-000000000002','legacy-data-api@example.invalid');
insert into public.admin_users(user_id,display_name,active)
 values('a4000000-0000-4000-8000-000000000002','Legacy fictitious',true);
insert into public.pre_anamneses(public_code,patient_name,patient_phone,procedure,source_version)
 values('DATA-API-FICTITIOUS','Fictitious patient','31900000000','Fictitious procedure','CI');

select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles),4,'Admin still reads the complete staff');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),1,'Admin retains client access');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles),1,'Collaborator retains self-profile scope');
select is((select count(*)::integer from public.pagamentos),0,'Collaborator has no administrative financial rows');
select throws_ok('select * from public.recebimentos','42501',null,'Financial receipts remain RPC-only');
select throws_ok('select * from public.clinical_treatments','42501',null,'Clinical treatment tables remain RPC-only');
reset role;

select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*)::integer from public.clientes),0,'Signed-in outsider cannot read clients');
reset role;

select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.pre_anamneses where public_code='DATA-API-FICTITIOUS'),1,
 'Legacy administrator can read anamnesis after reset');
reset role;

set local role service_role;
select is((select count(*)::integer from public.staff_profiles),4,'Server PDF staff lookup works through service_role');
select lives_ok('select * from public.clinical_documents limit 0','Server PDF document lookup has a table grant');
select lives_ok('select public.bc_public_agenda_catalog()','Public agenda backend RPC remains callable');
select lives_ok($$insert into public.clientes(nome,telefone) values('Server fictitious grant test','31900000000')$$,
 'service_role can insert a fictitious client');
select lives_ok($$update public.clientes set nome='Server fictitious updated' where nome='Server fictitious grant test'$$,
 'service_role can update the fictitious client');
select lives_ok($$delete from public.clientes where nome='Server fictitious updated'$$,
 'service_role can delete its fictitious fixture');
reset role;

set local role anon;
select throws_ok('select * from public.clientes','42501',null,'anon remains blocked from patient rows');
select throws_ok('select public.bc_public_agenda_catalog()','42501',null,'anon cannot bypass the public agenda Edge Function');
reset role;

-- Security expectations for the next migration, not just existing objects.
create table public.bc_data_api_future_probe (id bigint generated by default as identity);
alter table public.bc_data_api_future_probe enable row level security;
create policy future_probe on public.bc_data_api_future_probe for select to authenticated using(true);
select ok(not has_table_privilege('anon','public.bc_data_api_future_probe','SELECT,INSERT,UPDATE,DELETE'),
 'New tables do not auto-expose to anon');
select ok(not has_table_privilege('authenticated','public.bc_data_api_future_probe','SELECT,INSERT,UPDATE,DELETE'),
 'A policy does not replace an explicit authenticated grant');
select ok(not has_table_privilege('service_role','public.bc_data_api_future_probe','SELECT,INSERT,UPDATE,DELETE'),
 'BYPASSRLS does not replace an explicit service_role grant');
select is((
  select count(*)::integer from (values ('anon'),('authenticated')) r(role_name)
  cross join unnest(array['USAGE','SELECT']) privilege
  where has_sequence_privilege(r.role_name,'public.bc_data_api_future_probe_id_seq',privilege)
),0,'Future identity sequences do not auto-expose to either browser role');

select * from finish();
rollback;
