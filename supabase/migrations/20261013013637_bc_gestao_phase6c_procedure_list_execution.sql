-- BC Gestão Fase 6C — listagem respeita acesso geral x restrito para execução clínica.

create or replace function private.bc_procedure_list_impl(p_include_archived boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null or not private.is_bc_active_staff() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by item->>'nome'),'[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id',p.id,
        'nome',p.nome,
        'ativo',p.ativo,
        'duracao_padrao',p.duracao_padrao,
        'current_version_id',p.current_version_id,
        'archived_at',p.archived_at,
        'access_mode',p.access_mode,
        'current_version',case when v.id is null then null else to_jsonb(v) end,
        'can_execute',exists(
          select 1 from public.staff_profiles sp
          where sp.user_id=v_user and sp.active and sp.atende_clientes
        ) and (
          p.access_mode='general'
          or (
            p.access_mode='restricted'
            and coalesce(pp.allowed,false)
            and pp.revoked_at is null
          )
        ),
        'can_manage',private.bc_can_manage_procedures()
      ) as item
      from public.procedimentos p
      left join public.procedure_versions v on v.id=p.current_version_id
      left join public.procedure_professional_permissions pp
        on pp.procedimento_id=p.id and pp.professional_user_id=v_user
      where p_include_archived or p.archived_at is null
    ) q;

  return v_result;
end;
$$;
revoke all on function private.bc_procedure_list_impl(boolean) from public;
revoke execute on function private.bc_procedure_list_impl(boolean) from anon;
grant execute on function private.bc_procedure_list_impl(boolean) to authenticated;
