-- Homologação local e transacional do cálculo misto. Não usar em produção.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

insert into fixture values
  ('variable-procedure', 'a1000000-0000-4000-8000-000000000091'),
  ('variable-version', 'a1000000-0000-4000-8000-000000000092');
insert into public.procedimentos(id, nome, duracao_padrao, ativo, created_by)
values (pg_temp.f('variable-procedure'), 'Peeling variável fictício', 30, true, pg_temp.f('admin'));
insert into public.procedure_versions(
  id, procedimento_id, version, status, nome, classe_documental, price_mode, base_price, created_by
) values (
  pg_temp.f('variable-version'), pg_temp.f('variable-procedure'), 1, 'published',
  'Peeling variável fictício', 'nao_injetavel', 'starting_at', 195, pg_temp.f('admin')
);
update public.procedimentos
set current_version_id = pg_temp.f('variable-version'), access_mode = 'general'
where id = pg_temp.f('variable-procedure');

select is((select automatic_enabled from private.bc_para_voce_program_settings where singleton), false,
  'Motor automático começa desligado para homologação');
select ok(not has_table_privilege('authenticated', 'private.bc_para_voce_program_settings', 'UPDATE'),
  'Equipe não pode ativar a configuração diretamente');
select ok(not has_function_privilege('anon', 'public.bc_para_voce_get_point_policy(uuid)', 'EXECUTE'),
  'Política de pontos não é pública');

select set_config('request.jwt.claim.sub', pg_temp.f('worker')::text, true);
set local role authenticated;
insert into fixture values ('visit-before-activation', public.bc_treatment_create(
  pg_temp.f('client'), pg_temp.f('procedure'), public.bc_agendamento_create(
    pg_temp.f('client'), pg_temp.f('worker'), pg_temp.f('procedure'), (select slot from test_clock)
  )
));
reset role;
update public.clinical_treatments set status = 'em_atendimento', objetivo = 'Teste', regiao = 'Rosto'
where id = pg_temp.f('visit-before-activation');
update public.clinical_treatments set status = 'finalizado', finalized_at = now()
where id = pg_temp.f('visit-before-activation');
select is((select count(*)::integer from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('visit-before-activation')), 0,
  'Sem regra manual, nada é concedido antes da ativação');

update private.bc_para_voce_program_settings
set automatic_enabled = true, effective_at = now() - interval '1 minute';
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.f('admin')::text, true);
select is(public.bc_para_voce_get_point_policy(pg_temp.f('procedure'))->>'mode', 'automatic',
  'Procedimento sem exceção usa o modelo misto');
select is(public.bc_para_voce_get_point_policy(pg_temp.f('procedure'))->>'automatic_enabled', 'true',
  'Admin enxerga estado da homologação');
select set_config('request.jwt.claim.sub', pg_temp.f('worker')::text, true);
select throws_ok(format('select public.bc_para_voce_reset_point_rule(%L)', pg_temp.f('procedure')),
  '42501', 'Acesso restrito à administração da clínica.',
  'Colaboradora não remove exceções de pontos');

insert into fixture values ('fixed-visit', public.bc_treatment_create(
  pg_temp.f('client'), pg_temp.f('procedure'), public.bc_agendamento_create(
    pg_temp.f('client'), pg_temp.f('worker'), pg_temp.f('procedure'), (select slot + interval '1 hour' from test_clock)
  )
));
insert into fixture values ('variable-visit', public.bc_treatment_create(
  pg_temp.f('client'), pg_temp.f('variable-procedure'), public.bc_agendamento_create(
    pg_temp.f('client'), pg_temp.f('worker'), pg_temp.f('variable-procedure'), (select slot + interval '2 hours' from test_clock)
  )
));
insert into fixture values ('pending-visit', public.bc_treatment_create(
  pg_temp.f('client'), pg_temp.f('variable-procedure'), public.bc_agendamento_create(
    pg_temp.f('client'), pg_temp.f('worker'), pg_temp.f('variable-procedure'), (select slot + interval '3 hours' from test_clock)
  )
));
insert into fixture values ('cycle-visit', public.bc_treatment_create(
  pg_temp.f('client'), pg_temp.f('variable-procedure'), public.bc_agendamento_create(
    pg_temp.f('client'), pg_temp.f('worker'), pg_temp.f('variable-procedure'), (select slot + interval '4 hours' from test_clock)
  )
));
reset role;

