# Data API: permissões explícitas para a mudança de 30/10/2026

## Resultado da revisão

O projeto ativo `bc-estetica-gestao` tem 52 tabelas em `public`, todas com RLS,
42 policies, quatro tabelas internas em `private` e nenhuma sequência em
`public`. O histórico remoto tem 69 migrações; o repositório inclui também
quatro migrações legadas da pré-anamnese. Elas criam duas tabelas que não
existem no projeto ativo: `admin_users` e `pre_anamneses`.

Ao reproduzir as 73 migrações originais sem privilégios automáticos, 44 das
52 tabelas ativas ficaram sem DML para `service_role`. As sete tabelas da
fundação financeira e `bc_pre_anamneses` já possuíam GRANT explícito.
As duas tabelas legadas também ficaram sem SELECT para `authenticated`.

Isso afeta sobretudo novas instalações, previews e resets. As tabelas da
produção atual conservam seus privilégios na mudança anunciada. O problema
não exige abrir informações clínicas ou financeiras para visitantes.

## Correção preparada

`20261021170511_bc_data_api_explicit_grants.sql` declara DML para `service_role`
nas 52 tabelas atuais por nome e, condicionalmente, nas duas tabelas legadas.
Acrescenta SELECT para `authenticated` nas tabelas legadas, mantendo o
UPDATE restrito à coluna `status` já declarado em migração anterior.

Não altera policies, dados, identidades, comissões, funções clínicas ou
financeiras, buckets ou configuração da API de produção. Não restaura
privilégios automáticos. Não concede DML de tabelas a `anon`.

O contrato atual do projeto ativo continua sendo:

| Papel/caminho | Acesso direto às tabelas |
| --- | --- |
| `anon` | Nenhum; agenda e envio público passam pelas Edge Functions. |
| `authenticated` | DML nas seis tabelas centrais, sempre sujeito à RLS; SELECT em outras 13. |
| Tabelas somente por RPC | 33 tabelas permanecem sem acesso direto por `authenticated`. |
| `service_role` | DML nas 52 tabelas; chave exclusiva do servidor. BYPASSRLS não substitui GRANT. |

As 13 tabelas de leitura são `audit_log`, `cliente_identificacao_fotos`,
`anamnese_template_versions`, `anamneses_gerais`, `anamnese_respostas`,
`anamnese_confirmacoes_clinicas`, `clinical_alerts`, `clinical_documents`,
`clinical_signatures`, `procedure_versions`, `procedure_version_components`,
`procedure_aliases` e `procedure_professional_permissions`.

As seis centrais são `staff_profiles`, `clientes`, `procedimentos`,
`agendamentos`, `atendimentos` e `pagamentos`. GRANT não promove
colaboradoras para administradoras: as policies continuam decidindo linhas
e operações permitidas.

## Validação e execução

`supabase/config.toml` define `api.auto_expose_new_tables = false` e
`db.major_version = 17`. A configuração é reconhecida pela CLI 2.121.0
fixada no workflow. A opção existe desde a CLI 2.102.0.

Em um checkout descartável com Docker:

```sh
python3 scripts/prepare-supabase-ci-migrations.py
supabase start
supabase db reset --local
supabase test db
```

O normalizador existe para os nomes antigos, apenas no checkout descartável;
não renomear o histórico do projeto hospedado. Não executar reset remoto.

O workflow Agenda DB CI exige a configuração segura antes de recriar o banco.
O teste novo `data_api_explicit_grants.test.sql` verifica 29 cenários,
incluindo tabelas futuras, sequências, RLS, perfis, acesso legado e DML do
servidor. A fixture é fictícia e a transação inteira termina em ROLLBACK.

Na revisão local, 325 asserções SQL dos 12 arquivos pgTAP passaram após a
reprodução das 74 migrações, incluindo a correção. Foram executadas em
PostgreSQL 18.6/PGlite 0.5.10, com pgTAP 1.3.4 original e estruturas mínimas
de Auth/Storage. A CLI nativa não encontrou banco Docker local em 54322.
O CI existente executa o banco PostgreSQL 17 e seus testes SQL; ele exclui
PostgREST, Auth, Storage e Edge Runtime e não comprova integração completa.
Antes de integrar ou aplicar a migração, confirmar o CI do banco e fazer
homologação separada dos fluxos HTTP/Auth/Storage/PDF com dados fictícios.

O replay das migrações do repositório e uma segunda execução com os corpos
atuais das funções hospedadas passaram nas mesmas 325 asserções. Na segunda
execução, os hashes dos 294 corpos públicos/privados coincidiram com a
consulta de produção. Os 156 pares tabela/papel (52 × 3) tiveram os mesmos
privilégios DML da produção atual. A comparação dos corpos detectou 34
diferenças textuais entre fontes do repositório e funções hospedadas; esta
correção não altera nem tenta reconciliar essas funções.

Os 753 testes Node existentes também passaram (69 da pré-anamnese,
131 do site e 553 da gestão).

## Novas migrações

Declarar junto de cada CREATE TABLE: RLS, policies necessárias, REVOKE/GRANT
por papel e, quando houver, privilégios das sequências usadas pela aplicação.
Uma tabela interna pode permanecer sem GRANT para os dois papéis do navegador.
Não conceder SELECT a `anon` em prontuários, equipe, agenda nominal ou financeiro.

Para funções, declarar EXECUTE explicitamente e retirar EXECUTE de PUBLIC
quando a chamada não for pública. PostgreSQL concede EXECUTE a PUBLIC por
padrão; desligar a exposição automática de tabelas não elimina esse padrão.
Não usar SECURITY DEFINER como solução genérica para um erro de permissão.

`private.public_booking_rate_limits_id_seq` continua sem privilégios para o
navegador. As quatro tabelas internas estão sem RLS, mas não são expostas
pela Data API e não concedem acesso direto a `anon` ou `authenticated`.
As funções proprietárias fazem as operações internas necessárias.

## Aplicação e verificação posterior

Esta entrega prepara a migração; não a aplica ao banco ativo. Antes de
aplicar, revisar o CI e a compatibilidade com qualquer migração acrescentada
em outra frente. O SQL é aditivo e transacional; não editar migrações antigas.

Executar `scripts/operations/data-api-access-audit.sql` antes e depois da
aplicação e após 30/10. Ele consulta apenas catálogos de permissões. Conferir
agenda pública pela Edge Function, gestão com os papéis reais e geração de
PDF em homologação com dados fictícios. Não encaminhar pacientes reais ao CI.

Referências oficiais:
- https://github.com/orgs/supabase/discussions/45329
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/deployment/branching/working-with-branches
