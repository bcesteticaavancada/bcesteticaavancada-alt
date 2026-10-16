begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
insert into fixture values('overnight',public.bc_agendamento_create(
  pg_temp.f('client'),pg_temp.f('chief'),pg_temp.f('procedure'),
  ((select day+3 from test_clock)+time '23:45') at time zone 'America/Sao_Paulo',
  ((select day+4 from test_clock)+time '00:15') at time zone 'America/Sao_Paulo'));
create temporary table inactive_result as select public.bc_agenda_inactivation_create(
  pg_temp.f('chief'),(select day+4 from test_clock),null,'ferias','Teste fictício de meia-noite') as result;
select is((select (result->>'affected_appointments')::integer from inactive_result),1,
  'Inativação avisa sobre compromisso da véspera que atravessa a meia-noite');
select is((select status from public.agendamentos where id=pg_temp.f('overnight')),'agendado',
  'Inativação preserva compromisso existente');
select lives_ok(format('select public.bc_agenda_reactivate(%L)',
  (select result->>'id' from inactive_result)),'Admin reativa agenda sem apagar compromisso');
reset role;
select * from finish();
rollback;
