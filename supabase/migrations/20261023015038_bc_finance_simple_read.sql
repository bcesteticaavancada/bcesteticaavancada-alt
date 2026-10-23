create or replace function private.bc_finance_period(p_from date,p_to date) returns void
language plpgsql immutable security invoker set search_path='' as $$
begin if p_from is null or p_to is null or p_to<p_from then raise exception 'Confira o período do relatório.' using errcode='22023'; end if; end $$;

create or replace function private.bc_finance_rows(p_from date,p_to date)
returns table(id uuid,kind text,direction text,description text,amount numeric,occurred_at timestamptz,included boolean,state text,professional_id uuid,professional_name text,method text)
language sql stable security definer set search_path='' as $$
 select r.id,'receipt'::text,'in'::text,'Recebimento — '||p.nome,r.valor,r.recebido_at,r.status='ativo',
 case when r.status='ativo' then 'active' else 'reversed' end,r.profissional_user_id,s.display_name,r.forma_pagamento
 from public.recebimentos r join private.bc_commission_items i on i.receipt_id=r.id
 join public.procedimentos p on p.id=r.procedimento_id join public.staff_profiles s on s.user_id=r.profissional_user_id
 where (r.recebido_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
 union all
 select p.id,'commission_payment','out','Comissão — '||s.display_name,p.amount,p.paid_at,p.state='paid',p.state,p.professional_id,s.display_name,p.method
 from private.bc_commission_payments p join public.staff_profiles s on s.user_id=p.professional_id
 where (p.paid_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
 union all
 select e.id,'expense','out',e.description,e.amount,e.paid_at,e.state='active',e.state,null::uuid,null::text,e.method
 from private.bc_finance_expenses e where (e.paid_at at time zone 'America/Sao_Paulo')::date between p_from and p_to;
$$;

create or replace function private.bc_finance_report_impl(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; income numeric; expense numeric;
begin
 perform private.bc_finance_require_admin();perform private.bc_finance_period(p_from,p_to);
 select coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_at,r.kind,r.id),'[]'::jsonb),
 coalesce(sum(r.amount) filter(where r.included and r.direction='in'),0),
 coalesce(sum(r.amount) filter(where r.included and r.direction='out'),0)
 into rows,income,expense from private.bc_finance_rows(p_from,p_to) r;
 return jsonb_build_object('clinic','BC Estética Avançada','from',p_from,'to',p_to,'generated_at',now(),
 'rows',rows,'totals',jsonb_build_object('income',income,'expense',expense,'balance',income-expense));
end $$;

create or replace function private.bc_finance_appointment_summary_impl(p_appointment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.agendamentos%rowtype; att public.atendimentos%rowtype; p public.pagamentos%rowtype;
 ids uuid[]; total_text text; total numeric; t_count integer; state text;
begin
 perform private.bc_finance_require_staff();
 select * into a from public.agendamentos where id=p_appointment_id;
 if not found or (not private.is_bc_admin() and a.colaboradora_user_id<>auth.uid()) then
 raise exception 'Acesso negado ao financeiro deste atendimento.' using errcode='42501'; end if;
 select * into att from public.atendimentos where agendamento_id=a.id;
 if not found then return jsonb_build_object('appointment_id',a.id,'state','not_completed','can_receive',false); end if;
 select array_agg(x.id order by x.id) into ids from public.pagamentos x
 where x.atendimento_id=att.id or (x.atendimento_id is null and x.agendamento_id=a.id);
 if cardinality(ids)>1 then return jsonb_build_object('appointment_id',a.id,'state','ambiguous','can_receive',false); end if;
 if cardinality(ids)=1 then
  select * into p from public.pagamentos where id=ids[1];
  if p.cliente_id is distinct from a.cliente_id or (p.agendamento_id is not null and p.agendamento_id<>a.id)
  or att.cliente_id is distinct from a.cliente_id or att.colaboradora_user_id is distinct from a.colaboradora_user_id
  or att.procedimento_id is distinct from a.procedimento_id then
   return jsonb_build_object('appointment_id',a.id,'state','ambiguous','can_receive',false); end if;
  state:=case when p.status='cancelado' then 'cancelled' when p.valor_total-p.valor_recebido>0 then 'receivable' else 'paid' end;
  return jsonb_build_object('appointment_id',a.id,'payment_id',p.id,'total',p.valor_total,'received',p.valor_recebido,
  'remaining',p.valor_total-p.valor_recebido,'state',state,'can_receive',state='receivable');
 end if;
 select count(*) into t_count from public.clinical_treatments where operational_attendance_id=att.id and status='finalizado';
 if t_count<>1 then return jsonb_build_object('appointment_id',a.id,'state',case when t_count>1 then 'ambiguous' else 'missing_total' end,'can_receive',false); end if;
 select v.snapshot->'treatment'->>'final_price' into total_text from public.clinical_treatments t
 join public.clinical_treatment_versions v on v.id=t.current_version_id and v.treatment_id=t.id
 where t.operational_attendance_id=att.id and t.status='finalizado';
 begin total:=total_text::numeric;exception when invalid_text_representation or numeric_value_out_of_range then total:=null;end;
 if total=0 then return jsonb_build_object('appointment_id',a.id,'state','free','total',0,'received',0,'remaining',0,'can_receive',false);end if;
 return jsonb_build_object('appointment_id',a.id,'state','missing_total','can_receive',false);
end $$;

create or replace function private.bc_finance_overview_impl(p_from date,p_to date,p_professional uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; pending jsonb; awaiting jsonb; payments jsonb; rules jsonb; people jsonb; procedures jsonb; charges jsonb; issues jsonb; n integer;
begin
 perform private.bc_finance_require_admin();perform private.bc_finance_period(p_from,p_to);
 result:=private.bc_finance_report_impl(p_from,p_to);
 if p_professional is not null then
  select result||jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_at,r.id),'[]'::jsonb),
  'totals',jsonb_build_object('income',coalesce(sum(r.amount)filter(where r.included and r.direction='in'),0),
  'expense',coalesce(sum(r.amount)filter(where r.included and r.direction='out'),0),
  'balance',coalesce(sum(case when r.direction='in' then r.amount else -r.amount end)filter(where r.included),0)))
  into result from private.bc_finance_rows(p_from,p_to) r where r.professional_id=p_professional;
 end if;
 select coalesce(jsonb_agg(to_jsonb(g) order by g.professional_name),'[]'::jsonb) into pending from (
  select i.professional_id,s.display_name professional_name,sum(i.amount) amount,
  jsonb_agg(jsonb_build_object('id',i.id,'receipt_id',i.receipt_id,'amount',i.amount,'procedure',p.nome,'received_at',r.recebido_at,'client',c.nome) order by r.recebido_at,i.id) items
  from private.bc_commission_items i join public.staff_profiles s on s.user_id=i.professional_id
  join public.recebimentos r on r.id=i.receipt_id join public.procedimentos p on p.id=i.procedure_id join public.clientes c on c.id=r.cliente_id
  where i.state='pending' and (p_professional is null or i.professional_id=p_professional)
  group by i.professional_id,s.display_name
 ) g;
 select count(*),coalesce(jsonb_agg(jsonb_build_object('professional_id',i.professional_id,'professional_name',s.display_name,'procedure_id',i.procedure_id,'procedure',p.nome,'receipt_id',i.receipt_id) order by s.display_name,p.nome),'[]'::jsonb)
 into n,awaiting from private.bc_commission_items i join public.staff_profiles s on s.user_id=i.professional_id join public.procedimentos p on p.id=i.procedure_id
 where i.state='awaiting_rule' and (p_professional is null or i.professional_id=p_professional);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'professional_id',p.professional_id,'professional_name',s.display_name,'amount',p.amount,'paid_at',p.paid_at,'method',p.method,'state',p.state) order by p.paid_at desc,p.id),'[]'::jsonb)
 into payments from private.bc_commission_payments p join public.staff_profiles s on s.user_id=p.professional_id
 where (p.paid_at at time zone 'America/Sao_Paulo')::date between p_from and p_to and (p_professional is null or p.professional_id=p_professional);
 select coalesce(jsonb_agg(jsonb_build_object('professional_id',c.profissional_user_id,'procedure_id',c.procedimento_id,'percent',c.percentual) order by c.profissional_user_id,c.procedimento_id),'[]'::jsonb)
 into rules from public.comissao_profissional_procedimento c where c.ativo and (p_professional is null or c.profissional_user_id=p_professional);
 select coalesce(jsonb_agg(jsonb_build_object('id',s.user_id,'name',s.display_name,'procedure_ids',(select coalesce(jsonb_agg(p.id),'[]'::jsonb) from public.procedimentos p where (p.ativo and private.bc_professional_procedure_allowed(s.user_id,p.id)) or exists(select 1 from private.bc_commission_items i where i.professional_id=s.user_id and i.procedure_id=p.id and i.state='awaiting_rule'))) order by s.display_name),'[]'::jsonb)
 into people from public.staff_profiles s where (s.active and s.atende_clientes and s.role in ('admin','colaborador')) or exists(select 1 from private.bc_commission_items i where i.professional_id=s.user_id and i.state in ('pending','awaiting_rule'));
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.nome) order by p.nome),'[]'::jsonb) into procedures from public.procedimentos p where p.ativo or exists(select 1 from private.bc_commission_items i where i.procedure_id=p.id and i.state='awaiting_rule');
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'appointment_id',p.agendamento_id,'client',c.nome,'professional',s.display_name,'procedure',pr.nome,'total',p.valor_total,'received',p.valor_recebido,'remaining',p.valor_total-p.valor_recebido) order by p.created_at,p.id),'[]'::jsonb)
 into charges from public.pagamentos p join public.atendimentos a on a.id=p.atendimento_id join public.clientes c on c.id=p.cliente_id
 join public.staff_profiles s on s.user_id=a.colaboradora_user_id join public.procedimentos pr on pr.id=a.procedimento_id
 where p.status in ('pendente','parcial') and p.valor_total>p.valor_recebido and (p_professional is null or a.colaboradora_user_id=p_professional);
 select coalesce(jsonb_agg(jsonb_build_object('treatment_id',t.id,'appointment_id',t.agendamento_id,'professional',s.display_name,'client',c.nome) order by t.id),'[]'::jsonb)
 into issues from public.clinical_treatments t join public.staff_profiles s on s.user_id=t.profissional_user_id join public.clientes c on c.id=t.cliente_id
 left join public.clinical_treatment_versions v on v.id=t.current_version_id and v.treatment_id=t.id
 where t.status='finalizado' and (p_professional is null or t.profissional_user_id=p_professional)
 and (select count(*) from public.pagamentos p where p.atendimento_id=t.operational_attendance_id or (p.atendimento_id is null and p.agendamento_id=t.agendamento_id))<>1
 and coalesce(v.snapshot->'treatment'->>'final_price','') !~ '^0+(\\.0+)?$';
 return result||jsonb_build_object('pending',pending,'awaiting_rules',n,'awaiting',awaiting,'payments',payments,'rules',rules,'people',people,'procedures',procedures,'charges',charges,'charge_issues',issues);
