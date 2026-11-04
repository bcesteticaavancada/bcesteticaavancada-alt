-- Entrada manual de produtos e lotes na sessão clínica.
-- Não muda tabelas nem o gate de finalização: mantém product_id, lot_id,
-- validade, snapshot e trilha de auditoria existentes.

create or replace function private.bc_treatment_product_usage_add_text_impl(
  p_treatment_id uuid,
  p_product_name text,
  p_lot_code text,
  p_expires_on date,
  p_quantity numeric,
  p_unit text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_treatment public.clinical_treatments%rowtype;
  v_product_name text := nullif(btrim(p_product_name), '');
  v_lot_code text := nullif(btrim(p_lot_code), '');
  v_unit text := nullif(btrim(p_unit), '');
  v_product_id uuid;
  v_lot_id uuid;
  v_usage_id uuid;
  v_matches integer;
  v_lot public.clinical_product_lots%rowtype;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado aos produtos do atendimento.' using errcode = '42501';
  end if;

  -- Autorizar antes de criar qualquer item na biblioteca.
  select * into v_treatment
    from public.clinical_treatments
    where id = p_treatment_id for update;
  if not found then
    raise exception 'Atendimento não encontrado.' using errcode = 'P0002';
  end if;
  if v_treatment.profissional_user_id is distinct from v_user
    or v_treatment.status not in ('rascunho', 'pronto_para_iniciar', 'em_atendimento')
    or v_treatment.pending_document_id is not null then
    raise exception 'Somente a profissional responsável pode registrar produtos enquanto a sessão está editável.' using errcode = '42501';
  end if;

  if v_product_name is null or char_length(v_product_name) > 160 then
    raise exception 'Informe o produto (até 160 caracteres).' using errcode = '22023';
  end if;
  if v_lot_code is null or char_length(v_lot_code) > 100 then
    raise exception 'Informe o lote (até 100 caracteres).' using errcode = '22023';
  end if;
  if v_unit is null or char_length(v_unit) > 30 then
    raise exception 'Informe a unidade (até 30 caracteres).' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade deve ser maior que zero.' using errcode = '22023';
  end if;
  if p_expires_on is null then
    raise exception 'Informe a validade do lote.' using errcode = '22023';
  end if;
  if p_expires_on < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Lote vencido não pode ser usado em novo atendimento.' using errcode = '22023';
  end if;

  -- Serializa registros simultâneos do mesmo nome digitado.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('bc_product_manual'),
    pg_catalog.hashtext(lower(v_product_name))
  );

  select count(*), min(id) into v_matches, v_product_id
    from public.clinical_products
    where active and lower(btrim(name)) = lower(v_product_name);
  if v_matches > 1 then
    raise exception 'Há produtos diferentes com esse nome. Identifique o produto na biblioteca antes do registro.' using errcode = '22023';
  end if;
  if v_matches = 0 then
    insert into public.clinical_products(name, default_unit, tracks_lot, active, created_by)
      values (v_product_name, v_unit, true, true, v_user)
      returning id into v_product_id;
    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
      values (v_user, 'clinical_product_created', 'clinical_products', v_product_id,
        pg_catalog.jsonb_build_object('active', true, 'origin', 'clinical_treatment_manual'));
  end if;

  select count(*), min(id) into v_matches, v_lot_id
    from public.clinical_product_lots
    where product_id = v_product_id
      and lower(btrim(lot_code)) = lower(v_lot_code);
  if v_matches > 1 then
    raise exception 'Há mais de um lote com esse código. Solicite revisão da biblioteca.' using errcode = '22023';
  end if;
  if v_matches = 1 then
    select * into v_lot from public.clinical_product_lots where id = v_lot_id;
    if not v_lot.active then
      raise exception 'Este lote está inativo. Solicite revisão da biblioteca.' using errcode = '22023';
    end if;
    if v_lot.expires_on <> p_expires_on then
      raise exception 'Validade diferente do lote já cadastrado. Confira a embalagem antes de registrar.' using errcode = '22023';
    end if;
  else
    insert into public.clinical_product_lots(product_id, lot_code, expires_on, active, created_by)
      values (v_product_id, v_lot_code, p_expires_on, true, v_user)
      returning id into v_lot_id;
    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, new_data)
      values (v_user, 'clinical_product_lot_created', 'clinical_product_lots', v_lot_id,
        pg_catalog.jsonb_build_object('product_id', v_product_id, 'active', true, 'origin', 'clinical_treatment_manual'));
  end if;

  -- Reutiliza a função já homologada: valida lotes, profissional, quantidade,
  -- cria o snapshot imutável e registra a auditoria do uso.
  v_usage_id := private.bc_treatment_product_usage_add_impl(
    p_treatment_id, v_product_id, v_lot_id, p_quantity, v_unit
  );
  return v_usage_id;
end;
$function$;

create or replace function public.bc_treatment_product_usage_add_text(
  p_treatment_id uuid,
  p_product_name text,
  p_lot_code text,
  p_expires_on date,
  p_quantity numeric,
  p_unit text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.bc_treatment_product_usage_add_text_impl(
    p_treatment_id, p_product_name, p_lot_code, p_expires_on, p_quantity, p_unit
  );
$function$;

revoke all on function private.bc_treatment_product_usage_add_text_impl(uuid, text, text, date, numeric, text)
  from public, anon, authenticated;
-- O wrapper security invoker precisa de EXECUTE na função interna;
-- o schema private não está exposto na Data API.
grant execute on function private.bc_treatment_product_usage_add_text_impl(uuid, text, text, date, numeric, text)
  to authenticated;
revoke all on function public.bc_treatment_product_usage_add_text(uuid, text, text, date, numeric, text)
  from public, anon, authenticated;
grant execute on function public.bc_treatment_product_usage_add_text(uuid, text, text, date, numeric, text)
  to authenticated;
