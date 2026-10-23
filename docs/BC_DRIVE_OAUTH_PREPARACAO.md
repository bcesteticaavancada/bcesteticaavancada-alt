# Google OAuth — preparação da próxima etapa

Data: 23/10/2026. Status: especificação e validações do worker prontas. Callback e Picker não implementados nesta branch; nenhum token real obtido ou configurado por esta revisão. A configuração Google Cloud iniciada em outra etapa precisa ser conferida e reutilizada, quando válida.

## Decisão técnica

Usar OAuth de aplicação web com autorização da conta `decolarbh@gmail.com` e somente o escopo `https://www.googleapis.com/auth/drive.file`. O worker rejeita tokens com escopo diferente ou mais amplo. A conexão Drive do ChatGPT não fornece credenciais para este aplicativo.

As pastas existentes precisam ser selecionadas explicitamente com Google Picker usando o mesmo projeto OAuth. Selecionar somente a raiz não deve ser tratado como autorização comprovada das subpastas: selecionar e validar cada uma das quatro pastas usadas pelo worker. Não alterar permissões para tornar a integração acessível. A pasta `03_Site_Maya_e_Midias` fica fora deste worker.

## Roteiro a implementar em ambiente reservado

1. Conferir o projeto Google Cloud e cliente que já tenham sido criados pela clínica; reutilizá-los após validar conta, estado e configuração. Se necessário, completar Drive API, Picker API e tela de consentimento. Não há compra ou cobrança autorizada nesta revisão.
2. Conferir ou registrar cliente OAuth do tipo aplicação web, origem HTTPS da interface administrativa reservada e callback HTTPS exato. Essa interface não será adicionada à página inicial da BC. Definir os endereços antes de registrar o cliente; não usar curingas.
3. Restringir a abertura do fluxo à pessoa autorizada, confirmar a conta Google escolhida e usar authorization code, `access_type=offline`, proteção `state` vinculada à sessão e uso único. O callback deverá validar sessão, `state`, expiração e os escopos concedidos. Implementar PKCE conforme a biblioteca/fluxo adotado. Não construir autorização manual sem revisão.
4. Selecionar as quatro pastas pelo Picker. Quando um token temporário for necessário ao Picker, restringir seu uso à página administrativa, manter somente em memória e não persistir em logs/localStorage. O refresh token e o client secret ficam exclusivamente no servidor. Validar os IDs e executar a verificação privada do worker antes do primeiro envio.
5. Fazer a troca do código no servidor e registrar refresh token/client secret diretamente no gerenciador de secrets do Supabase. Nunca passar esses valores por chat, issue, commit, JavaScript público, relatório ou GitHub Actions.
6. Implantação da função e de eventual callback somente depois de autorização específica. Não implantar o worker com fluxos clínicos habilitados. O gateway Supabase precisa ter uma decisão explícita de autenticação: se for desativada a validação JWT do gateway para o acionador interno, manter obrigatoriamente o segredo forte do worker e acesso apenas pelo servidor; não adicionar uma chamada pelo navegador. Esta revisão não alterou `supabase/config.toml`.
7. Homologar manualmente uma única execução por vez, com namespace fictício e uploads inicialmente desligados; seguir o roteiro em `BC_DRIVE_BACKUP_V1.md`. Nenhum agendamento nesta etapa.

## Configuração de servidor planejada

| Nome | Uso |
| --- | --- |
| `BC_DRIVE_BACKUP_RUN_SECRET` | Segredo aleatório de pelo menos 32 caracteres; cabeçalho interno `x-bc-backup-secret` |
| `BC_DRIVE_BACKUP_SCOPE` | Apenas `test` é aceito; qualquer outro valor bloqueia a execução |
| `BC_DRIVE_BACKUP_ENABLE_WRITES` | `false` por padrão; `true` permite somente arquivos fictícios |
| `BC_DRIVE_ALLOWED_ACCOUNTS` | Allowlist fechada de servidor com a conta proprietária e a conta da Mel, conforme metadados reconferidos; não concede compartilhamento |
| `BC_DRIVE_CLIENT_ID` | Identificador do cliente próprio |
| `BC_DRIVE_CLIENT_SECRET` | Segredo do cliente próprio |
| `BC_DRIVE_REFRESH_TOKEN` | Token de renovação da conta autorizada |
| `BC_DRIVE_FOLDER_ROOT` | `1Ax1FUrgxpBdgHgBTsriMtQGYK37GMK_y` |
| `BC_DRIVE_FOLDER_CLINICAL` | `1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y` |
| `BC_DRIVE_FOLDER_CLIENT` | `1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N` |
| `BC_DRIVE_FOLDER_MANIFEST` | `1s7LTdxb24dDYpzdHThKIEAEFdwwvmfjh` |
| `SUPABASE_URL` | URL exata do projeto `tpqsmerlxquyrzrjbogj` |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial de servidor existente; nunca no frontend |

Estes são nomes/IDs, sem valores de credenciais. Nenhuma variável real foi configurada nesta revisão.

## Pontos que dependem da autorização real

- Consentimento da conta correta e acesso efetivo `drive.file` às quatro pastas. A verificação feita pela conexão ChatGPT não comprova acesso do novo cliente OAuth.
- Disponibilidade dos campos `permissions`, proprietário, parentesco e checksum para o token real. Ausência de evidência bloqueia o worker; não afrouxar verificações para contornar uma falha.
- Renovação e revogação dos tokens. Aplicações externas em status Testing podem receber refresh tokens que expiram em sete dias, conforme as condições documentadas pelo Google; avaliar configuração definitiva antes de prometer continuidade.
- Monitoramento de revogação/expiração, rotação de secrets e alertas restritos a contadores/códigos técnicos, sem dados clínicos. Não há alertas ativos.
- Os metadados atuais das quatro pastas mostram o proprietário e a conta individual da Mel; a allowlist aceita somente essas duas contas. Segundo o handoff, Fernando e Mel também utilizam a conta proprietária. Essa situação não modifica os papéis do aplicativo. O worker não lê tabelas financeiras; a política financeira do aplicativo continua intacta.

## Fontes primárias consultadas

- [Google: escopos da API Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
- [Google: OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server).
- [Google: validade e revogação de tokens](https://developers.google.com/identity/protocols/oauth2#expiration).
- [Google: seleção de pastas com Picker](https://developers.google.com/workspace/drive/picker/guides/overview).

A preparação OAuth já foi autorizada por Fernando. Isso não exige nova confirmação genérica. Permanecem necessários o consentimento no próprio Google para os destinos efetivos (incluindo raiz e manifestos), a configuração segura de secrets e a aprovação específica para implantação/teste real; produção clínica e agendamento exigem aprovação final de Fernando e Mel.
