# BC Estética Avançada — Central privada de dados e backup por gravação

Situação em **28/10/2026**: **estrutura privada organizada no Google Drive; expansão automática por evento NÃO implantada nem homologada**. Proposta de desenvolvimento isolada; **não mesclar, não publicar, não alterar dados de pacientes** sem testes e aprovação.

## O que está efetivamente feito no Google Drive

A pasta existente de backup, sob conta administrativa da BC e compartilhamento restrito à gestão, foi renomeada para **BC Estética Avançada — Central Privada de Dados e Backups**. O **ID da pasta permaneceu igual**; duas pastas consentidas já usadas pelo backup automático mantiveram seus IDs e localizações. Não houve troca de OAuth, permissão ou scripts do worker.

Subpastas da raiz:
- `01_Anamneses_e_Documentos_Clinicos` — já existente; destino privado do backup clínico atual.
- `02_Arquivos_de_Clientes` — já existente; destino privado do backup de anexos atual.
- `03_Site_Maya_e_Midias` — já existente; pacote ZIP Maya 2D movido da raiz, preservando seu ID.
- `04_Manifestos_e_Relatorios_de_Backup` — já existente.
- `05_BC_Gestao_Banco_de_Dados_e_Exportacoes` — pasta nova, **ainda sem rotina de exportação**.
- `06_Site_Codigo_Versoes_e_Publicacoes` — pasta nova, **ainda sem sincronização GitHub→Drive**.
- `07_Configuracoes_Auditoria_e_Restauracao` — pasta nova, **ainda sem rotina de exportação**.
- `08_Financeiro_e_Contabilidade` — pasta nova, **ainda sem rotina de exportação**.
- `09_Administracao_Contratos_e_Equipe` — pasta nova, **ainda sem rotina de exportação**.

A pasta principal e as cinco novas pastas foram verificadas após criação/renomeação: somente permissões **individuais de proprietário e colaborador(a)**, sem `anyone`. Não publicar nem registrar tokens, IDs de pastas, nomes de pacientes ou relatórios clínicos neste repositório.

**Pasta externa detectada:** há outro diretório `BC Estética` no Drive, **sob propriedade de outra conta**, com permissão `anyone:writer` por link e subpastas nomeadas para equipe. É um **bloqueio de segurança**: NÃO mover/conectar/herdar permissões automaticamente na Central Privada. Proprietário(a) deve revisar e revogar acesso amplo antes de migração seletiva com conferência de propriedade, destinatários e consentimento. Não apagar nem alterar a pasta externa sem autorização de sua proprietária.

## Estado do que já está em execução

- O `drive-backup` v2, ativado em 25/10, usa `bc-prontuario-private`, `drive.file`, journal de versões, restauração com SHA-256 e cron **horário** `0 * * * *`.
- Primeira execução real validou **10/10 objetos**, com **0 erros**, incluindo download e verificação de bytes. A última execução consultada de **28/10 às 23h (Brasília)** foi `success`, auditou os 10 objetos e tinha 0 pendências.
- O backup existente só cobre **PDFs/imagens/assinaturas/anexos no bucket clínico privado**. **Não cobre automaticamente** conteúdo que existe apenas no Postgres, contas, financeiro, arquivos de código no GitHub, mídia fora do bucket ou mudanças em páginas do site.
- A ligação OAuth com Google Cloud tem pendência de conferência de publicação/renovação. Um token que funciona hoje não comprova renovação indefinida.
- PR #64 continua em rascunho no GitHub, embora a função de backup tenha sido validada e ativada em produção. Esta iniciativa **depende** do PR #64, mas não o mescla.

## Objetivo de comportamento

**Quando um registro for efetivamente salvo**, o sistema registra um evento durável sem conteúdo sensível e solicita, de forma assíncrona, uma cópia **versionada** no Drive. Não executar upload ao Drive dentro da transação do usuário. Não expor dados no payload de webhook nem travar agendamento/atendimento quando o Drive estiver lento. Conservar o cron horário como reconciliação e alertar se uma mudança permanecer sem backup.

### Matriz de cobertura

| Origem de gravação | Fonte oficial | Gatilho requerido | Destino privado no Drive | Estado |
|---|---|---|---|---|
| Anamnese, consentimento, PDFs e fotos | Supabase Storage privado | Evento confirmado de upload/atualização + outbox após commit, fila idempotente | 01/02 | **Cron horário ativo; por evento pendente** |
| Clientes, agenda, atendimentos, fichas e assinaturas como linhas de banco | Postgres Supabase | Eventos transacionais em tabelas explícitas (INSERT/UPDATE/DELETE) + snapshot incremental; exportação consistente periódica | 05 | **Não implementado** |
| Financeiro, repasses e recibos no banco | Postgres, schemas `public`/`private` | Exportação **criptografada** e autorizada em worker isolado, consistente e com retenção separada | 08 | **Não implementado** |
| Código, HTML, CSS, JS, publicações, configurações não secretas | GitHub repositório do site | GitHub Actions disparada após `push`/merge na branch aprovada, com commit/manifesto de arquivos e versão | 06 | **Histórico Git existente; cópia Drive não implementada** |
| Maya (conteúdo, respostas, configuração e imagens) | GitHub/arquivos do sistema | Mesmo gatilho do site para arquivos versionados; DB/Storage para dados próprios | 03/06 | **ZIP manual preservado; automatização pendente** |
| Auditoria, restauração e estado das cópias | Journal privado + eventos do sistema | Finalização de backup, hash, monitoramento, teste de recuperação | 04/07 | **Journal atual ativo; painel e alertas pendentes** |
| Contratos, materiais administrativos, arquivos externos | Drive ou upload autorizado | Cópia/organização com consentimento e permissão conferida | 09 | **Pendente** |

