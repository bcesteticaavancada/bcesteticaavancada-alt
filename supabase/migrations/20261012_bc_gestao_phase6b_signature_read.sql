-- Fase 6B — leitura segura das assinaturas já registradas para retry idempotente na UI.

create or replace function public.bc_clinical_signature_list(p_document_id uuid)
returns table(
  id uuid,
  signer_kind text,
  signer_name text,
  signer_profissao text,
  signer_conselho text,
  signer_registro text,
  signed_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth, private
as $$
  select s.id,s.signer_kind,s.signer_name,s.signer_profissao,s.signer_conselho,s.signer_registro,s.signed_at
  from public.clinical_signatures s
  join public.clinical_documents d on d.id=s.document_id
  where private.is_bc_active_staff()
    and s.document_id=p_document_id
  order by s.signed_at;
$$;

revoke all on function public.bc_clinical_signature_list(uuid) from public;
grant execute on function public.bc_clinical_signature_list(uuid) to authenticated;
