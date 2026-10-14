-- BC Gestão — hotfix de isolamento da policy de upload de fotos clínicas.
-- Evita que a policy de storage.objects consulte diretamente clinical_treatments,
-- que é intencionalmente RPC-only para authenticated.

create or replace function private.bc_storage_photo_insert_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    private.is_bc_active_staff()
    and (storage.foldername(p_name))[1] = 'fotos-clinicas'
    and exists (
      select 1
      from public.clinical_treatments t
      where t.id::text = (storage.foldername(p_name))[3]
        and t.cliente_id::text = (storage.foldername(p_name))[2]
        and t.profissional_user_id = auth.uid()
        and t.pending_document_id is null
        and t.status in ('rascunho','pronto_para_iniciar','em_atendimento')
    );
$$;

revoke all on function private.bc_storage_photo_insert_allowed(text) from public;
revoke execute on function private.bc_storage_photo_insert_allowed(text) from anon;
grant execute on function private.bc_storage_photo_insert_allowed(text) to authenticated;

drop policy if exists bc_phase6d_photo_insert on storage.objects;
create policy bc_phase6d_photo_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bc-prontuario-private'
    and (storage.foldername(name))[1] = 'fotos-clinicas'
    and storage.extension(name) in ('jpg','jpeg','png','webp')
    and private.bc_storage_photo_insert_allowed(name)
  );