**Não tratar** AutoSave de campo parcial como alteração concluída: evento apenas após confirmação do servidor. Para qualquer alteração pendente por mais de alguns minutos, gerar alerta administrativo; **não prometer sincronismo instantâneo**. Possíveis gatilhos: Database Webhooks (pg_net) ou trigger/outbox privada, com somente identificadores opacos no payload; Storage hook com evento de objeto confirmado; GitHub Actions para commits publicados.

## Proteções inegociáveis

1. **Privilégio mínimo:** pastas privadas; para novas pastas, aprovar escopo e autorização `drive.file` (a pasta criada pela interface Drive não está automaticamente disponível ao OAuth do app). Credenciais e IDs sensíveis ficam em secrets/Vault, jamais HTML, GitHub, logs ou payload.
2. **Outbox resistente:** registro de evento na mesma transação de gravação do BC Gestão; worker processa após commit com deduplicação por origem+chave+versão/hash, tentativas progressivas, checkpoint e dead-letter. A cópia é confirmada **após verificar bytes/hash no Drive**.
3. **Consistência:** exportação de banco com snapshot transacional/criptografia autenticada, esquema versionado, auditoria de falhas; evitar backup por eventos isolados como única recuperação de banco.
4. **Imutabilidade prática:** não sobrescrever versão antiga; proteger exclusão por política de retenção, evitar loops de sincronização e não apagar backup se origem for excluída.
5. **Privacidade/LGPD:** não copiar dados clínicos e financeiros para GitHub Actions ou repositório. Chaves para descriptografia separadas do Drive e backup de chaves sob controle da administração; política de acesso e retenção da Mel.
6. **Desempenho:** upload e Drive assíncronos, nunca bloquear salvar cliente, agendamento ou procedimento. Retry + reconciliador, com indicador do último backup e atraso.
7. **Recuperabilidade:** ensaios periódicos com dados fictícios e registro de integridade; executar recuperação real apenas sob autorização.
8. **Separação de funções:** suporte da Maya não deve conceder acesso a prontuários, financeiro ou Drive. O backup não substitui RLS nem controle de acesso.

## Sequência de implantação / gates

**Etapa 1 — Organização privada (CONCLUÍDA no Drive).** Manter pasta principal ID estável, subpastas e permissões. Diretório externo com link amplo fica fora até saneamento.

**Etapa 2 — Homologação de gatilho para Storage (PENDENTE).** Em branch isolada, integrar o evento pós-upload ao worker atual **sem publicar PDF nem chave**, apenas sinal de mudança; retentar e reconciliação horária. Testar com arquivo fictício e mudança da mesma chave; não ajustar worker de produção sem homologação.

**Etapa 3 — Backup consistente do banco BC Gestão (PENDENTE).** Inventário de tabelas críticas, export incremental e snapshot completo periódico criptografado, proteção de restauração, verificação de correlação e registros de exclusão. Não exportar banco por consulta manual com dados de pacientes.

**Etapa 4 — GitHub→Drive (PENDENTE).** Serviço com credenciais privadas; ao merge/publicação enviar ZIP/TAR versionado com checksum e hash do commit, sem segredos; validar restauração estática e manter histórico do GitHub.

**Etapa 5 — Controle, alerta e corte (PENDENTE).** Painel de status no BC Gestão para admin, monitoramento de falhas e atraso, teste completo de restauração, avaliação LGPD pela Mel, revisão dos custos/quotas e autorização expressa para deploy. Só então ativar os gatilhos reais, sem interromper o cron atual.

## Riscos e dependências

- O regime de compartilhamento da pasta externa **não atende ao requisito de pasta única privada**; precisa ser saneado por seu proprietário. Não realizar migração cega.
- O Google Drive **não substitui** banco Supabase nem o GitHub. Ele guardará snapshots/exportações privados de ambos.
- O `drive.file` da integração vigente está limitado aos destinos já autorizados; **novas pastas requerem consentimento/configuração de acesso pela aplicação** antes de usá-las em jobs.
- O acesso a pastas da administração não autoriza tornar públicas informações clínicas/financeiras. Testar explicitamente RLS, Auth, auditoria, permissões e a continuidade do backup atual.
- Status registrado é um retrato de 28/10/2026; verificar saúde do cron e validade OAuth novamente antes do corte.

## Referências

- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase backups de banco](https://supabase.com/docs/guides/platform/backups)
- [Supabase Webhooks e pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
- [GitHub Actions — Workflows](https://docs.github.com/en/actions/writing-workflows)
- [Google Drive — `drive.file` scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
