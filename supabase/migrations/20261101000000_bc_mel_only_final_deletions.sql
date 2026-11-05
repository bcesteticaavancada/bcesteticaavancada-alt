-- RASCUNHO NÃO APLICADO — dois pontos independentes de segurança:
-- Mel na responsabilidade clínica; Fernando como suporte técnico emergencial.
-- Nenhuma identidade real é gravada no Git. Configuração privada falha fechada.
-- Técnicos admin_criacao não ganham acesso clínico/DELETE direto: usam RPC
-- exclusiva com MFA forte, justificativa e auditoria imutável.
-- Liberação só após aprovação da Mel e revisão de rotas privilegiadas.

create table if not exists private.bc_final_delete_operators (
  scope text primary key check (scope in ('clinical_owner','technical_backup')),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  configured_at timestamptz not null default now()
);
alter table private.bc_final_delete_operators enable row level security;
revoke all on table private.bc_final_delete_operators
  from public, anon, authenticated, service_role;

create or replace function private.bc_is_final_delete_operator(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from private.bc_final_delete_operators o
    where o.user_id=p_user_id
  );
$$;
revoke all on function private.bc_is_final_delete_operator(uuid) from public,anon;
grant execute on function private.bc_is_final_delete_operator(uuid) to authenticated;

create or replace function private.bc_can_delete_finalized()
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from private.bc_final_delete_operators o
    join public.staff_profiles s on s.user_id=o.user_id
    where o.user_id=(select auth.uid()) and s.active
      and (
        (o.scope='clinical_owner' and s.role='admin')
        or
        (o.scope='technical_backup' and s.role='admin_criacao'
          and coalesce(auth.jwt()->>'aal','')='aal2')
      )
  );
$$;
revoke all on function private.bc_can_delete_finalized() from public,anon;
grant execute on function private.bc_can_delete_finalized() to authenticated;

-- Uma política RESTRICTIVE funciona em conjunto com todas as políticas
-- PERMISSIVE atuais. Mesmo outro admin não consegue remover definitivamente.
create policy bc_final_delete_two_operators on public.agendamentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_two_operators on public.atendimentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_two_operators on public.clientes
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_two_operators on public.pagamentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_two_operators on public.procedimentos
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized()));

create policy bc_final_delete_two_operators on public.staff_profiles
  as restrictive for delete to authenticated
  using ((select private.bc_can_delete_finalized())
         and not (select private.bc_is_final_delete_operator(user_id)));

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

-- Exceção de suporte: permite somente a identidade técnica previamente vinculada,
-- usando sessão MFA AAL2, motivo obrigatório e conjunto fechado de entidades.
-- SECURITY DEFINER é necessário porque admin_criacao tem negação RESTRICTIVE
-- a todas as tabelas brutas. Não exponha essa função diretamente no public.
create or replace function private.bc_support_delete_finalized_impl(
  p_entity_type text,p_entity_id uuid,p_reason text
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_key_column text;
  v_before jsonb;
  v_deleted integer;
begin
  if v_actor is null
     or not private.bc_can_delete_finalized()
     or not exists(select 1 from private.bc_final_delete_operators
                   where scope='technical_backup' and user_id=v_actor) then
    raise exception 'Suporte técnico emergencial não autorizado ou sem MFA.' using errcode='42501';
  end if;
  if nullif(trim(p_reason),'') is null or char_length(trim(p_reason)) not between 10 and 500 then
    raise exception 'Informe motivo claro de 10 a 500 caracteres.' using errcode='22023';
  end if;
  if p_entity_id is null or p_entity_type not in
     ('agendamentos','atendimentos','clientes','pagamentos','procedimentos','staff_profiles') then
    raise exception 'Entidade de exclusão não autorizada.' using errcode='22023';
  end if;
  if p_entity_type='staff_profiles'
     and private.bc_is_final_delete_operator(p_entity_id) then
    raise exception 'Contas de contingência não podem ser excluídas.' using errcode='42501';
  end if;
  v_key_column := case when p_entity_type='staff_profiles' then 'user_id' else 'id' end;
  execute format('select to_jsonb(t) from public.%I t where t.%I=$1 for update',
                 p_entity_type,v_key_column)
    into v_before using p_entity_id;
  if v_before is null then
    raise exception 'Registro não localizado.' using errcode='P0002';
  end if;
  execute format('delete from public.%I where %I=$1',p_entity_type,v_key_column)
    using p_entity_id;
  get diagnostics v_deleted = row_count;
  if v_deleted<>1 then
    raise exception 'Exclusão emergencial não foi concluída.' using errcode='55000';
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(v_actor,'technical_support_final_delete',p_entity_type,p_entity_id,
         v_before,jsonb_build_object('reason',trim(p_reason),'scope','technical_backup'));
  return p_entity_id;
end;
$$;
revoke all on function private.bc_support_delete_finalized_impl(text,uuid,text)
  from public,anon;
grant execute on function private.bc_support_delete_finalized_impl(text,uuid,text)
  to authenticated;

create or replace function public.bc_support_delete_finalized(
  p_entity_type text,p_entity_id uuid,p_reason text
)
returns uuid language sql security invoker set search_path=''
as $$
  select private.bc_support_delete_finalized_impl(p_entity_type,p_entity_id,p_reason);
$$;
revoke all on function public.bc_support_delete_finalized(text,uuid,text)
  from public,anon;
grant execute on function public.bc_support_delete_finalized(text,uuid,text)
  to authenticated;

-- IMPORTANTE: não registrar IDs, e-mails, senhas, tokens ou chaves reais no Git.
-- As duas identidades ficam vazias até configuração privada em deploy autorizado.
-- service_role/postgres contornam RLS: manter chaves fora do browser e revisar
-- todas as rotas elevadas antes de liberar.