end $$;

create or replace function private.bc_finance_my_summary_impl(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pending_total numeric; paid_total numeric; awaiting integer; items jsonb; payments jsonb; receipts jsonb;
begin
 perform private.bc_finance_require_staff();perform private.bc_finance_period(p_from,p_to);
 select coalesce(sum(i.amount) filter(where i.state='pending'),0),count(*)filter(where i.state='awaiting_rule'),
 coalesce(jsonb_agg(jsonb_build_object('id',i.id,'amount',i.amount,'state',i.state,'procedure',p.nome,'received_at',r.recebido_at) order by r.recebido_at desc,i.id),'[]'::jsonb)
 into pending_total,awaiting,items from private.bc_commission_items i join public.recebimentos r on r.id=i.receipt_id join public.procedimentos p on p.id=i.procedure_id
 where i.professional_id=auth.uid() and i.state in ('pending','awaiting_rule','waived');
 select coalesce(sum(p.amount)filter(where p.state='paid'),0),
 coalesce(jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'state',p.state,'method',p.method,'paid_at',p.paid_at) order by p.paid_at desc,p.id),'[]'::jsonb)
 into paid_total,payments from private.bc_commission_payments p where p.professional_id=auth.uid() and (p.paid_at at time zone 'America/Sao_Paulo')::date between p_from and p_to;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'amount',r.amount,'occurred_at',r.occurred_at,'state',r.state,'description',r.description) order by r.occurred_at desc,r.id),'[]'::jsonb)
 into receipts from private.bc_finance_rows(p_from,p_to) r where r.professional_id=auth.uid() and r.kind='receipt';
 return jsonb_build_object('from',p_from,'to',p_to,'pending_total',pending_total,'paid_total',paid_total,'awaiting_rules',awaiting,'items',items,'payments',payments,'receipts',receipts);
