begin;
create extension if not exists pgtap with schema extensions;
select plan(51);
\ir ../fixtures/agenda.psql
-- O catálogo semeado por migrações não interfere nas combinações desta fixture.
update public.procedimentos set ativo=false where id<>pg_temp.f('procedure');

-- Datas civis relativas tornam o teste independente da hora e do fim do mês.
create temporary table calendar_clock as
select current_month,
  (current_month+interval '1 month')::date as next_month,
  (current_month+interval '1 month 9 days')::date as day,
  (current_month+interval '12 months')::date as last_month,
  (current_month+interval '12 months 15 days')::date as last_day,
  (current_month-interval '1 month')::date as past_month,
  (current_month+interval '13 months')::date as beyond_month
from (select date_trunc('month',now() at time zone 'America/Sao_Paulo')::date as current_month) c;
grant select on calendar_clock to service_role;
create function pg_temp.overview_available(p_date date) returns boolean language sql as $$
  select (d->>'available')::boolean
  from jsonb_array_elements(public.bc_public_agenda_overview(p_date)) d
  where d->>'date'=p_date::text
$$;

select ok(has_function_privilege('service_role','public.bc_public_agenda_overview(date)','EXECUTE'),'Somente backend pode consultar overview');
select ok(not has_function_privilege('anon','public.bc_public_agenda_overview(date)','EXECUTE'),'Anon não contorna Edge pelo overview');
select ok(not has_function_privilege('authenticated','public.bc_public_agenda_overview(date)','EXECUTE'),'Authenticated não contorna Edge pelo overview');
select ok(not has_function_privilege('anon','private.bc_schedule_assert_public_month(date)','EXECUTE'),'Validador privado não é público');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid='public.bc_public_agenda_overview(date)'::regprocedure),'Overview fixa search_path seguro');

insert into public.professional_availability_days(professional_user_id,local_date,enabled,start_time,end_time,created_by,updated_by)
select pg_temp.f('worker'),day+n,true,
  case n when 0 then time '09:00' when 1 then time '12:00' when 2 then time '14:00'
    when 3 then time '15:00' when 4 then time '16:00' when 5 then time '17:00' else time '09:07' end,
  case n when 0 then time '10:00' when 1 then time '12:30' when 2 then time '14:30'
    when 3 then time '15:30' when 4 then time '16:15' when 5 then time '17:30' else time '09:45' end,
  pg_temp.f('admin'),pg_temp.f('admin')
from calendar_clock cross join generate_series(0,7) n where n<>6;
update public.professional_availability_days set enabled=false where local_date=(select day+5 from calendar_clock);
insert into public.professional_availability_days(professional_user_id,local_date,enabled,start_time,end_time,created_by,updated_by)
select pg_temp.f('worker'),last_day,true,'09:00','10:00',pg_temp.f('admin'),pg_temp.f('admin') from calendar_clock;
insert into public.professional_schedule_blocks(professional_user_id,starts_at,ends_at,block_type,internal_note,created_by)
select pg_temp.f('worker'),((day+1)+time '12:00') at time zone 'America/Sao_Paulo',
  ((day+1)+time '12:30') at time zone 'America/Sao_Paulo','almoco','PRIVATE_LUNCH',pg_temp.f('admin') from calendar_clock;
insert into public.professional_agenda_inactivations(professional_user_id,starts_on,planned_ends_on,reason,internal_note,created_by)
select pg_temp.f('worker'),day+3,day+3,'motivo_medico','PRIVATE_REASON',pg_temp.f('admin') from calendar_clock;
insert into public.agendamentos(cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,status,created_by,origem)
select pg_temp.f('client'),pg_temp.f('worker'),pg_temp.f('procedure'),
  ((day+2)+time '14:00') at time zone 'America/Sao_Paulo',
  ((day+2)+time '14:30') at time zone 'America/Sao_Paulo','agendado',pg_temp.f('admin'),'encaixe' from calendar_clock;

select is(jsonb_array_length(public.bc_public_agenda_overview((select next_month from calendar_clock))),
  extract(day from (select next_month+interval '1 month - 1 day' from calendar_clock))::integer,'Overview contém todos os dias do mês solicitado');
select ok((select bool_and((d->>'date')::date>=next_month and (d->>'date')::date<(next_month+interval '1 month')::date)
  from calendar_clock cross join lateral jsonb_array_elements(public.bc_public_agenda_overview(next_month)) d),'Overview não repete o mês atual ao navegar');
