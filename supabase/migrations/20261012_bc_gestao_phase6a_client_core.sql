-- BC Gestão Fase 6A — cadastro ampliado da cliente.
-- Mudança aditiva/forward-safe: registros legados podem permanecer incompletos.
-- Novos cadastros e edições v2 passam por RPCs que derivam autoria no backend.

alter table public.clientes
  add column if not exists cpf text,
  add column if not exists data_nascimento date,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_cpf text,
  add column if not exists responsavel_parentesco text,
  add column if not exists responsavel_telefone text;

-- Não persiste idade: ela é sempre derivada de data_nascimento.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'clientes_cpf_digits_check'
       and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes
      add constraint clientes_cpf_digits_check
      check (cpf is null or cpf ~ '^[0-9]{11}$');
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'clientes_data_nascimento_not_future_check'
       and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes
      add constraint clientes_data_nascimento_not_future_check
      check (data_nascimento is null or data_nascimento <= current_date);
  end if;
end;
$$;

create unique index if not exists clientes_cpf_unique_idx
  on public.clientes (cpf)
  where cpf is not null;

create or replace function private.bc_cliente_create_v2_impl(
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente_id uuid;
  v_nome text := nullif(trim(p_payload ->> 'nome'), '');
  v_cpf text := regexp_replace(coalesce(p_payload ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_data_nascimento date;
  v_telefone text := nullif(trim(p_payload ->> 'telefone'), '');
  v_email text := nullif(trim(p_payload ->> 'email'), '');
  v_responsavel_nome text := nullif(trim(p_payload ->> 'responsavel_nome'), '');
  v_responsavel_cpf text := regexp_replace(coalesce(p_payload ->> 'responsavel_cpf', ''), '[^0-9]', '', 'g');
  v_responsavel_parentesco text := nullif(trim(p_payload ->> 'responsavel_parentesco'), '');
  v_responsavel_telefone text := nullif(trim(p_payload ->> 'responsavel_telefone'), '');
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao cadastro de clientes.' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados cadastrais inválidos.' using errcode = '22023';
  end if;

  begin
    v_data_nascimento := nullif(trim(p_payload ->> 'data_nascimento'), '')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'Data de nascimento inválida.' using errcode = '22023';
  end;

  if v_nome is null or v_telefone is null or v_data_nascimento is null or char_length(v_cpf) <> 11 then
    raise exception 'Nome, CPF, data de nascimento e telefone são obrigatórios.' using errcode = '22023';
  end if;

  if v_data_nascimento > current_date then
    raise exception 'Data de nascimento não pode ser futura.' using errcode = '22023';
  end if;

  if v_data_nascimento > (current_date - interval '18 years')::date then
    if v_responsavel_nome is null
       or char_length(v_responsavel_cpf) <> 11
       or v_responsavel_parentesco is null
       or v_responsavel_telefone is null then
      raise exception 'Responsável legal é obrigatório para cliente menor de 18 anos.' using errcode = '22023';
    end if;
  else
    v_responsavel_nome := nullif(v_responsavel_nome, '');
    v_responsavel_cpf := nullif(v_responsavel_cpf, '');
    v_responsavel_parentesco := nullif(v_responsavel_parentesco, '');
    v_responsavel_telefone := nullif(v_responsavel_telefone, '');
  end if;

  insert into public.clientes (
    nome,
    cpf,
    data_nascimento,
    telefone,
    email,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    responsavel_nome,
    responsavel_cpf,
    responsavel_parentesco,
    responsavel_telefone,
    created_by
  ) values (
    v_nome,
    v_cpf,
    v_data_nascimento,
    v_telefone,
    v_email,
    nullif(trim(p_payload ->> 'cep'), ''),
    nullif(trim(p_payload ->> 'logradouro'), ''),
    nullif(trim(p_payload ->> 'numero'), ''),
    nullif(trim(p_payload ->> 'complemento'), ''),
    nullif(trim(p_payload ->> 'bairro'), ''),
    nullif(trim(p_payload ->> 'cidade'), ''),
    upper(nullif(trim(p_payload ->> 'uf'), '')),
    v_responsavel_nome,
    nullif(v_responsavel_cpf, ''),
    v_responsavel_parentesco,
    v_responsavel_telefone,
    v_user_id
  )
  returning id into v_cliente_id;

  return v_cliente_id;
exception
  when unique_violation then
    raise exception 'CPF já cadastrado na BC Estética.' using errcode = '23505';
end;
$$;

create or replace function public.bc_cliente_create_v2(
  p_payload jsonb
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_cliente_create_v2_impl(p_payload);
$$;

create or replace function private.bc_cliente_update_v2_impl(
  p_cliente_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_cliente public.clientes%rowtype;
  v_nome text := nullif(trim(p_payload ->> 'nome'), '');
  v_cpf text := regexp_replace(coalesce(p_payload ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_data_nascimento date;
  v_telefone text := nullif(trim(p_payload ->> 'telefone'), '');
  v_responsavel_nome text := nullif(trim(p_payload ->> 'responsavel_nome'), '');
  v_responsavel_cpf text := regexp_replace(coalesce(p_payload ->> 'responsavel_cpf', ''), '[^0-9]', '', 'g');
  v_responsavel_parentesco text := nullif(trim(p_payload ->> 'responsavel_parentesco'), '');
  v_responsavel_telefone text := nullif(trim(p_payload ->> 'responsavel_telefone'), '');
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado ao cadastro de clientes.' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados cadastrais inválidos.' using errcode = '22023';
  end if;

  select * into v_cliente
    from public.clientes
   where id = p_cliente_id
   for update;

  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  if not private.is_bc_admin() and not v_cliente.ativo then
    raise exception 'Cliente arquivado não pode ser editado pela colaboradora.' using errcode = '42501';
  end if;

  begin
    v_data_nascimento := nullif(trim(p_payload ->> 'data_nascimento'), '')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'Data de nascimento inválida.' using errcode = '22023';
  end;

  if v_nome is null or v_telefone is null or v_data_nascimento is null or char_length(v_cpf) <> 11 then
    raise exception 'Nome, CPF, data de nascimento e telefone são obrigatórios.' using errcode = '22023';
  end if;

  if v_data_nascimento > current_date then
    raise exception 'Data de nascimento não pode ser futura.' using errcode = '22023';
  end if;

  if v_data_nascimento > (current_date - interval '18 years')::date then
    if v_responsavel_nome is null
       or char_length(v_responsavel_cpf) <> 11
       or v_responsavel_parentesco is null
       or v_responsavel_telefone is null then
      raise exception 'Responsável legal é obrigatório para cliente menor de 18 anos.' using errcode = '22023';
    end if;
  else
    v_responsavel_nome := nullif(v_responsavel_nome, '');
    v_responsavel_cpf := nullif(v_responsavel_cpf, '');
    v_responsavel_parentesco := nullif(v_responsavel_parentesco, '');
    v_responsavel_telefone := nullif(v_responsavel_telefone, '');
  end if;

  update public.clientes
     set nome = v_nome,
         cpf = v_cpf,
         data_nascimento = v_data_nascimento,
         telefone = v_telefone,
         email = nullif(trim(p_payload ->> 'email'), ''),
         cep = nullif(trim(p_payload ->> 'cep'), ''),
         logradouro = nullif(trim(p_payload ->> 'logradouro'), ''),
         numero = nullif(trim(p_payload ->> 'numero'), ''),
         complemento = nullif(trim(p_payload ->> 'complemento'), ''),
         bairro = nullif(trim(p_payload ->> 'bairro'), ''),
         cidade = nullif(trim(p_payload ->> 'cidade'), ''),
         uf = upper(nullif(trim(p_payload ->> 'uf'), '')),
         responsavel_nome = v_responsavel_nome,
         responsavel_cpf = nullif(v_responsavel_cpf, ''),
         responsavel_parentesco = v_responsavel_parentesco,
         responsavel_telefone = v_responsavel_telefone,
         updated_at = now()
   where id = p_cliente_id;

  return p_cliente_id;
exception
  when unique_violation then
    raise exception 'CPF já cadastrado na BC Estética.' using errcode = '23505';
end;
$$;

create or replace function public.bc_cliente_update_v2(
  p_cliente_id uuid,
  p_payload jsonb
)
returns uuid
language sql
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select private.bc_cliente_update_v2_impl(p_cliente_id, p_payload);
$$;

create or replace function public.bc_cliente_duplicate_candidates(
  p_cpf text,
  p_nome text,
  p_data_nascimento date,
  p_telefone text
)
returns table (
  id uuid,
  nome text,
  cpf text,
  data_nascimento date,
  telefone text,
  ativo boolean
)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select c.id,
         c.nome,
         c.cpf,
         c.data_nascimento,
         c.telefone,
         c.ativo
    from public.clientes c
   where private.is_bc_active_staff()
     and (
       (
         nullif(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'), '') is not null
         and c.cpf = regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g')
       )
       or (
         lower(trim(c.nome)) = lower(trim(coalesce(p_nome, '')))
         and c.data_nascimento = p_data_nascimento
         and regexp_replace(coalesce(c.telefone, ''), '[^0-9]', '', 'g') =
             regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g')
       )
     )
   order by case
     when c.cpf = regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g') then 0
     else 1
   end,
   c.nome
   limit 10;
$$;

-- O trigger de audit_log já existente continua registrando criação/edição,
-- ator e horário sem duplicar CPF/endereço/responsável integralmente no log.

revoke all on function public.bc_cliente_create_v2(jsonb) from public;
revoke execute on function public.bc_cliente_create_v2(jsonb) from anon;
grant execute on function public.bc_cliente_create_v2(jsonb) to authenticated;

revoke all on function public.bc_cliente_update_v2(uuid, jsonb) from public;
revoke execute on function public.bc_cliente_update_v2(uuid, jsonb) from anon;
grant execute on function public.bc_cliente_update_v2(uuid, jsonb) to authenticated;

revoke all on function public.bc_cliente_duplicate_candidates(text, text, date, text) from public;
revoke execute on function public.bc_cliente_duplicate_candidates(text, text, date, text) from anon;
grant execute on function public.bc_cliente_duplicate_candidates(text, text, date, text) to authenticated;

revoke all on function private.bc_cliente_create_v2_impl(jsonb) from public;
revoke execute on function private.bc_cliente_create_v2_impl(jsonb) from anon;
grant execute on function private.bc_cliente_create_v2_impl(jsonb) to authenticated;

revoke all on function private.bc_cliente_update_v2_impl(uuid, jsonb) from public;
revoke execute on function private.bc_cliente_update_v2_impl(uuid, jsonb) from anon;
grant execute on function private.bc_cliente_update_v2_impl(uuid, jsonb) to authenticated;
