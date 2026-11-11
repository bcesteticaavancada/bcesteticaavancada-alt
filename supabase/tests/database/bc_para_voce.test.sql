begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

select ok(not has_table_privilege('authenticated', 'private.bc_para_voce_accounts', 'SELECT'),
  'Cadastro espelho privado');
select ok(not has_function_privilege('anon', 'public.bc_para_voce_staff_summary(uuid)', 'EXECUTE'),
  'Resumo indisponível ao público');
select set_config('request.jwt.claim.sub', pg_temp.f('worker')::text, true);
set local role authenticated;
insert into fixture values ('second-client', public.bc_cliente_create_v2(
  '{"nome":"Segunda cliente fictícia CI","telefone":"31900000041"}'
));
select is(public.bc_para_voce_staff_summary(pg_temp.f('second-client')),
  '{"account_state":"ativacao_pendente","total_points":0,"level":"adesao","pending_count":0}'::jsonb,
  'Cadastro básico feito pela colaboradora prepara o espelho');
select throws_ok(format('select public.bc_para_voce_set_point_rule(%L, 250)', pg_temp.f('procedure')),
  '42501', 'Acesso restrito à administração da clínica.', 'Colaboradora não altera Pontos BC');

select set_config('request.jwt.claim.sub', pg_temp.f('admin')::text, true);
select is(public.bc_para_voce_get_point_rule(pg_temp.f('procedure')), 0, 'Catálogo começa sem concessão automática');
select is(public.bc_para_voce_set_point_rule(pg_temp.f('procedure'), 1000), 1000, 'Admin define a regra');
select is(public.bc_para_voce_set_point_rule(pg_temp.f('procedure'), 1000), 1000, 'Salvar a mesma regra é idempotente');
select throws_ok(format('select public.bc_para_voce_set_point_rule(%L, -1)', pg_temp.f('procedure')),
  '22023', 'Pontuação inválida.', 'Regra recusa valor negativo');
select is(public.bc_para_voce_get_point_rule(pg_temp.f('procedure')), 1000, 'Admin consulta regra salva');
reset role;
select is((select count(*)::integer from public.audit_log where action = 'bc_para_voce_rule_updated'), 1,
  'Auditoria registra uma mudança efetiva de regra');

select set_config('request.jwt.claim.sub', pg_temp.f('worker')::text, true);
set local role authenticated;
insert into fixture values ('portal-appointment', public.bc_agendamento_create(
  pg_temp.f('client'), pg_temp.f('worker'), pg_temp.f('procedure'), (select slot from test_clock)
));
insert into fixture values ('portal-treatment', public.bc_treatment_create(
  pg_temp.f('client'), pg_temp.f('procedure'), pg_temp.f('portal-appointment')
));
select is(public.bc_para_voce_staff_summary(pg_temp.f('client'))->>'total_points', '0',
  'Agendar ou iniciar ficha não concede pontos');
reset role;
update public.clinical_treatments set status = 'em_atendimento', objetivo = 'Teste de fidelidade', regiao = 'Teste'
where id = pg_temp.f('portal-treatment');
update public.clinical_treatments set status = 'finalizado', finalized_at = now()
where id = pg_temp.f('portal-treatment');
set local role authenticated;
select is(public.bc_para_voce_staff_summary(pg_temp.f('client')),
  '{"account_state":"ativacao_pendente","total_points":1000,"level":"bronze","pending_count":0}'::jsonb,
  'Conclusão concede pontos ao cadastro correto e libera o primeiro nível');
select is(public.bc_para_voce_staff_summary(pg_temp.f('second-client'))->>'total_points', '0',
  'Um atendimento não pontua no segundo cadastro');
reset role;

select set_config('request.jwt.claim.sub', pg_temp.f('admin')::text, true);
set local role authenticated;
select is(public.bc_para_voce_set_point_rule(pg_temp.f('procedure'), 250), 250, 'Mudança vale para as próximas conclusões');
reset role;
select set_config('request.jwt.claim.sub', pg_temp.f('worker')::text, true);
update public.clinical_treatments set status = 'em_atendimento', finalized_at = null
where id = pg_temp.f('portal-treatment');
update public.clinical_treatments set status = 'finalizado', finalized_at = now()
where id = pg_temp.f('portal-treatment');
select is((select count(*)::integer from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('portal-treatment')), 1, 'Reconclusão não duplica o lançamento');
select is((select points from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('portal-treatment')), 1000, 'Reconclusão preserva a regra original');

update public.clientes set ativo = false where id = pg_temp.f('client');
set local role authenticated;
select is(public.bc_para_voce_staff_summary(pg_temp.f('client'))->>'account_state', 'arquivado',
  'Arquivamento aparece no resumo interno');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(format('select public.bc_para_voce_staff_summary(%L)', pg_temp.f('client')),
  '42501', 'Acesso restrito à equipe clínica ativa.', 'Sessão sem vínculo com a equipe não lê o resumo');
reset role;
select * from finish();
rollback;