end $$;

create or replace function private.bc_finance_operation_result_impl(p_kind text,p_request_key uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.bc_finance_require_admin();
 if p_kind='payment' then select jsonb_build_object('id',id,'state',state,'amount',amount) into result from private.bc_commission_payments where request_key=p_request_key and created_by=auth.uid();
 elsif p_kind='expense' then select jsonb_build_object('id',id,'state',state,'amount',amount) into result from private.bc_finance_expenses where request_key=p_request_key and created_by=auth.uid();
 else raise exception 'Tipo de lançamento inválido.' using errcode='22023'; end if;
 return result;
end $$;

create or replace function public.bc_finance_overview(p_from date,p_to date,p_professional uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_overview_impl($1,$2,$3);$$;
create or replace function public.bc_finance_my_summary(p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_my_summary_impl($1,$2);$$;
create or replace function public.bc_finance_appointment_summary(p_appointment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_appointment_summary_impl($1);$$;
create or replace function public.bc_finance_report(p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_report_impl($1,$2);$$;
create or replace function public.bc_finance_operation_result(p_kind text,p_request_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.bc_finance_operation_result_impl($1,$2);$$;
do $acl$ declare f record; begin
 for f in select p.oid::regprocedure sig,n.nspname sch,p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('bc_finance_period','bc_finance_rows','bc_finance_overview_impl','bc_finance_my_summary_impl','bc_finance_appointment_summary_impl','bc_finance_report_impl','bc_finance_operation_result_impl'))
 or (n.nspname='public' and p.proname in ('bc_finance_overview','bc_finance_my_summary','bc_finance_appointment_summary','bc_finance_report','bc_finance_operation_result'))
 loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 if f.sch='public' or f.name not in ('bc_finance_period','bc_finance_rows') then execute format('grant execute on function %s to authenticated',f.sig); end if;
 end loop;
end $acl$;
