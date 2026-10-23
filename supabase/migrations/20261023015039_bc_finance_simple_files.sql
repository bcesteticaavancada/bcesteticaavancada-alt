-- Comprovantes opcionais, separados dos documentos clínicos.
create table private.bc_finance_attachments(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('payment','expense')),
 payment_id uuid references private.bc_commission_payments(id),expense_id uuid references private.bc_finance_expenses(id),
 entity_id uuid generated always as (coalesce(payment_id,expense_id)) stored,
 name text not null check(length(name) between 1 and 200),mime text not null,
 size bigint not null check(size between 1 and 10485760),path text not null unique,
 state text not null default 'reserved' check(state in ('reserved','ready')),
 created_by uuid not null references auth.users(id),request_key uuid not null unique,request_payload jsonb not null,
 created_at timestamptz not null default now(),completed_at timestamptz,
 check((kind='payment' and payment_id is not null and expense_id is null) or (kind='expense' and expense_id is not null and payment_id is null))
);
create index bc_finance_attachment_payment_idx on private.bc_finance_attachments(payment_id);
create index bc_finance_attachment_expense_idx on private.bc_finance_attachments(expense_id);
create index bc_finance_attachment_creator_idx on private.bc_finance_attachments(created_by);
alter table private.bc_finance_attachments enable row level security;
revoke all on private.bc_finance_attachments from public,anon,authenticated;
grant all on private.bc_finance_attachments to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bc-finance-private','bc-finance-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']);

