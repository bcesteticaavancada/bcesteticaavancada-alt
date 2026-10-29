# Drive BC — correções dos três bloqueios

Estado: implementação em rascunho, sem deploy/merge ou alterações de Auth/DNS.
Base de implementação: PR 74, `2b539cef2e110409f9e5b92d92e061f724d5d158`.

## Contrato das correções

1. Status, Picker e inspeção de pastas funcionam com `BC_DRIVE_BACKUP_ENABLE_WRITES=true`, mantendo a autenticação, a allow-list e o kill switch de setup. Valores desconhecidos do flag continuam negados.
2. Erros de callback preservam a origem validada no cookie AES-GCM. Cookie inválido não escolhe destino. O destino de erro fica em variável por requisição, sem estado compartilhado entre callbacks concorrentes.
3. As sete áreas novas têm seleção explícita no Picker e inspeção de metadados/ACLs. A central é derivada do pai comum das duas pastas originais. Nome, pai, propriedade e privacidade são verificados no servidor. A pasta externa, grupos, domínio e compartilhamento anyone continuam recusados. Inspeção não habilita worker, exportação, sincronização nem cópia de arquivos.

As duas pastas originais e o roteamento do worker não foram modificados. A ampliação da cobertura de backup permanece uma entrega independente.

## Reconectar sem interromper o backup

O `save` legado redefine `folders_ready=false`. Por isso, o fluxo ativo não o reutiliza.

- A reconexão ativa exige opt-in separado: `BC_DRIVE_OAUTH_ENABLE_ACTIVE_RECONNECT=true`. O padrão é falso.
- O início exige conexão existente e pastas prontas. O cookie autentica também o hash da credencial que estava vigente.
- Após Google validar conta e escopo drive.file, a credencial candidata precisa acessar as duas pastas privadas originais.
- A RPC nova `bc_drive_oauth_rotate` só é executável por service_role. Ela bloqueia a mesma linha de controle usada para obter a lease do worker, recusa uma lease ativa e exige identidade, cliente e hash ainda iguais aos do início.
- Vault e timestamp são atualizados na mesma transação, preservando `folders_ready` e o controle do backup. Qualquer falha reverte a tentativa; não existe fallback para `save`.
- Se o worker estiver executando ou a conexão tiver mudado, a tentativa é recusada. Repetir após o worker terminar; não desabilitar o cron nem substituir uma credencial mais nova.
- Uma autorização iniciada com backup inativo não pode sobrescrever a conexão se o backup for habilitado enquanto a página Google estiver aberta.

## Arquivos e dependências

- `handler.ts` e `protocol.ts`: política, retorno por requisição e vínculo do handshake à credencial anterior.
- `central.ts`: catálogo e inspeção privada, sem persistência de destinos novos.
- `runtime.ts`: roteamento da RPC de rotação e opt-in independente.
- `20261029132944_bc_drive_oauth_safe_rotation.sql`: duas funções com grants explícitos; nenhuma tabela clínica/financeira, cron ou dado é alterado. Criada com Supabase CLI, não aplicada a produção.
- `gestao/configurar-drive/`: consulta com backup ativo e seleção da central/subpastas, com aviso de que não ativa cópias.
- Workflow OAuth cobre a base de backup e main, regressões Deno, UI, PostgreSQL descartável e ensaio TLS.

## Homologação

- Base Node anterior: 784 testes, todos aprovados.
- Após correções: 787 testes Node aprovados; 65 testes Deno de OAuth/backup aprovados; 37 verificações PostgreSQL/UI aprovadas, incluindo nove do arquivo novo de rotação. Esses grupos têm sobreposição de testes de UI e não devem ser somados como testes únicos.
- Entrypoints start/callback/setup passaram no `deno check`.
- Testes novos foram observados falhando antes da implementação, inclusive função de rotação ausente e interface ainda sem seleção da central.
- Fontes/fixtures e banco descartável não usam conta Google, token, conexão Supabase ou documento de paciente real. O Vault nos testes é simulado; sua criptografia real não é certificada pelo PGlite.
- O ensaio de navegador serve os arquivos reais e handlers em três hosts TLS locais e intercepta toda dependência externa. Ele não comprova login hospedado nem aparelho físico.
- Ensaio TLS aprovado nas três instalações: controles com backup ativo, central privada, reconexão e retorno de falha. Foi usado Chromium 153 por um executável temporário porque o download padrão do Playwright veio truncado; o CI usa seu instalador normal.
- Revisão independente não encontrou bloqueios críticos de segurança/arquitetura. A orientação de erro com reconexão desabilitada também ganhou regressão: não pede clicar em um botão indisponível.

## Aplicação futura, em janela autorizada

1. Revalidar o HEAD e o CI completo. Conferir identidade do projeto, funções/store instalados, saúde do backup e configuração Auth/Google sem imprimir segredos. Não realizar corte de domínio nesta entrega.
2. Manter o novo opt-in de reconexão falso. Aplicar somente a migration de rotação revisada depois das migrations OAuth/backup existentes; não executar reset/push indiscriminado de todas as migrations desta branch.
3. Implantar conjuntamente start, callback e setup do mesmo commit. Preservar callback Supabase, client ID, conta, scopes, pastas, RLS, cron, Site URL e DNS. O kill switch de setup deve ser habilitado somente na configuração autorizada.
4. Homologar status, Picker, CORS, rejeições e inspeção de metadados em sessão administrativa. Conferir que os registros do backup seguem avançando; nenhum PDF real precisa ser aberto ou copiado para esse teste.
5. Somente após validar RPC e continuidade, autorizar explicitamente o opt-in da reconexão ativa. A proprietária faz o consentimento interativo Google. Validar troca, privacidade, renovação do access token e execução posterior do cron.
6. Testar Android/iPhone físicos e Google Production/Testing antes de encerrar a homologação. Modo OAuth, Auth hospedado e recuperação integral de banco continuam gates independentes; esta correção não os declara aprovados.
7. Para interromper novas reconexões, desligar apenas o opt-in novo. Não restaurar banco, revogar tokens ou desabilitar o backup como reversão automática. Funções de rotação não precisam ser removidas às pressas.

Nenhuma dessas etapas de produção foi executada neste desenvolvimento. O deploy precisa respeitar a restrição anterior do usuário de não publicar alterações até autorização específica.
