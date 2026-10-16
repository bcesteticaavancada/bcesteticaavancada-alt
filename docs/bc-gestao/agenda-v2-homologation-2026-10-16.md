# Agenda V2 — relatório de homologação gratuita

Código final validado antes desta atualização documental: `571439d4f58765ca446744435298bf8bc46b574f`.
Branch: `feature/public-agenda-native`.
PR: `#45` para `main`.
Escopo: fechamento técnico da Agenda V2, incluindo regressão de permissões RLS identificada após a limpeza dos Advisors.

## Resultado

**Homologação técnica concluída no ambiente descartável de CI. GO para revisão de rollout; produção permanece sem alterações.**

No head `571439d4f58765ca446744435298bf8bc46b574f`, os três workflows do PR concluíram com sucesso: Agenda DB CI, Site CI e Pre-anamnese CI.

## Correções concluídas

- Uma única tabela `public.agendamentos` e um único motor de conflito; não há segunda agenda física nem sincronização paralela.
- Campo `booking_channel` separado da origem operacional. Registros antigos continuam compatíveis e novas reservas públicas usam canal `site` sem transformar automaticamente a pessoa em cliente clínico.
- RPC canônica `bc_agenda_list` com identidade obtida no banco por `auth.uid()`.
- Admin e Colaboradora Chefe podem trabalhar com a agenda da equipe; colaboradoras comuns permanecem limitadas à própria agenda, mesmo com payload forjado.
- Filtros das interfaces, datas futuras para uso interno e filtro de profissional para a Chefe protegidos contra respostas atrasadas/stale.
- Reservas públicas armazenam snapshot mínimo de nome/WhatsApp. Vínculo posterior com cliente formal é idempotente e não permite troca de identidade após confirmação.
- Atendimento clínico e status `atendido` exigem cliente formal vinculado.
- Lock por profissional impede conflitos entre canais, inclusive em intervalos que atravessam meia-noite.
- Rate limiting público permanece protegido sob concorrência.
- Calendário mensal usa datas civis corretamente; slots seguem a grade de 15 minutos.
- Bloqueios/inativações preservam compromissos existentes e consideram eventos iniciados na véspera.
- CI agora falha se o Supabase Advisor voltar a produzir warning relevante: `supabase db advisors --local --type all --level warn --fail-on warn`.

## Regressão RLS encontrada e corrigida

Após a migration de limpeza dos Advisors (`20261016021500_bc_gestao_rls_advisor_cleanup.sql`), foi criado um contrato de regressão de permissões para conferir o acesso efetivo de Admin, Colaboradora Chefe, colaboradora comum, conta inativa, usuário sem perfil e administração legada.

Esse teste reproduziu uma regressão real: a Colaboradora Chefe havia perdido a leitura das agendas da equipe quando policies permissivas sobrepostas foram consolidadas.

A causa foi isolada na policy `agendamentos_colaborador_select`: a limpeza preservava Admin e a agenda própria da colaboradora, mas não incluía a capability já existente `private.bc_can_manage_all_agendas()`.

A correção foi feita na migration:

`20261016083349_bc_gestao_preserve_chief_rls_scope.sql`

Ela restaura somente o escopo previamente autorizado da Chefe:

- mantém Admin com acesso previsto;
- mantém colaboradora comum limitada à própria agenda;
- permite à Colaboradora Chefe ler as agendas da equipe;
- não adiciona grants;
- não amplia escrita administrativa;
- não permite à Chefe promover o próprio papel;
- não permite registrar atendimento clínico de outra profissional;
- não permite editar histórico clínico compartilhado diretamente.

## Evidência final de banco

Agenda DB CI run: `38874851782`.

No run final:

| Verificação | Resultado |
| --- | --- |
| Migrations preparadas/reproduzidas | 67 |
| Última migration | `20261016083349_bc_gestao_preserve_chief_rls_scope.sql` |
| pgTAP | 153 testes em 5 arquivos, zero falhas |
| Resultado pgTAP | PASS |
| PL/pgSQL lint | Aprovado |
| Security/performance Advisors | `No issues found` no nível WARN |
| Concorrência | 6/6 cenários aprovados |

Os cinco arquivos pgTAP executados foram:

- `agenda_inactivation_overlap.test.sql`
- `agenda_v2_flow.test.sql`
- `collaborator_chief_runtime.test.sql`
- `public_agenda_runtime.test.sql`
- `rls_performance_permissions.test.sql`

Os seis cenários de concorrência finais passaram:

1. site/site no mesmo início;
2. site/site com intervalos sobrepostos;
3. site/interna;
4. interna/site;
5. interna atravessando meia-noite;
6. rate limit concorrente com 11 tentativas, 10 contabilizadas, 1 bloqueada e 1 reserva.