create or replace function private.bc_finance_entity_readable(p_kind text,p_entity_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_bc_active_staff() or not private.bc_finance_simple_enabled() then return false; end if;
 if p_kind='payment' then return exists(select 1 from private.bc_commission_payments where id=p_entity_id and (private.is_bc_admin() or professional_id=auth.uid()));
 elsif p_kind='expense' then return private.is_bc_admin() and exists(select 1 from private.bc_finance_expenses where id=p_entity_id); end if;
 return false;
end $$;
create or replace function private.bc_finance_attachment_storage(p_path text,p_write boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_bc_active_staff() or not private.bc_finance_simple_enabled() then return false; end if;
 return exists(select 1 from private.bc_finance_attachments a where a.path=p_path and
 case when p_write then private.is_bc_admin() and a.created_by=auth.uid() and a.state='reserved'
 else a.state='ready' and private.bc_finance_entity_readable(a.kind,a.entity_id) end);
end $$;
create policy bc_finance_object_insert on storage.objects for insert to authenticated
 with check(bucket_id='bc-finance-private' and private.bc_finance_attachment_storage(name,true));
create policy bc_finance_object_read on storage.objects for select to authenticated
 using(bucket_id='bc-finance-private' and private.bc_finance_attachment_storage(name,false));

create or replace function private.bc_finance_attachment_reserve_impl(p_kind text,p_entity_id uuid,p_name text,p_mime text,p_size bigint,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.bc_finance_attachments%rowtype; result private.bc_finance_attachments%rowtype; payload jsonb; extension text; new_id uuid:=gen_random_uuid();
begin
 perform private.bc_finance_require_admin();
 if p_request_key is null or p_entity_id is null or p_kind is null or p_kind not in ('payment','expense') or p_name is null or length(trim(p_name)) not between 1 and 200 or p_name~'[[:cntrl:]]'
 or p_mime is null or p_mime not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') or p_size is null or p_size not between 1 and 10485760 then
 raise exception 'Selecione PDF ou imagem de até10 MB com nome válido.' using errcode='22023'; end if;
 payload:=jsonb_build_object('kind',p_kind,'entity',p_entity_id,'name',trim(p_name),'mime',p_mime,'size',p_size);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bc_finance_proof:'||p_request_key::text,0));
 select * into prior from private.bc_finance_attachments where request_key=p_request_key;
 if found then
  if prior.created_by<>auth.uid() then raise exception 'Acesso negado ao comprovante.' using errcode='42501';end if;
  if prior.request_payload<>payload then raise exception 'A tentativa corresponde a outro arquivo.' using errcode='22023';end if;
  return jsonb_build_object('id',prior.id,'path',prior.path,'name',prior.name,'state',prior.state);
 end if;
 if not private.bc_finance_entity_readable(p_kind,p_entity_id) then raise exception 'Registro financeiro não encontrado.' using errcode='22023';end if;
 extension:=case p_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/heic' then 'heic' else 'heif' end;
 insert into private.bc_finance_attachments(id,kind,payment_id,expense_id,name,mime,size,path,created_by,request_key,request_payload)
 values(new_id,p_kind,case when p_kind='payment' then p_entity_id end,case when p_kind='expense' then p_entity_id end,trim(p_name),p_mime,p_size,
 p_kind||'/'||p_entity_id::text||'/'||new_id::text||'.'||extension,auth.uid(),p_request_key,payload) returning * into result;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
 values(auth.uid(),'finance_attachment_reserved','bc_finance_attachments',result.id,jsonb_build_object('kind',p_kind,'entity_id',p_entity_id));
 return jsonb_build_object('id',result.id,'path',result.path,'name',result.name,'state',result.state);
end $$;
create or replace function private.bc_finance_attachment_complete_impl(p_attachment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.bc_finance_attachments%rowtype; metadata jsonb;
begin
 perform private.bc_finance_require_admin();
 select * into a from private.bc_finance_attachments where id=p_attachment_id for update;
 if not found or a.created_by<>auth.uid() then raise exception 'Acesso negado ao comprovante.' using errcode='42501';end if;
 if a.state<>'ready' then
  select o.metadata into metadata from storage.objects o where o.bucket_id='bc-finance-private' and o.name=a.path;
  if metadata is null or metadata->>'size' is distinct from a.size::text or metadata->>'mimetype' is distinct from a.mime then
   raise exception 'O comprovante ainda não foi enviado ou não corresponde ao arquivo reservado.' using errcode='55000';end if;
  update private.bc_finance_attachments set state='ready',completed_at=now() where id=a.id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'finance_attachment_completed','bc_finance_attachments',a.id,jsonb_build_object('kind',a.kind,'entity_id',a.entity_id));
 end if;
 return jsonb_build_object('id',a.id,'path',a.path,'name',a.name,'state','ready');
end $$;
create or replace function private.bc_finance_attachment_list_impl(p_kind text,p_entity_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.bc_finance_require_staff();
 if not private.bc_finance_entity_readable(p_kind,p_entity_id) then raise exception 'Acesso negado ao comprovante.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'path',a.path,'name',a.name,'mime',a.mime,'size',a.size,'created_at',a.created_at) order by a.created_at,a.id),'[]'::jsonb)
 into result from private.bc_finance_attachments a where a.kind=p_kind and a.entity_id=p_entity_id and a.state='ready';
 return result;
end $$;
create or replace function public.bc_finance_attachment_reserve(p_kind text,p_entity_id uuid,p_name text,p_mime text,p_size bigint,p_request_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_attachment_reserve_impl($1,$2,$3,$4,$5,$6);$$;
create or replace function public.bc_finance_attachment_complete(p_attachment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_attachment_complete_impl($1);$$;
create or replace function public.bc_finance_attachment_list(p_kind text,p_entity_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_attachment_list_impl($1,$2);$$;
revoke all on function private.bc_finance_entity_readable(text,uuid),private.bc_finance_attachment_storage(text,boolean),private.bc_finance_attachment_reserve_impl(text,uuid,text,text,bigint,uuid),private.bc_finance_attachment_complete_impl(uuid),private.bc_finance_attachment_list_impl(text,uuid),public.bc_finance_attachment_reserve(text,uuid,text,text,bigint,uuid),public.bc_finance_attachment_complete(uuid),public.bc_finance_attachment_list(text,uuid) from public,anon,authenticated;
grant execute on function private.bc_finance_attachment_storage(text,boolean),private.bc_finance_attachment_reserve_impl(text,uuid,text,text,bigint,uuid),private.bc_finance_attachment_complete_impl(uuid),private.bc_finance_attachment_list_impl(text,uuid),public.bc_finance_attachment_reserve(text,uuid,text,text,bigint,uuid),public.bc_finance_attachment_complete(uuid),public.bc_finance_attachment_list(text,uuid) to authenticated,service_role;
