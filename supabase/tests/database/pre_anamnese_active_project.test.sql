begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

select ok(not has_table_privilege('anon','public.bc_pre_anamneses','SELECT'),'Envios não são públicos');
select ok(not has_table_privilege('authenticated','public.bc_pre_anamneses','SELECT'),'Recepção não tem leitura direta pela equipe');
select ok(not has_function_privilege('anon','public.bc_pre_anamnese_inbox(integer)','EXECUTE'),'Público não acessa recepção');
insert into public.bc_pre_anamneses(id,public_code,patient_name,patient_phone,procedure,answers,consents,source_version,submission_token,submission_hash,pdf_path,pdf_sha256,pdf_size_bytes)
values('a2000000-0000-4000-8000-000000000001','BC-CI-INTAKE','Pessoa fictícia','31900000000','Teste','{}','{}','ci','ci-token-000000000000',repeat('a',64),'pre-anamneses/ci/ficha.pdf',repeat('b',64),100);
insert into storage.objects(bucket_id,name,metadata) values('bc-prontuario-private','pre-anamneses/ci/ficha.pdf','{"mimetype":"application/pdf","size":100}');

select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select throws_ok('select public.bc_pre_anamnese_inbox()','42501','Acesso restrito à administração clínica.','Gestão de agenda não abre recepção clínica');
select is((select count(*)::integer from storage.objects where name='pre-anamneses/ci/ficha.pdf'),0,'Ficha não vinculada não fica legível à colaboradora');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select is(jsonb_array_length(public.bc_pre_anamnese_inbox()),1,'Admin recebe ficha na base ativa');
select ok(not (public.bc_pre_anamnese_inbox()->0 ? 'submission_token'),'Listagem não revela token de repetição');
select lives_ok(format('select public.bc_pre_anamnese_link(%L,%L)','a2000000-0000-4000-8000-000000000001',pg_temp.f('client')),'Admin vincula à pasta selecionada');
select lives_ok(format('select public.bc_pre_anamnese_link(%L,%L)','a2000000-0000-4000-8000-000000000001',pg_temp.f('client')),'Repetição do vínculo não duplica documento');
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),1,'Nenhum cliente foi criado pelo envio/vínculo');
select is((select count(*)::integer from public.anamneses_gerais where cliente_id=pg_temp.f('client')),0,'Vínculo não aprova anamnese clínica automaticamente');
select is((select count(*)::integer from public.bc_client_document_feed(pg_temp.f('client')) where storage_path='pre-anamneses/ci/ficha.pdf'),1,'PDF recebido aparece na pasta documental');
reset role;
select is((select count(*)::integer from public.client_files where storage_path='pre-anamneses/ci/ficha.pdf'),1,'Uma ficha gera exatamente um documento na pasta');
select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select is((select count(*)::integer from storage.objects where name='pre-anamneses/ci/ficha.pdf'),1,'PDF vinculado segue compartilhamento clínico da pasta');
reset role;
select * from finish();
rollback;
