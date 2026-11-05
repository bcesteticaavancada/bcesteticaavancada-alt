begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/treatment_products.psql

select case when exists(select 1 from pg_available_extensions where name='pg_net')
 then ok(exists(select 1 from pg_extension where extname='pg_net'),'pg_net habilitado para o despachante')
 else skip('adaptador pg_net indisponível neste runtime isolado') end;

insert into auth.users(id,email) values('b9000000-0000-4000-8000-000000000001','admin-retorno@example.invalid');
insert into public.staff_profiles(user_id,display_name,role,active,atende_clientes) values('b9000000-0000-4000-8000-000000000001','Admin fictícia','admin',true,true);
select ok(not has_function_privilege('anon','public.bc_return_reminder_save(uuid,date,timestamp with time zone,text)','EXECUTE'),'anônimo sem gravação de retorno');
select ok(not has_function_privilege('authenticated','public.bc_return_push_claim()','EXECUTE'),'equipe não lê fila de endpoints');
select ok(not has_table_privilege('authenticated','private.bc_return_push_subscriptions','SELECT'),'equipe não lê inscrições privadas');
select ok(not has_table_privilege('authenticated','public.bc_return_reminders','UPDATE'),'sem escrita direta de lembretes');

select set_config('request.jwt.claim.sub',pg_temp.p80('author')::text,true);
set local role authenticated;
select lives_ok($q$insert into product_fixture values('equipment-use',public.bc_treatment_equipment_usage_add_text(pg_temp.p80('treatment'),'  Laser fictício  ','{}','Potência livre de teste'))$q$,'equipamento inédito cadastrado por texto');
select lives_ok($q$select public.bc_treatment_equipment_usage_add_text(pg_temp.p80('treatment'),'LASER FICTÍCIO','{}','Segunda aplicação')$q$,'mesmo nome reutiliza cadastro');
select lives_ok($q$insert into product_fixture values('return-reminder',public.bc_return_reminder_save(pg_temp.p80('treatment'),current_date+2,now()+interval '10 minutes','Reavaliar em 15 dias'))$q$,'lembrete sem completar parecer');
select is(jsonb_array_length(public.bc_return_reminder_list()),1,'leitura de retorno persiste');
select lives_ok($q$select public.bc_return_reminder_save(pg_temp.p80('finalized'),current_date+2,now()+interval '10 minutes','Retorno de ficha finalizada')$q$,'lembrete pode ser criado após finalizar ficha');
select throws_ok($q$select public.bc_return_reminder_save(pg_temp.p80('treatment'),(now() at time zone 'America/Sao_Paulo')::date-1,now()+interval '10 minutes','')$q$,'22023',null,'recusa data de retorno passada');
select throws_ok($q$select public.bc_return_push_subscribe(jsonb_build_object('endpoint','https://evil.example/','keys',jsonb_build_object('p256dh',repeat('a',87),'auth',repeat('a',22))))$q$,'22023',null,'endpoint externo arbitrário é recusado');
select lives_ok($q$select public.bc_return_push_subscribe(jsonb_build_object('endpoint','https://fcm.googleapis.com/qa-only','keys',jsonb_build_object('p256dh',repeat('a',87),'auth',repeat('a',22))))$q$,'inscrição válida persiste para conta atual');
select set_config('request.jwt.claim.sub',pg_temp.p80('other')::text,true);
select throws_ok($q$select public.bc_return_reminder_save(pg_temp.p80('treatment'),current_date+2,now()+interval '10 minutes','')$q$,'42501',null,'outra profissional não edita retorno alheio');
select is(jsonb_array_length(public.bc_return_reminder_list()),0,'caixa não expõe lembretes alheios');
select throws_ok($q$select public.bc_treatment_equipment_usage_add_text(pg_temp.p80('treatment'),'Indevido','{}',null)$q$,'42501',null,'outra profissional não inclui equipamento');
reset role;
select is((select count(*)::integer from public.clinical_equipment where lower(name)='laser fictício'),1,'cadastro de equipamento não duplica');
select is((select usage_notes from public.clinical_treatment_equipment_usages where id=pg_temp.p80('equipment-use')),'Potência livre de teste','anotação livre salva no uso');

