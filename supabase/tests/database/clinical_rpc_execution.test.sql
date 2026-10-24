begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

-- Catches the real 42501 observed from the published client: public invoker
-- wrappers need narrowly granted EXECUTE on their guarded private entrypoints.
select checks.result
from unnest(array[
 'private.bc_clinical_product_list_impl(boolean)',
 'private.bc_clinical_product_upsert_impl(uuid,jsonb)',
 'private.bc_clinical_product_lot_list_impl(uuid,boolean)',
 'private.bc_clinical_product_lot_upsert_impl(uuid,jsonb)',
 'private.bc_treatment_product_usage_list_impl(uuid)',
 'private.bc_treatment_product_usage_add_impl(uuid,uuid,uuid,numeric,text)',
 'private.bc_treatment_product_usage_remove_impl(uuid)',
 'private.bc_clinical_equipment_list_impl(boolean)',
 'private.bc_clinical_equipment_upsert_impl(uuid,jsonb)',
 'private.bc_treatment_equipment_usage_list_impl(uuid)',
 'private.bc_treatment_equipment_usage_add_impl(uuid,uuid,jsonb)',
 'private.bc_treatment_equipment_usage_remove_impl(uuid)',
 'private.bc_treatment_photo_list_impl(uuid)',
 'private.bc_treatment_photo_register_impl(uuid,text,text,bigint,text,text,text,text,timestamptz)',
 'private.bc_treatment_photo_void_impl(uuid,text)',
 'private.bc_treatment_intercurrence_list_impl(uuid)',
 'private.bc_treatment_intercurrence_create_impl(uuid,text,text,text,text,timestamptz)',
 'private.bc_treatment_intercurrence_update_draft_impl(uuid,jsonb)',
 'private.bc_intercurrence_add_update_impl(uuid,text,text)',
 'private.bc_treatment_confirm_open_intercurrences_impl(uuid)'
]) s
cross join lateral (values
 (ok(has_function_privilege('authenticated',s,'EXECUTE'),'authenticated reaches '||s)),
 (ok(not has_function_privilege('anon',s,'EXECUTE'),'anonymous cannot reach '||s))
) checks(result);

select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select lives_ok('select public.bc_clinical_product_list(false)','admin lists products through the real wrapper');
select lives_ok('select public.bc_clinical_equipment_list(false)','admin lists equipment through the real wrapper');
insert into fixture values('qa-product',public.bc_clinical_product_upsert(null,'{"name":"TESTE DE FLUXO produto CI","tracks_lot":true,"default_unit":"ml"}'));
insert into fixture values('qa-lot',public.bc_clinical_product_lot_upsert(pg_temp.f('qa-product'),jsonb_build_object('lot_code','FLUXO-CI','expires_on',current_date+365)));
insert into fixture values('qa-equipment',public.bc_clinical_equipment_upsert(null,'{"name":"TESTE DE FLUXO equipamento CI","parameter_schema":{"fields":[]}}'));
select is(jsonb_array_length(public.bc_clinical_product_lot_list(pg_temp.f('qa-product'),false)),1,'created lot visible through wrapper');

select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
insert into fixture values('qa-treatment',public.bc_treatment_create(pg_temp.f('client'),pg_temp.f('procedure')));
select lives_ok(format('select public.bc_treatment_photo_list(%L)',pg_temp.f('qa-treatment')),'author opens photo card');
select lives_ok(format('select public.bc_treatment_intercurrence_list(%L)',pg_temp.f('qa-treatment')),'author opens intercurrence card');
insert into fixture values('qa-usage',public.bc_treatment_product_usage_add(pg_temp.f('qa-treatment'),pg_temp.f('qa-product'),pg_temp.f('qa-lot'),1,'ml'));
select is(jsonb_array_length(public.bc_treatment_product_usage_list(pg_temp.f('qa-treatment'))),1,'author records traceable product');
select lives_ok(format('select public.bc_treatment_product_usage_remove(%L)',pg_temp.f('qa-usage')),'author removes own draft usage');
insert into fixture values('qa-equipment-usage',public.bc_treatment_equipment_usage_add(pg_temp.f('qa-treatment'),pg_temp.f('qa-equipment'),'{}'));
select is(jsonb_array_length(public.bc_treatment_equipment_usage_list(pg_temp.f('qa-treatment'))),1,'author records equipment');
select lives_ok(format('select public.bc_treatment_equipment_usage_remove(%L)',pg_temp.f('qa-equipment-usage')),'author removes own equipment draft');
insert into fixture values('qa-intercurrence',public.bc_treatment_intercurrence_create(pg_temp.f('qa-treatment'),'durante','leve','TESTE DE FLUXO','Conduta fictícia CI',now()));
select lives_ok(format('select public.bc_treatment_intercurrence_update_draft(%L,%L)',pg_temp.f('qa-intercurrence'),'{"description":"TESTE DE FLUXO revisado"}'),'author corrects own draft intercurrence');
select lives_ok(format('select public.bc_treatment_confirm_open_intercurrences(%L)',pg_temp.f('qa-treatment')),'author confirms open intercurrences');
select lives_ok(format('select public.bc_intercurrence_add_update(%L,%L,%L)',pg_temp.f('qa-intercurrence'),'Evolução de teste','encerrada'),'author records evolution');
select throws_ok('select public.bc_clinical_product_upsert(null,''{"name":"Não permitido"}'')','42501',null,'ordinary collaborator still cannot edit product library');
select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
select throws_ok(format('select public.bc_treatment_product_usage_add(%L,%L,%L,1,''ml'')',pg_temp.f('qa-treatment'),pg_temp.f('qa-product'),pg_temp.f('qa-lot')),'42501',null,'another professional cannot modify author session');
select throws_ok(format('select public.bc_treatment_equipment_usage_add(%L,%L,''{}'')',pg_temp.f('qa-treatment'),pg_temp.f('qa-equipment')),'42501',null,'equipment author restriction survives new EXECUTE grant');
reset role;
update public.staff_profiles set active=false where user_id=pg_temp.f('worker');
select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
select throws_ok('select public.bc_clinical_product_list(false)','42501',null,'inactive staff cannot list products');
select throws_ok('select public.bc_clinical_equipment_list(false)','42501',null,'inactive staff cannot list equipment');
reset role;
update public.staff_profiles set role='admin_criacao',active=true,atende_clientes=false,pode_gerenciar_agendas=false,pode_gerenciar_procedimentos=false,procedure_scope='explicit' where user_id=pg_temp.f('ordinary');
select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select throws_ok('select public.bc_clinical_product_list(false)','42501',null,'creation role remains restricted to its read-only projection');
select throws_ok('select public.bc_clinical_equipment_list(false)','42501',null,'creation role cannot call clinical equipment RPC');
reset role;
select * from finish();
rollback;
