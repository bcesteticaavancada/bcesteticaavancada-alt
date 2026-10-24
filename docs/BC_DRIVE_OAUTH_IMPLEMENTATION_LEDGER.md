# Execução — plano: docs/superpowers/plans/2026-10-23-drive-oauth-preparacao.md

## Homologação da autorização concluída pelo titular

Consentimento real confirmado por metadados às 19:49:27 UTC, folders_ready=false.
Após selecionar as duas pastas e confirmar, Fernando enviou a captura de sucesso.
Consulta fresca retornou account=decolarbh@gmail.com, folders_ready=true e
updated_at=2026-10-24 19:51:28.690867+00. Nenhuma coluna de credencial foi lida.
Na versão instalada, ready depende da validação dos IDs e permissões pelo Google.

Etapa OAuth/Picker/duas pastas concluída. Não confundir com backup/restauração:
worker ausente, escrita false, nenhum arquivo enviado por este fluxo. Próxima
etapa é a preparação da ponte Vault/worker e de ensaio inteiramente fictício em
branch, respeitando a liberação específica antes de enviar qualquer arquivo.

## Entrada retomada — página publicada e setup habilitado

Fernando confirmou entrada manual no Supabase; observação fresca mostrou o
projeto correto e a chave Picker cadastrada. Digests do client ID e de false
nos dois controles conferidos. PR61 continha somente quatro arquivos, main não
havia avançado e Site/Pre-anamnese CI passaram. Integrado somente PR61 como
7110fb7, dentro da publicação restrita anteriormente autorizada; PR59 preservado.

Salvo somente setup=true e conferido seu digest. Writes=false permaneceu com o
mesmo digest. As oito funções conservaram hashes/JWT; a configuração global
incrementou somente versões de execução. Teste hospedado: start/setup sem sessão
403, callback sem cookie 303/failed para caminho correto e preflight exato 204.
Zero estados/conexões. Página publicada abriu com SDK e pedido de sessão BC;
nenhum módulo clínico foi carregado pela configuração isolada.

Google Console permanece indisponível neste navegador. O titular continuará o
consentimento pelo link publicado no seu Chrome, conforme preferência anterior.
Entrada do painel não substitui login do BC. Nenhum consentimento Google, arquivo
de cliente, token, backup/worker ou agendamento foi tratado como concluído.

## Continuidade de 24/10 — retorno e preparação isolada da página

Recuperados o link compartilhado e o checkout existente. A correção local
`fd1efdb` estava concluída, mas não enviada. Validação fresca: HTTP 13/13,
SQL 9/9, UI 6/6, suíte geral 784/784 e tipagem dos três entrypoints aprovadas.
Revisão independente read-only sem achados novos que impeçam instalação
desativada. Configuração pública da main conferida pelo conector após a revisão.

Correção salva remotamente como `3ce02b3`, com o mesmo conteúdo, sem alterar
outros trabalhos. CI 40125828849 aprovado, incluindo ensaio Chromium com mocks.
Callback atualizado para v3; os quatro arquivos recuperados do servidor são
idênticos ao payload revisado. Nenhuma outra função mudou de hash/versão/JWT.
As três rotas hospedadas permaneceram em setup_disabled; zero estados/conexões.

PR61 acrescenta somente quatro arquivos da página sobre main 5fdeef1; comparação
confirmou ausência de home, worker ou migrations. Continua em rascunho, sem merge.
O painel Supabase exige nova entrada segura do titular para conferir a chave
Picker cadastrada na captura e os controles. Consentimento/Picker reais seguem
pendentes; nenhum teste simulado é registrado como homologação de provedor.

Os limites conhecidos de cookie, indicador histórico de pastas e revogação após
logout permanecem documentados. Não foram ampliados escopos, destinos ou acesso.

Base remota: `ea84ee6b206a2f67e733d716b0fd90b01ce90ce2`, branch própria
`backup/drive-oauth-preparacao`. Checkout separado; alterações não commitadas de
outro trabalho em `09ae9550eef1` foram preservadas. Nenhum AGENTS.md encontrado.

Ruling: execução direta dos requisitos já autorizados, sem nova escolha genérica
de executor — Fernando pediu continuidade e operação pelo Roque — custo: decisões
de armazenamento/instalação precisam estar explícitas na entrega antes de deploy.

Ruling: usar Vault para refresh token, mantendo client secret nos Edge Secrets —
evitar copiar segredo adicional no celular e evitar PAT administrativo — custo:
uma migration privada nova e adaptação futura do worker antes da homologação.

Ruling: duas pastas, nunca quatro — instrução expressa atual é a autoridade —
custo: manifesto/raiz do rascunho antigo permanecem fora desta autorização.

Pre-flight 1→2: handlers consomem operações start/consume/save/read/status/ready;
RPC terá a mesma união de nomes e campos. 1→3: página envia somente sessão Auth,
ação e dois IDs; nunca refresh token. 2→3: status retorna só flags booleanas.

