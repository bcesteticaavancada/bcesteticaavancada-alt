begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
insert into fixture values('appointment',public.bc_agendamento_create(pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock)));
select throws_ok(format('select public.bc_recebimento_registrar_agendamento(%L,100,%L)',pg_temp.f('appointment'),'pix'),'55000','Conclua o atendimento antes de registrar o recebimento.','Não recebe antes do atendimento operacional');
insert into fixture values('treatment',public.bc_treatment_create(pg_temp.f('client'),pg_temp.f('procedure'),pg_temp.f('appointment')));
reset role;
update public.clinical_treatments set status='em_atendimento',objetivo='Teste fictício',regiao='Teste' where id=pg_temp.f('treatment');
update public.clinical_treatments set status='finalizado' where id=pg_temp.f('treatment');
select is((select status from public.agendamentos where id=pg_temp.f('appointment')),'atendido','Conclusão clínica atualiza agenda');
select is((select count(*)::integer from public.atendimentos where agendamento_id=pg_temp.f('appointment')),1,'Conclusão cria um atendimento operacional');
select isnt((select id from public.atendimentos where agendamento_id=pg_temp.f('appointment')),pg_temp.f('appointment'),'IDs são independentes');
select is((select count(*)::integer from public.recebimentos where agendamento_id=pg_temp.f('appointment')),0,'Conclusão clínica não cria pagamento');
update public.clinical_treatments set status='finalizado' where id=pg_temp.f('treatment');
select is((select count(*)::integer from public.atendimentos where agendamento_id=pg_temp.f('appointment')),1,'Regravação da conclusão não duplica atendimento');
set local role authenticated;
select lives_ok(format('select public.bc_recebimento_registrar_agendamento(%L,100,%L)',pg_temp.f('appointment'),'pix'),'Recebimento resolve atendimento por agendamento');
reset role;
select is((select count(*)::integer from public.recebimentos where agendamento_id=pg_temp.f('appointment')),1,'Recebimento fica no agendamento correto');
select is((select operacional.id from public.atendimentos operacional join public.clinical_treatments t on t.operational_attendance_id=operacional.id where t.id=pg_temp.f('treatment')),(select atendimento_id from public.recebimentos where agendamento_id=pg_temp.f('appointment')),'Clínica e financeiro usam o mesmo atendimento operacional');

select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select throws_ok(format('select public.bc_recebimento_registrar_agendamento(%L,100,%L)',pg_temp.f('appointment'),'pix'),'42501','Acesso negado ao recebimento.','Chefe de agenda não recebe por outra profissional');
reset role;
select * from finish();
rollback;