select ok((select pg_temp.overview_available(day) from calendar_clock),'Dia com slot de profissional e procedimento elegíveis aparece disponível');
select ok((select not pg_temp.overview_available(day+1) from calendar_clock),'Almoço que ocupa toda a janela deixa dia indisponível');
select ok((select not pg_temp.overview_available(day+2) from calendar_clock),'Conflito que ocupa toda a janela deixa dia indisponível');
select ok((select not pg_temp.overview_available(day+3) from calendar_clock),'Inativação deixa dia indisponível sem expor o motivo');
select ok((select not pg_temp.overview_available(day+4) from calendar_clock),'Janela menor que a duração não oferece disponibilidade');
select ok((select not pg_temp.overview_available(day+5) from calendar_clock),'Disponibilidade desabilitada não oferece slot');
select ok((select not pg_temp.overview_available(day+6) from calendar_clock),'Dia sem disponibilidade explícita não oferece slot');
select ok((select pg_temp.overview_available(day+7) from calendar_clock),'Janela desalinhada usa o próximo quarto de hora válido');
select is(public.bc_public_agenda_slots(pg_temp.f('worker'),pg_temp.f('procedure'),(select day+7 from calendar_clock))->0->>'time','09:15','Slots e overview usam a mesma grade de quinze minutos');
select ok(not exists(select 1 from calendar_clock cross join lateral jsonb_array_elements(public.bc_public_agenda_overview(next_month)) d
  cross join lateral jsonb_object_keys(d) k where k not in ('date','available')),'RPC overview permite somente data e booleano');
select ok(public.bc_public_agenda_overview((select next_month from calendar_clock))::text not like '%PRIVATE%','Overview não retorna nomes, bloqueios nem motivos');
select ok((select bool_and((d->>'available')::boolean=(jsonb_array_length(public.bc_public_agenda_slots(pg_temp.f('worker'),pg_temp.f('procedure'),(d->>'date')::date))>0))
  from calendar_clock cross join lateral jsonb_array_elements(public.bc_public_agenda_overview(next_month)) d),'Overview coincide com slots reais de cada dia no cenário de uma profissional');

insert into public.professional_availability_days(professional_user_id,local_date,enabled,start_time,end_time,created_by,updated_by)
select pg_temp.f('ordinary'),day+1,true,'12:00','12:30',pg_temp.f('admin'),pg_temp.f('admin') from calendar_clock;
select ok((select pg_temp.overview_available(day+1) from calendar_clock),'Outra profissional elegível mantém dia disponível apesar do almoço da primeira');
update public.staff_profiles set active=false where user_id=pg_temp.f('ordinary');
select ok((select not pg_temp.overview_available(day+1) from calendar_clock),'Profissional alternativa inativa não oferece slot');
update public.staff_profiles set active=true where user_id=pg_temp.f('ordinary');
delete from public.professional_availability_days where professional_user_id=pg_temp.f('ordinary');

insert into fixture values('short_procedure','a1000000-0000-4000-8000-000000000009'),('short_version','a1000000-0000-4000-8000-00000000000a');
insert into public.procedimentos(id,nome,duracao_padrao,ativo,created_by)
values(pg_temp.f('short_procedure'),'Procedimento curto CI',15,true,pg_temp.f('admin'));
insert into public.procedure_versions(id,procedimento_id,version,status,nome,classe_documental,price_mode,base_price,created_by)
values(pg_temp.f('short_version'),pg_temp.f('short_procedure'),1,'published','Procedimento curto CI','nao_injetavel','fixed',100,pg_temp.f('admin'));
update public.procedimentos set current_version_id=pg_temp.f('short_version'),access_mode='general' where id=pg_temp.f('short_procedure');
select ok((select pg_temp.overview_available(day+4) from calendar_clock),'Outro procedimento elegível que cabe na janela mantém dia disponível');
update public.procedimentos set ativo=false where id=pg_temp.f('short_procedure');
select ok((select not pg_temp.overview_available(day+4) from calendar_clock),'Procedimento alternativo inativo deixa de oferecer slot');

update public.staff_profiles set active=false where user_id=pg_temp.f('worker');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Profissional inativa não mantém dia disponível');
update public.staff_profiles set active=true,atende_clientes=false where user_id=pg_temp.f('worker');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Profissional que não atende não mantém dia disponível');
update public.staff_profiles set atende_clientes=true where user_id=pg_temp.f('worker');
update public.procedimentos set access_mode='restricted' where id=pg_temp.f('procedure');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Procedimento restrito não oferece profissional sem permissão');
insert into public.procedure_professional_permissions(procedimento_id,professional_user_id,allowed,granted_by)
values(pg_temp.f('procedure'),pg_temp.f('worker'),true,pg_temp.f('admin'));
select ok((select pg_temp.overview_available(day) from calendar_clock),'Permissão explícita torna a combinação elegível');
update public.procedure_professional_permissions set allowed=false where procedimento_id=pg_temp.f('procedure');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Permissão negada não oferece disponibilidade');
update public.procedure_professional_permissions set allowed=true,revoked_at=now() where procedimento_id=pg_temp.f('procedure');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Permissão revogada não oferece disponibilidade');
update public.procedimentos set access_mode='general',ativo=false where id=pg_temp.f('procedure');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Procedimento inativo não oferece disponibilidade');
update public.procedimentos set ativo=true,archived_at=now() where id=pg_temp.f('procedure');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Procedimento arquivado não oferece disponibilidade');
update public.procedimentos set archived_at=null,duracao_padrao=null where id=pg_temp.f('procedure');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Procedimento sem duração não oferece disponibilidade');
update public.procedimentos set duracao_padrao=30,current_version_id=null where id=pg_temp.f('procedure');
select ok((select not pg_temp.overview_available(day) from calendar_clock),'Procedimento sem versão publicada não oferece disponibilidade');
update public.procedimentos set current_version_id=pg_temp.f('version') where id=pg_temp.f('procedure');

