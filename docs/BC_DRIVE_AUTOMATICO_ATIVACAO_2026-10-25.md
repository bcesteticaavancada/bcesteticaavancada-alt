# BC — backup automático privado ativado em 25/10/2026

**Ativo e verificado.** Fernando autorizou expressamente a ativação após o
ensaio fictício. O controle privado está habilitado e o job
`bc-drive-backup-hourly-v1` (ID 1) está ativo com `0 * * * *`, às horas cheias.
Ativação: **25/10/2026 às 01:29:26, horário de Brasília**.
Próximo horário previsto no momento da conferência: **02:00 de 25/10/2026**.

## Resultado operacional

| Conferência | Primeira execução | Repetição |
|---|---:|---:|
| Resultado | sucesso / HTTP 200 | sucesso / HTTP 200 |
| Objetos analisados | 10 | 10 |
| Novas cópias | 10 | 0 |
| Cópias recuperadas e verificadas por SHA-256 | 10 | 10 (auditoria) |
| Falhas | 0 | 0 |
| Pendências no lote | 0 | 0 |

- Primeira execução: 01:29:28–01:30:16, run `e71d5455-914f-4fae-8679-74e7b62a99d8`.
- Repetição: 01:31:10–01:31:29, run `da96360f-d259-46be-96e0-d25368d233c3`.
- Cobertura atual conferida: **10 de 10 objetos**, **10.148.553 bytes**.
- Destinos: **5 cópias clínicas e 5 arquivos de clientes**, nas duas pastas já consentidas.
- As duas chamadas de validação usaram o mesmo acionador SQL que o cron executará.
  O primeiro disparo pelo horário regular ainda era futuro na conferência.
- Permissões da conta, das pastas e de cada cópia foram revalidadas na execução.
- A cópia foi baixada no servidor e comparada por hash e quantidade de bytes.
  Nenhum conteúdo, nome, caminho, ID de arquivo real ou hash clínico veio para
  este relatório, chat ou ambiente local. O journal privado guarda a associação
  necessária para recuperação administrativa.
- Os quatro PDFs fictícios da homologação anterior foram preservados e não
  entram nos contadores acima.

O Storage REST apresenta timestamps em milissegundos; a coluna original do
Postgres retém microssegundos. A conferência de cobertura usa essa mesma precisão
da API. A primeira comparação SQL com igualdade de microssegundos produziu um
falso zero: todas as dez chaves/tamanhos coincidiam e as diferenças eram de
0,035 a 0,882 ms. A comparação correta confirmou 10/10; os bytes foram verificados
independentemente por SHA-256.

## Implementação e proteções

- Função `drive-backup`, versão 2. Bundle SHA-256:
  `04572201527588967b9ed64a102cbc2fbf4946250aec21c7dc2162874624b898`.
- Fonte implantada: commit `4b84513852dd0cd4908f1b72ca31d36b7b446679`,
  branch `backup/drive-automatico-v1`, PR 64 (base de preparação; sem mescla em main).
- Todos os arquivos de código do bundle publicado foram recuperados e
  comparados byte a byte com a fonte. A configuração vazia deno.json não
  integra o bundle de execução.
- Bucket exclusivo: `bc-prontuario-private`. Escopo Google exclusivo: `drive.file`.
- Conta de destino decolarbh; acesso permitido somente a essa conta e Mel.
  Não foram criados compartilhamentos.
- IDs do Drive reservados no journal antes do upload; retorno incerto reutiliza
  o mesmo ID. Cada hash de conteúdo mantém sua versão, sem apagar ou substituir.
- Lease de dez minutos e deadline de 110 s; até 12 cópias/alterações e 12
  auditorias por chamada, 12 MiB por objeto e 3.000 nós por inventário.
- Cursores separados avançam também em tentativas falhas. Snapshots consultam
  apenas chaves atuais, até 100 por resposta.
- `verify_jwt=false` é intencional: a função exige seu próprio ticket aleatório
  de uso único, válido por dois minutos, antes de obter lease ou acessar fontes.
  RPC V2 é exclusiva de `service_role`; usuários não têm acesso direto às tabelas.