Pré-voo: PR #57 é de simplificação do app, não de backup. Não modificar esse PR.
Nenhum PR aberto foi encontrado para a branch de backup pela consulta específica.

Task 1: complete. RED módulo de handler ausente; GREEN 12 cenários HTTP com
WebCrypto real e fronteiras Google/Auth simuladas. Type-check dos três entrypoints
passou. Ajustada anotação de Uint8Array para ArrayBuffer no WebCrypto, sem cast
que ocultasse erro. Nenhum endpoint implantado.

Task 2: complete. RED migration ausente; GREEN nove testes PostgreSQL/PGlite de
grants, RLS/isolamento, state único/expirado, conta/cliente, Vault substituído na
fronteira e atualização sem duplicação. Migration gerada por CLI 2.121.0;
catálogo remoto consultado somente para assinaturas das funções Vault, sem tokens.

Task 3: complete. RED controlador ausente; GREEN cinco testes e ensaio de celular.
Revisão independente encontrou retorno cancelled/failed ignorado, inicialmente
Minor; regrade para Important pelo risco de exibir sucesso de configuração antiga
após tentativa falha. RED reproduziu mensagem incorreta; GREEN sexto teste após
passar status allowlisted à página. Nenhum status recebido é inserido como HTML.

Revisão independente: nenhuma falha Critical; Important confirmado na política
no-referrer da página, que fazia o POST real enviar Origin:null e ser negado.
Corrigido para strict-origin, mantendo validação de origem exata; CSP form-action
permite somente self, Supabase e Google Accounts para a cadeia necessária.
Ensaio de navegador passou o ciclo POST→Google fictício→callback→página→Picker→
confirmação. Primeira versão do ensaio com redirects sintéticos não era suficiente;
substituída por três hosts TLS locais e bloqueio de DNS externo. Captura visual de
390 px conferida e sem overflow; nada salvo em serviço externo.

Ruling: registrar limite de cookie para JWT excepcionalmente grande como Minor —
não trocar arquitetura de sessão durante a correção de navegação — custo:
homologação real precisa confirmar tamanho/suporte no Chrome Android hospedado.

Task 4: validações finais e PR em preparação. Suíte ampla anterior passou 783
testes; novo teste de retorno exige reexecução. Suite canônica de backup ficou
bloqueada pela resolução JSR indisponível, não por falha de regra. Resolver pacotes
npm automaticamente pelo Deno também estava bloqueado; testes OAuth usam assert
built-in do Node sem typecheck de testes, com typecheck separado do código servidor.

Task 4: final local checks complete. npm test: 69 frontend + 131 site + 584 gestão = 784 passed, zero failures. HTTP OAuth 12/12; SQL 9/9; UI controller 6/6 (included in gestão); Chromium TLS browser rehearsal passed after navigation corrections. Server entrypoints passed Deno check. SDK pinned 2.118.0 URL checked HTTP 200. Canonical legacy backup suite remains environment-blocked by JSR resolution, recorded in delivery docs. Review found no Critical; Important findings were corrected and checked; cookie-size Minor is documented.

Ruling: retain own branch and open a draft PR against backup/drive-paralelo-v1, matching the already-authorized preparation/review scope — no merge or production deployment — cost: activation requires a separate explicit release after review and hosted Google/Picker validation.

## Retomada de instalação restrita — 24/10/2026

A autorização específica de Fernando de 23/10 às 19:07 (Brasília) para instalar
somente a autorização de teste foi recuperada antes de agir. Revisão independente
aprovou a instalação com o fluxo desabilitado. Migration instalada como versão
`20261024043221`, com tabelas vazias/RLS e RPC restrita a service_role; o arquivo
foi renomeado para corresponder ao servidor. A nova conferência dos vínculos
confirmou Fernando em admin_criacao e Mel em admin, sem alterar permissões.

Fernando concluiu pessoalmente o login Supabase. O digest do controle de escritas
corresponde a false; salvo também o controle de setup=false e conferido seu
digest. Cliente OAuth público corresponde ao código; nenhum client secret foi
aberto. Implantados os três handlers v1 da revisão `223cc494` com verify_jwt=false
e autenticação própria. Três chamadas pelo gateway real retornaram 503
setup_disabled, no-store, sem redirects/cookie OAuth. Estado/conexão continuam
vazios. Os cinco bundles anteriores e suas políticas JWT permanecem iguais.

Nenhum código de aplicação mudou nesta retomada: somente documentação de estado.
27 testes da retomada anterior e seu CI passaram; três verificações externas
foram acrescentadas agora. Não repetir essas contagens como prova de Google real.
A chave Picker não existe no servidor; o Google Console segue como pendência de
acesso/configuração. Página não publicada, sem consentimento, uploads, worker,
agendamento ou merge. Detalhes e limites: BC_DRIVE_OAUTH_INSTALACAO_TESTE.md.
