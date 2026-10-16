# Agenda V2 — homologação e conferência após implantação

Código final validado antes desta atualização documental: `571439d4f58765ca446744435298bf8bc46b574f`.
Branch: `feature/public-agenda-native`.
PR: [#45](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/45), integrado à `main` em 16/10/2026 às 08:57:46 UTC.
Merge verificado: `edc1889266633f2cd0337f882fc7617b0a2d1778`.
Conferência inicial: 16/10/2026, após 16h40 em Brasília. Configuração operacional posterior autorizada por Fernando: [horários e permissões](agenda-v2-operational-setup-2026-10-16.md).
Escopo: fechamento técnico da Agenda V2, incluindo regressão de permissões RLS identificada após a limpeza dos Advisors.

## Resultado

**Código integrado e agenda pública com horários de Alice e Mel para os 30 procedimentos. Aline e Kate aguardam cadastro; reserva controlada e validação mobile continuam pendentes.**

O handoff com head `f4416b5` foi superado pela correção da Chefe e pelo rollout já observado. No head final do PR, `ce53b891efe658213ad655cbc1327508ab3c228c`, Agenda DB CI, Site CI e Pre-anamnese CI concluíram com sucesso. O deploy do GitHub Pages na `main` também passou.

A conferência inicial não repetiu o rollout. Depois, a pedido de Fernando, foram configurados turnos, almoço, durações e permissões operacionais conforme o relatório vinculado acima. Nenhuma reserva ou conta foi criada nesta configuração.

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

Agenda DB CI final do PR: [38875607821](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/38875607821). A primeira execução verde da correção foi `38874851782`.

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

Site CI final do PR: [38875607844](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/38875607844).

Concluíram com sucesso no mesmo head:

- testes existentes da pré-anamnese;
- regressão do site;
- BC Gestão;
- checagem da Edge Function da agenda pública;
- testes HTTP da agenda pública;
- PDF de anamnese;
- PDF clínico.

Pre-anamnese CI final do PR: [38875607808](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/38875607808), também concluído com sucesso.

Na `main`, [Site CI 38877196454](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/38877196454) e [deploy do GitHub Pages 38877196686](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/38877196686) terminaram com sucesso.

## Migrations observadas no Supabase hospedado

Projeto conferido: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`). As seis migrations desta fase já constam no histórico remoto, nesta ordem. A ferramenta de implantação registrou novos timestamps; estes são os identificadores efetivamente observados, sem inferir necessidade de `migration repair`.

| Migration | Versão no repositório | Versão hospedada |
| --- | --- | --- |
| `bc_gestao_public_agenda_schema` | `20261014180000` | `20261016090114` |
| `bc_gestao_public_agenda_engine` | `20261014184500` | `20261016090230` |
| `bc_gestao_agenda_v2_permissions` | `20261015205157` | `20261016090255` |
| `bc_gestao_agenda_v2_homologation` | `20261016001707` | `20261016090345` |
| `bc_gestao_rls_advisor_cleanup` | `20261016021500` | `20261016090406` |
| `bc_gestao_preserve_chief_rls_scope` | `20261016083349` | `20261016090414` |

As migrations históricas devem ser preservadas. A normalização de nomes legados usada pelo CI é exclusiva do checkout descartável e não autoriza renomear o histórico remoto nem executar `migration repair` automaticamente.

## Conferência pública sem criar reservas

| Verificação hospedada | Resultado observado |
| --- | --- |
| Página `/agenda/`, módulo principal e configuração pública | HTTP 200 |
| Manifesto do PWA | HTTP 200; a agenda está dentro do escopo do site instalável |
| Edge Function `public-agenda` | ACTIVE, versão 1, `verify_jwt=false` intencional para o endpoint público |
| Catálogo público sem login | HTTP 200; 30 procedimentos: 28 com 60 min, Limpeza de pele com 90 min e Limpeza de pele com peeling com 100 min |
| Profissionais para todos os 30 procedimentos | HTTP 200; Alice e Mel, 60 combinações conferidas |
| Calendários e horários após configuração | Mês completo; vagas de segunda a sábado, almoço das 12h às 13h e término até 19h |
| Formato das respostas de calendário | Apenas mês, data, disponibilidade e estado; nenhum nome/dado de cliente |
| Chrome remoto, página publicada | Catálogo e calendário carregam; conferência anterior sem vagas foi superada pela configuração operacional |
| Capability real | Alice ativa, `role=colaborador`, `pode_gerenciar_agendas=true`; Mel ativa, `role=admin` |
| Policy de leitura de agendamentos | Inclui a capability da Chefe e mantém o filtro da colaboradora comum |

O app usa o próprio site em formato instalável (PWA). A agenda publicada é compartilhada entre navegador e app; não há um segundo banco ou build nativo separado. Esta conferência não testou instalação nem execução em Android/iPhone reais.

Inventário após configuração autorizada: 30 procedimentos ativos com duração válida, 2 profissionais ativas que atendem clientes, 60 vínculos ativos profissional/procedimento, 628 dias de disponibilidade e 628 pausas de almoço. São 314 dias por profissional, de 16/10/2026 a 16/10/2027, sem domingos. Aline e Kate não possuem conta identificada e ainda não foram liberadas.

Os CTAs da home já fazem parte da versão publicada. A exposição dos links não significa que reservas e dispositivos foram homologados em produção. A navegação pública permanece limitada ao mês atual; meses futuros ficam disponíveis na operação interna e por WhatsApp, conforme o desenho implementado.

## Escopo e limites desta conferência

- O rollout já estava aplicado quando o estado atual foi consultado; depois foi executada a configuração operacional explicitamente solicitada por Fernando.
- Nenhum paciente, cliente, usuário, agendamento, dado clínico ou financeiro real foi criado ou alterado por esta conferência.
- Turnos e permissões seguem o pedido do usuário. Ele escolheu 60 minutos para os 28 procedimentos sem duração; os dois tempos anteriores foram preservados.
- Não houve reserva de teste no ambiente hospedado. Conflitos, rate limiting e negativas de autorização possuem evidência no CI descartável; o ciclo de reserva real controlada ainda está pendente.
- Login real e operação dos perfis em celulares ainda precisam de validação. A leitura da configuração de perfis não substitui essa prova.
- Backup/rollback da implantação anterior não foi revalidado por esta auditoria; não se afirma que esta conferência produziu um backup.
- A configuração operacional teve dry-run com rollback e guardou seu estado anterior no registro de auditoria `04538d12-607b-4d00-99b1-d174e61ea70c`.

## Advisors e segurança

O schema descartável final ficou sem issues no nível WARN após as duas migrations de RLS e o contrato de regressão de papéis.

No Supabase hospedado, o Advisor de **performance retornou zero WARN/ERROR** nesta conferência. Os antigos 11 warnings de RLS não apareceram. Permanecem recomendações INFO de chaves estrangeiras/índices, que não foram alteradas nesta etapa.

O Advisor de **segurança hospedado ainda retorna avisos**: duas funções de pré-anamnese acessíveis por `anon`; dez funções `SECURITY DEFINER` acessíveis por `authenticated` (as duas de pré-anamnese e oito wrappers de agenda); e proteção contra senha vazada. Portanto, não se declara o Advisor hospedado inteiro sem WARN.

Os wrappers autenticados de agenda usam verificações internas de identidade/capability; a existência do aviso não demonstra, por si, acesso indevido. A homologação SQL cobre negativas de permissão. Revisar os avisos com esse contexto e validar os perfis no fluxo real; não revogar execução ou alterar a pré-anamnese cegamente para zerar o painel.

Referências: [funções privilegiadas para anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funções privilegiadas para authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Próximos passos: completar a operação

1. Informar os e-mails de Aline e Kate para cadastrar e verificar os acessos corretos.
2. Aplicar a Aline a regra de procedimentos de pele sem botox/preenchimento e a Kate a família de massagens/drenagens; usar os mesmos turnos autorizados. Conferir os procedimentos selecionados antes da ativação dessas contas.
3. Validar login e ações de Admin, Chefe, colaboradora comum, inativa e conta sem perfil; usar contas/fixtures controladas para os perfis de teste.
4. Com disponibilidade definida e janela específica de homologação, testar uma reserva fictícia do site até a gestão, conferir conflito e cancelamento controlado, sem editar compromissos reais.
5. Validar Chrome/Android, Safari/iPhone, Chrome desktop, tela pequena e PWA instalada: calendário, seleção, confirmação e WhatsApp.
6. Registrar essas provas antes de declarar a agenda pronta para clientes e divulgar seu uso. Manter revisão de segurança da pré-anamnese/Auth em tarefa separada.

## Estado de saída da homologação

- Desenvolvimento: concluído.
- Regressão de permissões da Chefe: reproduzida, corrigida e coberta por teste.
- Agenda DB CI: verde.
- Site CI: verde.
- Pre-anamnese CI: verde.
- Advisors locais em WARN: limpos.
- PR #45: mergeado.
- Site: publicado; página e consultas públicas funcionando.
- Supabase hospedado: seis migrations da fase registradas e função pública ativa.
- Performance hospedada: antigos 11 WARN resolvidos.
- Disponibilidade: Alice e Mel configuradas de segunda a sábado, 09h–19h, pausa 12h–13h, até 16/10/2027.
- Catálogo: 30 durações válidas e Alice/Mel autorizadas nos 30 procedimentos.
- Aline e Kate: cadastro e permissões específicas pendentes dos e-mails.
- Validação operacional real/mobile: pendente.
- Estado operacional: horários públicos liberados para Alice/Mel; concluir as demais contas e provas finais.
