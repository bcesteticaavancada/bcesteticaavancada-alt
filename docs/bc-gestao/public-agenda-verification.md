> **Atualização de 16/10/2026:** o PR #45 foi mergeado e a Agenda V2 já está publicada, com migrations e Edge Function no Supabase hospedado. Ainda faltam disponibilidade real, 28 durações de procedimentos e validação operacional/mobile. Veja [o relatório atual](agenda-v2-homologation-2026-10-16.md). O conteúdo abaixo é histórico de 15/10; suas afirmações sobre produção sem alterações e runtime pendente foram substituídas pelo relatório atual.

# BC Gestão — Agenda Pública — Verificação e Rollout

Data da verificação: 2026-10-15
Branch: `feature/public-agenda-native`
Projeto Supabase: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)

## Decisão

**Código / homologação: GO**

**Produção: NO-GO até concluir os testes runtime em ambiente controlado e receber aprovação explícita de rollout.**

A implementação das Tasks 1–9 está versionada e passou a suíte completa de CI. Nenhuma migration nova da agenda foi aplicada no banco de produção e a Edge Function `public-agenda` ainda não está implantada.

## Evidência de CI

Última execução validada:

- GitHub Actions run: `38792311360`
- Head SHA: `325449609f39a7777e7d244d8b0d6ad78071e45e`
- Resultado: `success`

Etapas verdes:

- Existing pre-anamnese tests
- Site regression tests
- BC Gestão tests
- Public Agenda Edge Function check (`deno check`)
- Anamnese PDF Edge Function tests
- Clinical PDF Edge Function tests

## Sincronização com main

Antes da verificação final, `main` havia avançado com hotfixes da anamnese remota. Esses commits foram incorporados somente à branch de feature via PR interno #43.

Após a sincronização:

- `feature/public-agenda-native` inclui o estado atual do `main`.
- Comparação verificada: feature `ahead`, `behind_by = 0`.
- O `main` não recebeu a agenda pública durante esta verificação.

## Ordem das migrations

Foi detectada uma armadilha de ordem antes do rollout: a migration original do schema da agenda (`20261014173500`) ficava cronologicamente antes do hotfix remoto já aplicado (`20261014173632`). Como a agenda nunca foi aplicada em ambiente remoto, o arquivo foi renumerado com segurança.

Ordem final esperada:

1. `20261014173632_bc_gestao_anamnese_remote_schema_hotfix.sql` — já presente no histórico remoto;
2. `20261014180000_bc_gestao_public_agenda_schema.sql` — nova agenda;
3. `20261014184500_bc_gestao_public_agenda_engine.sql` — motor da agenda.

Foi adicionado teste de regressão para impedir que essa ordem seja quebrada novamente.

## Estado real do Supabase de produção

### Development branches

Consulta realizada: nenhuma development branch disponível (`branches: []`).

Consequência: não há, neste momento, um banco remoto isolado onde seja seguro executar os testes de concorrência/autorização com migrations reais sem tocar produção.

### Migrations

A lista de migrations remotas não contém:

- `bc_gestao_public_agenda_schema`;
- `bc_gestao_public_agenda_engine`.

Logo, o banco de produção ainda não recebeu o schema/motor desta feature.

### Edge Functions

Funções atualmente ativas no projeto remoto:

- `generate-anamnese-pdf`;
- `generate-clinical-pdf`.

A função `public-agenda` ainda não está implantada.

## Segurança da agenda pública

Contratos cobertos por código/testes estáticos:

- browser não recebe secret/service-role key;
- função pública usa secret somente no backend;
- `verify_jwt=false` é intencional para o endpoint público e a autorização é limitada ao desenho do handler/RPCs;
- browser chama apenas a Edge Function pública, não tabelas operacionais;
- respostas públicas são reduzidas a DTOs mínimos;
- nome/WhatsApp são snapshots de reserva, não identidade clínica;
- reserva pública não cria nem vincula prontuário automaticamente;
- atendimento clínico fica bloqueado até vínculo explícito com cliente formal;
- conflito de horário usa lock/checagem compartilhada;
- rate limit persiste somente hash da origem, não IP bruto;
- CORS, `no-store`, 409, 429 e erro genérico estão cobertos pelo handler/testes;
- Home apenas consulta disponibilidade pública e nunca efetua booking diretamente.