update public.clinical_treatments set status='rascunho' where id=pg_temp.p80('treatment');
select set_config('request.jwt.claim.sub','b9000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($q$select public.bc_treatment_report_upsert(pg_temp.p80('treatment'),'{"descricao_sessao":"Rascunho","resposta_observada":"Teste","orientacoes":"Teste","retorno_necessario":true,"retorno_sugerido_em":null}')$q$,'administradora edita parecer em rascunho');
select lives_ok($q$select public.bc_treatment_equipment_usage_add_text(pg_temp.p80('treatment'),'Laser da administração','{}',null)$q$,'administradora pode corrigir equipamento da sessão');
select throws_ok($q$select public.bc_clinical_equipment_upsert(null,'{"name":" laser fictício ","parameter_schema":{"fields":[]}}')$q$,'22023',null,'cadastro não duplica equipamento por nome normalizado');
select lives_ok($q$insert into product_fixture values('catalog-product',public.bc_clinical_product_upsert(null,'{"name":"Produto catálogo QA","default_unit":"mL"}'))$q$,'administradora cadastra produto');
select throws_ok($q$select public.bc_clinical_product_upsert(null,'{"name":" produto CATÁLOGO qa "}')$q$,'22023',null,'cadastro não duplica produto');
select lives_ok($q$select public.bc_clinical_product_lot_upsert(pg_temp.p80('catalog-product'),jsonb_build_object('lot_code','QA-L01','expires_on',current_date+100))$q$,'administradora cadastra lote');
select throws_ok($q$select public.bc_clinical_product_lot_upsert(pg_temp.p80('catalog-product'),jsonb_build_object('lot_code',' qa-l01 ','expires_on',current_date+100))$q$,'22023',null,'cadastro não duplica lote por maiúsculas ou espaços');
select throws_ok($q$select public.bc_treatment_product_usage_add(pg_temp.p80('finalized'),pg_temp.p80('catalog-product'),null,1,'mL')$q$,'42501',null,'admin também respeita estado finalizado no uso por ID');
reset role;
update public.bc_return_reminders set remind_at=now()-interval '1 minute' where id=pg_temp.p80('return-reminder');
select lives_ok('select private.bc_return_materialize()','fila materializa lembrete vencido');
select lives_ok('select private.bc_return_materialize()','segunda execução idempotente');
select is((select count(*)::integer from public.bc_return_notifications where reminder_id=pg_temp.p80('return-reminder')),1,'aviso único por revisão');
select is((select count(*)::integer from private.bc_return_push_deliveries),1,'entrega única por aparelho');

select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($q$insert into product_fixture values('claimed-delivery',nullif(public.bc_return_push_claim()->0->>'id','')::uuid)$q$,'worker claim persistido');
select ok((select id is not null from product_fixture where name='claimed-delivery'),'worker recebe trabalho com lease');
select is(jsonb_array_length(public.bc_return_push_claim()),0,'lease impede duplicidade de entrega');
select ok(public.bc_return_push_is_current(pg_temp.p80('claimed-delivery'),(select claim_token from private.bc_return_push_deliveries where id=pg_temp.p80('claimed-delivery'))),'claim inicial válido');
select set_config('request.jwt.claim.sub',pg_temp.p80('author')::text,true);
set local role authenticated;
select lives_ok($q$select public.bc_return_reminder_save(pg_temp.p80('treatment'),current_date+3,now()+interval '1 day','Reagendado')$q$,'reagendamento incrementa revisão');
reset role;
select ok(not public.bc_return_push_is_current(pg_temp.p80('claimed-delivery'),(select claim_token from private.bc_return_push_deliveries where id=pg_temp.p80('claimed-delivery'))),'reagendamento invalida envio anterior');
select is((select status from private.bc_return_push_deliveries where id=pg_temp.p80('claimed-delivery')),'cancelled','trabalho antigo cancelado');
select set_config('request.jwt.claim.sub',pg_temp.p80('author')::text,true);
set local role authenticated;
select lives_ok($q$select public.bc_return_reminder_complete(pg_temp.p80('return-reminder'))$q$,'conclusão cancela lembrete');
reset role;
select ok(not (select active from public.bc_return_reminders where id=pg_temp.p80('return-reminder')),'lembrete concluído fica inativo');

insert into public.treatment_external_consents(treatment_id,client_file_id,cliente_id,procedure_version_id,consent_template_version_id,consent_class,reviewed_by)
values(pg_temp.p80('finalized'),pg_temp.p80('file'),pg_temp.p80('client'),pg_temp.p80('version'),pg_temp.p80('template'),'nao_injetavel',pg_temp.p80('author'));
insert into public.clinical_treatment_versions(treatment_id,version,snapshot,created_by)
values(pg_temp.p80('finalized'),1,'{"original":"preservado"}',pg_temp.p80('author'));
update public.clinical_treatments set current_version_id=(select id from public.clinical_treatment_versions where treatment_id=pg_temp.p80('finalized') and version=1) where id=pg_temp.p80('finalized');
select set_config('request.jwt.claim.sub',pg_temp.p80('author')::text,true);
set local role authenticated;
select throws_ok($q$select public.bc_treatment_admin_reopen(pg_temp.p80('finalized'),'Teste')$q$,'42501',null,'colaboradora não inicia correção administrativa');
reset role;
select set_config('request.jwt.claim.sub','b9000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($q$select public.bc_treatment_admin_reopen(pg_temp.p80('finalized'),'Correção solicitada pela administradora')$q$,'administradora abre correção com motivo');
reset role;
select is((select snapshot->>'original' from public.clinical_treatment_versions where treatment_id=pg_temp.p80('finalized') and version=1),'preservado','versão original permanece intacta');
select is((select profissional_user_id from public.clinical_treatments where id=pg_temp.p80('finalized')),pg_temp.p80('author'),'correção não transfere autoria clínica');
select is((select correction_mode from public.clinical_treatments where id=pg_temp.p80('finalized')),'reopened','reabertura prepara nova versão');
select * from finish();
rollback;
