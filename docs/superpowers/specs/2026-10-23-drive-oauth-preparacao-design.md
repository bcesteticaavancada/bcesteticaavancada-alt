# BC — autorização Google Drive em teste

Escopo autorizado por Fernando em 23/10/2026: preparar OAuth da conta
`decolarbh@gmail.com`, limitado às duas pastas privadas de backup, sem transferir
dados reais de clientes e sem ativar produção. Continuidade de implementação
delegada ao Roque; escolhas técnicas abaixo são decisões de implementação.

## Resultado esperado

Uma página administrativa separada permite autorizar o Google e selecionar as
duas pastas. O servidor valida a conta, a sessão, o retorno e as permissões.
A interface nunca recebe client secret nem refresh token. Nenhuma rota desse
fluxo lê Storage, tabelas clínicas, agenda ou financeiro, nem envia arquivos.

Pastas aceitas, sem raiz, manifestos ou mídia:

| Destino | ID |
| --- | --- |
| Documentos clínicos | `1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y` |
| Arquivos de clientes | `1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N` |

## Abordagem

Continuar com o cliente web já criado e o callback exato já registrado:
`https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-oauth-callback`.
O escopo é exclusivamente `https://www.googleapis.com/auth/drive.file`.
Picker dá acesso explícito a cada pasta; o backend aceita somente os dois IDs.

Alternativas consideradas: ferramenta local exigiria computador e outro cliente
OAuth; exibir refresh token para copiar repetiria a dificuldade e a exposição de
credenciais. Decisão técnica: persistência automática no Vault do Supabase,
criptografada e acessível por RPC somente a `service_role`. É uma adaptação do
rascunho antigo, que previa copiar o refresh token para Edge Secrets. Client ID
e client secret continuam nos Edge Secrets já preenchidos. O worker antigo não
será alterado ou implantado nesta fase; o uso futuro do token Vault pelo worker
é uma integração posterior explícita.

## Componentes e limites

- Página isolada `gestao/configurar-drive/`, sem link na home e sem carregamento
  dos módulos clínicos. Reutiliza somente a sessão de autenticação da conta
  autorizada, validada novamente no servidor.
- `drive-oauth-start`: POST por navegação/formulário, com sessão BC no corpo,
  origem HTTPS exata, usuário verificado e conta permitida. Define cookie
  criptografado HttpOnly/Secure/SameSite=Lax, válido por dez minutos, e redireciona
  ao Google com state aleatório e PKCE S256. Sem credenciais nos URLs de retorno.
- `drive-oauth-callback`: verifica cookie, state de uso único no banco, validade,
  sessão BC ainda válida, código e escopo. Troca código somente no servidor,
  verifica a conta via Drive about.get, salva no Vault e volta à página com um
  status fixo. Nenhum código, token, erro bruto ou dado de usuário em redirects.
- `drive-oauth-setup`: status, token temporário para Picker e validação de pastas,
  sempre com sessão BC, mesma origem e conta permitida. O token de acesso Picker
  existe apenas na memória da página; não é o refresh token.
- O cookie usa chave derivada do client secret com HKDF e propósito específico;
  rotação invalida autorizações em andamento. PKCE verifier e sessão BC ficam
  criptografados no cookie, nunca em query string, localStorage novo ou logs.
- Fluxos de uso único e metadados ficam em `private`, com RLS e nenhum acesso
  anon/authenticated. Segredos Vault não são retornados por RPCs de usuário.
- Permissões de pasta: proprietário e destinatários só podem ser as contas
  `decolarbh@gmail.com` e `mluisafdeassis@gmail.com`; bloquear grupos, domínios,
  público, lixeira, shared drives, falta de evidência ou falta de gravação.
- `BC_DRIVE_OAUTH_ENABLE_SETUP` precisa ser `true` e
  `BC_DRIVE_BACKUP_ENABLE_WRITES` precisa ser exatamente `false`. Ausência ou
  outra configuração bloqueia as rotas. Não modificar automaticamente flags.

## Validação e entrega

Testes de protocolo com criptografia real; testes HTTP com transporte Google e
Auth simulado; testes SQL locais de grants, consumo único e persistência; testes
da página com identidade e pastas fictícias. Sem acesso a arquivos reais.
Verificar a suíte existente e as regras de backup. Entregar branch e PR em
rascunho, documentação de instalação e pendências, sem merge/deploy/migration
no projeto ativo. A homologação Google/Picker real depende da aprovação para
instalar somente essa etapa e de uma chave pública Picker restrita à origem.

Aplicativo externo permanece em Testing; a autorização não será apresentada
como permanente. Renovação/revogação e testes de restauração pertencem à fase
de homologação do backup, não são alegados por testes simulados.
