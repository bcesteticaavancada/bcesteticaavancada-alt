begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

-- Exclusivamente na base descartável: estado clínico já finalizado/assinado.
select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
insert into fixture values('fin-appointment',public.bc_agendamento_create(pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),(select slot from test_clock)));
insert into fixture values('fin-treatment',public.bc_treatment_create(pg_temp.f('client'),pg_temp.f('procedure'),pg_temp.f('fin-appointment')));
reset role;
update public.clinical_treatments set final_price=600,status='em_atendimento' where id=pg_temp.f('fin-treatment');
-- A versão histórica fictícia não testa o fluxo de consentimento.
alter table public.clinical_treatment_versions disable trigger bc_external_consent_snapshot_before_version_insert;
insert into public.clinical_treatment_versions(treatment_id,version,snapshot,created_by)
select id,1,jsonb_build_object('treatment',to_jsonb(t)),pg_temp.f('worker') from public.clinical_treatments t where id=pg_temp.f('fin-treatment');
alter table public.clinical_treatment_versions enable trigger bc_external_consent_snapshot_before_version_insert;
update public.clinical_treatments t set current_version_id=v.id from public.clinical_treatment_versions v where v.treatment_id=t.id and t.id=pg_temp.f('fin-treatment');
update public.clinical_treatments set status='finalizado' where id=pg_temp.f('fin-treatment');
insert into fixture select 'fin-attendance',operational_attendance_id from public.clinical_treatments where id=pg_temp.f('fin-treatment');
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
insert into fixture values('fin-key',gen_random_uuid());
insert into fixture values('fin-receipt',public.bc_recebimento_registrar_v2(pg_temp.f('fin-key'),pg_temp.f('fin-attendance'),100,'pix'));
reset role;
select is((select valor_total from public.pagamentos where atendimento_id=pg_temp.f('fin-attendance')),600::numeric,'FIN01 parcela preserva cobrança600');
select is((select valor_recebido from public.pagamentos where atendimento_id=pg_temp.f('fin-attendance')),100::numeric,'FIN01 registra somente entrada100');
select is((select status from public.pagamentos where atendimento_id=pg_temp.f('fin-attendance')),'parcial','FIN01 saldo500 continua em aberto');
set local role authenticated;
select throws_ok(format('select public.bc_recebimento_registrar_v2(gen_random_uuid(),%L,501,%L)',pg_temp.f('fin-attendance'),'pix'),'22023','Valor recebido excede o saldo da cobrança.','FIN01 excesso recusado atomicamente');
select lives_ok(format('select public.bc_recebimento_registrar_v2(gen_random_uuid(),%L,500,%L)',pg_temp.f('fin-attendance'),'pix'),'FIN01 restante quita cobrança');
select lives_ok(format('select public.bc_recebimento_estornar(%L,%L)',pg_temp.f('fin-receipt'),'Estorno fictício CI'),'FIN01 estorno permitido sem livro congelado');
reset role;
select is((select valor_total from public.pagamentos where atendimento_id=pg_temp.f('fin-attendance')),600::numeric,'FIN01 estorno preserva total original');
select is((select valor_recebido from public.pagamentos where atendimento_id=pg_temp.f('fin-attendance')),500::numeric,'FIN01 estorno recompõe soma ativa');

-- A mesma tentativa permanece reconhecida mesmo após estorno.
set local role authenticated;
select is(public.bc_recebimento_registrar_v2(pg_temp.f('fin-key'),pg_temp.f('fin-attendance'),100,'pix'),pg_temp.f('fin-receipt'),'FIN02 replay devolve o mesmo recibo');
select throws_ok(format('select public.bc_recebimento_registrar_v2(%L,%L,200,%L)',pg_temp.f('fin-key'),pg_temp.f('fin-attendance'),'pix'),'22023','Chave já utilizada com outros dados de recebimento.','FIN02 chave não aceita outro valor');
select throws_ok(format('select public.bc_recebimento_registrar(%L,100,%L)',pg_temp.f('fin-attendance'),'pix'),'55000','Atualize a página para registrar o recebimento com confirmação de tentativa.','FIN02 escrita sem chave foi encerrada');
reset role;
select is((select count(*)::integer from public.recebimentos where atendimento_id=pg_temp.f('fin-attendance')),2,'FIN02 reenvio não cria entrada adicional');
select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
select throws_ok(format('select public.bc_recebimento_registrar_v2(%L,%L,100,%L)',pg_temp.f('fin-key'),pg_temp.f('fin-attendance'),'pix'),'42501','Tentativa pertence a outra identidade.','FIN02 chave não é reutilizada por outra pessoa');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);

