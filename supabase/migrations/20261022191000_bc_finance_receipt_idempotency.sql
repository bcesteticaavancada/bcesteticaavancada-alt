-- FIN02: uma chave representa uma tentativa financeira, inclusive após resposta perdida.
alter table public.recebimentos add column request_key uuid;
alter table public.recebimentos add column request_payload jsonb;
alter table public.recebimentos add constraint bc_receipt_request_pair check ((request_key is null)=(request_payload is null));
create unique index bc_receipt_request_key_uq on public.recebimentos(request_key) where request_key is not null;

create or replace function private.bc_recebimento_registrar_v2_impl(
 p_request_key uuid,p_atendimento_id uuid,p_valor numeric,p_forma_pagamento text,
 p_recebido_at timestamptz default null,p_observacao text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.atendimentos%rowtype; r public.recebimentos%rowtype; payload jsonb; receipt_id uuid;
begin
 if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao recebimento.' using errcode='42501'; end if;
 if p_request_key is null then raise exception 'Chave da tentativa é obrigatória.' using errcode='22023'; end if;
 -- Serializa a mesma chave antes de qualquer bloqueio de agenda/atendimento.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bc_receipt:'||p_request_key::text,0));
 select * into a from public.atendimentos where id=p_atendimento_id;
 if not found or (not private.is_bc_admin() and a.colaboradora_user_id is distinct from auth.uid()) then raise exception 'Acesso negado ao recebimento.' using errcode='42501'; end if;
 payload:=jsonb_build_object('atendimento_id',p_atendimento_id,'valor',p_valor,'forma_pagamento',trim(p_forma_pagamento),'recebido_epoch',extract(epoch from p_recebido_at),'observacao',nullif(trim(p_observacao),''));
 select * into r from public.recebimentos where request_key=p_request_key;
 if found then
   if r.created_by is distinct from auth.uid() then raise exception 'Tentativa pertence a outra identidade.' using errcode='42501'; end if;
   if r.request_payload is distinct from payload then raise exception 'Chave já utilizada com outros dados de recebimento.' using errcode='22023'; end if;
   return r.id;
 end if;
 receipt_id:=private.bc_recebimento_registrar_impl(p_atendimento_id,p_valor,p_forma_pagamento,p_recebido_at,p_observacao);
 update public.recebimentos set request_key=p_request_key,request_payload=payload where id=receipt_id;
 return receipt_id;
end $$;

create or replace function public.bc_recebimento_registrar_v2(
 p_request_key uuid,p_atendimento_id uuid,p_valor numeric,p_forma_pagamento text,
 p_recebido_at timestamptz default null,p_observacao text default null
) returns uuid language sql security invoker set search_path='' as $$
 select private.bc_recebimento_registrar_v2_impl($1,$2,$3,$4,$5,$6);
$$;
create or replace function private.bc_recebimento_registrar_agendamento_v2_impl(
 p_request_key uuid,p_agendamento_id uuid,p_valor numeric,p_forma_pagamento text,
 p_recebido_at timestamptz default null,p_observacao text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare attendance_id uuid; appointment public.agendamentos%rowtype;
begin
 if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao recebimento.' using errcode='42501'; end if;
 select * into appointment from public.agendamentos where id=p_agendamento_id;
 if not found or (not private.is_bc_admin() and appointment.colaboradora_user_id is distinct from auth.uid()) then raise exception 'Acesso negado ao recebimento.' using errcode='42501'; end if;
 select id into attendance_id from public.atendimentos where agendamento_id=appointment.id;
 if attendance_id is null then raise exception 'Conclua o atendimento antes de registrar o recebimento.' using errcode='55000'; end if;
 return private.bc_recebimento_registrar_v2_impl(p_request_key,attendance_id,p_valor,p_forma_pagamento,p_recebido_at,p_observacao);
end $$;
create or replace function public.bc_recebimento_registrar_agendamento_v2(
 p_request_key uuid,p_agendamento_id uuid,p_valor numeric,p_forma_pagamento text,
 p_recebido_at timestamptz default null,p_observacao text default null
) returns uuid language sql security invoker set search_path='' as $$
 select private.bc_recebimento_registrar_agendamento_v2_impl($1,$2,$3,$4,$5,$6);
$$;
revoke all on function private.bc_recebimento_registrar_v2_impl(uuid,uuid,numeric,text,timestamptz,text),private.bc_recebimento_registrar_agendamento_v2_impl(uuid,uuid,numeric,text,timestamptz,text),public.bc_recebimento_registrar_v2(uuid,uuid,numeric,text,timestamptz,text),public.bc_recebimento_registrar_agendamento_v2(uuid,uuid,numeric,text,timestamptz,text) from public,anon;
grant execute on function private.bc_recebimento_registrar_v2_impl(uuid,uuid,numeric,text,timestamptz,text),private.bc_recebimento_registrar_agendamento_v2_impl(uuid,uuid,numeric,text,timestamptz,text),public.bc_recebimento_registrar_v2(uuid,uuid,numeric,text,timestamptz,text),public.bc_recebimento_registrar_agendamento_v2(uuid,uuid,numeric,text,timestamptz,text) to authenticated;
-- Implementação não idempotente só pode ser chamada internamente pelo definer v2.
revoke all on function private.bc_recebimento_registrar_impl(uuid,numeric,text,timestamptz,text),private.bc_recebimento_registrar_agendamento_impl(uuid,numeric,text,timestamptz,text) from public,anon,authenticated;
create or replace function public.bc_recebimento_registrar(p_atendimento_id uuid,p_valor numeric,p_forma_pagamento text,p_recebido_at timestamptz default now(),p_observacao text default null)
returns uuid language plpgsql security invoker set search_path='' as $$begin
 if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao recebimento.' using errcode='42501'; end if;
 raise exception 'Atualize a página para registrar o recebimento com confirmação de tentativa.' using errcode='55000';
end $$;
create or replace function public.bc_recebimento_registrar_agendamento(p_agendamento_id uuid,p_valor numeric,p_forma_pagamento text,p_recebido_at timestamptz default now(),p_observacao text default null)
returns uuid language plpgsql security invoker set search_path='' as $$begin
 if auth.uid() is null or not private.is_bc_active_staff() then raise exception 'Acesso negado ao recebimento.' using errcode='42501'; end if;
 raise exception 'Atualize a página para registrar o recebimento com confirmação de tentativa.' using errcode='55000';
end $$;
