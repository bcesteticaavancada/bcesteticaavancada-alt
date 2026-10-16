-- Regression contract for the eleven RLS performance recommendations.
-- Only disposable CI fixtures; all changes roll back. No grants are broadened.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

select is((
 with expanded as (
   select p.tablename, p.policyname, c.command
   from pg_policies p cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) c(command)
   where p.schemaname='public'
     and p.tablename in ('staff_profiles','procedimentos','agendamentos','clientes','atendimentos')
     and p.permissive='PERMISSIVE' and 'authenticated'=any(p.roles)
     and (p.cmd='ALL' or p.cmd=c.command)
 ), duplicated as (select tablename, command from expanded group by tablename,command having count(*)>1)
 select count(*)::integer from duplicated
),0,'Authenticated has one permissive policy per command, without overlapping ALL policies');

insert into fixture values
 ('legacy_admin','a2000000-0000-4000-8000-000000000001'),
 ('outsider','a2000000-0000-4000-8000-000000000002'),
 ('inactive','a2000000-0000-4000-8000-000000000003'),
 ('inactive_legacy','a2000000-0000-4000-8000-000000000004');
insert into auth.users(instance_id,id,aud,role,email,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',name||'-rls@example.invalid',now(),now()
from fixture where name in ('legacy_admin','outsider','inactive','inactive_legacy');
insert into public.staff_profiles(user_id,display_name,role,active,atende_clientes)
values(pg_temp.f('inactive'),'Inactive fictitious','colaborador',false,false);
insert into public.admin_users(user_id,display_name,active)
values(pg_temp.f('legacy_admin'),'Legacy fictitious',true),(pg_temp.f('inactive_legacy'),'Inactive legacy fictitious',false);
insert into public.pre_anamneses(public_code,patient_name,patient_phone,procedure,source_version)
values('RLS-ONLY-FICTITIOUS','Fictitious patient','31900000000','Fictitious procedure','CI');
insert into public.agendamentos(id,cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,created_by,origem)
select 'a3000000-0000-4000-8000-000000000001',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),slot,slot+interval '30 minutes',pg_temp.f('admin'),'agenda' from test_clock;
insert into public.agendamentos(id,cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,created_by,origem)
select 'a3000000-0000-4000-8000-000000000002',pg_temp.f('client'),pg_temp.f('ordinary'),pg_temp.f('procedure'),slot,slot+interval '30 minutes',pg_temp.f('admin'),'encaixe' from test_clock;
insert into public.agendamentos(id,cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,created_by,origem)
select 'a3000000-0000-4000-8000-000000000003',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),slot+interval '2 hours',slot+interval '150 minutes',pg_temp.f('admin'),'agenda' from test_clock;
insert into public.atendimentos(agendamento_id,cliente_id,colaboradora_user_id,procedimento_id,created_by)
values('a3000000-0000-4000-8000-000000000001',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),pg_temp.f('worker'));

select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),5,'admin: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),1,'admin: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),1,'admin: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),3,'admin: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),1,'admin: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),0,'admin: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),0,'admin: preserves visibility of pre_anamneses');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),1,'chief: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),1,'chief: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),1,'chief: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),3,'chief: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),1,'chief: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),0,'chief: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),0,'chief: preserves visibility of pre_anamneses');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),1,'worker: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),1,'worker: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),1,'worker: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),2,'worker: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),1,'worker: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),0,'worker: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),0,'worker: preserves visibility of pre_anamneses');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),1,'ordinary: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),1,'ordinary: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),1,'ordinary: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),1,'ordinary: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),1,'ordinary: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),0,'ordinary: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),0,'ordinary: preserves visibility of pre_anamneses');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('inactive')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),1,'inactive: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),0,'inactive: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),0,'inactive: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),0,'inactive: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),0,'inactive: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),0,'inactive: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),0,'inactive: preserves visibility of pre_anamneses');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('outsider')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),0,'outsider: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),0,'outsider: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),0,'outsider: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),0,'outsider: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),0,'outsider: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),0,'outsider: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),0,'outsider: preserves visibility of pre_anamneses');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('legacy_admin')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),0,'legacy_admin: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),0,'legacy_admin: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),0,'legacy_admin: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),0,'legacy_admin: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),0,'legacy_admin: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),1,'legacy_admin: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),1,'legacy_admin: preserves visibility of pre_anamneses');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('inactive_legacy')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.staff_profiles where true),0,'inactive_legacy: preserves visibility of staff_profiles');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),0,'inactive_legacy: preserves visibility of clientes');
select is((select count(*)::integer from public.procedimentos where id=pg_temp.f('procedure')),0,'inactive_legacy: preserves visibility of procedimentos');
select is((select count(*)::integer from public.agendamentos where true),0,'inactive_legacy: preserves visibility of agendamentos');
select is((select count(*)::integer from public.atendimentos where true),0,'inactive_legacy: preserves visibility of atendimentos');
select is((select count(*)::integer from public.admin_users where true),0,'inactive_legacy: preserves visibility of admin_users');
select is((select count(*)::integer from public.pre_anamneses where public_code='RLS-ONLY-FICTITIOUS'),0,'inactive_legacy: preserves visibility of pre_anamneses');
reset role;

