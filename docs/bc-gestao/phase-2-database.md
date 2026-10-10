# BC Gestão — Fase 2 / Banco e Segurança

Data: 2026-10-09
Projeto Supabase: `bc-estetica-gestao`
Project ref: `tpqsmerlxquyrzrjbogj`
Região: `sa-east-1`

## Estado

A camada de banco do BC Gestão foi criada em projeto Supabase separado da pré-anamnese.

Migrations aplicadas no projeto:

1. `20261009123429` — `bc_gestao_core`
2. `20261009123831` — `bc_gestao_security_hardening`

## Estrutura criada

Tabelas públicas com RLS habilitado:

- `staff_profiles`
- `clientes`
- `procedimentos`
- `agendamentos`
- `atendimentos`
- `pagamentos`

## Permissões principais

- `admin`: políticas administrativas para os dados operacionais e financeiros.
- `colaborador`: agenda própria, cliente vinculado à própria agenda e histórico autorizado do cliente.
- `pagamentos`: somente política administrativa; não existe política financeira para colaborador.
- `anon`: sem privilégios de tabela do BC Gestão.

## Hardening

O primeiro lint de segurança detectou helpers `SECURITY DEFINER` no schema público e `search_path` mutável no trigger de `updated_at`.

Foi aplicada uma migration de hardening que:

- criou o schema não exposto `private`;
- moveu os helpers usados pelas políticas RLS para `private.is_bc_admin()` e `private.is_bc_active_colaborador()`;
- revogou `EXECUTE` de `anon` nos helpers privados;
- revogou `EXECUTE` de `anon` e `authenticated` nos helpers públicos legados;
- manteve os helpers públicos sem uso apenas como caminho forward-safe, sem acesso pelos papéis da aplicação;
- fixou `search_path` do trigger e dos helpers;
- alterou as políticas para consumir somente os helpers privados.

Após o hardening, o Supabase Security Advisor retornou `lints: []`.

Referências do linter que motivaram o hardening:

- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Evidências verificadas

- As seis tabelas existem no projeto novo.
- RLS está ativo nas seis tabelas.
- A única política de `pagamentos` é administrativa.
- Helpers privados têm `SECURITY DEFINER` e `search_path` fixo.
- `anon` não pode executar os helpers privados.
- Os helpers públicos legados não podem ser executados por `anon` nem `authenticated`.
- O Security Advisor não aponta avisos de segurança após o hardening.
- Nenhum usuário real, cliente, atendimento ou pagamento foi cadastrado nesta fase.

## Isolamento

Nenhuma migration foi aplicada no projeto `bc-estetica-pre-anamnese`.
O site público continua fora desta camada de banco e o desenvolvimento segue na branch `feature/bc-gestao-1`.
