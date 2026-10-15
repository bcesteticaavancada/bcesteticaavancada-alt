begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- Usuários 100% fictícios e descartados no rollback deste teste.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'chief-ci@example.invalid', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'worker-ci@example.invalid', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'ordinary-ci@example.invalid', '', now(), now());

insert into public.staff_profiles (user_id, display_name, role, active, atende_clientes, pode_gerenciar_agendas)
values
  ('11111111-1111-4111-8111-111111111111', 'Chefe CI', 'colaborador', true, true, true),
  ('22222222-2222-4222-8222-222222222222', 'Profissional CI', 'colaborador', true, true, false),
  ('33333333-3333-4333-8333-333333333333', 'Colaboradora CI', 'colaborador', true, true, false);

select is(
  (select role from public.staff_profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  'colaborador',
  'Colaboradora Chefe continua tecnicamente com role colaborador'
);

select ok(
  (select pode_gerenciar_agendas from public.staff_profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  'Chefe recebe somente a capacidade operacional de agenda'
);

-- Simula JWT da Colaboradora Chefe.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.bc_schedule_day_upsert(
    '22222222-2222-4222-8222-222222222222'::uuid,
    (current_date + 1), true, '09:00'::time, '18:00'::time
  )$$,
  'Colaboradora Chefe pode gerir disponibilidade de outra profissional'
);

reset role;

select ok(
  exists(
    select 1 from public.professional_availability_days
     where professional_user_id = '22222222-2222-4222-8222-222222222222'
       and local_date = current_date + 1
       and enabled = true
  ),
  'Alteração feita pela Chefe persiste na agenda da profissional alvo'
);

-- Simula colaboradora comum tentando alterar a agenda alheia.
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.bc_schedule_day_upsert(
    '22222222-2222-4222-8222-222222222222'::uuid,
    (current_date + 2), true, '09:00'::time, '18:00'::time
  )$$,
  '42501',
  'Acesso negado à agenda da profissional.',
  'Colaboradora comum não pode gerir agenda de outra profissional'
);

select lives_ok(
  $$select public.bc_schedule_day_upsert(
    '33333333-3333-4333-8333-333333333333'::uuid,
    (current_date + 2), true, '10:00'::time, '17:00'::time
  )$$,
  'Colaboradora comum continua podendo gerir a própria disponibilidade'
);

reset role;
select * from finish();
rollback;
