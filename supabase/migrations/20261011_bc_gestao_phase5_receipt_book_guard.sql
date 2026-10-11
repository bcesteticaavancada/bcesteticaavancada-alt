-- BC Gestão Fase 5 — impede movimentos retroativos em livros financeiros congelados.
-- A proteção fica no banco para cobrir qualquer caminho futuro de inserção em recebimentos.

create or replace function private.bc_guard_recebimento_book_period()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_data date := (new.recebido_at at time zone 'America/Sao_Paulo')::date;
  v_status text;
begin
  select lf.status
    into v_status
    from public.livros_financeiros lf
   where lf.profissional_user_id = new.profissional_user_id
     and v_data between lf.periodo_inicio and lf.periodo_fim
     and lf.status in ('fechado', 'pago', 'em_revisao')
   order by case lf.status
              when 'pago' then 1
              when 'fechado' then 2
              else 3
            end
   limit 1;

  if v_status in ('fechado', 'pago') then
    raise exception 'Recebimento pertence a livro fechado ou pago; reabra ou reverta o fluxo antes de registrar o movimento.'
      using errcode = '55000';
  end if;

  if v_status = 'em_revisao' and not private.is_bc_admin() then
    raise exception 'Período financeiro está em revisão; somente a administradora pode registrar movimentos retroativos.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.bc_guard_recebimento_book_period() from public, anon, authenticated;

drop trigger if exists bc_recebimentos_book_period_guard on public.recebimentos;

create trigger bc_recebimentos_book_period_guard
before insert on public.recebimentos
for each row
execute function private.bc_guard_recebimento_book_period();
