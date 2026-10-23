-- Rotina simples aditiva. O corte só é ativado depois de todos os componentes.
create table private.bc_finance_settings(id boolean primary key default true check(id),simple_mode boolean not null default false);
insert into private.bc_finance_settings(id,simple_mode) values(true,false);
create table private.bc_commission_payments(
 id uuid primary key default gen_random_uuid(),professional_id uuid not null references auth.users(id),
 amount numeric(12,2) not null check(amount>0 and amount::text not in ('NaN','Infinity','-Infinity')),
 paid_at timestamptz not null,method text,created_by uuid not null references auth.users(id),
 state text not null default 'paid' check(state in ('paid','reversed')),
 request_key uuid not null unique,request_payload jsonb not null,
 reversed_at timestamptz,reversed_by uuid references auth.users(id),reversal_reason text,created_at timestamptz not null default now()
);
create table private.bc_commission_items(
 id uuid primary key default gen_random_uuid(),receipt_id uuid not null unique references public.recebimentos(id),
 professional_id uuid not null references auth.users(id),procedure_id uuid not null references public.procedimentos(id),
 base_amount numeric(12,2) not null check(base_amount>0),rate_snapshot numeric(7,4) check(rate_snapshot between 0 and 100),
 amount numeric(12,2) check(amount>=0),state text not null check(state in ('awaiting_rule','pending','paid','void','waived')),
 payment_id uuid references private.bc_commission_payments(id),created_at timestamptz not null default now(),
 check((state='paid')=(payment_id is not null)),
 check(state not in ('pending','paid','waived') or (rate_snapshot is not null and amount is not null))
);
create table private.bc_finance_expenses(
 id uuid primary key default gen_random_uuid(),description text not null check(length(trim(description)) between 1 and 200),
 amount numeric(12,2) not null check(amount>0 and amount::text not in ('NaN','Infinity','-Infinity')),
 paid_at timestamptz not null,method text,note text,created_by uuid not null references auth.users(id),
 state text not null default 'active' check(state in ('active','reversed')),
 request_key uuid not null unique,request_payload jsonb not null,
 reversed_at timestamptz,reversed_by uuid references auth.users(id),reversal_reason text,created_at timestamptz not null default now()
);
create index bc_commission_pending_idx on private.bc_commission_items(professional_id,state);
create index bc_commission_procedure_idx on private.bc_commission_items(procedure_id);
create index bc_commission_payment_idx on private.bc_commission_items(payment_id);
create index bc_commission_payments_prof_date_idx on private.bc_commission_payments(professional_id,paid_at);
create index bc_commission_payments_actor_idx on private.bc_commission_payments(created_by);
create index bc_commission_payments_reversed_by_idx on private.bc_commission_payments(reversed_by);
create index bc_expenses_date_idx on private.bc_finance_expenses(paid_at);
create index bc_expenses_actor_idx on private.bc_finance_expenses(created_by);
create index bc_expenses_reversed_by_idx on private.bc_finance_expenses(reversed_by);
alter table private.bc_finance_settings enable row level security;
alter table private.bc_commission_items enable row level security;
alter table private.bc_commission_payments enable row level security;
alter table private.bc_finance_expenses enable row level security;
revoke all on private.bc_finance_settings,private.bc_commission_items,private.bc_commission_payments,private.bc_finance_expenses from public,anon,authenticated;
grant all on private.bc_finance_settings,private.bc_commission_items,private.bc_commission_payments,private.bc_finance_expenses to service_role;

create or replace function private.bc_finance_simple_enabled() returns boolean
language sql volatile security definer set search_path='' as $$
 select simple_mode from private.bc_finance_settings where id;
$$;
create or replace function private.bc_finance_require_admin() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_bc_admin() then raise exception 'Acesso negado ao financeiro.' using errcode='42501'; end if;
 if not private.bc_finance_simple_enabled() then raise exception 'Financeiro em atualização. Tente novamente em instantes.' using errcode='55000'; end if;
end $$;
create or replace function private.bc_finance_require_staff() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao financeiro.' using errcode='42501'; end if;
 if not private.bc_finance_simple_enabled() then raise exception 'Financeiro em atualização. Tente novamente em instantes.' using errcode='55000'; end if;
