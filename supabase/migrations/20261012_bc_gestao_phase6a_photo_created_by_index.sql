-- BC Gestão Fase 6A — correção de performance apontada pelo advisor.
-- Cobre a FK cliente_identificacao_fotos.created_by -> auth.users(id).

create index if not exists cliente_identificacao_fotos_created_by_idx
  on public.cliente_identificacao_fotos (created_by);