## Advisors do Supabase — produção atual

Os advisors foram executados em 2026-10-15 antes de aplicar qualquer mudança da agenda.

### Segurança

Foram observados findings preexistentes do projeto, não introduzidos pela agenda ainda não aplicada:

- tabelas RPC-only com RLS e sem policy direta (`rls_enabled_no_policy`) — em vários casos isso é intencional pelo desenho de acesso somente via RPC;
- `bc_anamnese_remote_get` e `bc_anamnese_remote_save` aparecem como `SECURITY DEFINER` executáveis por `anon`/`authenticated` — pertencem ao fluxo remoto tokenizado de anamnese e devem ser revisados dentro do escopo desse módulo, sem alteração cega durante o rollout da agenda;
- proteção contra senhas vazadas do Supabase Auth está desativada — item geral de hardening de autenticação, não causado pela agenda.

Referências de remediação:

- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Performance

Existem findings gerais/preexistentes de:

- foreign keys sem índice de cobertura;
- policies com `auth.uid()` sem initplan em alguns pontos;
- múltiplas policies permissivas;
- índices ainda não utilizados.

Esses findings devem ser tratados como backlog de performance/hardening geral. Não foi feito um refactor amplo durante a agenda pública para evitar risco e mudança de escopo.

## Testes runtime ainda pendentes

Os testes abaixo **não foram executados contra produção**, porque exigiriam aplicar migrations e/ou criar dados de teste no banco real:

1. admin fictícia altera disponibilidade de profissional fictícia;
2. colaboradora fictícia altera somente a própria agenda;
3. colaboradora recebe erro ao tentar alterar outra profissional;
4. usuário não autenticado não executa RPC interno;
5. encaixe interno em dia não publicado continua permitido quando não há conflito/bloqueio/inativação;
6. mesmo dia permanece invisível ao público até publicação explícita;
7. rollover de mês no fuso `America/Sao_Paulo` em runtime;
8. compromisso legado com `fim = null` bloqueia sobreposição usando duração do procedimento;
9. reserva `origem = site` aparece na agenda, mas não abre atendimento clínico antes do vínculo;
10. duas transações concorrentes no mesmo slot resultam em exatamente um agendamento ativo;
11. inativação sem data final preserva compromissos existentes e retorna `affected_appointments`;
12. comportamento HTTP da Edge Function implantada: OPTIONS, 405, 422, 409, 429, CORS e erro 5xx sanitizado.

Esses testes devem ser feitos em development branch/staging com dados exclusivamente fictícios.

## Checklist pré-rollout seguro

Antes de produção:

1. criar/usar ambiente controlado de homologação;
2. conferir `supabase migration list`;
3. executar `supabase db push --dry-run` no alvo apropriado antes de qualquer push real;
4. aplicar as duas migrations da agenda no ambiente controlado;
5. executar os testes runtime acima com identidades/dados fictícios;
6. rodar novamente advisors de segurança e performance após as DDLs;
7. confirmar secrets da Edge Function sem registrar seus valores em logs/documentos;
8. implantar `public-agenda` com o modelo de autenticação pública aprovado;
9. testar CORS/erros/rate limit em homologação;
10. só então decidir GO/NO-GO de produção.

Não usar `migration repair` como atalho. Só considerar reparo se houver divergência real de histórico previamente entendida e documentada.

## Ordem de ativação em produção, após aprovação

1. migrations da agenda;
2. telas internas de disponibilidade;
3. equipe preenche disponibilidade real manualmente;
4. Edge Function `public-agenda`;
5. página `/agenda/`;
6. CTAs/widget da Home;
7. observar erros/logs nas primeiras reservas.

Embora `/agenda/` e os novos CTAs já existam na branch de feature, eles **não estão ativos em produção** enquanto a branch não for promovida/publicada.

## Conclusão

A implementação está **pronta para homologação** e a árvore da feature está sincronizada com o `main`. A CI completa está verde, a ordem de migrations foi corrigida antes do rollout e produção continua sem as mudanças da agenda.

Estado final desta verificação: **GO-STAGING / NO-GO-PRODUCTION**.
