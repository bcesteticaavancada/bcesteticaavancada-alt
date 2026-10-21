begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

-- Identities and data below are fictitious, exclusively in the disposable CI database.
insert into fixture(name,id) values('creation-owned','a1000000-0000-4000-8000-000000000099');
insert into public.clinical_treatments(id,cliente_id,procedimento_id,procedure_version_id,profissional_user_id,treatment_date,price_mode_snapshot,base_price_snapshot,created_by)
values(pg_temp.f('creation-owned'),pg_temp.f('client'),pg_temp.f('procedure'),pg_temp.f('version'),pg_temp.f('ordinary'),current_date,'fixed',100,pg_temp.f('ordinary'));
update public.staff_profiles set role='admin_criacao',atende_clientes=false,
  pode_gerenciar_agendas=false,pode_gerenciar_procedimentos=false,procedure_scope='explicit'
where user_id=pg_temp.f('ordinary');
select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select is(private.is_bc_admin(),false,'Criação não herda administração financeira');
select is(private.is_bc_active_colaborador(),false,'Criação não herda financeiro próprio');
select is(private.is_bc_active_staff(),false,'Criação não herda prontuários brutos');
select throws_ok(format('select public.bc_treatment_update_draft(%L,%L::jsonb)',pg_temp.f('creation-owned'),'{"final_price":42}'),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite editar valor ou ficha');
select throws_ok(format('select public.bc_treatment_confirm_health(%L,false,null)',pg_temp.f('creation-owned')),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite confirmar saúde');
select throws_ok(format('select public.bc_treatment_confirm_alerts(%L)',pg_temp.f('creation-owned')),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite revisar alertas');
select throws_ok(format('select public.bc_treatment_prepare_consent(%L)',pg_temp.f('creation-owned')),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite preparar consentimento');
select throws_ok(format('select public.bc_treatment_mark_ready(%L)',pg_temp.f('creation-owned')),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite mudar etapa');
select throws_ok(format('select public.bc_treatment_start(%L)',pg_temp.f('creation-owned')),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite iniciar atendimento');
select throws_ok(format('select public.bc_treatment_correct_same_day(%L,%L::jsonb)',pg_temp.f('creation-owned'),'{}'),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite retificação');
select throws_ok(format('select public.bc_treatment_correct_reopened(%L,%L::jsonb)',pg_temp.f('creation-owned'),'{}'),'42501','Acesso restrito à equipe clínica ativa.','Autoria antiga não permite reabrir ficha');

select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),0,'Cliente bruto é restrito');
select is((select count(*)::integer from public.procedure_versions where id=pg_temp.f('version')),0,'Versão com preço não é legível diretamente');
select is(jsonb_array_length(public.bc_creation_list('clientes')->'rows'),1,'Consulta operacional mostra cliente autorizado');
select ok(not ((public.bc_creation_list('procedimentos')->'rows'->0) ? 'base_price'),'Projeção de procedimento exclui preço');
select throws_ok($$select public.bc_creation_list('pagamentos')$$,'22023','Área de consulta inválida.','Parâmetro não libera outra tabela');
select throws_ok($$select public.bc_creation_list('clientes',-1)$$,'22023','Consulta inválida.','Paginação inválida recusada');
select throws_ok($$select public.bc_meus_recebimentos(current_date,current_date)$$,'42501','Acesso negado ao financeiro.','Sem recebimentos próprios');
select throws_ok($$select public.bc_meus_livros_financeiros(current_date,current_date)$$,'42501','Acesso negado ao financeiro.','Sem livros próprios');
select throws_ok($$select public.bc_meus_repasses(current_date,current_date)$$,'42501','Acesso negado ao financeiro.','Sem repasses próprios');
select throws_ok(format('select public.bc_comissao_set(%L,%L,10)',pg_temp.f('worker'),pg_temp.f('procedure')),'42501','Somente a administradora pode configurar comissão.','Não altera comissão');
select lives_ok(format('update public.clientes set nome=%L where id=%L','Mudança indevida',pg_temp.f('client')),'Update direto não encontra linhas autorizadas');
reset role;
select is((select nome from public.clientes where id=pg_temp.f('client')),'Pessoa fictícia CI','Cadastro preservado');
select ok(not has_function_privilege('anon','public.bc_creation_list(text,integer,text,uuid)','execute'),'Consulta não é anônima');
update public.staff_profiles set active=false where user_id=pg_temp.f('ordinary');
set local role authenticated;
select throws_ok($$select public.bc_creation_list('clientes')$$,'42501','Acesso restrito ao Admin de Criação.','Desativação revoga consulta');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
select throws_ok($$select public.bc_creation_list('clientes')$$,'42501','Acesso restrito ao Admin de Criação.','Colaboradora não herda consulta global');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select is((select count(*)::integer from public.clientes where id=pg_temp.f('client')),1,'Admin mantém acesso anterior');
reset role;
select * from finish();
rollback;
