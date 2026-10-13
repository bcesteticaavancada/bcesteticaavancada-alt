-- BC Gestão Fase 6D — hardening do Storage clínico.
-- Evita objeto órfão após a ficha já ter sido congelada para assinatura/finalização.

drop policy if exists bc_phase6d_photo_insert on storage.objects;
create policy bc_phase6d_photo_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bc-prontuario-private'
    and private.is_bc_active_staff()
    and (storage.foldername(name))[1] = 'fotos-clinicas'
    and storage.extension(name) in ('jpg','jpeg','png','webp')
    and exists (
      select 1
      from public.clinical_treatments t
      where t.id::text = (storage.foldername(name))[3]
        and t.cliente_id::text = (storage.foldername(name))[2]
        and t.profissional_user_id = auth.uid()
        and t.pending_document_id is null
        and t.status in ('rascunho','pronto_para_iniciar','em_atendimento')
    )
  );
