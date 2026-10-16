begin;
create extension if not exists pgtap with schema extensions;
-- Nenhum teste pode fabricar disponibilidade em mês futuro nos últimos
-- minutos do mês civil. Todos os demais dias executam o fluxo completo.
select (now() at time zone 'America/Sao_Paulo') <
 (date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month - 1 hour') as has_public_window \gset
\if :has_public_window
select no_plan();
\ir ../fixtures/agenda.psql

select has_column('public','agendamentos','booking_channel','Canal não reutiliza a semântica operacional de origem');
select ok((select relrowsecurity from pg_class where oid='public.agendamentos'::regclass),'RLS da agenda está habilitada');
select ok(not has_table_privilege('anon','public.agendamentos','SELECT'),'Público não lê compromissos');
select ok(not has_table_privilege('anon','public.clientes','SELECT'),'Público não lê clientes');
select ok(not has_function_privilege('anon','public.bc_agenda_list(timestamptz,timestamptz,text)','EXECUTE'),'Público não lê RPC interna');
select ok(public.bc_public_agenda_catalog() @> jsonb_build_array(jsonb_build_object('id',pg_temp.f('procedure'))),'Catálogo inclui procedimento publicado com duração');
select ok(public.bc_public_agenda_professionals(pg_temp.f('procedure')) @> jsonb_build_array(jsonb_build_object('id',pg_temp.f('worker'))),'Profissional autorizada aparece');
update public.procedimentos set access_mode='restricted' where id=pg_temp.f('procedure');
select is(public.bc_public_agenda_professionals(pg_temp.f('procedure')),'[]'::jsonb,'Restrito não vaza profissionais não autorizadas');
insert into public.procedure_professional_permissions(procedimento_id,professional_user_id,allowed,granted_by) values(pg_temp.f('procedure'),pg_temp.f('worker'),true,pg_temp.f('admin'));
select is(jsonb_array_length(public.bc_public_agenda_professionals(pg_temp.f('procedure'))),1,'Somente profissional autorizada no procedimento restrito');
update public.procedimentos set duracao_padrao=null where id=pg_temp.f('procedure');
select ok(not public.bc_public_agenda_catalog() @> jsonb_build_array(jsonb_build_object('id',pg_temp.f('procedure'))),'Procedimento sem duração não é oferecido');
update public.procedimentos set duracao_padrao=30 where id=pg_temp.f('procedure');
select ok(jsonb_array_length(public.bc_public_agenda_slots(pg_temp.f('worker'),pg_temp.f('procedure'),(select day from test_clock)))>0,'Disponibilidade explícita produz horários');
select throws_ok(format('select public.bc_public_agenda_month(%L,%L,%L)',pg_temp.f('worker'),pg_temp.f('procedure'),(date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month')::date),'22023','Data fora do mês disponível.','Site recusa mês futuro');
select is(jsonb_array_length(public.bc_public_agenda_month(pg_temp.f('worker'),pg_temp.f('procedure'),date_trunc('month',now() at time zone 'America/Sao_Paulo')::date)),extract(day from date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month - 1 day')::integer,'Calendário contém mês civil inteiro');

set local role service_role;
insert into fixture values('site',(public.bc_public_agenda_book('Pessoa Site CI','(31) 90000-0000',pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock),repeat('a',64))->>'appointment_id')::uuid);
reset role;
select is((select cliente_id from public.agendamentos where id=pg_temp.f('site')),null::uuid,'Reserva não cria nem associa paciente formal');
select is((select count(*)::integer from public.clientes),1,'Nenhum paciente extra foi criado');
select is((select booking_channel from public.agendamentos where id=pg_temp.f('site')),'site','Canal da reserva é site');
select throws_ok(format('insert into public.atendimentos(agendamento_id,cliente_id,colaboradora_user_id,procedimento_id,data_atendimento,created_by) values(%L,%L,%L,%L,now(),%L)',pg_temp.f('site'),pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),pg_temp.f('worker')),'55000','Cadastro da cliente precisa ser vinculado antes do atendimento.','Reserva sem cadastro não abre atendimento clínico');
select is((select origem from public.agendamentos where id=pg_temp.f('site')),'agenda','Origem operacional de reserva pública continua agenda');
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
select throws_ok(format('select public.bc_set_agendamento_status(%L,%L)',pg_temp.f('site'),'atendido'),'55000','Cadastro da cliente precisa ser vinculado antes do atendimento.','Nem Admin conclui reserva pendente sem cadastro');
select is((select public_booking_phone_normalized from public.agendamentos where id=pg_temp.f('site')),'31900000000','WhatsApp normalizado');
select is((select fim-inicio from public.agendamentos where id=pg_temp.f('site')),interval '30 minutes','Duração bloqueia intervalo completo');
select ok(not public.bc_public_agenda_slots(pg_temp.f('worker'),pg_temp.f('procedure'),(select day from test_clock)) @> jsonb_build_array(jsonb_build_object('start_at',(select slot from test_clock))),'Reserva desaparece da disponibilidade');
select is(public.bc_public_agenda_book('Outra Pessoa','31900000001',pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock),repeat('b',64))->>'error_code','23P01','Segunda reserva pública conflita de forma controlada');
select is((select count(*)::integer from private.public_booking_rate_limits where origin_hash=repeat('b',64)),1,'Tentativa recusada consome rate limit');

select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'site')),1,'Chefe vê reserva Site de outra profissional');
select throws_ok(format('select public.bc_agendamento_create(%L,%L,%L,%L)',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock)),'23P01','slot_unavailable','Interna não ignora reserva Site');
insert into fixture values('internal',public.bc_agendamento_create(pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),(select slot+interval '1 hour' from test_clock)));
select lives_ok(format('select public.bc_agendamento_update(%L,%L,%L)',pg_temp.f('internal'),pg_temp.f('procedure'),(select slot+interval '90 minutes' from test_clock)),'Chefe remarca agenda de outra profissional');
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'all')),2,'Geral reúne site e interna na mesma tabela');
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'internal')),1,'Interna filtra somente canal interno');
select throws_ok(format('select public.bc_set_agendamento_status(%L,%L)',pg_temp.f('internal'),'atendido'),'42501','Atendimento clínico deve ser concluído pela profissional responsável.','Chefe não conclui atendimento clínico alheio');
select throws_ok('select public.bc_financeiro_repasses_admin(null,null,null)','42501','Acesso administrativo obrigatório.','Chefe não ganha acesso financeiro administrativo');
select throws_ok(format('select public.bc_registrar_atendimento(%L)',pg_temp.f('internal')),'42501','Acesso negado ao atendimento.','Chefe não registra dados clínicos de outra profissional');
with changed as (update public.staff_profiles set role='admin' where user_id=pg_temp.f('chief') returning user_id) select is((select count(*)::integer from changed),0,'Chefe não promove a si mesma');
with changed as (update public.staff_profiles set pode_gerenciar_agendas=true where user_id=pg_temp.f('ordinary') returning user_id) select is((select count(*)::integer from changed),0,'Chefe não concede capacidades a outras usuárias');
insert into fixture values('block',public.bc_schedule_block_create(pg_temp.f('worker'),(select slot+interval '3 hours' from test_clock),(select slot+interval '4 hours' from test_clock),'outro','Nota interna fictícia'));
select throws_ok(format('select public.bc_agendamento_create(%L,%L,%L,%L)',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),(select slot+interval '3 hours' from test_clock)),'23P01','slot_unavailable','Encaixe não ignora bloqueio absoluto');
select lives_ok(format('select public.bc_schedule_block_delete(%L)',pg_temp.f('block')),'Chefe desbloqueia profissional alheia');
insert into fixture values('inactivation',(public.bc_agenda_inactivation_create(pg_temp.f('worker'),(select day from test_clock),null,'ferias','Motivo privado')->>'id')::uuid);
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'all')),2,'Inativação preserva compromissos existentes');
select throws_ok(format('select public.bc_agendamento_create(%L,%L,%L,%L)',pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),(select slot+interval '4 hours' from test_clock)),'23P01','slot_unavailable','Nem encaixe ignora inativação');
select lives_ok(format('select public.bc_agendamento_link_cliente(%L,%L)',pg_temp.f('site'),pg_temp.f('client')),'Vínculo manual não é impedido por inativação posterior');
select lives_ok(format('select public.bc_agenda_reactivate(%L)',pg_temp.f('inactivation')),'Chefe reativa profissional alheia');
select lives_ok(format('select public.bc_set_agendamento_status(%L,%L)',pg_temp.f('internal'),'cancelado'),'Chefe cancela agenda alheia');
reset role;
select is((select cliente_id from public.agendamentos where id=pg_temp.f('site')),pg_temp.f('client'),'Vínculo persiste no mesmo agendamento');
select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
select lives_ok(format('select public.bc_agendamento_link_cliente(%L,%L)',pg_temp.f('site'),pg_temp.f('client')),'Reenvio do mesmo vínculo é idempotente');
insert into public.clientes(id,nome,telefone,created_by) values('a1000000-0000-4000-8000-000000000008','Outra pessoa CI','31900000002',pg_temp.f('admin'));
select throws_ok(format('select public.bc_agendamento_link_cliente(%L,%L)',pg_temp.f('site'),'a1000000-0000-4000-8000-000000000008'),'55000','Reserva já vinculada a outro cadastro.','Não permite trocar identidade clínica após o vínculo');
select is((select count(*)::integer from public.agendamentos),2,'Vínculo não duplica compromisso');
update public.agendamentos set origem='encaixe' where id=pg_temp.f('internal');
select is((select booking_channel from public.agendamentos where id=pg_temp.f('internal')),'internal','Origem encaixe legada permanece no canal interno');
select is(public.bc_public_agenda_book('Outra Pessoa','31900000001',pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock),repeat('b',64))->>'error_code','23P01','Site também respeita ocupação');