- O pg_net transporta somente o ticket descartável. OAuth e credenciais
  Supabase permanecem no servidor. O ticket é marcado como usado atomicamente;
  a repetição é recusada e o histórico é preservado.
- A fila do pg_net pertence à plataforma e manteve seus grants PUBLIC apesar da
  tentativa de REVOKE; nenhum segredo permanente foi enfileirado. A mudança para
  tickets descartáveis foi aplicada antes da ativação. Uma leitura SQL da fila
  poderia antecipar a mesma execução permitida enquanto o ticket fosse válido,
  mas não daria acesso aos documentos nem a uma autorização reutilizável.
- Controle único de operação: `private.bc_drive_backup_control.enabled`.
  A antiga variável Edge `BC_DRIVE_BACKUP_ENABLE_WRITES` pertence aos guards da
  preparação OAuth e **não é o interruptor do worker V2**.
- A função fictícia continua encerrada. Os outros nove bundles publicados
  permaneceram com os mesmos hashes; nenhum papel de colaboradora foi alterado.

## Validação

- 24 testes Deno de regras/worker, 10 testes PGlite de SQL/ACL/lease/tickets,
  typecheck Deno e 784 testes existentes do aplicativo passaram.
- Revisão independente local: sem Critical; corrigidos dois Important de
  rotação e um Minor de consulta ao histórico, com regressões RED/GREEN.
- Integração real: papel de servidor aceitou o primeiro consumo do ticket
  fictício transacional e recusou a repetição; o teste foi revertido.
  Gate desativado foi conferido antes da ativação.
- Probes HTTP reais: sem autorização 401; origem de navegador 403;
  ticket inválido 401.
- Tabelas privadas com RLS e sem grants para anon/authenticated/service_role.
  RPC V2 executável somente pelo servidor; acionador SQL sem grant de aplicação.
- Advisors: nenhum WARN novo do backup. Quatro INFO de RLS sem policy são
  intencionais para tabelas internas sem grants; ver
  [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
  Avisos anteriores de outros módulos não foram alterados.
- CI remoto não é apresentado como evidência: os conectores de consulta usados
  não retornaram checks dessa branch. Os resultados acima são locais e operacionais.

Migrations registradas no projeto: `20261025021446_bc_drive_automatic_backup` e
`20261025042745_bc_drive_backup_one_time_invocation`. Os arquivos locais mantêm os
timestamps originais gerados pelo CLI. A primeira forma da segunda migration
falhou por requestState expirado e não foi aplicada; a forma final é aditiva,
com endpoints V2 e sem exclusão de registros.

## Acompanhamento e pausa

O resultado efetivo fica em `private.bc_drive_backup_runs`; o sucesso do job
SQL indica enfileiramento, não confirma sozinho a cópia. Não foi configurado
envio de alertas por e-mail, WhatsApp ou outro canal.

Consulta administrativa sem dados clínicos:

```sql
select enabled, last_success_at,
  last_success_at is null or last_success_at < clock_timestamp()-interval '2 hours'
    as needs_attention
from private.bc_drive_backup_control;
select started_at, finished_at, status, counters, error_code
from private.bc_drive_backup_runs
order by started_at desc limit 5;
```

Pausa reversível, sem apagar arquivos ou versões:

```sql
begin;
update private.bc_drive_backup_control set enabled=false where singleton;
select cron.unschedule(jobid)
from cron.job where jobname='bc-drive-backup-hourly-v1';
commit;
```

## Limites e pendência administrativa

Esta rotina cobre PDFs, assinaturas, imagens e anexos **já gravados no bucket**.
Não exporta tabelas PostgreSQL, financeiro, cadastros que só existam no banco,
mídias do site ou um plano completo de recuperação de desastre. Um lote acima de
12 pendentes continua nas próximas horas; não há promessa de SLA de uma hora
para um acúmulo maior.

O Google foi configurado inicialmente com aplicativo externo em Testing; o estado
atual de publicação no Cloud não foi reconfirmado. **É necessário conferir e
concluir a saída desse modo e renovar a autorização, se ainda necessário, para
evitar interrupção após sete dias.** A automação já funciona com a conexão atual,
mas não é uma garantia de autorização permanente. Regra oficial:
[Refresh token expiration](https://developers.google.com/identity/protocols/oauth2?hl=en#expiration).

