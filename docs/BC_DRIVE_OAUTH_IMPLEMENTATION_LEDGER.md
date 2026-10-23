# Execução — plano: docs/superpowers/plans/2026-10-23-drive-oauth-preparacao.md

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
