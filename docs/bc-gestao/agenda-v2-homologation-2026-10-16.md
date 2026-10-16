# Agenda V2 — relatório de homologação gratuita

Código avaliado: `2ef9dc3f28067179453832a7ab61c9f2aedf75ab`.
Branch: `feature/public-agenda-native`. Base recebida: `cf192ff23d9b868d4585d02224b20f5088f1a325`.
Escopo: fechamento técnico da homologação descrita no handoff de 15/10/2026.

## Resultado

**Homologação gratuita concluída. GO para revisão de rollout; produção permanece sem alterações.**

Site CI e Agenda DB CI concluídos com sucesso no commit de código indicado acima. Nenhum teste desta rodada foi pulado. O commit seguinte altera somente documentação.

## Correções concluídas

- Uma única tabela `public.agendamentos` e um único motor de conflito. Não há sincronização ou segunda agenda física.
- Campo `booking_channel` separado da origem operacional. Registros antigos continuam internos; `agenda`, `encaixe`, `interno` e reservas históricas `site` permanecem compatíveis. Novas reservas públicas usam origem operacional `agenda` e canal `site`.
- RPC canônica `bc_agenda_list`: Geral/Site/Interna com identidade obtida no banco por `auth.uid()`. Admin e Colaboradora Chefe operam a equipe; colaboradoras comuns ficam limitadas à própria agenda, mesmo com payload forjado.
- Filtros nas duas interfaces, seleção de datas futuras para uso interno e filtro de profissional para a Chefe. Respostas antigas e erros atrasados não substituem a visão mais recente.
- Reservas públicas guardam apenas snapshot de nome/WhatsApp e não criam cliente formal. A equipe pode remarcar, cancelar e vincular cadastro posteriormente.
- Vínculo idempotente para a mesma cliente; troca de identidade após confirmação é recusada. Atendimento clínico e status `atendido` exigem cliente formal vinculado, inclusive para Admin.
- Lock por profissional impede conflitos entre canais e intervalos que atravessam meia-noite. Reservas internas respeitam bloqueios/inativações e podem usar horário especial fora da disponibilidade publicada.
- Tentativas recusadas contam no limite público de dez tentativas por dez minutos. Lock por hash impede ultrapassar o limite em concorrência. Recusas persistidas são traduzidas para HTTP 409/422/429 sem confirmar uma reserva falsa.
- Calendário mensal usa datas civis corretamente; slots respeitam a grade de quinze minutos. Inativação contabiliza compromissos que vêm da véspera e preserva os existentes.
- Formulários de bloqueio oferecem somente tipos aceitos pelo banco e avisam sobre revisão dos compromissos preservados.
- Correção de três testes frágeis: fixture de aniversário dependente do fuso local; regex que não aceitava optional chaining; texto incorreto esperado para acesso negado.

## Testes e evidências

| Verificação | Resultado |
| --- | --- |
| `npm run test:frontend` | 62 aprovados |
| `npm run test:site` | 99 aprovados |
| `npm run test:gestao` | 532 aprovados |
| `npm test` | 693 aprovados, zero falhas |
| Deno — tipos da Edge Function pública | Aprovado no CI |
| Deno — HTTP da agenda | 6 aprovados |
| Deno — PDFs de anamnese e clínico | 3 + 5 aprovados |
| Banco — migrations do zero | 65 migrations aplicadas desde banco limpo |
| Banco — pgTAP | 78 aprovados em 4 arquivos, zero falhas |
| Banco — concorrência | 6 cenários aprovados, sem duplicidade |
| Banco — lint PL/pgSQL | Aprovado, sem erros |
| Advisors locais | Sem erros ou avisos de segurança; 11 avisos de performance |

Site CI: https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/38830018610

Agenda DB CI: https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/38830018539

A prova de concorrência mantém uma transação sem commit enquanto outra tenta reservar o intervalo. Confere exatamente uma reserva persistida e uma recusa controlada: Site/Site no mesmo início; Site/Site com início diferente e intervalo sobreposto; Site/Interna; Interna/Site; Interna atravessando meia-noite. A sexta prova dispara onze tentativas simultâneas com o mesmo hash, esperando dez tentativas contabilizadas, uma recusa por limite e apenas uma reserva.

As provas de banco incluem catálogo publicado/duração, profissionais autorizados, calendário completo do mês atual, recusa de mês futuro, snapshots/normalização, ausência de cadastro automático, vínculo posterior, identidade imutável, bloqueios/inativações, reativação, encaixe especial, intervalo legado sem `fim`, filtros e isolamento dos três perfis. Incluem negativas de acesso financeiro administrativo, cadastro de papel e atendimento de outra profissional.

Os testes de HTTP executam o handler real com transporte Supabase substituído; os testes pgTAP e de concorrência executam SQL real em Supabase descartável. Não se trata de uma validação gráfica manual em aparelhos reais.

### Provas de regressão

- CI `e76565c`: os quatro conflitos no mesmo dia passaram; a corrida interna que atravessava meia-noite permitiu dois commits. A nova migration corrige o lock.
- CI `9edc569`: exatamente duas regressões SQL reproduzidas — status clínico sem cadastro e substituição de identidade já vinculada. As correções exigem vínculo formal e tornam o vínculo idempotente/imutável.
- Requisições Site/Interna resolvidas fora de ordem reproduziram o erro nos testes do controller real; o contador de geração resolve a sobrescrita da visão.

