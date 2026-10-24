-- Corte atômico: não misturar apuração semanal prévia com comissão por recebimento.
-- Se houver uso legado novo, aborta; nenhum dado financeiro é descartado.
do $cutover$ declare t record; begin
 lock table public.clinical_treatments,public.agendamentos,public.atendimentos,public.pagamentos,public.recebimentos,public.livros_financeiros,public.repasses in share row exclusive mode;
 if exists(select 1 from public.recebimentos) or exists(select 1 from public.livros_financeiros) or exists(select 1 from public.repasses)
 or exists(select 1 from public.pagamentos) then
 raise exception 'Há movimentos anteriores ao financeiro simples. Revise a transição antes de ativar.' using errcode='55000';
 end if;
 update private.bc_finance_settings set simple_mode=true where id;
 for t in select id from public.clinical_treatments where status='finalizado' order by profissional_user_id,id loop
 perform private.bc_finance_ensure_charge(t.id);
 end loop;
end $cutover$;
