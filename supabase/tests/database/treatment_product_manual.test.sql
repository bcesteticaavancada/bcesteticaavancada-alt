begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/treatment_products.psql

select ok(has_function_privilege('authenticated','public.bc_treatment_product_usage_add_text(uuid,text,text,date,numeric,text)','EXECUTE'),'authenticated reaches text wrapper');
select ok(has_function_privilege('authenticated','private.bc_treatment_product_usage_add_text_impl(uuid,text,text,date,numeric,text)','EXECUTE'),'invoker reaches guarded implementation');
select ok(not has_function_privilege('anon','public.bc_treatment_product_usage_add_text(uuid,text,text,date,numeric,text)','EXECUTE'),'anonymous cannot reach wrapper');
select ok(not has_function_privilege('anon','private.bc_treatment_product_usage_add_text_impl(uuid,text,text,date,numeric,text)','EXECUTE'),'anonymous cannot reach implementation');
select is((select prosecdef from pg_proc where oid='public.bc_treatment_product_usage_add_text(uuid,text,text,date,numeric,text)'::regprocedure),false,'public wrapper is invoker');
select is((select proconfig from pg_proc where oid='private.bc_treatment_product_usage_add_text_impl(uuid,text,text,date,numeric,text)'::regprocedure),array['search_path=""'],'definer has empty search path');
select ok('produto_lote_pendente'=any(private.bc_treatment_finalization_gate(pg_temp.p80('treatment'))),'required traceability blocks finalization before use');

select set_config('request.jwt.claim.sub',pg_temp.p80('author')::text,true);
set local role authenticated;
select lives_ok($q$insert into product_fixture values('usage1',public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'  Bio fictício PR80  ','QA-01',current_date+365,2.5,'mL'))$q$,'new product and new lot persist through real wrapper');
select lives_ok($q$insert into product_fixture values('usage2',public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'BIO FICTÍCIO PR80','QA-02',current_date+365,1,'mL'))$q$,'existing product and new lot');
select lives_ok($q$insert into product_fixture values('usage3',public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'bio fictício pr80',' qa-01 ',current_date+365,1,'mL'))$q$,'existing product and lot reuse case-insensitively');
select is(jsonb_array_length(public.bc_treatment_product_usage_list(pg_temp.p80('treatment'))),3,'fresh history read contains all persisted uses');

select throws_ok(format('select public.bc_treatment_product_usage_add_text(%L,%L,%L,%L,1,%L)',pg_temp.p80('treatment'),bad_name,'QA-03',current_date+365,'mL'),'22023',null,label)
from (values(null::text,'null product'),(' ','blank product'),(E'\t\n','whitespace product'),(repeat('x',161),'product length limit')) x(bad_name,label);
select throws_ok(format('select public.bc_treatment_product_usage_add_text(%L,%L,%L,%L,1,%L)',pg_temp.p80('treatment'),'Bio fictício PR80',bad_lot,current_date+365,'mL'),'22023',null,label)
from (values(null::text,'null lot'),(' ','blank lot'),(E'\t\n','whitespace lot'),(repeat('x',101),'lot length limit')) x(bad_lot,label);
select throws_ok(format('select public.bc_treatment_product_usage_add_text(%L,%L,%L,%L,1,%L)',pg_temp.p80('treatment'),'Bio fictício PR80','QA-03',current_date+365,bad_unit),'22023',null,label)
from (values(null::text,'null unit'),(' ','blank unit'),(repeat('x',31),'unit length limit')) x(bad_unit,label);
select throws_ok(format('select public.bc_treatment_product_usage_add_text(%L,%L,%L,%L,%L::numeric,%L)',pg_temp.p80('treatment'),'Bio fictício PR80','QA-03',current_date+365,bad_quantity,'mL'),'22023',null,label)
from (values(null::text,'null quantity'),('0','zero quantity'),('-1','negative quantity'),('NaN','NaN quantity'),('Infinity','infinite quantity'),('-Infinity','negative infinite quantity')) x(bad_quantity,label);
select throws_ok(format('select public.bc_treatment_product_usage_add_text(%L,%L,%L,%L::date,1,%L)',pg_temp.p80('treatment'),'Bio fictício PR80','QA-03',bad_date,'mL'),'22023',null,label)
from (values(null::text,'missing expiry'),(((now() at time zone 'America/Sao_Paulo')::date-1)::text,'expired lot'),('infinity','infinite expiry'),('-infinity','negative infinite expiry')) x(bad_date,label);
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Bio fictício PR80','QA-01',current_date+366,1,'mL')$q$,'22023',null,'conflicting expiry is rejected');
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('finalized'),'Produto proibido','LOT',current_date+365,1,'mL')$q$,'42501',null,'finalized session cannot create catalog items');
select throws_ok($q$select public.bc_treatment_product_usage_add_text(gen_random_uuid(),'Produto proibido','LOT',current_date+365,1,'mL')$q$,'P0002',null,'missing treatment cannot create catalog items');
select set_config('request.jwt.claim.sub',pg_temp.p80('other')::text,true);
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Produto proibido','LOT',current_date+365,1,'mL')$q$,'42501',null,'another professional cannot change author session');
reset role;

