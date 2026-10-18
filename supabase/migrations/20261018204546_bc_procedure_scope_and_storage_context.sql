-- Mantém a matriz atual; permite limitar futuras profissionais à lista explícita.
alter table public.staff_profiles add column if not exists procedure_scope text not null default 'all'
  check (procedure_scope in ('all','explicit'));

create or replace function private.bc_professional_procedure_allowed(p_user_id uuid,p_procedure_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.staff_profiles sp join public.procedimentos p on p.id=p_procedure_id
    where sp.user_id=p_user_id and sp.active and sp.atende_clientes and (
      (sp.procedure_scope='all' and p.access_mode='general') or exists(
        select 1 from public.procedure_professional_permissions pp where pp.procedimento_id=p.id
          and pp.professional_user_id=sp.user_id and pp.allowed and pp.revoked_at is null)));
$$;
revoke all on function private.bc_professional_procedure_allowed(uuid,uuid) from public,anon,authenticated;

create or replace function private.bc_schedule_public_eligible(p_professional_user_id uuid,p_procedimento_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.bc_professional_procedure_allowed(p_professional_user_id,p_procedimento_id) and exists(
    select 1 from public.procedimentos p join public.procedure_versions pv on pv.id=p.current_version_id
    where p.id=p_procedimento_id and p.ativo and p.archived_at is null and p.duracao_padrao>0 and pv.status='published');
$$;
create or replace function private.bc_treatment_can_execute_version(p_version_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.procedure_versions v where v.id=p_version_id and v.status in ('published','superseded')
    and private.bc_professional_procedure_allowed(p_user_id,v.procedimento_id));
$$;

-- INSERT e remarcação interna têm a mesma matriz de qualificação do site.
-- Uma revogação não impede cancelar ou concluir uma reserva já existente.
create or replace function private.bc_appointment_qualification_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.procedimento_id is not distinct from old.procedimento_id and new.colaboradora_user_id is not distinct from old.colaboradora_user_id
      and new.inicio is not distinct from old.inicio and new.fim is not distinct from old.fim then return new; end if;
  end if;
  if not private.bc_schedule_public_eligible(new.colaboradora_user_id,new.procedimento_id) then
    raise exception 'Profissional não autorizada para este procedimento.' using errcode='42501';
  end if;
  return new;
end; $$;
revoke all on function private.bc_appointment_qualification_guard() from public,anon,authenticated;
create trigger bc_appointment_qualification before insert or update of procedimento_id,colaboradora_user_id,inicio,fim on public.agendamentos
for each row execute function private.bc_appointment_qualification_guard();

create or replace function private.bc_agenda_eligible_procedures_impl(p_professional_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.bc_schedule_can_manage(p_professional_user_id) then raise exception 'Acesso negado à agenda da profissional.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
    select p.id,p.nome,p.duracao_padrao,p.ativo from public.procedimentos p
    where private.bc_schedule_public_eligible(p_professional_user_id,p.id) order by p.nome
  ) r;
  return result;
end; $$;
create or replace function public.bc_agenda_eligible_procedures(p_professional_user_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.bc_agenda_eligible_procedures_impl($1); $$;
revoke all on function private.bc_agenda_eligible_procedures_impl(uuid),public.bc_agenda_eligible_procedures(uuid) from public,anon;
grant execute on function private.bc_agenda_eligible_procedures_impl(uuid),public.bc_agenda_eligible_procedures(uuid) to authenticated;

-- Compartilhamento clínico permanece; arquivos órfãos ou anulados não são uma pasta clínica.
create or replace function private.bc_clinical_storage_context_read(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_bc_active_staff() and (
    exists(select 1 from public.cliente_identificacao_fotos f join public.clientes c on c.id=f.cliente_id where f.storage_path=p_path)
    or exists(select 1 from public.clinical_treatment_photos f join public.clinical_treatments t on t.id=f.treatment_id
      where f.storage_path=p_path and f.voided_at is null and f.cliente_id=t.cliente_id)
    or exists(select 1 from public.clinical_documents d join public.clientes c on c.id=d.cliente_id where d.storage_path=p_path)
    or exists(select 1 from public.clinical_signatures s join public.clinical_documents d on d.id=s.document_id where s.storage_path=p_path)
    or exists(select 1 from public.client_files f join public.clientes c on c.id=f.cliente_id where f.storage_path=p_path and f.voided_at is null)
  );
$$;
revoke all on function private.bc_clinical_storage_context_read(text) from public,anon;
grant execute on function private.bc_clinical_storage_context_read(text) to authenticated;
alter policy bc_prontuario_private_select on storage.objects using (
  bucket_id='bc-prontuario-private' and private.bc_clinical_storage_context_read(name)
);
