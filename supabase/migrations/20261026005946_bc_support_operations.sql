-- Apoio operacional específico. Não altera helpers clínicos, financeiro ou RLS existentes.
create table private.bc_support_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  state text not null default 'reserved' check(state in ('reserved','invited','failed')),
  invited_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bc_support_invitations_actor_idx on private.bc_support_invitations(requested_by);
create index bc_support_invitations_user_idx on private.bc_support_invitations(invited_user_id);
alter table private.bc_support_invitations enable row level security;
revoke all on private.bc_support_invitations from public,anon,authenticated;

create table private.bc_support_consent_copies (
  file_id uuid primary key references public.client_files(id) on delete restrict,
  original_document_id uuid not null references public.clinical_documents(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index bc_support_copies_original_idx on private.bc_support_consent_copies(original_document_id);
create index bc_support_copies_actor_idx on private.bc_support_consent_copies(created_by);
alter table private.bc_support_consent_copies enable row level security;
revoke all on private.bc_support_consent_copies from public,anon,authenticated;

create table private.bc_support_uploads (
  storage_path text primary key,
  client_id uuid not null references public.clientes(id) on delete restrict,
  original_document_id uuid not null references public.clinical_documents(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  state text not null default 'prepared' check(state in ('prepared','registered','discarded')),
  file_id uuid references public.client_files(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index bc_support_uploads_client_idx on private.bc_support_uploads(client_id);
create index bc_support_uploads_original_idx on private.bc_support_uploads(original_document_id);
create index bc_support_uploads_actor_idx on private.bc_support_uploads(created_by);
create index bc_support_uploads_file_idx on private.bc_support_uploads(file_id);
alter table private.bc_support_uploads enable row level security;
revoke all on private.bc_support_uploads from public,anon,authenticated;

create function private.bc_support_client_projection(p_client public.clientes)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
  from jsonb_each(to_jsonb(p_client))
  where key=any(array['id','nome','telefone','email','cpf','data_nascimento','cep','logradouro','numero','complemento','bairro','cidade','uf','responsavel_nome','responsavel_cpf','responsavel_parentesco','responsavel_telefone','updated_at']);
$$;
revoke all on function private.bc_support_client_projection(public.clientes) from public,anon,authenticated;
grant execute on function private.bc_support_client_projection(public.clientes) to service_role;

create function private.bc_support_service_impl(p_actor_id uuid,p_session_id uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.clientes%rowtype; old_client public.clientes%rowtype;
  d public.clinical_documents%rowtype; f public.client_files%rowtype;
  invitation private.bc_support_invitations%rowtype;
  upload_record private.bc_support_uploads%rowtype;
  v_client uuid; v_document uuid; v_file uuid; v_name text; v_email text;
  v_path text; v_reason text; v_hash text; v_size bigint; v_patch jsonb; v_combined jsonb;
  v_documents jsonb; v_object jsonb; v_user uuid; v_birth date; v_cpf text; v_guardian_cpf text;
begin
  if not exists(
    select 1 from public.staff_profiles s join auth.users u on u.id=s.user_id
    join auth.sessions a on a.user_id=u.id and a.id=p_session_id
    where s.user_id=p_actor_id and s.active and s.role in ('admin','admin_criacao')
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
      and (a.not_after is null or a.not_after>now())
  ) then raise exception 'Acesso operacional não autorizado.' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Dados inválidos.' using errcode='22023'; end if;

  if p_action in ('client_get','client_update','download','upload_check','register_returned','discard_upload') then
    v_client:=(p_payload->>'clientId')::uuid;
    v_reason:=nullif(trim(p_payload->>'reason'),'');
    if v_reason is null or length(v_reason)>500 then raise exception 'Informe o motivo do apoio.' using errcode='22023'; end if;
    select * into c from public.clientes where id=v_client and ativo for update;
    if not found then raise exception 'Cliente indisponível para apoio.' using errcode='P0002'; end if;
  end if;

  if p_action='client_get' then
    select coalesce(jsonb_agg(items.item order by items.created_at desc),'[]'::jsonb) into v_documents from (
      select jsonb_build_object('id',x.id,'documentId',x.id,'kind','original','category',x.document_type,'title',case when x.document_type='anamnese_geral' then 'Anamnese assinada' else 'Consentimento — '||coalesce(pv.nome,'procedimento') end,'created_at',x.created_at) as item,x.created_at
      from public.clinical_documents x left join public.procedure_consents pc on x.document_type='consentimento_procedimento' and pc.id=x.source_id left join public.procedure_versions pv on pv.id=pc.procedure_version_id
      where x.cliente_id=c.id and x.document_type in ('anamnese_geral','consentimento_procedimento') and x.status='emitido' and x.storage_path is not null
        and exists(select 1 from public.clinical_signatures s where s.document_id=x.id and s.signer_kind='profissional')
        and exists(select 1 from public.clinical_signatures s where s.document_id=x.id and s.signer_kind in ('paciente','responsavel'))
      union all
      select jsonb_build_object('id',x.id,'documentId',r.original_document_id,'kind','returned','category','tcle_externo','title','Consentimento — cópia devolvida','created_at',x.created_at),x.created_at
      from private.bc_support_consent_copies r join public.client_files x on x.id=r.file_id
      join public.clinical_documents o on o.id=r.original_document_id and o.cliente_id=x.cliente_id
      where x.cliente_id=c.id and x.voided_at is null
    ) items;
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor_id,'support_client_opened','clientes',c.id,jsonb_build_object('reason',v_reason));
    return jsonb_build_object('client',private.bc_support_client_projection(c),'documents',v_documents);
  elsif p_action='client_update' then
    v_patch:=p_payload->'patch';
    if v_patch is null or jsonb_typeof(v_patch)<>'object' or exists(select 1 from jsonb_object_keys(v_patch) k where k<>all(array['nome','telefone','email','cpf','data_nascimento','cep','logradouro','numero','complemento','bairro','cidade','uf','responsavel_nome','responsavel_cpf','responsavel_parentesco','responsavel_telefone'])) then raise exception 'Campo cadastral não permitido.' using errcode='22023'; end if;
    if (p_payload->>'expectedUpdatedAt')::timestamptz is distinct from c.updated_at then raise exception 'Cadastro atualizado por outra pessoa. Reabra a ficha.' using errcode='40001'; end if;
    if exists(select 1 from jsonb_each(v_patch) e where jsonb_typeof(e.value) not in ('string','null') or length(e.value#>>'{}')>500) then raise exception 'Dados cadastrais inválidos.' using errcode='22023'; end if;
    v_combined:=to_jsonb(c)||v_patch;old_client:=c;
    if nullif(trim(v_combined->>'nome'),'') is null or nullif(trim(v_combined->>'telefone'),'') is null then raise exception 'Nome e telefone são obrigatórios.' using errcode='22023'; end if;
    v_birth:=nullif(trim(v_combined->>'data_nascimento'),'')::date;
    if v_birth>current_date then raise exception 'Data de nascimento não pode ser futura.' using errcode='22023'; end if;
    v_cpf:=nullif(regexp_replace(coalesce(v_combined->>'cpf',''),'[^0-9]','','g'),'');
    v_guardian_cpf:=nullif(regexp_replace(coalesce(v_combined->>'responsavel_cpf',''),'[^0-9]','','g'),'');
    if (nullif(trim(v_combined->>'cpf'),'') is not null and (v_cpf is null or length(v_cpf)<>11)) or (nullif(trim(v_combined->>'responsavel_cpf'),'') is not null and (v_guardian_cpf is null or length(v_guardian_cpf)<>11)) then raise exception 'CPF deve conter 11 dígitos.' using errcode='22023'; end if;
    update public.clientes set nome=trim(v_combined->>'nome'),telefone=trim(v_combined->>'telefone'),email=nullif(trim(v_combined->>'email'),''),cpf=v_cpf,data_nascimento=v_birth,
      cep=nullif(trim(v_combined->>'cep'),''),logradouro=nullif(trim(v_combined->>'logradouro'),''),numero=nullif(trim(v_combined->>'numero'),''),complemento=nullif(trim(v_combined->>'complemento'),''),bairro=nullif(trim(v_combined->>'bairro'),''),cidade=nullif(trim(v_combined->>'cidade'),''),uf=upper(nullif(trim(v_combined->>'uf'),'')),
      responsavel_nome=nullif(trim(v_combined->>'responsavel_nome'),''),responsavel_cpf=v_guardian_cpf,responsavel_parentesco=nullif(trim(v_combined->>'responsavel_parentesco'),''),responsavel_telefone=nullif(trim(v_combined->>'responsavel_telefone'),'') where id=c.id returning * into c;
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data) values(p_actor_id,'support_client_updated','clientes',c.id,private.bc_support_client_projection(old_client),private.bc_support_client_projection(c)||jsonb_build_object('reason',v_reason));
    return jsonb_build_object('client',private.bc_support_client_projection(c));
  elsif p_action in ('upload_check','register_returned','discard_upload') then
    v_document:=(p_payload->>'documentId')::uuid;
    select * into d from public.clinical_documents where id=v_document and cliente_id=c.id and document_type='consentimento_procedimento' and status='emitido' and storage_path is not null;
    if not found or not exists(select 1 from public.clinical_signatures where document_id=d.id and signer_kind='profissional') or not exists(select 1 from public.clinical_signatures where document_id=d.id and signer_kind in ('paciente','responsavel')) then raise exception 'Consentimento original indisponível.' using errcode='42501'; end if;
    v_path:=p_payload->>'storagePath';
    if v_path is null or v_path !~ ('^arquivos-clientes/'||c.id::text||'/[0-9a-f-]{36}\.pdf$') then raise exception 'Arquivo de consentimento inválido.' using errcode='22023';end if;
    if p_action='upload_check' then
      insert into private.bc_support_uploads(storage_path,client_id,original_document_id,created_by) values(v_path,c.id,d.id,p_actor_id);
      return jsonb_build_object('ok',true);
    end if;
    select * into upload_record from private.bc_support_uploads where storage_path=v_path and client_id=c.id and original_document_id=d.id and created_by=p_actor_id for update;
    if not found then raise exception 'Envio indisponível.' using errcode='42501';end if;
    if p_action='discard_upload' then
      if upload_record.state='registered' then return jsonb_build_object('removable',false,'fileId',upload_record.file_id);end if;
      update private.bc_support_uploads set state='discarded' where storage_path=v_path;
      return jsonb_build_object('removable',true);
    end if;
    if upload_record.state='discarded' then raise exception 'Envio descartado.' using errcode='55000';end if;
    v_size:=(p_payload->>'sizeBytes')::bigint;v_hash:=p_payload->>'sha256';
    if v_size is null or v_size<5 or v_size>8388608 or v_hash is null or v_hash!~'^[0-9a-f]{64}$' then raise exception 'Arquivo de consentimento inválido.' using errcode='22023'; end if;
    if upload_record.state='registered' then
      select * into f from public.client_files where id=upload_record.file_id and storage_path=v_path and sha256=v_hash and size_bytes=v_size;
      if not found then raise exception 'Registro divergente.' using errcode='22023';end if;
      return jsonb_build_object('fileId',f.id);
    end if;
    select metadata into v_object from storage.objects where bucket_id='bc-prontuario-private' and name=v_path;
    if not found or coalesce(v_object->>'mimetype','')<>'application/pdf' or (v_object->>'size')::bigint is distinct from v_size then raise exception 'Arquivo enviado não confere.' using errcode='22023'; end if;
    insert into public.client_files(cliente_id,title,category,origin,storage_path,mime_type,size_bytes,sha256,uploaded_by) values(c.id,'Consentimento — cópia devolvida','tcle_externo','upload_manual',v_path,'application/pdf',v_size,v_hash,p_actor_id) returning id into v_file;
    insert into private.bc_support_consent_copies(file_id,original_document_id,created_by) values(v_file,d.id,p_actor_id);
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor_id,'support_consent_returned','client_files',v_file,jsonb_build_object('clientId',c.id,'documentId',d.id,'sha256',v_hash,'reason',v_reason));
    update private.bc_support_uploads set state='registered',file_id=v_file where storage_path=v_path;
    return jsonb_build_object('fileId',v_file);
  elsif p_action='download' then
    if p_payload->>'kind'='original' then
      select * into d from public.clinical_documents where id=(p_payload->>'documentId')::uuid and cliente_id=c.id and document_type in ('anamnese_geral','consentimento_procedimento') and status='emitido' and storage_path is not null;
      if not found or not exists(select 1 from public.clinical_signatures where document_id=d.id and signer_kind='profissional') or not exists(select 1 from public.clinical_signatures where document_id=d.id and signer_kind in ('paciente','responsavel')) then raise exception 'Documento indisponível para apoio.' using errcode='42501'; end if;
      v_path:=d.storage_path;v_document:=d.id;
    elsif p_payload->>'kind'='returned' then
      select x.* into f from public.client_files x join private.bc_support_consent_copies r on r.file_id=x.id join public.clinical_documents o on o.id=r.original_document_id and o.cliente_id=x.cliente_id where x.id=(p_payload->>'documentId')::uuid and x.cliente_id=c.id and x.voided_at is null;
      if not found then raise exception 'Documento indisponível para apoio.' using errcode='42501'; end if;
      v_path:=f.storage_path;v_document:=f.id;
    else raise exception 'Documento indisponível para apoio.' using errcode='42501';end if;
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor_id,'support_document_downloaded','clientes',c.id,jsonb_build_object('documentId',v_document,'reason',v_reason));
    return jsonb_build_object('path',v_path,'clientName',c.nome,'title','Consentimento ou anamnese');
  elsif p_action='activate_staff' then
    if not exists(select 1 from public.staff_profiles where user_id=p_actor_id and role='admin' and active) then raise exception 'Acesso operacional não autorizado.' using errcode='42501';end if;
    v_user:=(p_payload->>'userId')::uuid;
    if not exists(select 1 from private.bc_support_invitations where invited_user_id=v_user and state='invited') then raise exception 'Colaboradora indisponível para ativação.' using errcode='42501';end if;
    update public.staff_profiles set atende_clientes=true,updated_at=now() where user_id=v_user and role='colaborador' and active and nullif(trim(profissao),'') is not null and nullif(trim(conselho),'') is not null and nullif(trim(registro_conselho),'') is not null;
    if not found then raise exception 'Complete a identificação profissional antes de habilitar atendimento.' using errcode='22023';end if;
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor_id,'support_collaborator_activated','staff_profiles',v_user,jsonb_build_object('atende_clientes',true));
    return jsonb_build_object('ok',true);
  elsif p_action='invite_reserve' then
    v_name:=nullif(trim(p_payload->>'name'),'');v_email:=lower(trim(p_payload->>'email'));
    if v_name is null or length(v_name)>120 or v_email is null or length(v_email)>254 or v_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Nome ou e-mail inválido.' using errcode='22023';end if;
    select * into invitation from private.bc_support_invitations where email=v_email for update;
    if not found then
      if exists(select 1 from auth.users where lower(email)=v_email) then raise exception 'Já existe uma conta para este e-mail.' using errcode='23505';end if;
      insert into private.bc_support_invitations(email,display_name,requested_by) values(v_email,v_name,p_actor_id) on conflict(email) do nothing returning * into invitation;
      if not found then raise exception 'Convite em andamento.' using errcode='55P03';end if;
    else
      if invitation.requested_by<>p_actor_id then raise exception 'Convite pertence a outro operador.' using errcode='42501';end if;
      if invitation.state='reserved' and invitation.updated_at>now()-interval '2 minutes' then raise exception 'Convite em andamento.' using errcode='55P03';end if;
      select u.id into v_user from auth.users u where lower(u.email)=v_email;
      if found and not exists(
        select 1 from auth.users u where u.id=v_user and u.raw_app_meta_data->>'bc_support_invitation_id'=invitation.id::text
          and u.created_at>=invitation.created_at and u.deleted_at is null and u.email_confirmed_at is null and u.last_sign_in_at is null
          and not exists(select 1 from auth.sessions a where a.user_id=u.id)
          and (not exists(select 1 from public.staff_profiles s where s.user_id=u.id) or (invitation.invited_user_id=u.id and exists(select 1 from public.staff_profiles s where s.user_id=u.id and s.role='colaborador')))
      ) then raise exception 'Conta indisponível para este convite.' using errcode='42501';end if;
      update private.bc_support_invitations set state='reserved',display_name=v_name,updated_at=now() where id=invitation.id returning * into invitation;
    end if;
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor_id,'support_invitation_requested','staff_profiles',invitation.id,jsonb_build_object('email',v_email));
    return jsonb_build_object('invitationId',invitation.id,'userId',v_user);
  elsif p_action in ('invite_finish','invite_fail') then
    select * into invitation from private.bc_support_invitations where id=(p_payload->>'invitationId')::uuid and requested_by=p_actor_id for update;
    if not found then raise exception 'Convite indisponível.' using errcode='42501';end if;
    if p_action='invite_fail' then
      update private.bc_support_invitations set state='failed',updated_at=now() where id=invitation.id and state='reserved';
      return jsonb_build_object('ok',true);
    end if;
    if invitation.state not in ('reserved','invited') then raise exception 'Convite indisponível.' using errcode='42501';end if;
    v_user:=(p_payload->>'userId')::uuid;
    if not exists(select 1 from auth.users u where u.id=v_user and lower(u.email)=invitation.email and u.raw_app_meta_data->>'bc_support_invitation_id'=invitation.id::text and u.created_at>=invitation.created_at and u.deleted_at is null and u.email_confirmed_at is null and u.last_sign_in_at is null and not exists(select 1 from auth.sessions a where a.user_id=u.id)) then raise exception 'Conta indisponível para este convite.' using errcode='42501';end if;
    if exists(select 1 from public.staff_profiles where user_id=v_user) then
      if invitation.invited_user_id is distinct from v_user or not exists(select 1 from public.staff_profiles where user_id=v_user and role='colaborador') then raise exception 'Conta indisponível para este convite.' using errcode='42501';end if;
    else
      insert into public.staff_profiles(user_id,display_name,role,active,atende_clientes,pode_gerenciar_agendas,pode_gerenciar_procedimentos,procedure_scope) values(v_user,invitation.display_name,'colaborador',true,false,false,false,'explicit');
      insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data) values(p_actor_id,'support_collaborator_invited','staff_profiles',v_user,jsonb_build_object('invitationId',invitation.id,'role','colaborador'));
    end if;
    update private.bc_support_invitations set state='invited',invited_user_id=v_user,updated_at=now() where id=invitation.id;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'Operação de apoio inválida.' using errcode='22023';
end;$$;
revoke all on function private.bc_support_service_impl(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.bc_support_service_impl(uuid,uuid,text,jsonb) to service_role;
grant usage on schema private to service_role;
create function public.bc_support_service(p_actor_id uuid,p_session_id uuid,p_action text,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.bc_support_service_impl(p_actor_id,p_session_id,p_action,p_payload);$$;
revoke all on function public.bc_support_service(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.bc_support_service(uuid,uuid,text,jsonb) to service_role;