end $$;
create or replace function private.bc_finance_valid_amount(p_amount numeric,p_zero boolean default false) returns numeric
language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2)
 or p_amount<0 or (not p_zero and p_amount=0) or p_amount>=10000000000 then
 raise exception 'Informe um valor válido em reais e centavos.' using errcode='22023'; end if;
 return p_amount;
end $$;

create or replace function private.bc_finance_ensure_charge(p_treatment_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.clinical_treatments%rowtype; ids uuid[]; total numeric; total_text text; result uuid;
begin
 select * into t from public.clinical_treatments where id=p_treatment_id;
 if not found or t.status<>'finalizado' or t.operational_attendance_id is null then return null; end if;
 perform private.bc_finance_lock_professional(t.profissional_user_id);
 perform 1 from public.atendimentos where id=t.operational_attendance_id for update;
 select array_agg(p.id order by p.id) into ids from public.pagamentos p
 where p.atendimento_id=t.operational_attendance_id or (p.atendimento_id is null and p.agendamento_id=t.agendamento_id);
 if cardinality(ids)>1 then return null; end if;
 if cardinality(ids)=1 then return ids[1]; end if;
 select v.snapshot->'treatment'->>'final_price' into total_text from public.clinical_treatment_versions v
 where v.id=t.current_version_id and v.treatment_id=t.id;
 begin total:=total_text::numeric; exception when invalid_text_representation or numeric_value_out_of_range then return null; end;
 if total is null or total::text in ('NaN','Infinity','-Infinity') or total<=0 or total<>round(total,2) or total>=10000000000 then return null; end if;
 insert into public.pagamentos(agendamento_id,atendimento_id,cliente_id,valor_total,valor_recebido,status,created_by)
 values(t.agendamento_id,t.operational_attendance_id,t.cliente_id,total,0,'pendente',t.profissional_user_id) returning id into result;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
 values(auth.uid(),'finance_charge_created','pagamentos',result,jsonb_build_object('treatment_id',t.id,'amount',total));
 return result;
end $$;
-- Ordem alfabética dos BEFORE triggers: trava profissional antes da ponte operacional.
create or replace function private.bc_finance_begin_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if private.bc_finance_simple_enabled() and new.status='finalizado' and old.status is distinct from new.status then
 perform private.bc_finance_lock_professional(new.profissional_user_id); end if;
 return new;
end $$;
create trigger bc_finance_begin_completion before update of status on public.clinical_treatments
 for each row execute function private.bc_finance_begin_completion();

create or replace function private.bc_finance_completion_charge() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if private.bc_finance_simple_enabled() and new.status='finalizado' and old.status is distinct from new.status then
 perform private.bc_finance_ensure_charge(new.id); end if;
 return new;
end $$;
create trigger bc_finance_completion_charge after update of status on public.clinical_treatments
 for each row execute function private.bc_finance_completion_charge();

create or replace function private.bc_finance_receipt_commission() returns trigger
language plpgsql security definer set search_path='' as $$
declare rate numeric;
begin
 if not private.bc_finance_simple_enabled() then return new; end if;
 perform private.bc_finance_lock_professional(new.profissional_user_id);
 if tg_op='UPDATE' then
  if new.status='ativo' and old.status='estornado' then raise exception 'Registre uma nova entrada para corrigir um recebimento cancelado.' using errcode='55000'; end if;
  if new.status='estornado' then
   if exists(select 1 from private.bc_commission_items where receipt_id=new.id and state='paid') then
    raise exception 'Desfaça o pagamento da comissão antes de corrigir este recebimento.' using errcode='55000'; end if;
   update private.bc_commission_items set state='void',payment_id=null where receipt_id=new.id;
  end if;
  return new;
 end if;
 if new.status<>'ativo' then return new; end if;
 select percentual into rate from public.comissao_profissional_procedimento
 where profissional_user_id=new.profissional_user_id and procedimento_id=new.procedimento_id and ativo;
 insert into private.bc_commission_items(receipt_id,professional_id,procedure_id,base_amount,rate_snapshot,amount,state)
 values(new.id,new.profissional_user_id,new.procedimento_id,new.valor,rate,round(new.valor*rate/100,2),
 case when rate is null then 'awaiting_rule' when rate=0 then 'waived' else 'pending' end);
 return new;
end $$;
create trigger bc_finance_receipt_commission after insert or update of status on public.recebimentos
 for each row execute function private.bc_finance_receipt_commission();

create or replace function private.bc_finance_resolve_commission_rule() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not private.bc_finance_simple_enabled() or not new.ativo then return new; end if;
 perform private.bc_finance_lock_professional(new.profissional_user_id);
 update private.bc_commission_items set rate_snapshot=new.percentual,amount=round(base_amount*new.percentual/100,2),
 state=case when new.percentual=0 then 'waived' else 'pending' end
 where professional_id=new.profissional_user_id and procedure_id=new.procedimento_id and state='awaiting_rule';
 return new;
end $$;
create trigger bc_finance_resolve_commission_rule after insert or update on public.comissao_profissional_procedimento
 for each row execute function private.bc_finance_resolve_commission_rule();

create or replace function private.bc_finance_legacy_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if private.bc_finance_simple_enabled() then raise exception 'Use o financeiro atualizado para registrar este pagamento, sem fechar semana ou criar lote.' using errcode='55000'; end if;
 return new;
end $$;
create trigger bc_finance_legacy_books before insert or update on public.livros_financeiros for each row execute function private.bc_finance_legacy_write_guard();
create trigger bc_finance_legacy_payouts before insert or update on public.repasses for each row execute function private.bc_finance_legacy_write_guard();
create trigger bc_finance_legacy_cycles before insert or update on public.config_repasses for each row execute function private.bc_finance_legacy_write_guard();

create or replace function private.bc_finance_commission_pay_impl(
 p_request_key uuid,p_professional uuid,p_item_ids uuid[],p_expected_total numeric,p_method text default null,p_paid_at timestamptz default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare prior private.bc_commission_payments%rowtype; payload jsonb; ids uuid[]; n integer; total numeric; result uuid;
begin
 perform private.bc_finance_require_admin();
 if p_request_key is null or p_professional is null or cardinality(p_item_ids) is null or cardinality(p_item_ids) not between 1 and 500
 or array_position(p_item_ids,null) is not null then raise exception 'Selecione as comissões que serão pagas.' using errcode='22023'; end if;
 perform private.bc_finance_valid_amount(p_expected_total);
 select array_agg(distinct x order by x) into ids from unnest(p_item_ids) x;
 if cardinality(ids)<>cardinality(p_item_ids) then raise exception 'Há comissões repetidas na seleção.' using errcode='22023'; end if;
 payload:=jsonb_build_object('professional',p_professional,'items',ids,'amount',p_expected_total,'method',nullif(trim(p_method),''),'paid_epoch',extract(epoch from p_paid_at));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bc_simple_payment:'||p_request_key::text,0));
 select * into prior from private.bc_commission_payments where request_key=p_request_key;
 if found then
  if prior.created_by<>auth.uid() then raise exception 'Tentativa pertence a outra identidade.' using errcode='42501'; end if;
  if prior.request_payload<>payload then raise exception 'Tentativa já utilizada com outros dados.' using errcode='22023'; end if;
  return prior.id;
 end if;
 perform private.bc_finance_lock_professional(p_professional);
 perform 1 from private.bc_commission_items where id=any(ids) order by id for update;
 select count(*),coalesce(sum(amount),0) into n,total from private.bc_commission_items
 where id=any(ids) and professional_id=p_professional and state='pending';
 if n<>cardinality(ids) or total<>p_expected_total then raise exception 'Os valores foram atualizados. Confira o total antes de pagar.' using errcode='55000'; end if;
 insert into private.bc_commission_payments(professional_id,amount,paid_at,method,created_by,request_key,request_payload)
 values(p_professional,total,coalesce(p_paid_at,now()),nullif(trim(p_method),''),auth.uid(),p_request_key,payload) returning id into result;
 update private.bc_commission_items set state='paid',payment_id=result where id=any(ids);
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
 values(auth.uid(),'finance_commission_paid','commission_payments',result,jsonb_build_object('professional',p_professional,'amount',total,'items',ids));
 return result;
end $$;

create or replace function private.bc_finance_commission_reverse_impl(p_payment_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p private.bc_commission_payments%rowtype;
begin
 perform private.bc_finance_require_admin();
 if nullif(trim(p_reason),'') is null then raise exception 'Informe o motivo da correção.' using errcode='22023'; end if;
 select * into p from private.bc_commission_payments where id=p_payment_id;
 if not found then raise exception 'Pagamento não encontrado.' using errcode='P0002'; end if;
 perform private.bc_finance_lock_professional(p.professional_id);
 select * into p from private.bc_commission_payments where id=p_payment_id for update;
 if p.state='reversed' then return p.id; end if;
 update private.bc_commission_payments set state='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=trim(p_reason) where id=p.id;
 update private.bc_commission_items set state='pending',payment_id=null where payment_id=p.id and state='paid';
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
 values(auth.uid(),'finance_commission_payment_reversed','commission_payments',p.id,jsonb_build_object('reason',trim(p_reason)));
 return p.id;
end $$;

create or replace function private.bc_finance_expense_create_impl(
 p_request_key uuid,p_description text,p_amount numeric,p_paid_at timestamptz default null,p_method text default null,p_note text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare prior private.bc_finance_expenses%rowtype; payload jsonb; result uuid;
begin
 perform private.bc_finance_require_admin();
 perform private.bc_finance_valid_amount(p_amount);
 if p_request_key is null or length(trim(coalesce(p_description,''))) not between 1 and 200 or length(coalesce(p_note,''))>1000
 then raise exception 'Informe descrição e valor da despesa.' using errcode='22023'; end if;
 payload:=jsonb_build_object('description',trim(p_description),'amount',p_amount,'paid_epoch',extract(epoch from p_paid_at),'method',nullif(trim(p_method),''),'note',nullif(trim(p_note),''));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bc_simple_expense:'||p_request_key::text,0));
 select * into prior from private.bc_finance_expenses where request_key=p_request_key;
 if found then
  if prior.created_by<>auth.uid() then raise exception 'Tentativa pertence a outra identidade.' using errcode='42501'; end if;
  if prior.request_payload<>payload then raise exception 'Tentativa já utilizada com outros dados.' using errcode='22023'; end if;
  return prior.id;
 end if;
 insert into private.bc_finance_expenses(description,amount,paid_at,method,note,created_by,request_key,request_payload)
 values(trim(p_description),p_amount,coalesce(p_paid_at,now()),nullif(trim(p_method),''),nullif(trim(p_note),''),auth.uid(),p_request_key,payload) returning id into result;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
 values(auth.uid(),'finance_expense_created','finance_expenses',result,jsonb_build_object('amount',p_amount,'description',trim(p_description)));
 return result;
end $$;
create or replace function private.bc_finance_expense_reverse_impl(p_expense_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare e private.bc_finance_expenses%rowtype;
begin
 perform private.bc_finance_require_admin();
 if nullif(trim(p_reason),'') is null then raise exception 'Informe o motivo da correção.' using errcode='22023'; end if;
 select * into e from private.bc_finance_expenses where id=p_expense_id for update;
 if not found then raise exception 'Despesa não encontrada.' using errcode='P0002'; end if;
 if e.state='reversed' then return e.id; end if;
 update private.bc_finance_expenses set state='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=trim(p_reason) where id=e.id;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,new_data)
 values(auth.uid(),'finance_expense_reversed','finance_expenses',e.id,jsonb_build_object('reason',trim(p_reason)));
 return e.id;
end $$;

create or replace function private.bc_finance_commissions_apply_impl(p_professional uuid,p_percent numeric,p_procedure_ids uuid[] default null) returns integer
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; proc uuid; n integer:=0; rule_id uuid; old_percent numeric;
begin
 perform private.bc_finance_require_admin();
 perform private.bc_finance_valid_amount(p_percent,true);
 if p_percent>100 or p_professional is null then raise exception 'Informe profissional e percentual entre 0 e 100.' using errcode='22023'; end if;
 perform private.bc_finance_lock_professional(p_professional);
 select array_agg(p.id order by p.id) into ids from public.procedimentos p where
 (p_procedure_ids is null or p.id=any(p_procedure_ids)) and
 ((p.ativo and private.bc_professional_procedure_allowed(p_professional,p.id)) or exists(select 1 from private.bc_commission_items i where i.professional_id=p_professional and i.procedure_id=p.id and i.state='awaiting_rule'));
 if coalesce(cardinality(ids),0)=0 or (p_procedure_ids is not null and cardinality(ids)<>cardinality(p_procedure_ids))
 then raise exception 'Selecione procedimentos autorizados para esta profissional.' using errcode='22023'; end if;
 foreach proc in array ids loop
  rule_id:=null;old_percent:=null;
  select id,percentual into rule_id,old_percent from public.comissao_profissional_procedimento
  where profissional_user_id=p_professional and procedimento_id=proc and ativo for update;
  if rule_id is null then
   insert into public.comissao_profissional_procedimento(profissional_user_id,procedimento_id,percentual,ativo,created_by,updated_by)
   values(p_professional,proc,p_percent,true,auth.uid(),auth.uid()) returning id into rule_id;
  else update public.comissao_profissional_procedimento set percentual=p_percent,updated_by=auth.uid(),updated_at=now() where id=rule_id; end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(auth.uid(),'comissao_updated','comissao_profissional_procedimento',rule_id,
  jsonb_build_object('percentual',old_percent),jsonb_build_object('profissional_user_id',p_professional,'procedimento_id',proc,'percentual',p_percent));
  n:=n+1;
 end loop;
 return n;
end $$;

-- Interfaces públicas invoker; somente implementações explicitamente autorizadas.
create or replace function public.bc_finance_commission_pay(p_request_key uuid,p_professional uuid,p_item_ids uuid[],p_expected_total numeric,p_method text default null,p_paid_at timestamptz default null) returns uuid language sql security invoker set search_path='' as $$select private.bc_finance_commission_pay_impl($1,$2,$3,$4,$5,$6);$$;
create or replace function public.bc_finance_commission_reverse(p_payment_id uuid,p_reason text) returns uuid language sql security invoker set search_path='' as $$select private.bc_finance_commission_reverse_impl($1,$2);$$;
create or replace function public.bc_finance_expense_create(p_request_key uuid,p_description text,p_amount numeric,p_paid_at timestamptz default null,p_method text default null,p_note text default null) returns uuid language sql security invoker set search_path='' as $$select private.bc_finance_expense_create_impl($1,$2,$3,$4,$5,$6);$$;
create or replace function public.bc_finance_expense_reverse(p_expense_id uuid,p_reason text) returns uuid language sql security invoker set search_path='' as $$select private.bc_finance_expense_reverse_impl($1,$2);$$;
create or replace function public.bc_finance_commissions_apply(p_professional uuid,p_percent numeric,p_procedure_ids uuid[] default null) returns integer language sql security invoker set search_path='' as $$select private.bc_finance_commissions_apply_impl($1,$2,$3);$$;

do $acl$ declare f record; begin
 for f in select p.oid::regprocedure sig,n.nspname sch,p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('bc_finance_simple_enabled','bc_finance_require_admin','bc_finance_require_staff','bc_finance_valid_amount','bc_finance_ensure_charge','bc_finance_begin_completion','bc_finance_completion_charge','bc_finance_receipt_commission','bc_finance_resolve_commission_rule','bc_finance_legacy_write_guard','bc_finance_commission_pay_impl','bc_finance_commission_reverse_impl','bc_finance_expense_create_impl','bc_finance_expense_reverse_impl','bc_finance_commissions_apply_impl'))
 or (n.nspname='public' and p.proname in ('bc_finance_commission_pay','bc_finance_commission_reverse','bc_finance_expense_create','bc_finance_expense_reverse','bc_finance_commissions_apply'))
 loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 if (f.sch='public' or f.name in ('bc_finance_commission_pay_impl','bc_finance_commission_reverse_impl','bc_finance_expense_create_impl','bc_finance_expense_reverse_impl','bc_finance_commissions_apply_impl'))
 then execute format('grant execute on function %s to authenticated',f.sig); end if;
 end loop;
end $acl$;
