-- RASCUNHO NÃO APLICADO — exclusão definitiva: somente a identidade clínica da Mel.
-- Falha fechada: sem configuração privada de Mel, nenhum usuário autenticado pode
-- efetuar DELETE nas seis tabelas que hoje concedem essa operação ao admin.
-- O acesso SELECT/INSERT/UPDATE existente permanece inalterado.
-- Executar primeiro em Supabase LOCAL descartável; publicar somente após
-- aprovação expressa da Mel, validação da identidade e testes de regressão.

create table if not exists private.bc_final_delete_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  configured_at timestamptz not null default now()
);
alter table private.bc_final_delete_owner enable row level security;
revoke all on table private.bc_final_delete_owner from public, anon, authenticated, service_role;

create or replace function private.bc_can_delete_finalized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_bc_admin())
    and exists (
      select 1 from private.bc_final_delete_owner m
      where m.singleton = true
        and m.user_id = (select auth.uid())
    );
$$;
revoke all on function private.bc_can_delete_finalized() from public, anon;
grant execute on function private.bc_can_delete_finalized() to authenticated;

-- Uma política RESTRICTIVE funciona em conjunto com todas as políticas
-- PERMISSIVE atuais. Mesmo outro admin não consegue remover definitivamente.
create policy bc_final_delete_mel_only on public.agendamentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_mel_only on public.atendimentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_mel_only on public.clientes
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_mel_only on public.pagamentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_mel_only on public.procedimentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_mel_only on public.staff_profiles
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized())
         and user_id <> (select auth.uid()));

-- A exclusão permitida continua auditada: um snapshot privado preserva
-- o estado anterior, inclusive se a operação não partir de uma tela específica.
create or replace function private.bc_audit_final_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_entity_id uuid;
begin
  v_entity_id := coalesce((v_old->>'id')::uuid, (v_old->>'user_id')::uuid);
  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, old_data)
  values (auth.uid(), 'record_definitively_deleted', tg_table_name, v_entity_id, v_old);
  return old;
end;
$$;
revoke all on function private.bc_audit_final_delete() from public, anon, authenticated;

create trigger bc_audit_final_delete
before delete on public.agendamentos for each row
execute function private.bc_audit_final_delete();

create trigger bc_audit_final_delete
before delete on public.atendimentos for each row
execute function private.bc_audit_final_delete();

create trigger bc_audit_final_delete
before delete on public.clientes for each row
execute function private.bc_audit_final_delete();

create trigger bc_audit_final_delete
before delete on public.pagamentos for each row
execute function private.bc_audit_final_delete();

create trigger bc_audit_final_delete
before delete on public.procedimentos for each row
execute function private.bc_audit_final_delete();

create trigger bc_audit_final_delete
before delete on public.staff_profiles for each row
execute function private.bc_audit_final_delete();

-- IMPORTANTE: nunca gravar UUID real, e-mail, token ou senha da Mel no Git.
-- A linha em private.bc_final_delete_owner será criada somente no deploy
-- autorizado por operador de banco, após conferir a identidade com a Mel.
-- service_role / postgres são privilegiados e podem contornar RLS; não usar
-- service_role em browsers nem em endpoints de exclusão de registros.
