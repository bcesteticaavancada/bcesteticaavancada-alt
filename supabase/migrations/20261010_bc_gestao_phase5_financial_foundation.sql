-- BC Gestão — Fase 5: fundação financeira
-- Entidades de recebimento, apuração semanal e repasses.
-- Target project: bc-estetica-gestao only.

create table if not exists public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id),
  agendamento_id uuid not null references public.agendamentos(id),
  atendimento_id uuid references public.atendimentos(id),
  cliente_id uuid not null references public.clientes(id),
  profissional_user_id uuid not null references auth.users(id),
  procedimento_id uuid not null references public.procedimentos(id),
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text,
  recebido_at timestamptz not null default now(),
  status text not null default 'ativo' check (status in ('ativo', 'estornado')),
  estornado_at timestamptz,
  estornado_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (
    (status = 'ativo' and estornado_at is null and estornado_by is null)
    or
    (status = 'estornado' and estornado_at is not null and estornado_by is not null)
  )
);

create table if not exists public.comissao_profissional_procedimento (
  id uuid primary key default gen_random_uuid(),
  profissional_user_id uuid not null references auth.users(id),
  procedimento_id uuid not null references public.procedimentos(id),
  percentual numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  ativo boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_comissao_profissional_procedimento_ativa
  on public.comissao_profissional_procedimento(profissional_user_id, procedimento_id)
  where ativo = true;

create table if not exists public.livros_financeiros (
  id uuid primary key default gen_random_uuid(),
  profissional_user_id uuid not null references auth.users(id),
  periodo_inicio date not null,
  periodo_fim date not null,
  status text not null default 'aberto' check (status in ('aberto', 'fechado', 'em_revisao', 'pago')),
  producao_recebida numeric(12,2) not null default 0 check (producao_recebida >= 0),
  repasse_total numeric(12,2) not null default 0 check (repasse_total >= 0),
  fechado_at timestamptz,
  fechado_by uuid references auth.users(id),
  reaberto_at timestamptz,
  reaberto_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_fim = periodo_inicio + 6),
  unique (profissional_user_id, periodo_inicio, periodo_fim)
);

create table if not exists public.livro_financeiro_itens (
  id uuid primary key default gen_random_uuid(),
  livro_id uuid not null references public.livros_financeiros(id) on delete cascade,
  movimento_recebimento_id uuid not null references public.recebimentos(id),
  atendimento_id uuid references public.atendimentos(id),
  procedimento_id uuid not null references public.procedimentos(id),
  valor_recebido_base numeric(12,2) not null check (valor_recebido_base > 0),
  percentual_aplicado numeric(5,2) not null check (percentual_aplicado >= 0 and percentual_aplicado <= 100),
  valor_repasse numeric(12,2) not null check (valor_repasse >= 0),
  created_at timestamptz not null default now(),
  unique (movimento_recebimento_id)
);

create table if not exists public.config_repasses (
  profissional_user_id uuid primary key references auth.users(id),
  ciclo_dias integer not null default 7 check (ciclo_dias in (7, 15, 30)),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.repasses (
  id uuid primary key default gen_random_uuid(),
  profissional_user_id uuid not null references auth.users(id),
  periodo_inicio date not null,
  periodo_fim date not null,
  valor_total numeric(12,2) not null default 0 check (valor_total >= 0),
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'estornado')),
  pago_at timestamptz,
  pago_by uuid references auth.users(id),
  estornado_at timestamptz,
  estornado_by uuid references auth.users(id),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_fim >= periodo_inicio)
);

create table if not exists public.repasse_livros (
  repasse_id uuid not null references public.repasses(id) on delete cascade,
  livro_id uuid not null references public.livros_financeiros(id),
  created_at timestamptz not null default now(),
  primary key (repasse_id, livro_id),
  unique (livro_id)
);

create index if not exists idx_recebimentos_profissional_recebido_at
  on public.recebimentos(profissional_user_id, recebido_at);
create index if not exists idx_recebimentos_pagamento_id
  on public.recebimentos(pagamento_id);
create index if not exists idx_livros_financeiros_profissional_periodo
  on public.livros_financeiros(profissional_user_id, periodo_inicio, periodo_fim);
create index if not exists idx_repasses_profissional_periodo
  on public.repasses(profissional_user_id, periodo_inicio, periodo_fim);
create index if not exists idx_livro_financeiro_itens_livro_id
  on public.livro_financeiro_itens(livro_id);

create trigger comissao_profissional_procedimento_set_updated_at
before update on public.comissao_profissional_procedimento
for each row execute function public.bc_set_updated_at();

create trigger livros_financeiros_set_updated_at
before update on public.livros_financeiros
for each row execute function public.bc_set_updated_at();

create trigger repasses_set_updated_at
before update on public.repasses
for each row execute function public.bc_set_updated_at();

alter table public.recebimentos enable row level security;
alter table public.comissao_profissional_procedimento enable row level security;
alter table public.livros_financeiros enable row level security;
alter table public.livro_financeiro_itens enable row level security;
alter table public.config_repasses enable row level security;
alter table public.repasses enable row level security;
alter table public.repasse_livros enable row level security;

revoke all on table
  public.recebimentos,
  public.comissao_profissional_procedimento,
  public.livros_financeiros,
  public.livro_financeiro_itens,
  public.config_repasses,
  public.repasses,
  public.repasse_livros
from anon;

grant select, insert, update, delete on table
  public.recebimentos,
  public.comissao_profissional_procedimento,
  public.livros_financeiros,
  public.livro_financeiro_itens,
  public.config_repasses,
  public.repasses,
  public.repasse_livros
to authenticated;

create policy "recebimentos_admin_all"
on public.recebimentos for all
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "recebimentos_colaborador_select_proprio"
on public.recebimentos for select
to authenticated
using (
  private.is_bc_active_staff()
  and profissional_user_id = auth.uid()
);

create policy "comissao_admin_all"
on public.comissao_profissional_procedimento for all
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "livros_admin_all"
on public.livros_financeiros for all
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "livros_colaborador_select_proprio"
on public.livros_financeiros for select
to authenticated
using (
  private.is_bc_active_staff()
  and profissional_user_id = auth.uid()
);

create policy "livro_financeiro_itens_admin_all"
on public.livro_financeiro_itens for all
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "config_repasses_admin_all"
on public.config_repasses for all
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "repasses_admin_all"
on public.repasses for all
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());

create policy "repasses_colaborador_select_proprio"
on public.repasses for select
to authenticated
using (
  private.is_bc_active_staff()
  and profissional_user_id = auth.uid()
);

create policy "repasse_livros_admin_all"
on public.repasse_livros for all
to authenticated
using (private.is_bc_admin())
with check (private.is_bc_admin());