select is((select count(*)::integer from public.clinical_products where lower(name)='bio fictício pr80'),1,'one product for all automatic registrations');
select is((select count(*)::integer from public.clinical_product_lots l join public.clinical_products p on p.id=l.product_id where lower(p.name)='bio fictício pr80'),2,'only the two real lots exist');
select ok((select bool_and(u.product_id=p.id and u.lot_id=l.id and u.product_name_snapshot=p.name and u.lot_code_snapshot=l.lot_code and u.expires_on_snapshot=l.expires_on and u.created_by=pg_temp.p80('author')) from public.clinical_treatment_product_usages u join public.clinical_products p on p.id=u.product_id join public.clinical_product_lots l on l.id=u.lot_id where u.treatment_id=pg_temp.p80('treatment')),'real product/lot IDs, expiry and author are preserved');
select is((select quantity from public.clinical_treatment_product_usages where id=pg_temp.p80('usage1')),2.5::numeric,'quantity is preserved');
select is((select unit from public.clinical_treatment_product_usages where id=pg_temp.p80('usage1')),'mL','unit is preserved');
select is((select count(*)::integer from public.audit_log where actor_user_id=pg_temp.p80('author') and action='clinical_treatment_product_usage_added'),3,'every use is audited');
select is((select count(*)::integer from public.clinical_products where name='Produto proibido'),0,'failed calls leave no new product');
select ok(not ('produto_lote_pendente'=any(private.bc_treatment_finalization_gate(pg_temp.p80('treatment')))),'real traceability clears product gate');

update public.clinical_products set active=false where lower(name)='bio fictício pr80';
select set_config('request.jwt.claim.sub',pg_temp.p80('author')::text,true);
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Bio fictício PR80','QA-01',current_date+365,1,'mL')$q$,'22023',null,'inactive product cannot be silently recreated');
reset role;
update public.clinical_products set active=true where lower(name)='bio fictício pr80';
update public.clinical_product_lots set active=false where lot_code='QA-02';
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Bio fictício PR80','QA-02',current_date+365,1,'mL')$q$,'22023',null,'inactive lot is rejected');
reset role;

-- Downstream failure must undo the whole catalog + audit transaction.
create function pg_temp.reject_p80_usage() returns trigger language plpgsql as $$begin raise exception 'synthetic downstream failure' using errcode='22023';end;$$;
create trigger reject_p80_usage before insert on public.clinical_treatment_product_usages for each row execute function pg_temp.reject_p80_usage();
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Produto rollback PR80','ROLLBACK',current_date+365,1,'mL')$q$,'22023','synthetic downstream failure','downstream failure propagates');
reset role;
drop trigger reject_p80_usage on public.clinical_treatment_product_usages;
select is((select count(*)::integer from public.clinical_products where name='Produto rollback PR80'),0,'failed usage rolls back product');
select is((select count(*)::integer from public.clinical_product_lots where lot_code='ROLLBACK'),0,'failed usage rolls back lot');
select is((select count(*)::integer from public.audit_log where actor_user_id=pg_temp.p80('author') and action='clinical_product_created'),1,'failed usage rolls back catalog audit too');

insert into public.clinical_products(name,created_by) values('Ambíguo PR80',pg_temp.p80('author')),('AMBÍGUO PR80',pg_temp.p80('author'));
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Ambíguo PR80','QA',current_date+365,1,'mL')$q$,'22023',null,'ambiguous product name requires catalog review');
reset role;
insert into public.clinical_product_lots(product_id,lot_code,expires_on,created_by)
select id,'qa-01',current_date+365,pg_temp.p80('author') from public.clinical_products where name='Bio fictício PR80';
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Bio fictício PR80','QA-01',current_date+365,1,'mL')$q$,'22023',null,'ambiguous lot code requires catalog review');
reset role;

-- The actual finalization RPC freezes the exact product IDs and snapshots.
set local role authenticated;
select lives_ok($q$select public.bc_treatment_finalize(pg_temp.p80('treatment'))$q$,'traceable procedure reaches real finalization preparation');
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Bio fictício PR80','QA-01',current_date+365,1,'mL')$q$,'42501',null,'pending document freezes further manual usage');
reset role;
select is((select jsonb_array_length(snapshot->'product_usages') from public.clinical_treatment_versions where treatment_id=pg_temp.p80('treatment')),3,'final version used by history/PDF contains all uses');
select is((select item->>'lot_code_snapshot' from public.clinical_treatment_versions v cross join lateral jsonb_array_elements(v.snapshot->'product_usages') item where v.treatment_id=pg_temp.p80('treatment') and item->>'id'=pg_temp.p80('usage1')::text),'QA-01','lot snapshot survives finalization');
update public.clinical_treatments set pending_document_id=null where id=pg_temp.p80('treatment');
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('treatment'),'Bio fictício PR80','QA-01',current_date+365,1,'mL')$q$,'42501',null,'pending version alone still freezes clinical usage');
reset role;
update public.clinical_products set name='Nome alterado na biblioteca' where lower(name)='bio fictício pr80';
select is((select snapshot->'product_usages'->0->>'product_name_snapshot' from public.clinical_treatment_versions where treatment_id=pg_temp.p80('treatment')),'Bio fictício PR80','history/PDF uses immutable clinical name snapshot');

update public.staff_profiles set active=false where user_id=pg_temp.p80('author');
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('second-treatment'),'Produto proibido','LOT',current_date+365,1,'mL')$q$,'42501',null,'inactive author is rejected');
reset role;
update public.staff_profiles set active=true,role='admin_criacao',atende_clientes=false,procedure_scope='explicit' where user_id=pg_temp.p80('author');
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('second-treatment'),'Produto proibido','LOT',current_date+365,1,'mL')$q$,'42501',null,'creation administrator gains no clinical privileges');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select throws_ok($q$select public.bc_treatment_product_usage_add_text(pg_temp.p80('second-treatment'),'Produto proibido','LOT',current_date+365,1,'mL')$q$,'42501',null,'missing JWT identity is rejected');
reset role;
select * from finish();
rollback;
