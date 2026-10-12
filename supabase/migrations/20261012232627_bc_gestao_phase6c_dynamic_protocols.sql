-- BC Gestão Fase 6C — protocolos compostos com opções dinâmicas por sessão.

create or replace function private.bc_procedure_save_draft_impl(p_procedure_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_procedure_id uuid := p_procedure_id;
  v_version_id uuid;
  v_name text := nullif(trim(p_payload->>'nome'),'');
  v_class text := lower(trim(coalesce(p_payload->>'classe_documental','')));
  v_price_mode text := lower(trim(coalesce(p_payload->>'price_mode','')));
  v_protocol_mode text := lower(trim(coalesce(p_payload->>'protocol_mode','simple')));
  v_base_price numeric;
  v_duration integer;
  v_next_version integer;
  v_component text;
  v_order integer := 0;
begin
  if v_user is null or not private.bc_can_manage_procedures() then
    raise exception 'Sem permissão para gerenciar procedimentos.' using errcode='42501';
  end if;
  if v_name is null then raise exception 'Nome obrigatório.' using errcode='22023'; end if;
  if v_class not in ('injetavel','nao_injetavel') then raise exception 'Classe documental inválida.' using errcode='22023'; end if;
  if v_price_mode not in ('fixed','starting_at') then raise exception 'Modo de preço inválido.' using errcode='22023'; end if;
  if v_protocol_mode not in ('simple','compound') then raise exception 'Modo de protocolo inválido.' using errcode='22023'; end if;

  begin
    v_base_price := nullif(trim(p_payload->>'base_price'),'')::numeric;
  exception when others then
    raise exception 'Preço-base inválido.' using errcode='22023';
  end;
  if v_base_price is null or v_base_price <= 0 then raise exception 'Preço-base inválido.' using errcode='22023'; end if;

  begin
    v_duration := nullif(trim(p_payload->>'suggested_duration'),'')::integer;
  exception when others then
    raise exception 'Duração sugerida inválida.' using errcode='22023';
  end;
  if v_duration is not null and v_duration <= 0 then raise exception 'Duração sugerida inválida.' using errcode='22023'; end if;

  if v_procedure_id is null then
    select p.id into v_procedure_id from public.procedimentos p
     where lower(trim(p.nome))=lower(v_name) limit 1;
    if v_procedure_id is null then
      insert into public.procedimentos(nome,ativo,duracao_padrao,created_by)
      values(v_name,false,v_duration,v_user)
      returning id into v_procedure_id;
    end if;
  end if;

  perform 1 from public.procedimentos where id=v_procedure_id for update;
  if not found then raise exception 'Procedimento não encontrado.' using errcode='P0002'; end if;

  select id into v_version_id from public.procedure_versions
   where procedimento_id=v_procedure_id and status='draft' for update;

  if v_version_id is null then
    select coalesce(max(version),0)+1 into v_next_version
      from public.procedure_versions where procedimento_id=v_procedure_id;
    insert into public.procedure_versions(
      procedimento_id,version,status,nome,classe_documental,categoria,descricao,price_mode,base_price,
      suggested_duration,requires_general_anamnesis,requires_return,return_interval_days,
      pre_guidance,post_guidance,consent_supplement,specific_schema,technical_schema,protocol_mode,
      requires_photo,requires_product_lot,requires_equipment,created_by
    ) values (
      v_procedure_id,v_next_version,'draft',v_name,v_class,nullif(trim(p_payload->>'categoria'),''),nullif(trim(p_payload->>'descricao'),''),
      v_price_mode,v_base_price,v_duration,coalesce((p_payload->>'requires_general_anamnesis')::boolean,true),
      coalesce((p_payload->>'requires_return')::boolean,false),nullif(trim(p_payload->>'return_interval_days'),'')::integer,
      nullif(trim(p_payload->>'pre_guidance'),''),nullif(trim(p_payload->>'post_guidance'),''),nullif(trim(p_payload->>'consent_supplement'),''),
      coalesce(p_payload->'specific_schema','{}'::jsonb),coalesce(p_payload->'technical_schema','{}'::jsonb),v_protocol_mode,
      coalesce((p_payload->>'requires_photo')::boolean,false),coalesce((p_payload->>'requires_product_lot')::boolean,false),
      coalesce((p_payload->>'requires_equipment')::boolean,false),v_user
    ) returning id into v_version_id;
  else
    update public.procedure_versions set
      nome=v_name,
      classe_documental=v_class,
      categoria=nullif(trim(p_payload->>'categoria'),''),
      descricao=nullif(trim(p_payload->>'descricao'),''),
      price_mode=v_price_mode,
      base_price=v_base_price,
      suggested_duration=v_duration,
      requires_general_anamnesis=coalesce((p_payload->>'requires_general_anamnesis')::boolean,true),
      requires_return=coalesce((p_payload->>'requires_return')::boolean,false),
      return_interval_days=nullif(trim(p_payload->>'return_interval_days'),'')::integer,
      pre_guidance=nullif(trim(p_payload->>'pre_guidance'),''),
      post_guidance=nullif(trim(p_payload->>'post_guidance'),''),
      consent_supplement=nullif(trim(p_payload->>'consent_supplement'),''),
      specific_schema=coalesce(p_payload->'specific_schema','{}'::jsonb),
      technical_schema=coalesce(p_payload->'technical_schema','{}'::jsonb),
      protocol_mode=v_protocol_mode,
      requires_photo=coalesce((p_payload->>'requires_photo')::boolean,false),
      requires_product_lot=coalesce((p_payload->>'requires_product_lot')::boolean,false),
      requires_equipment=coalesce((p_payload->>'requires_equipment')::boolean,false),
      updated_at=now()
    where id=v_version_id;
  end if;

  delete from public.procedure_version_components where parent_version_id=v_version_id;
  if jsonb_typeof(coalesce(p_payload->'component_version_ids','[]'::jsonb)) <> 'array' then
    raise exception 'Componentes inválidos.' using errcode='22023';
  end if;
  for v_component in select jsonb_array_elements_text(coalesce(p_payload->'component_version_ids','[]'::jsonb))
  loop
    v_order := v_order + 1;
    if not exists(select 1 from public.procedure_versions cv where cv.id=v_component::uuid and cv.status='published') then
      raise exception 'Componente publicado não encontrado.' using errcode='22023';
    end if;
    if v_component::uuid=v_version_id then raise exception 'Procedimento não pode compor a si mesmo.' using errcode='22023'; end if;
    insert into public.procedure_version_components(parent_version_id,component_version_id,required,sort_order)
    values(v_version_id,v_component::uuid,true,v_order)
    on conflict(parent_version_id,component_version_id) do update set sort_order=excluded.sort_order;
  end loop;

  if v_protocol_mode='compound'
     and not exists(select 1 from public.procedure_version_components where parent_version_id=v_version_id)
     and not (
       jsonb_typeof(coalesce(p_payload->'specific_schema'->'component_options','[]'::jsonb))='array'
       and jsonb_array_length(coalesce(p_payload->'specific_schema'->'component_options','[]'::jsonb)) > 0
     ) then
    raise exception 'Protocolo composto exige ao menos um componente.' using errcode='22023';
  end if;

  update public.procedimentos set nome=v_name,duracao_padrao=v_duration,updated_at=now()
   where id=v_procedure_id and current_version_id is null;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_draft_saved','procedure_versions',v_version_id,jsonb_build_object('procedimento_id',v_procedure_id));
  return v_procedure_id;
end;
$$;
revoke all on function private.bc_procedure_save_draft_impl(uuid,jsonb) from public;
revoke execute on function private.bc_procedure_save_draft_impl(uuid,jsonb) from anon;
grant execute on function private.bc_procedure_save_draft_impl(uuid,jsonb) to authenticated;