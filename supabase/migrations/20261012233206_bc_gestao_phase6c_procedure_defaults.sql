-- BC Gestão Fase 6C — defaults clínicos seguros para novos rascunhos.

create or replace function private.bc_procedure_version_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'draft' then
    if new.specific_schema is null or new.specific_schema = '{}'::jsonb then
      new.specific_schema := jsonb_build_object(
        'version',1,
        'fields',jsonb_build_array(
          jsonb_build_object('key','objetivo_sessao','label','Objetivo desta sessão','type','textarea','required',true),
          jsonb_build_object('key','area_regiao','label','Área/região planejada','type','text','required',true),
          jsonb_build_object('key','observacao_avaliacao','label','Observação da avaliação profissional','type','textarea','required',false)
        )
      );
    end if;
    if new.technical_schema is null or new.technical_schema = '{}'::jsonb then
      new.technical_schema := jsonb_build_object(
        'version',1,
        'reference_source','BC',
        'reference_steps',jsonb_build_array(
          'Confirmar avaliação profissional e Anamnese Geral vigente quando exigida.',
          'Registrar objetivo e área/região planejada.',
          'Registrar técnica, produto e equipamento efetivamente utilizados sem decisão automática do sistema.',
          'Registrar resposta e orientações pós-sessão.'
        )
      );
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.bc_procedure_version_defaults() from public;

drop trigger if exists procedure_versions_defaults on public.procedure_versions;
create trigger procedure_versions_defaults
before insert or update on public.procedure_versions
for each row execute function private.bc_procedure_version_defaults();