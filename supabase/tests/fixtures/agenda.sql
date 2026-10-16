-- Exclusivamente para o Supabase local descartável. Nunca executar em produção.
create temporary table fixture (name text primary key, id uuid not null);
insert into fixture values
 ('admin','a1000000-0000-4000-8000-000000000001'),
 ('chief','a1000000-0000-4000-8000-000000000002'),
 ('worker','a1000000-0000-4000-8000-000000000003'),
 ('ordinary','a1000000-0000-4000-8000-000000000004'),
 ('client','a1000000-0000-4000-8000-000000000005'),
 ('procedure','a1000000-0000-4000-8000-000000000006'),
 ('version','a1000000-0000-4000-8000-000000000007');
grant select, insert, update on fixture to authenticated, service_role;
create function pg_temp.f(text) returns uuid language sql as $$select id from fixture where name=$1$$;
create temporary table test_clock as select
 (date_trunc('hour',now()) + interval '2 hours') as slot,
 ((date_trunc('hour',now()) + interval '2 hours') at time zone 'America/Sao_Paulo')::date as day;
grant select on test_clock to authenticated, service_role;
insert into auth.users(instance_id,id,aud,role,email,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',name||'-agenda@example.invalid',now(),now()
from fixture where name in ('admin','chief','worker','ordinary');
insert into public.staff_profiles(user_id,display_name,role,active,atende_clientes,pode_gerenciar_agendas)
select id,'Teste '||name,case when name='admin' then 'admin' else 'colaborador' end,true,true,name='chief'
from fixture where name in ('admin','chief','worker','ordinary');
insert into public.clientes(id,nome,telefone,created_by) values(pg_temp.f('client'),'Pessoa fictícia CI','31900000000',pg_temp.f('admin'));
insert into public.procedimentos(id,nome,duracao_padrao,ativo,created_by) values(pg_temp.f('procedure'),'Procedimento fictício CI',30,true,pg_temp.f('admin'));
insert into public.procedure_versions(id,procedimento_id,version,status,classe_documental,price_mode,base_price,created_by)
values(pg_temp.f('version'),pg_temp.f('procedure'),1,'published','nao_injetavel','fixed',100,pg_temp.f('admin'));
update public.procedimentos set current_version_id=pg_temp.f('version'),access_mode='general' where id=pg_temp.f('procedure');
insert into public.professional_availability_days(professional_user_id,local_date,enabled,start_time,end_time,created_by,updated_by)
select pg_temp.f('worker'),day,true,'00:00','23:59',pg_temp.f('admin'),pg_temp.f('admin') from test_clock;