-- Anonymous callers keep no direct access to these operational tables.
select ok(not has_table_privilege('anon','public.staff_profiles','SELECT'),'anon cannot read profiles');
select ok(not has_table_privilege('anon','public.clientes','SELECT'),'anon cannot read clients');
select ok(not has_table_privilege('anon','public.atendimentos','SELECT'),'anon cannot read attendance');
select ok(not has_table_privilege('anon','public.pre_anamneses','SELECT'),'anon cannot read legacy pre-anamneses');

select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
with changed as (update public.staff_profiles set role='admin' where user_id=pg_temp.f('chief') returning user_id)
select is(count(*)::integer,0,'Chief still cannot promote herself') from changed;
select throws_ok(format('insert into public.atendimentos(agendamento_id,cliente_id,colaboradora_user_id,procedimento_id,created_by) values(%L,%L,%L,%L,%L)',
 'a3000000-0000-4000-8000-000000000003',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),pg_temp.f('chief')),
 '42501',null,'Chief cannot register another professionals clinical attendance');
with changed as (update public.atendimentos set observacoes='denied' returning id)
select is(count(*)::integer,0,'Chief cannot edit shared clinical history') from changed;
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
select lives_ok(format('insert into public.atendimentos(agendamento_id,cliente_id,colaboradora_user_id,procedimento_id,created_by) values(%L,%L,%L,%L,%L)',
 'a3000000-0000-4000-8000-000000000003',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),pg_temp.f('worker')),
 'Worker can register her own correctly linked attendance');
with changed as (update public.atendimentos set observacoes='denied' returning id)
select is(count(*)::integer,0,'Worker still cannot edit completed clinical history directly') from changed;
select throws_ok(format('insert into public.clientes(nome,telefone,created_by) values(%L,%L,%L)',
 'Unauthorized fictitious','31900000001',pg_temp.f('worker')),'42501',null,'Worker still cannot create client directly');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('legacy_admin')::text,true);
set local role authenticated;
with changed as (update public.pre_anamneses set status='em_avaliacao' where public_code='RLS-ONLY-FICTITIOUS' returning id)
select is(count(*)::integer,1,'Active legacy admin retains status-update access') from changed;
select throws_ok($$update public.pre_anamneses set patient_name='denied' where public_code='RLS-ONLY-FICTITIOUS'$$,
 '42501',null,'Legacy admin still cannot update clinical identity columns');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
with changed as (update public.staff_profiles set display_name=display_name where user_id=pg_temp.f('worker') returning user_id)
select is(count(*)::integer,1,'Admin retains profile update') from changed;
with changed as (update public.clientes set nome=nome where id=pg_temp.f('client') returning id)
select is(count(*)::integer,1,'Admin retains client update') from changed;
with changed as (update public.procedimentos set nome=nome where id=pg_temp.f('procedure') returning id)
select is(count(*)::integer,1,'Admin retains catalog update') from changed;
with changed as (update public.agendamentos set observacao_administrativa='Fictitious CI' where id='a3000000-0000-4000-8000-000000000002' returning id)
select is(count(*)::integer,1,'Admin retains appointment update') from changed;
with changed as (update public.atendimentos set observacoes='Fictitious CI' where agendamento_id='a3000000-0000-4000-8000-000000000001' returning id)
select is(count(*)::integer,1,'Admin retains attendance update') from changed;
select lives_ok(format('insert into public.atendimentos(agendamento_id,cliente_id,colaboradora_user_id,procedimento_id,created_by) values(%L,%L,%L,%L,%L)',
 'a3000000-0000-4000-8000-000000000002',pg_temp.f('client'),pg_temp.f('ordinary'),pg_temp.f('procedure'),pg_temp.f('admin')),
 'Admin retains attendance insert for any professional');
reset role;
select * from finish();
rollback;
