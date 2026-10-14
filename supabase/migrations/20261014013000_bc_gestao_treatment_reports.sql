-- BC Gestão — Relatório / Parecer do Atendimento.
-- Adição forward-safe: o parecer corrente é 1:1 com o atendimento e cada versão final
-- congela seu próprio snapshot, preservando o histórico quando houver reabertura/correção.

create table if not exists public.clinical_treatment_reports (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null unique references public.clinical_treatments(id) on delete restrict,
  descricao_sessao text not null,
  resposta_observada text not null,
  orientacoes text not null,
  retorno_necessario boolean not null default false,
  retorno_sugerido_em date,
  observacoes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_treatment_reports_descricao_ck check (nullif(trim(descricao_sessao),'') is not null),
  constraint clinical_treatment_reports_resposta_ck check (nullif(trim(resposta_observada),'') is not null),
  constraint clinical_treatment_reports_orientacoes_ck check (nullif(trim(orientacoes),'') is not null)
);

create index if not exists clinical_treatment_reports_created_by_idx
  on public.clinical_treatment_reports(created_by);

alter table public.clinical_treatment_reports enable row level security;
revoke all on public.clinical_treatment_reports from anon, authenticated;

create or replace function private.bc_treatment_report_get_impl(p_treatment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  if not exists(select 1 from public.clinical_treatments t where t.id=p_treatment_id) then
    raise exception 'Atendimento não encontrado.' using errcode='P0002';
  end if;

  select to_jsonb(r) into v_result
    from public.clinical_treatment_reports r
   where r.treatment_id=p_treatment_id;

  return v_result;
end;
$$;
revoke all on function private.bc_treatment_report_get_impl(uuid) from public, anon, authenticated;

create or replace function public.bc_treatment_report_get(p_treatment_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.bc_treatment_report_get_impl(p_treatment_id);
$$;
revoke all on function public.bc_treatment_report_get(uuid) from public, anon, authenticated;
grant execute on function public.bc_treatment_report_get(uuid) to authenticated;

create or replace function private.bc_treatment_report_upsert_impl(
  p_treatment_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.clinical_treatments%rowtype;
  v_user uuid:=auth.uid();
  v_id uuid;
  v_descricao text;
  v_resposta text;
  v_orientacoes text;
  v_observacoes text;
  v_retorno boolean;
  v_retorno_data date;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select * into t
    from public.clinical_treatments
   where id=p_treatment_id
   for update;

  if not found then
    raise exception 'Atendimento não encontrado.' using errcode='P0002';
  end if;
  if v_user<>t.profissional_user_id then
    raise exception 'Somente a profissional responsável pode registrar o parecer.' using errcode='42501';
  end if;
  if t.status<>'em_atendimento' or t.pending_document_id is not null then
    raise exception 'O parecer não pode ser alterado neste estado do atendimento.' using errcode='55000';
  end if;

  v_descricao:=nullif(trim(p_payload->>'descricao_sessao'),'');
  v_resposta:=nullif(trim(p_payload->>'resposta_observada'),'');
  v_orientacoes:=nullif(trim(p_payload->>'orientacoes'),'');
  v_observacoes:=nullif(trim(p_payload->>'observacoes'),'');

  if v_descricao is null then
    raise exception 'Descrição da sessão é obrigatória.' using errcode='22023';
  end if;
  if v_resposta is null then
    raise exception 'Resposta observada é obrigatória.' using errcode='22023';
  end if;
  if v_orientacoes is null then
    raise exception 'Orientações são obrigatórias.' using errcode='22023';
  end if;
  if not (p_payload ? 'retorno_necessario') or jsonb_typeof(p_payload->'retorno_necessario')<>'boolean' then
    raise exception 'Informe se há necessidade de retorno.' using errcode='22023';
  end if;
  v_retorno:=(p_payload->>'retorno_necessario')::boolean;

  begin
    v_retorno_data:=nullif(trim(p_payload->>'retorno_sugerido_em'),'')::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Data sugerida para retorno é inválida.' using errcode='22023';
  end;

  if not v_retorno then
    v_retorno_data:=null;
  end if;

  insert into public.clinical_treatment_reports(
    treatment_id,descricao_sessao,resposta_observada,orientacoes,
    retorno_necessario,retorno_sugerido_em,observacoes,created_by
  ) values(
    t.id,v_descricao,v_resposta,v_orientacoes,
    v_retorno,v_retorno_data,v_observacoes,v_user
  )
  on conflict(treatment_id) do update set
    descricao_sessao=excluded.descricao_sessao,
    resposta_observada=excluded.resposta_observada,
    orientacoes=excluded.orientacoes,
    retorno_necessario=excluded.retorno_necessario,
    retorno_sugerido_em=excluded.retorno_sugerido_em,
    observacoes=excluded.observacoes,
    updated_at=now()
  returning id into v_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_treatment_report_saved','clinical_treatment_reports',v_id,
    jsonb_build_object('treatment_id',t.id,'retorno_necessario',v_retorno,'retorno_sugerido_em',v_retorno_data));

  return v_id;
end;
$$;
revoke all on function private.bc_treatment_report_upsert_impl(uuid,jsonb) from public, anon, authenticated;

create or replace function public.bc_treatment_report_upsert(
  p_treatment_id uuid,
  p_payload jsonb
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.bc_treatment_report_upsert_impl(p_treatment_id,p_payload);
$$;
revoke all on function public.bc_treatment_report_upsert(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.bc_treatment_report_upsert(uuid,jsonb) to authenticated;

-- Gate 6D estendido: mantém todos os requisitos anteriores e acrescenta parecer completo.
create or replace function private.bc_treatment_finalization_gate(p_treatment_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  t public.clinical_treatments%rowtype;
  pv public.procedure_versions%rowtype;
  reasons text[]:='{}'::text[];
  v_open_ids uuid[]:='{}'::uuid[];
  v_confirmed_ids uuid[];
begin
  select * into t from public.clinical_treatments where id=p_treatment_id;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0002'; end if;
  select * into pv from public.procedure_versions where id=t.procedure_version_id;
  if not found then raise exception 'Versão do procedimento não encontrada.' using errcode='P0002'; end if;

  if pv.requires_photo and (
    not exists(select 1 from public.clinical_treatment_photos p where p.treatment_id=t.id and p.kind='antes' and p.voided_at is null)
    or not exists(select 1 from public.clinical_treatment_photos p where p.treatment_id=t.id and p.kind='depois' and p.voided_at is null)
  ) then
    reasons:=array_append(reasons,'fotos_pendentes');
  end if;

  if pv.requires_product_lot and not exists(
    select 1 from public.clinical_treatment_product_usages u
    where u.treatment_id=t.id
      and u.lot_id is not null
      and u.lot_code_snapshot is not null
      and u.expires_on_snapshot is not null
      and u.quantity>0
      and nullif(trim(u.unit),'') is not null
  ) then
    reasons:=array_append(reasons,'produto_lote_pendente');
  end if;

  if pv.requires_equipment and not exists(
    select 1 from public.clinical_treatment_equipment_usages e where e.treatment_id=t.id
  ) then
    reasons:=array_append(reasons,'equipamento_pendente');
  end if;

  select coalesce(array_agg(i.id order by i.id),'{}'::uuid[])
    into v_open_ids
    from public.clinical_intercurrences i
   where i.treatment_id=t.id and i.status in ('aberta','acompanhamento');

  if cardinality(v_open_ids)>0 then
    select c.open_intercurrence_ids into v_confirmed_ids
      from public.clinical_treatment_intercurrence_confirmations c
     where c.treatment_id=t.id
     order by c.confirmed_at desc,c.id desc
     limit 1;
    if v_confirmed_ids is null or not (v_confirmed_ids=v_open_ids) then
      reasons:=array_append(reasons,'intercorrencia_aberta_nao_confirmada');
    end if;
  end if;

  if not exists(
    select 1
      from public.clinical_treatment_reports r
     where r.treatment_id=t.id
       and nullif(trim(r.descricao_sessao),'') is not null
       and nullif(trim(r.resposta_observada),'') is not null
       and nullif(trim(r.orientacoes),'') is not null
  ) then
    reasons:=array_append(reasons,'parecer_pendente');
  end if;

  return reasons;
end;
$$;
revoke all on function private.bc_treatment_finalization_gate(uuid) from public, anon, authenticated;

-- Finalização: congela o parecer junto à versão antes de criar o documento pendente.
create or replace function private.bc_treatment_finalize_impl(p_treatment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.clinical_treatments%rowtype;
  pv public.procedure_versions%rowtype;
  s public.staff_profiles%rowtype;
  v_report public.clinical_treatment_reports%rowtype;
  v_user uuid:=auth.uid();
  v_number integer;
  v_version uuid;
  v_doc uuid;
  v_code text;
  snap jsonb;
  correction text;
  comp jsonb;
  v_phase6d_reasons text[];
  v_photos jsonb;
  v_products jsonb;
  v_equipment jsonb;
  v_intercurrences jsonb;
begin
  select * into t from public.clinical_treatments where id=p_treatment_id for update;
  if not found or v_user<>t.profissional_user_id then raise exception 'Atendimento indisponível.' using errcode='42501'; end if;
  if t.status<>'em_atendimento' or t.pending_version_id is not null then raise exception 'Atendimento não está disponível para preparar finalização.' using errcode='55000'; end if;
  if nullif(trim(t.objetivo),'') is null or nullif(trim(t.regiao),'') is null or not private.bc_treatment_specific_complete(t.id) then raise exception 'Ficha técnica obrigatória incompleta.' using errcode='22023'; end if;

  v_phase6d_reasons:=private.bc_treatment_finalization_gate(t.id);
  if cardinality(v_phase6d_reasons)>0 then
    raise exception 'Finalização possui pendências: %',array_to_string(v_phase6d_reasons,', ') using errcode='55000';
  end if;

  select * into v_report from public.clinical_treatment_reports where treatment_id=t.id;
  if not found then
    raise exception 'Parecer clínico obrigatório não encontrado.' using errcode='55000';
  end if;

  select * into pv from public.procedure_versions where id=t.procedure_version_id;
  if t.price_mode_snapshot='fixed' then
    update public.clinical_treatments set final_price=base_price_snapshot where id=t.id;
    t.final_price:=t.base_price_snapshot;
  elsif t.price_mode_snapshot='starting_at' and (t.final_price is null or t.final_price<=0) then
    raise exception 'Preço final positivo é obrigatório para procedimento a partir de.' using errcode='22023';
  end if;

  select * into s from public.staff_profiles where user_id=v_user and active and atende_clientes;
  if not found or nullif(trim(s.profissao),'') is null or nullif(trim(s.conselho),'') is null or nullif(trim(s.registro_conselho),'') is null then
    raise exception 'Identidade profissional incompleta.' using errcode='22023';
  end if;

  select coalesce(max(version),0)+1 into v_number from public.clinical_treatment_versions where treatment_id=t.id;
  correction:=case when t.current_version_id is null then 'initial' else coalesce(t.correction_mode,'same_day') end;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) into comp
    from public.clinical_treatment_components c where c.treatment_id=t.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'kind',x.kind,'region',x.region,'view',x.view,'caption',x.caption,
    'captured_at',x.captured_at,'created_at',x.created_at
  ) order by x.captured_at,x.created_at,x.id),'[]'::jsonb) into v_photos
  from public.clinical_treatment_photos x where x.treatment_id=t.id and x.voided_at is null;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]'::jsonb) into v_products
    from public.clinical_treatment_product_usages x where x.treatment_id=t.id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]'::jsonb) into v_equipment
    from public.clinical_treatment_equipment_usages x where x.treatment_id=t.id;

  select coalesce(jsonb_agg(
    to_jsonb(i) || jsonb_build_object('updates',coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at,u.id)
      from public.clinical_intercurrence_updates u where u.intercurrence_id=i.id
    ),'[]'::jsonb))
    order by i.occurred_at,i.created_at,i.id
  ),'[]'::jsonb) into v_intercurrences
  from public.clinical_intercurrences i where i.treatment_id=t.id;

  snap:=jsonb_build_object(
    'treatment',to_jsonb(t),
    'procedure_version',to_jsonb(pv),
    'components',comp,
    'professional',jsonb_build_object('name',s.display_name,'profissao',s.profissao,'conselho',s.conselho,'registro',s.registro_conselho),
    'consent_document_id',t.consent_document_id,
    'anamnese_id',t.anamnese_id,
    'photos',v_photos,
    'product_usages',v_products,
    'equipment_usages',v_equipment,
    'intercurrences',v_intercurrences,
    'report',to_jsonb(v_report),
    'captured_at',now()
  );

  insert into public.clinical_treatment_versions(treatment_id,version,prior_version_id,correction_mode,snapshot,created_by)
  values(t.id,v_number,t.current_version_id,correction,snap,v_user) returning id into v_version;
  v_code:='BC-ATD-'||to_char((now() at time zone 'America/Sao_Paulo')::date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.clinical_documents(
    cliente_id,document_type,source_id,source_version,document_version,document_code,status,
    profissional_user_id,profissional_nome,profissional_profissao,profissional_conselho,profissional_registro
  ) values(
    t.cliente_id,'treatment_record',v_version,v_number,v_number,v_code,'aguardando_assinaturas',
    v_user,s.display_name,s.profissao,s.conselho,s.registro_conselho
  ) returning id into v_doc;
  update public.clinical_treatment_versions set document_id=v_doc where id=v_version;
  update public.clinical_treatments set pending_version_id=v_version,pending_document_id=v_doc,updated_at=now() where id=t.id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user,'clinical_treatment_finalization_prepared','clinical_treatment_versions',v_version,
    jsonb_build_object('treatment_id',t.id,'document_id',v_doc,'version',v_number,'phase6d_frozen',true,'report_id',v_report.id));
  return jsonb_build_object('treatment_version_id',v_version,'document_id',v_doc,'version',v_number);
end;
$$;
revoke all on function private.bc_treatment_finalize_impl(uuid) from public, anon, authenticated;
