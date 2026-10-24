# Estado da instalação OAuth de teste — 24/10/2026

## Autorização e limites

Fernando aprovou instalar somente a autorização de teste em resposta à proposta
de 23/10/2026 às 19:07 (Brasília). Essa autorização foi recuperada antes de agir.
O backup permanece bloqueado: sem leitura/transferência de documentos reais,
sem agendamento, sem merge na principal e sem alterações financeiras.
O fluxo deste PR59 aceita somente as duas pastas de conteúdo. Não ampliar para
raiz/manifestos sem consentimento específico; a ligação ao worker é etapa futura.

## Concluído

- Revisão independente: sem achados críticos/importantes que bloqueiem instalação
  com configuração desabilitada. Restam limites menores já descritos abaixo.
- Reexecutados 12 cenários HTTP OAuth e tipagem dos três entrypoints: aprovados.
- Reexecutados testes PostgreSQL efêmero e interface: 15 testes aprovados
  (9 contados no grupo SQL, incluindo seu agrupador; 6 de interface).
- Conferência técnica dos vínculos: Fernando ativo, e-mail confirmado, papel
  `admin_criacao`; Mel ativa, e-mail confirmado, papel `admin`. Nenhum vínculo alterado.
- Migration instalada via conector: `20261024043221`, nome
  `bc_drive_oauth_test_setup`. O arquivo foi renomeado para refletir a versão
  registrada no servidor. Não reaplicar com o timestamp antigo.
- Duas tabelas privadas criadas, vazias e com RLS. RPC sem EXECUTE para `anon`
  e `authenticated`; `service_role` tem EXECUTE. USAGE em `private` já existia
  antes da instalação. Vault disponível, sem credencial nova gravada.
- A primeira chamada de instalação teve erro de sessão expirada. A consulta de
  conferência comprovou ausência dos objetos; a segunda chamada concluiu, e uma
  nova consulta confirmou os objetos, grants e contagens. Não houve dupla aplicação.

## Ponto exato de retomada

Antes de implantar os três handlers, conferir explicitamente
`BC_DRIVE_OAUTH_ENABLE_SETUP=false` e preservar
`BC_DRIVE_BACKUP_ENABLE_WRITES=false`. O navegador Supabase está na tela de login;
a conexão MCP permite DDL/deploy, mas não fornece gerenciamento de Edge Secrets.
É necessária entrada segura no painel para conferir esses controles, sem enviar
senha, token ou client secret por conversa.

O Google Cloud Console retornou “Site Unavailable” neste navegador, inclusive
numa única recarga de conferência. Não houve login, mudança ou criação de chave
no Google. Reutilizar cliente OAuth existente; conferir APIs, origem/callback,
usuários de teste e chave pública Picker com restrições antes de habilitar setup.

Ainda não foram implantadas as três funções, publicada a página, obtido
consentimento Google real ou executado upload. O backend de backup não foi instalado.

## Instalação seguinte

Usar somente `drive-oauth-start`, `drive-oauth-callback`, `drive-oauth-setup`,
com os três módulos relativos em `_shared/drive-oauth/` e `verify_jwt=false`
porque os handlers verificam sessão/state por conta própria. Manter configuração
desabilitada e testar respostas negativas antes de liberar autorização real.
Publicar somente os quatro arquivos de `gestao/configurar-drive/` quando os
pré-requisitos estiverem conferidos; não mesclar PR59 inteiro para isso.

## Limites menores e validação pendente

Sessão BC excepcionalmente longa pode exceder o cookie; validação anterior de
pastas é um registro histórico e pode permanecer marcada após uma reconferência
mal sucedida. Não usar esse indicador como prova atual de privacidade ou como
autorização para backups. A ativação futura exige reconferência de permissões.
Gateway, cookies reais, Picker, consentimento e criptografia Vault hospedada
ainda não foram homologados. Logout não foi provado como revogação imediata de JWT.
