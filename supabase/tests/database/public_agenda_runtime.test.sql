begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_table('public', 'professional_availability_days', 'agenda deve criar disponibilidade diária');
select has_table('public', 'professional_schedule_blocks', 'agenda deve criar bloqueios');
select has_table('public', 'professional_agenda_inactivations', 'agenda deve criar inativações');

select has_column(
  'public',
  'staff_profiles',
  'pode_gerenciar_agendas',
  'staff_profiles deve distinguir Colaboradora Chefe sem promover para admin'
);

select ok(
  to_regprocedure('public.bc_schedule_day_upsert(uuid,date,boolean,time without time zone,time without time zone)') is not null,
  'RPC interno de disponibilidade deve existir'
);

select ok(
  not has_function_privilege('anon', 'public.bc_schedule_day_upsert(uuid,date,boolean,time without time zone,time without time zone)', 'EXECUTE'),
  'anon não executa RPC interno de disponibilidade'
);

select ok(
  has_function_privilege('authenticated', 'public.bc_schedule_day_upsert(uuid,date,boolean,time without time zone,time without time zone)', 'EXECUTE'),
  'authenticated pode chamar wrapper interno; autorização fina ocorre dentro da função'
);

select ok(
  has_function_privilege('service_role', 'public.bc_public_agenda_book(text,text,uuid,uuid,timestamp with time zone,text)', 'EXECUTE'),
  'service_role pode executar reserva pública pelo backend'
);

select ok(
  not has_function_privilege('anon', 'public.bc_public_agenda_book(text,text,uuid,uuid,timestamp with time zone,text)', 'EXECUTE'),
  'anon não executa diretamente a reserva pública'
);

select ok(
  not has_function_privilege('authenticated', 'public.bc_public_agenda_book(text,text,uuid,uuid,timestamp with time zone,text)', 'EXECUTE'),
  'authenticated não contorna a Edge Function para reservar diretamente'
);

select * from finish();
rollback;
