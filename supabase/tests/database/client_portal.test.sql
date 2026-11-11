begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

insert into fixture values
  ('other-client', 'a1000000-0000-4000-8000-000000000011'),
  ('unlinked-booking', 'a1000000-0000-4000-8000-000000000012');
insert into public.clientes(id, nome, telefone, created_by)
values (pg_temp.f('other-client'), 'Segunda pessoa fictícia', '31900000000', pg_temp.f('admin'));
insert into public.agendamentos(cliente_id, colaboradora_user_id, procedimento_id, inicio, status, created_by, observacao_administrativa)
select pg_temp.f(data.cliente), pg_temp.f('worker'), pg_temp.f('procedure'),
       now() + data.offset_time, data.status, pg_temp.f('admin'), 'Nota interna fictícia'
from (values
  ('client', interval '4 hours', 'agendado'),
  ('other-client', interval '5 hours', 'agendado'),
  ('client', interval '-1 day', 'agendado'),
  ('client', interval '6 hours', 'cancelado')
) as data(cliente, offset_time, status);
insert into public.agendamentos(
  id, colaboradora_user_id, procedimento_id, inicio, origem, booking_channel,
  public_booking_name, public_booking_phone, public_booking_phone_normalized
) values (
  pg_temp.f('unlinked-booking'), pg_temp.f('worker'), pg_temp.f('procedure'),
  now() + interval '7 hours', 'site', 'site', 'Pessoa fictícia CI', '31900000000', '31900000000'
);

create temporary table portal_tokens (name text primary key, issued jsonb not null);
grant select, insert on portal_tokens to authenticated, service_role;
select ok(not has_table_privilege('authenticated', 'private.bc_client_portal_links', 'SELECT'), 'Hash inacessível à equipe');
select ok(not has_function_privilege('anon', 'public.bc_client_portal_schedule(text)', 'EXECUTE'), 'Público sem RPC direta');
select ok(not has_function_privilege('anon', 'public.bc_client_portal_issue(uuid)', 'EXECUTE'), 'Público não gera links');
select ok(not has_function_privilege('authenticated', 'public.bc_client_portal_schedule(text)', 'EXECUTE'), 'Equipe sem RPC direta do portal');

select set_config('request.jwt.claim.sub', pg_temp.f('chief')::text, true);
set local role authenticated;
select throws_ok(format('select public.bc_client_portal_issue(%L)', pg_temp.f('client')),
  '42501', 'Acesso restrito à administração da clínica.', 'Colaboradora chefe não gera acesso');
select throws_ok(format('select public.bc_client_portal_revoke(%L)', pg_temp.f('client')),
  '42501', 'Acesso restrito à administração da clínica.', 'Colaboradora chefe não revoga acesso');
reset role;
select set_config('request.jwt.claim.sub', pg_temp.f('admin')::text, true);
set local role authenticated;
insert into portal_tokens values
  ('first', public.bc_client_portal_issue(pg_temp.f('client'))),
  ('other', public.bc_client_portal_issue(pg_temp.f('other-client')));
reset role;

select ok((select issued->>'token' ~ '^[a-f0-9]{64}$' from portal_tokens where name = 'first'), 'Token aleatório de 32 bytes em hexadecimal');
select is((select expires_at from private.bc_client_portal_links where cliente_id = pg_temp.f('client')),
  now() + interval '24 hours', 'Acesso expira em 24 horas');
select ok((select token_hash = extensions.digest(issued->>'token', 'sha256')
  from private.bc_client_portal_links, portal_tokens
  where cliente_id = pg_temp.f('client') and name = 'first'), 'Banco guarda somente hash do token');
select ok(not exists(select 1 from public.audit_log
  where action = 'client_portal_link_issued' and new_data ? 'token'), 'Auditoria não guarda token');

set local role service_role;
select is(public.bc_client_portal_schedule((select issued->>'token' from portal_tokens where name = 'first')),
  jsonb_build_object('appointments', jsonb_build_array(jsonb_build_object('starts_at', now() + interval '4 hours'))),
  'Mostra somente a hora futura da cliente vinculada, mesmo com telefone igual');
select is(public.bc_client_portal_schedule((select issued->>'token' from portal_tokens where name = 'other')),
  jsonb_build_object('appointments', jsonb_build_array(jsonb_build_object('starts_at', now() + interval '5 hours'))),
  'Segundo link vê somente o segundo cadastro');
reset role;

set local role authenticated;
select lives_ok(format('select public.bc_agendamento_link_cliente(%L, %L)',
  pg_temp.f('unlinked-booking'), pg_temp.f('client')), 'Admin vincula a reserva do site pelo fluxo existente');
insert into portal_tokens values ('replacement', public.bc_client_portal_issue(pg_temp.f('client')));
reset role;
set local role service_role;
select is(public.bc_client_portal_schedule((select issued->>'token' from portal_tokens where name = 'first')),
  null::jsonb, 'Emissão invalida o link anterior');
select is(public.bc_client_portal_schedule((select issued->>'token' from portal_tokens where name = 'replacement')),
  jsonb_build_object('appointments', jsonb_build_array(
    jsonb_build_object('starts_at', now() + interval '4 hours'),
    jsonb_build_object('starts_at', now() + interval '7 hours')
  )), 'Reserva do site aparece depois do vínculo');
reset role;
set local role authenticated;
select is(public.bc_client_portal_revoke(pg_temp.f('client')), true, 'Admin revoga o acesso');
select is(public.bc_client_portal_revoke(pg_temp.f('client')), false, 'Repetir revogação é seguro');
reset role;
update private.bc_client_portal_links set expires_at = now() where cliente_id = pg_temp.f('other-client');
set local role service_role;
select is(public.bc_client_portal_schedule((select issued->>'token' from portal_tokens where name = 'replacement')),
  null::jsonb, 'Link revogado não consulta');
select is(public.bc_client_portal_schedule((select issued->>'token' from portal_tokens where name = 'other')),
  null::jsonb, 'Link expirado não consulta');
reset role;

set local role authenticated;
insert into portal_tokens values ('before-archive', public.bc_client_portal_issue(pg_temp.f('client')));
reset role;
update public.clientes set ativo = false where id = pg_temp.f('client');
set local role authenticated;
select throws_ok(format('select public.bc_client_portal_issue(%L)', pg_temp.f('client')),
  '22023', 'Selecione uma cliente ativa.', 'Cadastro arquivado não recebe link');
reset role;
update public.clientes set ativo = true where id = pg_temp.f('client');
set local role service_role;
select is(public.bc_client_portal_schedule((select issued->>'token' from portal_tokens where name = 'before-archive')),
  null::jsonb, 'Reativar o cadastro não restaura um link antigo');
reset role;
select * from finish();
rollback;