### Relógio dos testes

As fixtures usam amanhã às 10h dentro do mês civil; no último dia usam o próximo quarto de hora. Se não existir mais janela pública futura de 45 minutos, as provas públicas registram skip explícito, mantendo a corrida interna. Nenhum teste fabrica disponibilidade pública em mês futuro para ficar verde.

## Migrations

Criada pela CLI Supabase 2.121.0: `20261016001707_bc_gestao_agenda_v2_homologation.sql`.

As migrations históricas foram preservadas. A normalização de nomes legados acontece apenas no checkout descartável do CI, conforme script já existente; não renomeia histórico remoto nem usa `migration repair`.

RLS continua habilitada. Novos wrappers revogam execução de PUBLIC/anon e concedem apenas os papéis necessários. Funções privilegiadas mantêm `search_path` seguro e autenticação/autorização explícita. A chave de backend permanece somente na Edge Function.

## Revisão independente

A revisão somente leitura encontrou três pontos: substituição de identidade vinculada, respostas antigas do filtro e fixture dependente da virada do mês. Foram corrigidos e cobertos por regressões. A revisão não executou SQL; essa evidência vem do CI descartável.

### Cobertura complementar

As regressões também validam acesso interno a datas futuras, filtro de profissional para a Chefe e o aviso de inativação sobre compromisso que começa na véspera. Esses casos passaram na suíte Node e nos testes SQL finais indicados acima.

## Produção e limites

- Nenhum merge na `main`, publicação ou deploy foi feito.
- Nenhuma migration foi aplicada ao Supabase hospedado de produção.
- Nenhum paciente, usuário real, agendamento, dado clínico ou financeiro real foi criado ou alterado.
- Nenhum projeto/branch pago foi criado. A homologação usa Node local e GitHub Actions com Supabase temporário.
- A flag operacional da Alice real não foi alterada; habilitar a capacidade real pertence à implantação autorizada.
- O deploy de GitHub Pages continua disparando somente por `main` ou acionamento manual; os commits desta etapa só rodaram CI.

## Riscos e pendências antes de produção

Os advisors apontam **11 avisos de performance preexistentes**: cinco de avaliação de autenticação nas policies de `admin_users`, `pre_anamneses`, `staff_profiles` e `atendimentos` e seis de múltiplas policies permissivas. Não há erro ou aviso de segurança nesta execução local. As policies relacionadas já existiam antes do fechamento; não foi feita uma refatoração geral fora do escopo da agenda.

O runner também avisa sobre a versão de Node usada internamente por actions antigas; ele as executa automaticamente em Node 24. Não houve falha de execução.

A homologação não verifica configurações futuras do ambiente de produção nem substitui a validação operacional em celulares após implantação controlada. A configuração do backend e a disponibilidade real devem ser conferidas nessa etapa, sem reaproveitar as credenciais/fixtures públicas do banco local.

## Próximo passo separado: implantação controlada

1. Revisar este relatório e aprovar a etapa de produção separadamente.
2. Conferir backup, histórico do Supabase alvo e `db push --dry-run`; não reparar histórico automaticamente.
3. Aplicar somente migrations pendentes após conferência, incluindo a nova migration de fechamento.
4. Habilitar a capacidade de agenda da Colaboradora Chefe com identidade real verificada, preservando o papel colaborador e demais permissões.
5. Implantar Edge Function e telas internas de forma coordenada; confirmar configuração de backend/salt sem expor valores.
6. Equipe preenche disponibilidade real, faz validação operacional em celulares e só então ativa agenda pública/CTAs.
7. Observar primeiras reservas, recusas e permissões, com reversão planejada da exposição pública se necessário.

## Arquivos alterados nesta continuação

- `.github/workflows/agenda-db-ci.yml`
- `.github/workflows/site-ci.yml`
- `gestao/admin/index.html`
- `gestao/colaborador/index.html`
- `gestao/js/admin-agenda.js`
- `gestao/js/admin-schedule.js`
- `gestao/js/agenda-api.js`
- `gestao/js/agenda-origin.js`
- `gestao/js/colaborador-agenda.js`
- `gestao/js/colaborador-schedule.js`
- `scripts/test-agenda-concurrency.py`
- `supabase/functions/public-agenda/handler_test.ts`
- `supabase/functions/public-agenda/index.ts`
- `supabase/migrations/20261016001707_bc_gestao_agenda_v2_homologation.sql`
- `supabase/tests/database/agenda_inactivation_overlap.test.sql`
- `supabase/tests/database/agenda_v2_flow.test.sql`
- `supabase/tests/database/collaborator_chief_runtime.test.sql`
- `supabase/tests/fixtures/agenda.psql`
- `tests/gestao/admin-agenda.test.mjs`
- `tests/gestao/agenda-api.test.mjs`
- `tests/gestao/agenda-filter-race.test.mjs`
- `tests/gestao/agenda-origin.test.mjs`
- `tests/gestao/clientes-domain.test.mjs`
- `tests/gestao/colaborador-agenda.test.mjs`
- `tests/gestao/collaborator-agenda-filters.test.mjs`
- `tests/gestao/collaborator-chief-ui.test.mjs`
- `tests/gestao/schedule-block-types.test.mjs`
- `tests/site/public-agenda-http.test.mjs`
- `docs/superpowers/plans/2026-10-16-agenda-v2-homologation.md`
- Este relatório e a nota de atualização em `public-agenda-verification.md`.