update public.clinical_treatments
set status = 'em_atendimento', objetivo = 'Teste de crédito misto', regiao = 'Rosto'
where id in (pg_temp.f('fixed-visit'), pg_temp.f('variable-visit'),
  pg_temp.f('pending-visit'), pg_temp.f('cycle-visit'));
update public.clinical_treatments set final_price = 400.50 where id = pg_temp.f('variable-visit');
update public.clinical_treatments set final_price = 890, cycle_key = 'pacote-ficticio'
where id = pg_temp.f('cycle-visit');
update public.clinical_treatments set status = 'finalizado', finalized_at = now()
where id in (pg_temp.f('fixed-visit'), pg_temp.f('variable-visit'),
  pg_temp.f('pending-visit'), pg_temp.f('cycle-visit'));

select is((select points from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('fixed-visit')), 100,
  'Preço fixo concede valor-base da ficha');
select is((select calculation_mode from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('fixed-visit')), 'automatic_fixed',
  'Crédito fixo preserva a origem');
select is((select points from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('variable-visit')), 401,
  'Preço a partir de usa preço final confirmado e arredonda');
select is((select amount_snapshot from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('variable-visit')), 400.50::numeric,
  'Valor real de referência é congelado no evento');
select is((select calculation_mode from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('pending-visit')), 'pending_price',
  'Sem valor final confirmado, crédito fica pendente');
select is((select points from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('pending-visit')), 0,
  'Crédito pendente não aumenta o saldo');
select is((select calculation_mode from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('cycle-visit')), 'pending_cycle',
  'Ciclo ou pacote precisa de rateio revisado antes do crédito');
select is((select points from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('cycle-visit')), 0,
  'Ciclo pendente não multiplica pontos');
set local role authenticated;
select is(public.bc_para_voce_staff_summary(pg_temp.f('client'))->>'total_points', '501',
  'Saldo considera apenas créditos aprovados');
select is(public.bc_para_voce_staff_summary(pg_temp.f('client'))->>'pending_count', '2',
  'Resumo interno informa duas pendências sem revelar preços');
reset role;

update public.clinical_treatments set status = 'em_atendimento', finalized_at = null
where id = pg_temp.f('variable-visit');
update public.clinical_treatments set status = 'finalizado', finalized_at = now(), final_price = 750
where id = pg_temp.f('variable-visit');
select is((select count(*)::integer from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('variable-visit')), 1,
  'Reconclusão nunca duplica crédito misto');
select is((select points from private.bc_para_voce_point_events
  where treatment_id = pg_temp.f('variable-visit')), 401,
  'Reconclusão preserva cálculo original');

select set_config('request.jwt.claim.sub', pg_temp.f('admin')::text, true);
set local role authenticated;
select is(public.bc_para_voce_set_point_rule(pg_temp.f('variable-procedure'), 250), 250,
  'Admin pode configurar exceção manual');
select is(public.bc_para_voce_get_point_policy(pg_temp.f('variable-procedure'))->>'mode', 'manual',
  'Política identifica a exceção');
select is(public.bc_para_voce_reset_point_rule(pg_temp.f('variable-procedure')), true,
  'Admin pode retornar ao modelo misto');
select is(public.bc_para_voce_get_point_policy(pg_temp.f('variable-procedure'))->>'mode', 'automatic',
  'Remoção restaura modelo misto sem alterar saldo anterior');
reset role;

select * from finish();
rollback;
