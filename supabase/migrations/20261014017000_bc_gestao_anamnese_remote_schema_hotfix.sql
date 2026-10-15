-- BC Gestão — hotfix da anamnese remota.
--
-- O navegador público executa apenas os wrappers em public. Os wrappers remotos
-- precisam atravessar o schema private, mas o papel anon não deve receber USAGE
-- genérico nesse schema. Por isso, somente estes dois entrypoints públicos usam
-- SECURITY DEFINER com search_path vazio; toda validação do token continua nas
-- implementações privadas já existentes.

create or replace function public.bc_anamnese_remote_get(p_token text)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select private.bc_anamnese_remote_get_impl(p_token);
$$;

create or replace function public.bc_anamnese_remote_save(
  p_token text,
  p_answers jsonb,
  p_submit boolean default false
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select private.bc_anamnese_remote_save_impl(p_token, p_answers, p_submit);
$$;

-- Os únicos entrypoints remotos expostos ao navegador continuam em public.
revoke all on function public.bc_anamnese_remote_get(text) from public;
revoke all on function public.bc_anamnese_remote_save(text,jsonb,boolean) from public;
grant execute on function public.bc_anamnese_remote_get(text) to anon, authenticated;
grant execute on function public.bc_anamnese_remote_save(text,jsonb,boolean) to anon, authenticated;

-- As implementações internas deixam de ser executáveis diretamente pelos papéis
-- do navegador. SECURITY DEFINER dos wrappers públicos é a única ponte autorizada.
revoke all on function private.bc_anamnese_remote_get_impl(text) from public;
revoke all on function private.bc_anamnese_remote_save_impl(text,jsonb,boolean) from public;
revoke all on function private.bc_anamnese_remote_get_impl(text) from anon, authenticated;
revoke all on function private.bc_anamnese_remote_save_impl(text,jsonb,boolean) from anon, authenticated;