savepoint no_total;
delete from public.recebimentos where atendimento_id=pg_temp.f('fin-attendance');
delete from public.pagamentos where atendimento_id=pg_temp.f('fin-attendance');
update public.clinical_treatments set current_version_id=null where id=pg_temp.f('fin-treatment');
set local role authenticated;
select throws_ok(format('select public.bc_recebimento_registrar_v2(gen_random_uuid(),%L,100,%L)',pg_temp.f('fin-attendance'),'pix'),'55000','Valor total não definido: revise a cobrança ou conclua a versão assinada do atendimento.','FIN01 total ausente não vira parcela quitada');
reset role;
select is((select count(*)::integer from public.pagamentos where atendimento_id=pg_temp.f('fin-attendance')),0,'FIN01 falha não cria cobrança');
rollback to no_total;

-- FIN03: o lote precisa ser estornado antes da revisão, inclusive estado legado.
set local role authenticated;
select public.bc_comissao_set(pg_temp.f('worker'),pg_temp.f('procedure'),50);
insert into fixture values('fin-book',public.bc_livro_fechar(pg_temp.f('worker'),date_trunc('week',now() at time zone 'America/Sao_Paulo')::date,date_trunc('week',now() at time zone 'America/Sao_Paulo')::date+6));
insert into fixture values('fin-payout',public.bc_repasse_criar(pg_temp.f('worker'),array[pg_temp.f('fin-book')]));
select throws_ok(format('select public.bc_livro_reabrir(%L,%L)',pg_temp.f('fin-book'),'Revisão fictícia'),'55000','Estorne o repasse ativo antes de revisar ou recalcular o livro.','FIN03 lote ativo impede reabertura');
reset role;
update public.livros_financeiros set status='em_revisao' where id=pg_temp.f('fin-book');
set local role authenticated;
select throws_ok(format('select public.bc_livros_recalcular(%L,null,%L::date,%L::date)',pg_temp.f('worker'),date_trunc('week',now() at time zone 'America/Sao_Paulo')::date,date_trunc('week',now() at time zone 'America/Sao_Paulo')::date+6),'55000','Estorne o repasse ativo antes de revisar ou recalcular o livro.','FIN03 estado legado não permite recalcular lote ativo');
select lives_ok(format('select public.bc_repasse_estornar(%L,%L)',pg_temp.f('fin-payout'),'Revisão fictícia'),'FIN03 estorno libera revisão');
select public.bc_comissao_set(pg_temp.f('worker'),pg_temp.f('procedure'),40);
select is(public.bc_livros_recalcular(pg_temp.f('worker'),null,date_trunc('week',now() at time zone 'America/Sao_Paulo')::date,date_trunc('week',now() at time zone 'America/Sao_Paulo')::date+6),1,'FIN03 livro pode ser recalculado depois do estorno');
insert into fixture values('fin-new-payout',public.bc_repasse_criar(pg_temp.f('worker'),array[pg_temp.f('fin-book')]));
reset role;
select is((select valor_total from public.repasses where id=pg_temp.f('fin-new-payout')),200::numeric,'FIN03 novo lote usa500x40%=200');

-- FIN04: simula inconsistências anteriores sem efetuar baixa parcial.
update public.livros_financeiros set status='em_revisao' where id=pg_temp.f('fin-book');
set local role authenticated;
select throws_ok(format('select public.bc_repasse_baixar(%L)',pg_temp.f('fin-new-payout')),'55000','Repasse exige livros ativos fechados da mesma profissional.','FIN04 livro em revisão impede baixa');
reset role;
update public.livros_financeiros set status='fechado',repasse_total=190 where id=pg_temp.f('fin-book');
set local role authenticated;
select throws_ok(format('select public.bc_repasse_baixar(%L)',pg_temp.f('fin-new-payout')),'55000','Valor do repasse diverge dos livros; estorne e monte um novo lote.','FIN04 total divergente impede baixa');
reset role;
select is((select status from public.repasses where id=pg_temp.f('fin-new-payout')),'aberto','FIN04 falhas preservam lote aberto');
update public.livros_financeiros set repasse_total=200 where id=pg_temp.f('fin-book');
update public.repasse_livros set ativo=false where repasse_id=pg_temp.f('fin-new-payout');
set local role authenticated;
select throws_ok(format('select public.bc_repasse_baixar(%L)',pg_temp.f('fin-new-payout')),'55000','Repasse exige livros ativos fechados da mesma profissional.','FIN04 lote sem livros ativos impede baixa');
reset role;
update public.repasse_livros set ativo=true where repasse_id=pg_temp.f('fin-new-payout');
set local role authenticated;
select lives_ok(format('select public.bc_repasse_baixar(%L)',pg_temp.f('fin-new-payout')),'FIN04 lote coerente pode ser baixado');
reset role;
select is((select status from public.livros_financeiros where id=pg_temp.f('fin-book')),'pago','FIN04 baixa atualiza livro junto com lote');
select is((select status from public.repasses where id=pg_temp.f('fin-new-payout')),'pago','FIN04 baixa conclui lote coerente');
select * from finish();
rollback;
