-- BC Gestão — follow-up forward-safe do atendimento rápido.
-- Persiste a chave idempotente também no agendamento criado pelo encaixe.

alter table public.agendamentos
  add column if not exists request_key uuid;

create unique index if not exists agendamentos_request_key_uidx
  on public.agendamentos(request_key)
  where request_key is not null;

create or replace function private.bc_quick_visit_request_link()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.agendamentos
     set request_key=new.request_key
   where id=new.appointment_id
     and (request_key is null or request_key=new.request_key);

  if not found then
    raise exception 'Agendamento do encaixe não encontrado ou já vinculado a outra chave.' using errcode='23505';
  end if;

  return new;
end;
$$;

revoke all on function private.bc_quick_visit_request_link() from public, anon, authenticated;

drop trigger if exists bc_quick_visit_request_link on public.quick_visit_requests;
create trigger bc_quick_visit_request_link
before insert on public.quick_visit_requests
for each row execute function private.bc_quick_visit_request_link();
