begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
insert into fixture values('appointment',public.bc_agendamento_create(pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock)));
select throws_ok(format('select public.bc_recebimento_registrar_agendamento_v2(gen_random_uuid(),%L,100,%L)',pg_temp.f('appointment'),'pix'),'55000','Conclua o atendimento antes de registrar o recebimento.','Não recebe antes do atendimento operacional');
insert into fixture values('treatment',public.bc_treatment_create(pg_temp.f('client'),pg_temp.f('procedure'),pg_temp.f('appointment')));
reset role;
update public.clinical_treatments set status='em_atendimento',objetivo='Teste fictício',regiao='Teste' where id=pg_temp.f('treatment');
-- A fixture financeira usa uma versão final imutável, como a conclusão real.
insert into public.clinical_treatment_versions(treatment_id,version,snapshot,created_by)
select id,1,jsonb_build_object('treatment',to_jsonb(t)),pg_temp.f('worker') from public.clinical_treatments t where id=pg_temp.f('treatment');
update public.clinical_treatments t set current_version_id=v.id from public.clinical_treatment_versions v where v.treatment_id=t.id and t.id=pg_temp.f('treatment');
update public.clinical_treatments set status='finalizado' where id=pg_temp.f('treatment');
select is((select status from public.agendamentos where id=pg_temp.f('appointment')),'atendido','Conclusão clínica atualiza agenda');
select is((select count(*)::integer from public.atendimentos where agendamento_id=pg_temp.f('appointment')),1,'Conclusão cria um atendimento operacional');
select isnt((select id from public.atendimentos where agendamento_id=pg_temp.f('appointment')),pg_temp.f('appointment'),'IDs são independentes');
select is((select count(*)::integer from public.recebimentos where agendamento_id=pg_temp.f('appointment')),0,'Conclusão clínica não cria pagamento');
update public.clinical_treatments set status='finalizado' where id=pg_temp.f('treatment');
select is((select count(*)::integer from public.atendimentos where agendamento_id=pg_temp.f('appointment')),1,'Regravação da conclusão não duplica atendimento');
set local role authenticated;
select lives_ok(format('select public.bc_recebimento_registrar_agendamento_v2(gen_random_uuid(),%L,100,%L)',pg_temp.f('appointment'),'pix'),'Recebimento resolve atendimento por agendamento');
reset role;
select is((select count(*)::integer from public.recebimentos where agendamento_id=pg_temp.f('appointment')),1,'Recebimento fica no agendamento correto');
select is((select operacional.id from public.atendimentos operacional join public.clinical_treatments t on t.operational_attendance_id=operacional.id where t.id=pg_temp.f('treatment')),(select atendimento_id from public.recebimentos where agendamento_id=pg_temp.f('appointment')),'Clínica e financeiro usam o mesmo atendimento operacional');

-- Simula uma ficha realmente criada antes desta integração, sem agenda.
set local role authenticated;
insert into fixture values('legacy-treatment',private.bc_treatment_create_impl(pg_temp.f('client'),pg_temp.f('procedure'),null,'{}'::uuid[],'{}'::text[]));
reset role;
update public.clinical_treatments set treatment_date=(select day from test_clock),status='em_atendimento',objetivo='Legado fictício',regiao='Teste' where id=pg_temp.f('legacy-treatment');
set local role authenticated;
select throws_ok(format('select public.bc_treatment_resolve_appointment(%L)',pg_temp.f('legacy-treatment')),'22023','Informe o horário real na data desta sessão.','Legado não inventa horário sem confirmação');
select lives_ok(format('select public.bc_treatment_resolve_appointment(%L,null,%L)',pg_temp.f('legacy-treatment'),(select slot+interval '1 hour' from test_clock)),'Profissional pode reservar explicitamente o horário da ficha antiga');
reset role;
update public.clinical_treatments set status='finalizado' where id=pg_temp.f('legacy-treatment');
select ok((select operational_attendance_id is not null from public.clinical_treatments where id=pg_temp.f('legacy-treatment')),'Ficha antiga pode concluir após revisar o vínculo');
update public.staff_profiles set active=false where user_id=pg_temp.f('worker');
set local role authenticated;
select throws_ok(format('select public.bc_treatment_complete_finalize(%L,%L)',pg_temp.f('legacy-treatment'),gen_random_uuid()),'42501','Acesso negado à finalização clínica.','Conta desativada é recusada antes de finalizar');
reset role;
update public.staff_profiles set active=true where user_id=pg_temp.f('worker');

-- Estado finalizado anterior à migration: o vínculo explícito recupera a integração.
set local role authenticated;
insert into fixture values('legacy-finalized',private.bc_treatment_create_impl(pg_temp.f('client'),pg_temp.f('procedure'),null,'{}'::uuid[],'{}'::text[]));
reset role;
alter table public.clinical_treatments disable trigger bc_treatment_operational_completion;
update public.clinical_treatments set treatment_date=(select day from test_clock),status='finalizado' where id=pg_temp.f('legacy-finalized');
alter table public.clinical_treatments enable trigger bc_treatment_operational_completion;
set local role authenticated;
select lives_ok(format('select public.bc_treatment_resolve_appointment(%L,null,%L)',pg_temp.f('legacy-finalized'),(select slot+interval '2 hours' from test_clock)),'Ficha antiga já finalizada pode ser integrada por revisão explícita');
reset role;
select ok((select operational_attendance_id is not null from public.clinical_treatments where id=pg_temp.f('legacy-finalized')),'Legado finalizado gera vínculo operacional');
select is((select count(*)::integer from public.recebimentos r join public.clinical_treatments t on t.agendamento_id=r.agendamento_id where t.id=pg_temp.f('legacy-finalized')),0,'Vínculo histórico não cria pagamento');

select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select is(public.bc_treatment_get(pg_temp.f('legacy-finalized'))->>'can_resolve_appointment','false','Leitura compartilhada não oferece ação exclusiva da autora');
select throws_ok(format('select public.bc_recebimento_registrar_agendamento_v2(gen_random_uuid(),%L,100,%L)',pg_temp.f('appointment'),'pix'),'42501','Acesso negado ao recebimento.','Chefe de agenda não recebe por outra profissional');
reset role;
select * from finish();
rollback;
