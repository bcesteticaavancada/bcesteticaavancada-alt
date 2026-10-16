-- BC Gestão — limpa os avisos WARN do Database Advisor sem ampliar permissões.
-- Estratégia:
-- 1) auth.uid() dentro de RLS passa a ser avaliado uma vez via (select auth.uid());
-- 2) policies permissivas sobrepostas são consolidadas por comando;
-- 3) privilégios efetivos anteriores são preservados.

-- Legado de pré-anamnese: existe no replay completo do CI, mas pode não existir
-- no projeto hospedado bc-estetica-gestao. Por isso o ajuste é condicional.
do $do$
begin
  if to_regclass('public.admin_users') is not null then
    execute $sql$
      alter policy "admin_users_read_self"
      on public.admin_users
      using (user_id = (select auth.uid()) and active = true)
    $sql$;
  end if;

  if to_regclass('public.pre_anamneses') is not null then
    execute $sql$
      alter policy "admins_read_pre_anamneses"
      on public.pre_anamneses
      using (
        exists (
          select 1
          from public.admin_users au
          where au.user_id = (select auth.uid())
            and au.active = true
        )
      )
    $sql$;

    execute $sql$
      alter policy "admins_update_pre_anamneses"
      on public.pre_anamneses
      using (
        exists (
          select 1
          from public.admin_users au
          where au.user_id = (select auth.uid())
            and au.active = true
        )
      )
      with check (
        exists (
          select 1
          from public.admin_users au
          where au.user_id = (select auth.uid())
            and au.active = true
        )
      )
    $sql$;
  end if;
end
$do$;

-- staff_profiles
-- Antes: admin_all (ALL) + self_select (SELECT) => duas permissive policies no SELECT.
drop policy if exists "staff_profiles_admin_all" on public.staff_profiles;
alter policy "staff_profiles_self_select"
on public.staff_profiles
using (
  private.is_bc_admin()
  or user_id = (select auth.uid())
);

create policy "staff_profiles_admin_insert"
on public.staff_profiles for insert
to authenticated
with check (private.is_bc_admin());

create policy "staff_profiles_admin_update"
on public.staff_profiles for update
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "staff_profiles_admin_delete"
on public.staff_profiles for delete
to authenticated
using (private.is_bc_admin());

-- agendamentos
-- SELECT preserva: admin vê tudo; colaboradora ativa vê apenas a própria agenda.
drop policy if exists "agendamentos_admin_all" on public.agendamentos;
alter policy "agendamentos_colaborador_select"
on public.agendamentos
using (
  private.is_bc_admin()
  or (
    private.is_bc_active_colaborador()
    and colaboradora_user_id = (select auth.uid())
  )
);

create policy "agendamentos_admin_insert"
on public.agendamentos for insert
to authenticated
with check (private.is_bc_admin());

create policy "agendamentos_admin_update"
on public.agendamentos for update
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "agendamentos_admin_delete"
on public.agendamentos for delete
to authenticated
using (private.is_bc_admin());

-- atendimentos
-- Leitura já é compartilhada com a equipe ativa; removemos apenas o ALL redundante.
-- INSERT combina admin + colaboradora responsável em uma única policy permissiva.
drop policy if exists "atendimentos_admin_all" on public.atendimentos;

alter policy "atendimentos_colaborador_insert_proprio"
on public.atendimentos
with check (
  private.is_bc_admin()
  or (
    private.is_bc_active_colaborador()
    and colaboradora_user_id = (select auth.uid())
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.agendamentos a
      where a.id = atendimentos.agendamento_id
        and a.colaboradora_user_id = (select auth.uid())
        and a.cliente_id = atendimentos.cliente_id
        and a.procedimento_id = atendimentos.procedimento_id
    )
  )
);

create policy "atendimentos_admin_update"
on public.atendimentos for update
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "atendimentos_admin_delete"
on public.atendimentos for delete
to authenticated
using (private.is_bc_admin());

-- clientes
-- clientes_equipe_select já inclui admin e colaborador ativo via is_bc_active_staff().
drop policy if exists "clientes_admin_all" on public.clientes;

create policy "clientes_admin_insert"
on public.clientes for insert
to authenticated
with check (private.is_bc_admin());

create policy "clientes_admin_update"
on public.clientes for update
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "clientes_admin_delete"
on public.clientes for delete
to authenticated
using (private.is_bc_admin());

-- procedimentos
-- procedimentos_staff_select já cobre admin + colaboradora ativa.
drop policy if exists "procedimentos_admin_all" on public.procedimentos;

create policy "procedimentos_admin_insert"
on public.procedimentos for insert
to authenticated
with check (private.is_bc_admin());

create policy "procedimentos_admin_update"
on public.procedimentos for update
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "procedimentos_admin_delete"
on public.procedimentos for delete
to authenticated
using (private.is_bc_admin());
