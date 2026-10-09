-- BC Gestão 1.0 — core schema and RLS
-- Additive migration. Target project: bc-estetica-gestao only.

create or replace function public.bc_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  role text not null check (role in ('admin', 'colaborador')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) > 0),
  telefone text not null check (char_length(trim(telefone)) > 0),
  email text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.procedimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(trim(nome)) > 0),
  ativo boolean not null default true,
  duracao_padrao integer check (duracao_padrao is null or duracao_padrao > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  colaboradora_user_id uuid not null references auth.users(id),
  procedimento_id uuid not null references public.procedimentos(id),
  inicio timestamptz not null,
  fim timestamptz,
  status text not null default 'agendado' check (status in ('agendado', 'atendido', 'cancelado', 'faltou')),
  observacao_administrativa text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim is null or fim > inicio)
);

create table if not exists public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null unique references public.agendamentos(id),
  cliente_id uuid not null references public.clientes(id),
  colaboradora_user_id uuid not null references auth.users(id),
  procedimento_id uuid not null references public.procedimentos(id),
  data_atendimento timestamptz not null default now(),
  queixa_objetivo text,
  observacoes text,
  reacoes text,
  intercorrencias text,
  feedback_cliente text,
  orientacoes text,
  recomendacao_proxima_sessao text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid references public.agendamentos(id),
  atendimento_id uuid references public.atendimentos(id),
  cliente_id uuid not null references public.clientes(id),
  valor_total numeric(12,2) not null check (valor_total >= 0),
  valor_recebido numeric(12,2) not null default 0 check (valor_recebido >= 0),
  forma_pagamento text,
  status text not null default 'pendente' check (status in ('pendente', 'parcial', 'pago', 'cancelado')),
  vencimento date,
  data_recebimento timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (agendamento_id is not null or atendimento_id is not null),
  check (valor_recebido <= valor_total)
);

create index if not exists idx_agendamentos_cliente_id on public.agendamentos(cliente_id);
create index if not exists idx_agendamentos_colaboradora_user_id on public.agendamentos(colaboradora_user_id);
create index if not exists idx_agendamentos_inicio on public.agendamentos(inicio);
create index if not exists idx_agendamentos_procedimento_id on public.agendamentos(procedimento_id);
create index if not exists idx_atendimentos_cliente_id on public.atendimentos(cliente_id);
create index if not exists idx_atendimentos_colaboradora_user_id on public.atendimentos(colaboradora_user_id);
create index if not exists idx_atendimentos_procedimento_id on public.atendimentos(procedimento_id);
create index if not exists idx_pagamentos_cliente_id on public.pagamentos(cliente_id);
create index if not exists idx_pagamentos_status on public.pagamentos(status);
create index if not exists idx_pagamentos_vencimento on public.pagamentos(vencimento);

create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function public.bc_set_updated_at();

create trigger clientes_set_updated_at
before update on public.clientes
for each row execute function public.bc_set_updated_at();

create trigger procedimentos_set_updated_at
before update on public.procedimentos
for each row execute function public.bc_set_updated_at();

create trigger agendamentos_set_updated_at
before update on public.agendamentos
for each row execute function public.bc_set_updated_at();

create trigger atendimentos_set_updated_at
before update on public.atendimentos
for each row execute function public.bc_set_updated_at();

create trigger pagamentos_set_updated_at
before update on public.pagamentos
for each row execute function public.bc_set_updated_at();

create or replace function public.is_bc_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.active = true
      and sp.role = 'admin'
  );
$$;

create or replace function public.is_bc_active_colaborador()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.active = true
      and sp.role = 'colaborador'
  );
$$;

revoke all on function public.is_bc_admin() from public;
revoke all on function public.is_bc_active_colaborador() from public;
grant execute on function public.is_bc_admin() to authenticated;
grant execute on function public.is_bc_active_colaborador() to authenticated;

alter table public.staff_profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.procedimentos enable row level security;
alter table public.agendamentos enable row level security;
alter table public.atendimentos enable row level security;
alter table public.pagamentos enable row level security;

revoke all on table public.staff_profiles, public.clientes, public.procedimentos, public.agendamentos, public.atendimentos, public.pagamentos from anon;
grant select, insert, update, delete on table public.staff_profiles, public.clientes, public.procedimentos, public.agendamentos, public.atendimentos, public.pagamentos to authenticated;

create policy "staff_profiles_self_select"
on public.staff_profiles for select
to authenticated
using (user_id = auth.uid());

create policy "staff_profiles_admin_all"
on public.staff_profiles for all
to authenticated
using (public.is_bc_admin())
with check (public.is_bc_admin());

create policy "procedimentos_authenticated_select"
on public.procedimentos for select
to authenticated
using (true);

create policy "procedimentos_admin_all"
on public.procedimentos for all
to authenticated
using (public.is_bc_admin())
with check (public.is_bc_admin());

create policy "agendamentos_admin_all"
on public.agendamentos for all
to authenticated
using (public.is_bc_admin())
with check (public.is_bc_admin());

create policy "agendamentos_colaborador_select"
on public.agendamentos for select
to authenticated
using (
  public.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
);

create policy "clientes_admin_all"
on public.clientes for all
to authenticated
using (public.is_bc_admin())
with check (public.is_bc_admin());

create policy "clientes_colaborador_select_por_vinculo"
on public.clientes for select
to authenticated
using (
  public.is_bc_active_colaborador()
  and exists (
    select 1
    from public.agendamentos a
    where a.cliente_id = clientes.id
      and a.colaboradora_user_id = auth.uid()
  )
);

create policy "atendimentos_admin_all"
on public.atendimentos for all
to authenticated
using (public.is_bc_admin())
with check (public.is_bc_admin());

create policy "atendimentos_colaborador_select_historico_por_vinculo"
on public.atendimentos for select
to authenticated
using (
  public.is_bc_active_colaborador()
  and exists (
    select 1
    from public.agendamentos a
    where a.cliente_id = atendimentos.cliente_id
      and a.colaboradora_user_id = auth.uid()
  )
);

create policy "atendimentos_colaborador_insert_proprio"
on public.atendimentos for insert
to authenticated
with check (
  public.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
  and created_by = auth.uid()
  and exists (
    select 1
    from public.agendamentos a
    where a.id = atendimentos.agendamento_id
      and a.colaboradora_user_id = auth.uid()
      and a.cliente_id = atendimentos.cliente_id
      and a.procedimento_id = atendimentos.procedimento_id
  )
);

create policy "atendimentos_colaborador_update_proprio"
on public.atendimentos for update
to authenticated
using (
  public.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
)
with check (
  public.is_bc_active_colaborador()
  and colaboradora_user_id = auth.uid()
  and created_by = auth.uid()
  and exists (
    select 1
    from public.agendamentos a
    where a.id = atendimentos.agendamento_id
      and a.colaboradora_user_id = auth.uid()
      and a.cliente_id = atendimentos.cliente_id
      and a.procedimento_id = atendimentos.procedimento_id
  )
);

create policy "pagamentos_admin_all"
on public.pagamentos for all
to authenticated
using (public.is_bc_admin())
with check (public.is_bc_admin());
