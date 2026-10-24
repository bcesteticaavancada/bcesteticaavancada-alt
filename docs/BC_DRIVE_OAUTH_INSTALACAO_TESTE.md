# Estado da instalação OAuth de teste — 24/10/2026

## Retomada mais recente — retorno corrigido, consentimento pendente

- Correção salva na branch de teste como `3ce02b372d62756c928569dd97178b09f202776e`.
  O retorno agora usa `/bcesteticaavancada-alt/gestao/configurar-drive/` em sucesso,
  cancelamento e falha. O checkout local `fd1efdb` tem o mesmo conteúdo desta correção.
- Validação fresca: 13 testes HTTP OAuth, 9 testes SQL, 6 testes da interface e
  784 testes gerais aprovados; os 6 de interface já integram os 784 gerais.
  Tipagem dos três entrypoints aprovada. Revisão independente sem bloqueios novos.
- CI `40125828849`: SUCCESS, incluindo ensaio Chromium com serviços fictícios.
  Isso não homologa consentimento, Picker, cookies ou permissões Google reais.
- Atualizado somente `drive-oauth-callback`, versão 3. Código recuperado pelo
  conector é idêntico aos quatro arquivos enviados. SHA-256 do bundle:
  `4a5065b85ab2a7e281f592496b0f14720377e2fd8a180bdbde5591ab346bae04`.
  As outras sete funções conservaram os hashes, versões e políticas JWT da
  conferência imediatamente anterior desta retomada.
- Página isolada preparada no PR rascunho
  [61](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/61), sobre
  `main` em `5fdeef1b41711833d6187b71f3f6953071dcf637`. Comparação confirmou somente
  quatro adições em `gestao/configurar-drive/`; o config.js da principal exporta
  a URL e a chave publicável esperadas. Nenhum merge nem publicação da página.
- Fernando enviou captura com o nome `BC_DRIVE_PICKER_API_KEY` cadastrado depois
  da instalação inicial descrita abaixo. Não repetir a afirmação histórica de
  que a chave inexiste como se fosse uma conferência atual.
- O painel Supabase pede login nesta sessão. A presença atual da chave, os
  controles no painel e os pré-requisitos Google ainda precisam de conferência.
  Nenhum valor secreto foi aberto, copiado ou incluído neste relatório.
- Após a atualização, as três rotas continuaram retornando HTTP 503,
  `setup_disabled`, `no-store`, sem redirecionamento/cookie OAuth. As tabelas
  continuam com zero estados e zero conexões. Nenhum documento foi acessado.

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
- Após Fernando concluir o login no painel, conferido o digest de
  `BC_DRIVE_BACKUP_ENABLE_WRITES`: corresponde exatamente a `false`. O controle
  `BC_DRIVE_OAUTH_ENABLE_SETUP` não existia; foi criado explicitamente com `false`
  e seu digest conferido após salvar. Nenhum valor de credencial foi revelado.
- O digest de `BC_DRIVE_CLIENT_ID` corresponde ao cliente público previsto no
  código. `BC_DRIVE_CLIENT_SECRET` existe, mas seu valor não foi aberto; isso
  ainda não comprova que o Google aceitará a credencial.
- Implantados somente os três handlers revisados, versão 1, com dependências
  relativas e `verify_jwt=false`; a autenticação própria permanece no código.
- Testes externos pelo gateway Supabase: três de três aprovados. Start POST,
  callback GET e setup POST retornaram HTTP 503, `setup_disabled`, `no-store`,
  sem redirecionamento e sem cookie OAuth. O único cookie observado foi o
  cookie de infraestrutura `__cf_bm`; seu valor não foi registrado.
- Consulta posterior confirmou zero estados pendentes e zero conexões OAuth.
  Os hashes dos bundles e as políticas JWT das cinco funções anteriores
  permaneceram iguais. A atualização global de configuração incrementou suas
  versões de execução; não houve mudança nos respectivos códigos.

## Registro da instalação inicial, com fluxo desabilitado

Código-fonte inicial: revisão `223cc4949dce4666a7ec513afe305b9a3b6146e7` do PR59.
A tabela registra a instalação original. O callback foi atualizado posteriormente
conforme a seção mais recente no início deste documento.

| Função | Versão | SHA-256 do bundle informado pelo Supabase |
| --- | --- | --- |
| `drive-oauth-start` | 1 | `12c5cc5f881143dc3d7e3eb1dabe349de124247613eee13d5371fd09f1c1bb91` |
| `drive-oauth-callback` | 1 | `b47e052ace40afe81399aa988100d64dfcaa55945f7d43a16162207d2954a0ea` |
| `drive-oauth-setup` | 1 | `afd087103d9eb56253790f79e4e10f6266f8acb29642144e0d13d6e0917090a3` |

## Ponto exato de retomada

Os três handlers já estão instalados; o callback corrigido é a versão 3. As
rotas continuam bloqueadas pelo comportamento externo. Na instalação inicial,
`BC_DRIVE_OAUTH_ENABLE_SETUP=false` e `BC_DRIVE_BACKUP_ENABLE_WRITES=false` foram
conferidos por digest no painel. O login daquela sessão expirou; a nova entrada
deve ser feita pelo titular de forma segura. Não reaplicar a migration nem
reinstalar as funções como primeira ação da próxima retomada.

A captura posterior de Fernando mostra o nome da chave Picker cadastrado, mas
ainda falta conferir a configuração atual pelo painel e validar seu uso real.
Conferir APIs, callback, origem e usuários de teste. Manter os dois controles
desativados durante essa preparação. Não enviar credenciais por conversa.

O Google Cloud Console retornou “Site Unavailable” neste navegador, inclusive
numa única recarga de conferência. Não houve login, mudança ou criação de chave
no Google. Reutilizar cliente OAuth existente; conferir APIs, origem/callback,
usuários de teste e chave pública Picker com restrições antes de habilitar setup.

A página ainda não foi publicada; usar o PR61 com somente seus quatro arquivos,
sem mesclar o PR59 inteiro. Não houve consentimento Google real ou upload.
O backend de backup não foi instalado.

## Instalação seguinte

Concluir a preparação Google/Picker. Publicar somente os quatro arquivos de
`gestao/configurar-drive/` quando os pré-requisitos estiverem conferidos; não
mesclar PR59 inteiro para isso. A autorização específica já recebida cobre esta
instalação de teste; não repetir a mesma pergunta genérica de aprovação.
A confirmação de consentimento será feita pelo titular no fluxo Google.
Depois, homologar conta/pastas e cookies hospedados, sem enviar documentos.

Ativar backups, transferir arquivos clínicos reais, ampliar destinos, agendar
execuções ou mesclar a principal continua exigindo a aprovação prevista de
Fernando e Mel. Nenhuma dessas ações foi executada.

## Limites menores e validação pendente

Sessão BC excepcionalmente longa pode exceder o cookie; validação anterior de
pastas é um registro histórico e pode permanecer marcada após uma reconferência
mal sucedida. Não usar esse indicador como prova atual de privacidade ou como
autorização para backups. A ativação futura exige reconferência de permissões.
Gateway, cookies reais, Picker, consentimento e criptografia Vault hospedada
ainda não foram homologados no fluxo habilitado. O bloqueio dos três endpoints
pelo gateway real foi aprovado; isso não valida um consentimento ou transferência.
Nenhum teste executado nesta retomada foi reprovado. Os testes de consentimento,
Picker e recuperação real seguem pendentes, sem serem contados como aprovados.
Logout não foi provado como revogação imediata de JWT.
