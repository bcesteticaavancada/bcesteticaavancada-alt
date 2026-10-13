-- BC Gestão Fase 6C — snapshot do nome do procedimento por versão.

alter table public.procedure_versions
  add column if not exists nome text;

update public.procedure_versions v
   set nome = p.nome
  from public.procedimentos p
 where p.id = v.procedimento_id
   and nullif(trim(v.nome),'') is null;

alter table public.procedure_versions
  alter column nome set not null;

create or replace function private.bc_procedure_version_immutable_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published and superseded procedure versions are immutable.' using errcode='55000';
    end if;
    return old;
  end if;

  if old.status='superseded' then
    raise exception 'Superseded procedure versions are immutable.' using errcode='55000';
  end if;

  if old.status='published' then
    if new.status='superseded'
       and row(
         new.id,new.procedimento_id,new.version,new.nome,new.classe_documental,new.categoria,new.descricao,
         new.price_mode,new.base_price,new.suggested_duration,new.requires_general_anamnesis,
         new.requires_return,new.return_interval_days,new.pre_guidance,new.post_guidance,
         new.consent_supplement,new.specific_schema,new.technical_schema,new.protocol_mode,
         new.requires_photo,new.requires_product_lot,new.requires_equipment,new.created_by,
         new.published_by,new.published_at,new.created_at
       ) is not distinct from row(
         old.id,old.procedimento_id,old.version,old.nome,old.classe_documental,old.categoria,old.descricao,
         old.price_mode,old.base_price,old.suggested_duration,old.requires_general_anamnesis,
         old.requires_return,old.return_interval_days,old.pre_guidance,old.post_guidance,
         old.consent_supplement,old.specific_schema,old.technical_schema,old.protocol_mode,
         old.requires_photo,old.requires_product_lot,old.requires_equipment,old.created_by,
         old.published_by,old.published_at,old.created_at
       ) then
      return new;
    end if;
    raise exception 'Published procedure versions are immutable.' using errcode='55000';
  end if;

  return new;
end;
$$;
revoke all on function private.bc_procedure_version_immutable_guard() from public;

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

  if v_protocol_mode='compound' and not exists(select 1 from public.procedure_version_components where parent_version_id=v_version_id) then
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

create or replace function private.bc_procedure_publish_impl(p_procedure_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_draft public.procedure_versions%rowtype;
  v_old_current uuid;
begin
  if v_user is null or not private.bc_can_manage_procedures() then
    raise exception 'Sem permissão para publicar procedimentos.' using errcode='42501';
  end if;

  select p.current_version_id into v_old_current
    from public.procedimentos p where p.id=p_procedure_id for update;
  if not found then raise exception 'Procedimento não encontrado.' using errcode='P0002'; end if;

  select * into v_draft from public.procedure_versions
    where procedimento_id=p_procedure_id and status='draft' for update;
  if not found then raise exception 'Nenhuma versão em rascunho.' using errcode='55000'; end if;

  if v_draft.protocol_mode='compound' and not exists(select 1 from public.procedure_version_components where parent_version_id=v_draft.id) then
    raise exception 'Protocolo composto exige componentes publicados.' using errcode='22023';
  end if;

  if v_old_current is not null then
    update public.procedure_versions set status='superseded',updated_at=now()
     where id=v_old_current and status='published';
  end if;

  update public.procedure_versions set status='published',published_by=v_user,published_at=now(),updated_at=now()
   where id=v_draft.id;

  update public.procedimentos
     set nome=v_draft.nome,
         ativo=true,
         duracao_padrao=v_draft.suggested_duration,
         current_version_id=v_draft.id,
         archived_at=null,
         updated_at=now()
   where id=p_procedure_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'procedure_published','procedimentos',p_procedure_id,jsonb_build_object('version_id',v_draft.id,'version',v_draft.version));
  return v_draft.id;
end;
$$;
revoke all on function private.bc_procedure_publish_impl(uuid) from public;
revoke execute on function private.bc_procedure_publish_impl(uuid) from anon;
grant execute on function private.bc_procedure_publish_impl(uuid) to authenticated;
