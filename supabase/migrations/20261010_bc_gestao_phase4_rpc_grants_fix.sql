-- BC Gestão Fase 4 — corrige grants dos novos wrappers RPC.
-- Mantém o padrão da Fase 3: wrapper público SECURITY INVOKER,
-- implementação privada SECURITY DEFINER e executável apenas por authenticated.

revoke all on function public.bc_cliente_create(text, text, text) from public;
revoke execute on function public.bc_cliente_create(text, text, text) from anon;
grant execute on function public.bc_cliente_create(text, text, text) to authenticated;

revoke all on function public.bc_cliente_update(uuid, text, text, text) from public;
revoke execute on function public.bc_cliente_update(uuid, text, text, text) from anon;
grant execute on function public.bc_cliente_update(uuid, text, text, text) to authenticated;

revoke all on function public.bc_cliente_set_active(uuid, boolean) from public;
revoke execute on function public.bc_cliente_set_active(uuid, boolean) from anon;
grant execute on function public.bc_cliente_set_active(uuid, boolean) to authenticated;

revoke all on function public.bc_agendamento_create(uuid, uuid, uuid, timestamptz, timestamptz, text) from public;
revoke execute on function public.bc_agendamento_create(uuid, uuid, uuid, timestamptz, timestamptz, text) from anon;
grant execute on function public.bc_agendamento_create(uuid, uuid, uuid, timestamptz, timestamptz, text) to authenticated;

revoke all on function public.bc_agendamento_update(uuid, uuid, timestamptz, timestamptz, text) from public;
revoke execute on function public.bc_agendamento_update(uuid, uuid, timestamptz, timestamptz, text) from anon;
grant execute on function public.bc_agendamento_update(uuid, uuid, timestamptz, timestamptz, text) to authenticated;

revoke all on function private.bc_cliente_create_impl(text, text, text) from public;
revoke execute on function private.bc_cliente_create_impl(text, text, text) from anon;
grant execute on function private.bc_cliente_create_impl(text, text, text) to authenticated;

revoke all on function private.bc_cliente_update_impl(uuid, text, text, text) from public;
revoke execute on function private.bc_cliente_update_impl(uuid, text, text, text) from anon;
grant execute on function private.bc_cliente_update_impl(uuid, text, text, text) to authenticated;

revoke all on function private.bc_cliente_set_active_impl(uuid, boolean) from public;
revoke execute on function private.bc_cliente_set_active_impl(uuid, boolean) from anon;
grant execute on function private.bc_cliente_set_active_impl(uuid, boolean) to authenticated;

revoke all on function private.bc_agendamento_create_impl(uuid, uuid, uuid, timestamptz, timestamptz, text) from public;
revoke execute on function private.bc_agendamento_create_impl(uuid, uuid, uuid, timestamptz, timestamptz, text) from anon;
grant execute on function private.bc_agendamento_create_impl(uuid, uuid, uuid, timestamptz, timestamptz, text) to authenticated;

revoke all on function private.bc_agendamento_update_impl(uuid, uuid, timestamptz, timestamptz, text) from public;
revoke execute on function private.bc_agendamento_update_impl(uuid, uuid, timestamptz, timestamptz, text) from anon;
grant execute on function private.bc_agendamento_update_impl(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
