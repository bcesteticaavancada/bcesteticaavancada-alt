-- BC Gestão Fase 5 — hardening final de auditoria e privilégios.
-- Reafirma segurança mesmo se grants padrão/legados forem alterados por outra migration.

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_admin_select" on public.audit_log;
create policy "audit_log_admin_select"
  on public.audit_log
  for select
  to authenticated
  using (private.is_bc_admin());

revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Estruturas financeiras não são API direta para o browser.
revoke all on table public.recebimentos from anon, authenticated;
revoke all on table public.comissao_profissional_procedimento from anon, authenticated;
revoke all on table public.livros_financeiros from anon, authenticated;
revoke all on table public.livro_financeiro_itens from anon, authenticated;
revoke all on table public.config_repasses from anon, authenticated;
revoke all on table public.repasses from anon, authenticated;
revoke all on table public.repasse_livros from anon, authenticated;

-- Recebimentos.
revoke all on function public.bc_recebimento_registrar(uuid, numeric, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.bc_recebimento_registrar(uuid, numeric, text, timestamptz, text) to authenticated;
revoke all on function public.bc_recebimento_estornar(uuid, text) from public, anon, authenticated;
grant execute on function public.bc_recebimento_estornar(uuid, text) to authenticated;
revoke all on function public.bc_meus_recebimentos(date, date) from public, anon, authenticated;
grant execute on function public.bc_meus_recebimentos(date, date) to authenticated;
revoke all on function public.bc_financeiro_recebimentos_admin(uuid, date, date) from public, anon, authenticated;
grant execute on function public.bc_financeiro_recebimentos_admin(uuid, date, date) to authenticated;

-- Comissão e livros.
revoke all on function public.bc_comissao_set(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.bc_comissao_set(uuid, uuid, numeric) to authenticated;
revoke all on function public.bc_financeiro_comissoes_admin(uuid) from public, anon, authenticated;
grant execute on function public.bc_financeiro_comissoes_admin(uuid) to authenticated;
revoke all on function public.bc_livro_fechar(uuid, date, date) from public, anon, authenticated;
grant execute on function public.bc_livro_fechar(uuid, date, date) to authenticated;
revoke all on function public.bc_livro_reabrir(uuid, text) from public, anon, authenticated;
grant execute on function public.bc_livro_reabrir(uuid, text) to authenticated;
revoke all on function public.bc_livros_recalcular(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.bc_livros_recalcular(uuid, uuid, date, date) to authenticated;
revoke all on function public.bc_meus_livros_financeiros(date, date) from public, anon, authenticated;
grant execute on function public.bc_meus_livros_financeiros(date, date) to authenticated;
revoke all on function public.bc_financeiro_livros_admin(uuid, date, date) from public, anon, authenticated;
grant execute on function public.bc_financeiro_livros_admin(uuid, date, date) to authenticated;

-- Ciclos e repasses.
revoke all on function public.bc_config_repasse_set(uuid, integer) from public, anon, authenticated;
grant execute on function public.bc_config_repasse_set(uuid, integer) to authenticated;
revoke all on function public.bc_repasse_criar(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.bc_repasse_criar(uuid, uuid[], text) to authenticated;
revoke all on function public.bc_repasse_baixar(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.bc_repasse_baixar(uuid, timestamptz) to authenticated;
revoke all on function public.bc_repasse_estornar(uuid, text) from public, anon, authenticated;
grant execute on function public.bc_repasse_estornar(uuid, text) to authenticated;
revoke all on function public.bc_meus_repasses(date, date) from public, anon, authenticated;
grant execute on function public.bc_meus_repasses(date, date) to authenticated;
revoke all on function public.bc_financeiro_repasses_admin(uuid, date, date) from public, anon, authenticated;
grant execute on function public.bc_financeiro_repasses_admin(uuid, date, date) to authenticated;
