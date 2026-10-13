-- BC Gestão Fase 6C — leitura do consentimento já vinculado sem reabrir a etapa de preparo.

create or replace function private.bc_treatment_get_impl(p_treatment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if auth.uid() is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select to_jsonb(t) || jsonb_build_object(
    'procedure_version',to_jsonb(pv),
    'access_mode',p.access_mode,
    'components',coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from public.clinical_treatment_components c
      where c.treatment_id=t.id
    ),'[]'::jsonb),
    'gate_reasons',private.bc_treatment_gate(t.id),
    'consent',case when t.consent_document_id is null then null else (
      select jsonb_build_object(
        'document_id',d.id,
        'document_code',d.document_code,
        'document_status',d.status,
        'consent_id',pc.id,
        'consent_class',pc.consent_class,
        'procedure_name',pc.procedure_name_snapshot,
        'supplement',pc.supplement_snapshot,
        'status',pc.status,
        'title',ct.title,
        'body',ct.body,
        'template_version',ct.version,
        'reused',pc.status='finalizado'
      )
      from public.clinical_documents d
      join public.procedure_consents pc on pc.id=d.source_id
      join public.consent_template_versions ct on ct.id=pc.consent_template_version_id
      where d.id=t.consent_document_id
        and d.document_type='consentimento_procedimento'
    ) end
  ) into r
  from public.clinical_treatments t
  join public.procedure_versions pv on pv.id=t.procedure_version_id
  join public.procedimentos p on p.id=t.procedimento_id
  where t.id=p_treatment_id;

  if r is null then
    raise exception 'Atendimento não encontrado.' using errcode='P0002';
  end if;
  return r;
end;
$$;
revoke all on function private.bc_treatment_get_impl(uuid) from public;
revoke execute on function private.bc_treatment_get_impl(uuid) from anon;
grant execute on function private.bc_treatment_get_impl(uuid) to authenticated;