select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'all')),0,'Comum não vê agenda alheia em Geral');
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'site')),0,'Comum não vê agenda alheia em Site');
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'internal')),0,'Comum não vê agenda alheia em Interna');
select throws_ok(format('select public.bc_agendamento_update(%L,%L,%L)',pg_temp.f('internal'),pg_temp.f('procedure'),(select slot+interval '2 hours' from test_clock)),'42501','Acesso negado ao agendamento.','Comum não edita agenda alheia');
select throws_ok(format('select public.bc_agendamento_link_cliente(%L,%L)',pg_temp.f('site'),pg_temp.f('client')),'42501','Acesso negado ao vínculo.','Comum não vincula reserva alheia');
select lives_ok(format('select public.bc_agendamento_create(%L,%L,%L,%L)',pg_temp.f('client'),pg_temp.f('ordinary'),pg_temp.f('procedure'),(select slot+interval '1 day' from test_clock)),'Comum cria encaixe próprio sem disponibilidade pública');
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'internal')),1,'Filtro da comum continua restrito a si');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select is(jsonb_array_length(public.bc_agenda_list((select slot-interval '1 day' from test_clock),(select slot+interval '2 days' from test_clock),'all')),3,'Admin vê todas as profissionais');
select lives_ok(format('select public.bc_schedule_day_upsert(%L,%L,true,%L,%L)',pg_temp.f('ordinary'),(select day+1 from test_clock),'09:00','18:00'),'Admin administra disponibilidade de qualquer profissional');
reset role;
-- Reproduz fielmente linha histórica sem fim, antes da existência do gate.
update public.agendamentos set status='cancelado' where id=pg_temp.f('site');
alter table public.agendamentos disable trigger bc_agendamento_no_overlap;
insert into public.agendamentos(cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,status,created_by,origem)
select pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),slot,null,'agendado',pg_temp.f('admin'),'encaixe' from test_clock;
alter table public.agendamentos enable trigger bc_agendamento_no_overlap;
select is(public.bc_public_agenda_book('Teste legado','31900000001',pg_temp.f('worker'),pg_temp.f('procedure'),(select slot+interval '15 minutes' from test_clock),repeat('l',64))->>'error_code','23P01','Compromisso legado sem fim bloqueia intervalo usando duração padrão');
insert into private.public_booking_rate_limits(origin_hash) select repeat('c',64) from generate_series(1,10);
select is(public.bc_public_agenda_book('Teste limite','31900000001',pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock),repeat('c',64))->>'error_code','53300','Mantém limite de dez confirmações em dez minutos');
update private.public_booking_rate_limits set attempted_at=now()-interval '11 minutes' where origin_hash=repeat('c',64);
select is(public.bc_public_agenda_book('Teste janela','31900000001',pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock),repeat('c',64))->>'error_code','23P01','Tentativas antigas não contam na janela atual');
select * from finish();
\else
select plan(1);
select skip('Mês civil sem janela pública futura de 45 minutos; concorrência interna continua sendo validada.');
select * from finish();
\endif
rollback;
