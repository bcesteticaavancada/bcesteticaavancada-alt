-- BC Gestão — opções de procedimento do atendimento rápido.
-- Calcula autorização clínica para a profissional escolhida no servidor.

create or replace function private.bc_quick_visit_procedure_options_impl(
  p_profissional_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  if p_profissional_user_id is null then
    raise exception 'Profissional inválida.' using errcode='22023';
  end if;

  if not private.is_bc_admin() and p_profissional_user_id <> v_user then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  if not exists(
    select 1
      from public.staff_profiles sp
     where sp.user_id = p_profissional_user_id
       and sp.active is true
       and sp.atende_clientes is true
  ) then
    raise exception 'Profissional indisponível.' using errcode='22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'procedure_id', p.id,
        'can_execute', private.bc_treatment_can_execute_version(p.current_version_id, p_profissional_user_id)
      )
      order by lower(p.nome), p.id
    ),
    '[]'::jsonb
  )
    into v_result
    from public.procedimentos p
   where p.ativo is true
     and p.current_version_id is not null;

  return v_result;
end;
$$;

revoke all on function private.bc_quick_visit_procedure_options_impl(uuid)
  from public, anon, authenticated;

create or replace function public.bc_quick_visit_procedure_options(
  p_profissional_user_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.bc_quick_visit_procedure_options_impl(p_profissional_user_id);
$$;

revoke all on function public.bc_quick_visit_procedure_options(uuid)
  from public, anon, authenticated;
grant execute on function public.bc_quick_visit_procedure_options(uuid)
  to authenticated;
