-- BC Gestão Fase 6B — hardening: metadado de assinatura só pode ser registrado após o arquivo existir no Storage privado.

create or replace function private.bc_clinical_signature_register_impl(
  p_document_id uuid,p_signer_kind text,p_storage_path text,p_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_doc public.clinical_documents%rowtype;
  v_client public.clientes%rowtype;
  v_staff public.staff_profiles%rowtype;
  v_name text;
  v_profissao text;
  v_conselho text;
  v_registro text;
  v_signer_user uuid;
  v_id uuid;
  v_minor boolean;
  v_clinic_date date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user_id is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if p_signer_kind not in ('paciente','responsavel','profissional') then
    raise exception 'Tipo de assinatura inválido.' using errcode='22023';
  end if;

  select * into v_doc from public.clinical_documents where id=p_document_id for update;
  if not found or v_doc.status <> 'aguardando_assinaturas' then
    raise exception 'Documento não está aguardando assinaturas.' using errcode='55000';
  end if;
  if p_storage_path not like ('assinaturas/'||p_document_id::text||'/%') then
    raise exception 'Caminho de assinatura inválido.' using errcode='22023';
  end if;
  if nullif(trim(p_sha256),'') is null then
    raise exception 'Hash da assinatura é obrigatório.' using errcode='22023';
  end if;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id='bc-prontuario-private'
      and o.name=p_storage_path
  ) then
    raise exception 'Arquivo de assinatura não encontrado no armazenamento privado.' using errcode='P0002';
  end if;

  select * into v_client from public.clientes where id=v_doc.cliente_id;
  if not found then raise exception 'Cliente não encontrada.' using errcode='P0002'; end if;
  v_minor := v_client.data_nascimento > (v_clinic_date - interval '18 years')::date;

  if p_signer_kind='profissional' then
    if v_doc.profissional_user_id <> v_user_id then
      raise exception 'Somente a profissional revisora pode assinar este documento.' using errcode='42501';
    end if;
    select * into v_staff from public.staff_profiles where user_id=v_user_id and active and atende_clientes;
    if not found or nullif(trim(v_staff.profissao),'') is null
       or nullif(trim(v_staff.conselho),'') is null or nullif(trim(v_staff.registro_conselho),'') is null then
      raise exception 'Identidade profissional incompleta.' using errcode='22023';
    end if;
    v_name := v_staff.display_name;
    v_profissao := v_staff.profissao;
    v_conselho := v_staff.conselho;
    v_registro := v_staff.registro_conselho;
    v_signer_user := v_user_id;
  elsif p_signer_kind='responsavel' then
    if not v_minor then
      raise exception 'Assinatura de responsável é usada para cliente menor de 18 anos.' using errcode='22023';
    end if;
    if nullif(trim(v_client.responsavel_nome),'') is null then
      raise exception 'Responsável legal não cadastrado.' using errcode='22023';
    end if;
    v_name := v_client.responsavel_nome;
  else
    if v_minor then
      raise exception 'Cliente menor de 18 anos exige assinatura do responsável legal.' using errcode='22023';
    end if;
    v_name := v_client.nome;
  end if;

  insert into public.clinical_signatures(
    document_id,signer_kind,signer_user_id,signer_name,signer_profissao,signer_conselho,signer_registro,
    storage_path,sha256,recorded_by
  ) values (
    p_document_id,p_signer_kind,v_signer_user,v_name,v_profissao,v_conselho,v_registro,
    p_storage_path,lower(trim(p_sha256)),v_user_id
  )
  returning id into v_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(v_user_id,'clinical_document_signed','clinical_signatures',v_id,
         jsonb_build_object('document_id',p_document_id,'signer_kind',p_signer_kind));

  return v_id;
exception when unique_violation then
  raise exception 'Esta assinatura já foi registrada para o documento.' using errcode='23505';
end;
$$;

revoke all on function private.bc_clinical_signature_register_impl(uuid,text,text,text) from public;
revoke execute on function private.bc_clinical_signature_register_impl(uuid,text,text,text) from anon;
grant execute on function private.bc_clinical_signature_register_impl(uuid,text,text,text) to authenticated;
