-- BC Gestão — feed documental unificado da Pasta da Cliente.
-- Leitura via RPC: clinical_documents gerados pela BC + client_files externos ativos.

create or replace function private.bc_client_document_feed_impl(p_cliente_id uuid)
returns table(
  source_kind text,
  source_id uuid,
  title text,
  category text,
  origin text,
  status text,
  document_date date,
  created_at timestamptz,
  storage_path text,
  mime_type text,
  downloadable boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado aos documentos da cliente.' using errcode='42501';
  end if;
  if not exists(select 1 from public.clientes c where c.id=p_cliente_id) then
    raise exception 'Cliente não encontrada.' using errcode='P0002';
  end if;

  return query
  select feed.source_kind,feed.source_id,feed.title,feed.category,feed.origin,feed.status,
         feed.document_date,feed.created_at,feed.storage_path,feed.mime_type,feed.downloadable
  from (
    select
      'clinical'::text as source_kind,
      d.id as source_id,
      case d.document_type
        when 'anamnese_geral' then 'Anamnese Geral'
        when 'consentimento_procedimento' then 'Consentimento do procedimento'
        when 'treatment_record' then 'Ficha de atendimento'
        else coalesce(nullif(d.document_code,''),'Documento clínico')
      end::text as title,
      d.document_type::text as category,
      'bc_gestao'::text as origin,
      d.status::text as status,
      (coalesce(d.generated_at,d.created_at) at time zone 'America/Sao_Paulo')::date as document_date,
      d.created_at,
      d.storage_path::text,
      case when d.storage_path is not null then 'application/pdf'::text else null::text end as mime_type,
      (d.status = 'emitido' and d.storage_path is not null) as downloadable
    from public.clinical_documents d
    where d.cliente_id=p_cliente_id

    union all

    select
      'external'::text as source_kind,
      f.id as source_id,
      f.title::text,
      f.category::text,
      f.origin::text,
      'anexado'::text as status,
      coalesce(f.document_date,(f.created_at at time zone 'America/Sao_Paulo')::date) as document_date,
      f.created_at,
      f.storage_path::text,
      f.mime_type::text,
      true as downloadable
    from public.client_files f
    where f.cliente_id=p_cliente_id
      and f.voided_at is null
  ) feed
  order by feed.created_at desc;
end;
$$;

create or replace function public.bc_client_document_feed(p_cliente_id uuid)
returns table(
  source_kind text,
  source_id uuid,
  title text,
  category text,
  origin text,
  status text,
  document_date date,
  created_at timestamptz,
  storage_path text,
  mime_type text,
  downloadable boolean
)
language sql
stable
security invoker
set search_path=''
as $$ select * from private.bc_client_document_feed_impl(p_cliente_id); $$;

revoke all on function public.bc_client_document_feed(uuid) from public;
revoke execute on function public.bc_client_document_feed(uuid) from anon;
grant execute on function public.bc_client_document_feed(uuid) to authenticated;

revoke all on function private.bc_client_document_feed_impl(uuid) from public;
revoke execute on function private.bc_client_document_feed_impl(uuid) from anon;
grant execute on function private.bc_client_document_feed_impl(uuid) to authenticated;