## Evidência final de site/backend

Site CI run: `38874852041`.

Concluíram com sucesso no mesmo head:

- testes existentes da pré-anamnese;
- regressão do site;
- BC Gestão;
- checagem da Edge Function da agenda pública;
- testes HTTP da agenda pública;
- PDF de anamnese;
- PDF clínico.

Pre-anamnese CI run: `38874851989`, também concluído com sucesso.

## Migrations da Agenda V2 que ainda não foram aplicadas em produção

A implantação controlada deve respeitar a ordem do histórico remoto. O conjunto novo desta fase inclui:

- `20261014180000_bc_gestao_public_agenda_schema.sql`
- `20261014184500_bc_gestao_public_agenda_engine.sql`
- `20261015205157_bc_gestao_agenda_v2_permissions.sql`
- `20261016001707_bc_gestao_agenda_v2_homologation.sql`
- `20261016021500_bc_gestao_rls_advisor_cleanup.sql`
- `20261016083349_bc_gestao_preserve_chief_rls_scope.sql`

As migrations históricas devem ser preservadas. A normalização de nomes legados usada pelo CI é exclusiva do checkout descartável e não autoriza renomear o histórico remoto nem executar `migration repair` automaticamente.

## Situação do app/PWA e ativação pública

O app usa o próprio site em formato instalável (PWA), portanto a agenda publicada no site será a mesma agenda usada no app. O manifesto já está publicado.

Ainda falta, na etapa de implantação:

- aplicar a Agenda V2 no banco hospedado;
- publicar/validar o serviço público de reservas;
- publicar/validar a página/integração da agenda;
- habilitar a capability real da Colaboradora Chefe após confirmar a identidade correta;
- cadastrar a disponibilidade real da equipe;
- preencher duração válida nos procedimentos que ainda não possuem esse dado;
- validar Android, iPhone e desktop antes de ativar os CTAs públicos.

Inventário levantado durante a preparação do rollout: existem 30 procedimentos ativos; 2 já possuem duração válida e os outros 28 precisam desse cadastro para aparecer corretamente na agenda pública.

## Produção e limites

- Nenhum merge na `main` foi feito até esta atualização documental.
- Nenhuma migration da Agenda V2 foi aplicada ao Supabase hospedado.
- Nenhum paciente, cliente, usuário, agendamento, dado clínico ou financeiro real foi criado ou alterado nesta homologação.
- A flag/capability real da Alice não foi alterada.
- Nenhum deploy público da Agenda V2 foi executado.
- O GitHub Pages continua dependente da `main`/fluxo de publicação configurado; portanto merge e produção permanecem etapas separadas e controladas.

## Advisors e segurança

O schema descartável final ficou sem issues no nível WARN após as duas migrations de RLS e o contrato de regressão de papéis.

Isso **não significa que o Supabase hospedado já esteja limpo**, pois as migrations ainda não foram aplicadas nele.

Avisos hospedados ligados à pré-anamnese remota e configurações de Auth devem ser revisados separadamente, especialmente funções `SECURITY DEFINER` usadas pelo fluxo remoto e a configuração de proteção de senha. Não bloquear ou alterar essas funções apenas para zerar Advisor sem validar o fluxo público por token.

## Próximo passo: implantação controlada

1. Revisar o PR #45 e este relatório atualizado.
2. Confirmar o head do PR e que os checks continuam verdes.
3. Autorizar separadamente o merge para `main`.
4. Conferir backup e histórico real de migrations do projeto Supabase alvo.
5. Executar `db push --dry-run`/equivalente de conferência sem reparar o histórico automaticamente.
6. Aplicar apenas as migrations pendentes e na ordem correta.
7. Validar RLS/papéis após o deploy: Admin, Colaboradora Chefe, colaboradora comum, inativa e usuário sem perfil.
8. Publicar/validar Edge Function de reservas e telas da agenda.
9. Cadastrar duração dos 28 procedimentos pendentes e disponibilidade real da equipe.
10. Fazer smoke test controlado sem usar pacientes/clientes reais desnecessariamente.
11. Validar Safari/iPhone, Chrome/Android, desktop e PWA.
12. Só depois ativar os CTAs públicos e observar as primeiras reservas com plano de reversão da exposição pública.

## Estado de saída da homologação

- Desenvolvimento: concluído.
- Regressão de permissões da Chefe: reproduzida, corrigida e coberta por teste.
- Agenda DB CI: verde.
- Site CI: verde.
- Pre-anamnese CI: verde.
- Advisors locais em WARN: limpos.
- PR #45: aberto para `main`.
- Produção: não alterada.
- Merge: pendente de autorização.
- Supabase hospedado: rollout pendente.
- Validação operacional real/mobile: pendente.
- Ativação pública: pendente.