select lives_ok(format('select public.bc_public_agenda_overview(%L)',(select current_month from calendar_clock)),'Overview aceita mês atual');
select ok((select pg_temp.overview_available(last_day) from calendar_clock),'Overview inclui disponibilidade no décimo segundo mês');
select ok(jsonb_array_length(public.bc_public_agenda_month(pg_temp.f('worker'),pg_temp.f('procedure'),(select last_month from calendar_clock)))>0,'Month aceita décimo segundo mês');
select ok(jsonb_array_length(public.bc_public_agenda_slots(pg_temp.f('worker'),pg_temp.f('procedure'),(select last_day from calendar_clock)))>0,'Slots aceita décimo segundo mês');
select throws_ok('select public.bc_public_agenda_overview(null)','22023','Data fora do mês disponível.','Overview rejeita mês nulo');
select throws_ok(format('select public.bc_public_agenda_overview(%L)',(select past_month from calendar_clock)),'22023','Data fora do mês disponível.','Overview rejeita mês passado');
select throws_ok(format('select public.bc_public_agenda_overview(%L)',(select beyond_month from calendar_clock)),'22023','Data fora do mês disponível.','Overview rejeita décimo terceiro mês');
select throws_ok(format('select public.bc_public_agenda_month(%L,%L,%L)',pg_temp.f('worker'),pg_temp.f('procedure'),(select past_month from calendar_clock)),'22023','Data fora do mês disponível.','Month rejeita mês passado');
select throws_ok(format('select public.bc_public_agenda_month(%L,%L,%L)',pg_temp.f('worker'),pg_temp.f('procedure'),(select beyond_month from calendar_clock)),'22023','Data fora do mês disponível.','Month rejeita décimo terceiro mês');
select throws_ok(format('select public.bc_public_agenda_slots(%L,%L,%L)',pg_temp.f('worker'),pg_temp.f('procedure'),(select past_month from calendar_clock)),'22023','Data fora do mês disponível.','Slots rejeita mês passado');
select throws_ok(format('select public.bc_public_agenda_slots(%L,%L,%L)',pg_temp.f('worker'),pg_temp.f('procedure'),(select beyond_month from calendar_clock)),'22023','Data fora do mês disponível.','Slots rejeita décimo terceiro mês');

set local role service_role;
insert into fixture values('future_booking',(public.bc_public_agenda_book('Pessoa futura CI','31900000000',pg_temp.f('worker'),pg_temp.f('procedure'),
  ((select day from calendar_clock)+time '09:00') at time zone 'America/Sao_Paulo',repeat('f',64))->>'appointment_id')::uuid);
insert into fixture values('last_booking',(public.bc_public_agenda_book('Pessoa limite CI','31900000001',pg_temp.f('worker'),pg_temp.f('procedure'),
  ((select last_day from calendar_clock)+time '09:00') at time zone 'America/Sao_Paulo',repeat('g',64))->>'appointment_id')::uuid);
select is(public.bc_public_agenda_book('Pessoa passada CI','31900000002',pg_temp.f('worker'),pg_temp.f('procedure'),
  ((select past_month from calendar_clock)+time '09:00') at time zone 'America/Sao_Paulo',repeat('h',64))->>'error_code','22023','Book rejeita mês passado');
select is(public.bc_public_agenda_book('Pessoa além CI','31900000003',pg_temp.f('worker'),pg_temp.f('procedure'),
  ((select beyond_month from calendar_clock)+time '09:00') at time zone 'America/Sao_Paulo',repeat('i',64))->>'error_code','22023','Book rejeita décimo terceiro mês');
select is(public.bc_public_agenda_book('Pessoa conflito CI','31900000004',pg_temp.f('worker'),pg_temp.f('procedure'),
  ((select day from calendar_clock)+time '09:00') at time zone 'America/Sao_Paulo',repeat('j',64))->>'error_code','23P01','Book futuro preserva proteção de conflitos');
reset role;
select is((select booking_channel from public.agendamentos where id=pg_temp.f('future_booking')),'site','Reserva no mês seguinte usa o mesmo canal site');
select is((select cliente_id from public.agendamentos where id=pg_temp.f('last_booking')),null::uuid,'Reserva no limite de doze meses preserva identidade pendente');
select is((select (inicio at time zone 'America/Sao_Paulo')::date from public.agendamentos where id=pg_temp.f('last_booking')),(select last_day from calendar_clock),'Book aceita o mesmo horizonte civil do calendário');
select ok(not public.bc_public_agenda_slots(pg_temp.f('worker'),pg_temp.f('procedure'),(select day from calendar_clock))
  @> jsonb_build_array(jsonb_build_object('time','09:00')),'Reserva futura desaparece dos slots');

select * from finish();
rollback;
