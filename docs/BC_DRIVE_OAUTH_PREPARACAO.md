# BC Estética Avançada — preparação OAuth Google Drive (homologação)

**Status em 23/10/2026:** somente preparação técnica. OAuth NÃO autorizado junto ao Google, credenciais NÃO criadas, função NÃO implantada, uploads NÃO habilitados. Nenhum arquivo clínico real foi lido ou enviado.

## Escopo aprovado pelo responsável

- Conta Google proprietária das pastas privadas de backup: conferir no Google Cloud Console e autorizar presencialmente com o titular.
- Destinos: somente `01_Anamneses_e_Documentos_Clinicos` e `02_Arquivos_de_Clientes`, sob a raiz privada identificada em [BC_DRIVE_BACKUP_V1.md](./BC_DRIVE_BACKUP_V1.md).
- Usuários autorizados para compartilhar essas pastas: somente proprietário e Mel. Guardar e-mails permitidos no secret `BC_DRIVE_ALLOWED_ACCOUNTS`, nunca no frontend.
- Escopo OAuth de menor privilégio: `https://www.googleapis.com/auth/drive.file`. **Não solicitar** `drive` amplo, `drive.readonly` amplo, Gmail ou permissões financeiras.
- **Proibido nesta fase:** transferir arquivos de clientes, gerar token de produção, criar agenda automática, ativar `BC_DRIVE_BACKUP_ENABLE_WRITES=true`, mesclar branch ou alterar o site.

## Estado confirmado antes do OAuth

- Os dois destinos são filhos da raiz privada e, na checagem de 23/10, só possuem permissões para duas contas individuais: proprietário e Mel. Não consta permissão `anyone` ou de domínio.
- A função em `supabase/functions/drive-backup` mantém o bloqueio de escrita por padrão, autenticação exclusiva de servidor, destinos classificados e verificação de compartilhamento antes dos uploads.
- O banco Supabase é a origem principal. A V1 do Drive cobre apenas arquivos do bucket privado; linhas que existam somente no PostgreSQL requerem outro plano de backup.
- A conexão Google Drive do ChatGPT **não** pode ser reutilizada como autorização do aplicativo.
- O Google Cloud Console não pôde ser acessado pelo navegador automatizado desta revisão. Nenhuma credencial foi criada ou capturada.

## Roteiro de preparação na conta proprietária (pendente de autorização no próprio Google)

1. No Google Cloud Console, selecionar um projeto de propriedade da BC ou criar um projeto dedicado `bc-estetica-backup`, sem configuração de faturamento desnecessária. Conferir conta Google ativa antes de qualquer alteração.
2. Ativar **Google Drive API** no projeto. Se for usar o seletor para autorizar pastas já existentes, verificar necessidade da **Google Picker API**.
3. Em **Google Auth Platform**, configurar Branding, Audience e Data Access com nome interno claro, e somente o escopo `drive.file`. Enquanto em teste, limitar o usuário de teste à conta proprietária.
4. Projetar um callback HTTPS **servidor-servidor**, com `state` e PKCE e origem controlada. Não redirecionar código OAuth para o GitHub Pages público nem inserir client secret em HTML/JS. Não criar cliente OAuth antes de definir e revisar esse callback.
5. Criar cliente OAuth apropriado somente após confirmação pontual. Solicitar acesso offline de forma explícita. Trocar o código por tokens no backend; registrar refresh token apenas em cofres de segredos, nunca em arquivos ou conversas.
6. Autorizar explicitamente os **dois diretórios** pelo seletor do Google Drive (ou criar diretórios do próprio app sob controle da BC, caso a permissão a pastas existentes não funcione). Não supor que possuir `drive.file` permite listar todas as pastas privadas.
7. Verificar o `scope` efetivamente concedido, acesso a arquivos criados pela própria integração, permissões das pastas, e capacidade de revogar o acesso.
8. Conferir a política de vida útil do refresh token. **Apps externos em Testing costumam ter refresh tokens de sete dias** para escopos além do perfil básico; não declarar backup permanente nessa condição.

## Secrets previstos (valores nunca no GitHub)

| Nome | Finalidade |
| --- | --- |
| `BC_DRIVE_CLIENT_ID` | ID do cliente OAuth do aplicativo |
| `BC_DRIVE_CLIENT_SECRET` | Secret OAuth somente no backend |
| `BC_DRIVE_REFRESH_TOKEN` | Token de atualização somente no servidor |
| `BC_DRIVE_FOLDER_CLINICAL` | ID exato da pasta clínica autorizada |
| `BC_DRIVE_FOLDER_CLIENT` | ID exato da pasta de arquivos autorizada |
| `BC_DRIVE_ALLOWED_ACCOUNTS` | Lista fechada de contas permitidas, separadas por vírgula |
| `BC_DRIVE_BACKUP_RUN_SECRET` | Segredo do acionador interno, mínimo 32 caracteres |
| `BC_DRIVE_BACKUP_ENABLE_WRITES` | Manter `false` durante preparação e testes sem upload |

**Não registrar valores reais dos secrets** em Actions, issues, PR, chat ou README. Guardar exclusivamente no cofre do ambiente de execução autorizado, com acesso auditado.

## Critérios de homologação para liberar um teste futuro

- [ ] Conta do Google confirmada, acesso exclusivo do proprietário/Mel revisto.
- [ ] Projeto, permissões e callback OAuth revisados.
- [ ] Credenciais criadas com confirmação no ato e armazenadas com segurança.
- [ ] Pastas selecionadas explicitamente e permissões conferidas.
- [ ] Teste negativo: sem autorização, chamada não consegue ler/escrever no Drive.
- [ ] Teste fictício: upload, download, SHA-256, repetição sem duplicação.
- [ ] Teste fictício: alteração produz nova versão sem sobrescrever a anterior.
- [ ] Teste de falha de token/permissão/rede sem expor dados ou corromper arquivos.
- [ ] Plano de revogação, alertas, capacidade e restauração documentados.
- [ ] Aprovação final de Fernando e Mel antes de qualquer produção ou arquivo real.

## Links oficiais de referência

- [Google Drive — escolher escopos da API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google OAuth — aplicação web, consentimento e refresh token](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Workspace — configurar consentimento OAuth](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Google Picker API](https://developers.google.com/workspace/drive/picker/guides/overview)
- [Supabase — segredos de Edge Functions](https://supabase.com/docs/guides/functions/secrets)

**Ponto de retomada:** acesso ao Google Cloud Console pelo titular, escolha de projeto e desenho do callback seguro; parar antes de criar chaves/acesso persistente para confirmação no momento.
