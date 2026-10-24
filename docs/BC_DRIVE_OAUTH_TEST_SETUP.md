# BC — OAuth de teste, rascunho pronto para revisão

Atualização mais recente de 24/10: o retorno ao caminho publicado foi corrigido
e instalado somente no callback, versão 3, mantendo as rotas bloqueadas.
Passaram 13 testes HTTP, 9 SQL, 6 de interface, 784 gerais e o CI `40125828849`,
incluindo navegador com serviços fictícios. A página isolada está preparada no
PR61, ainda sem publicação. A captura posterior de Fernando mostra a chave
Picker cadastrada; a conferência atual no painel está bloqueada pelo login.
Consultar o estado detalhado em `BC_DRIVE_OAUTH_INSTALACAO_TESTE.md` antes de agir.

Esta branch prepara somente autorização/seleção de duas pastas. Não é backup
ativo. Atualização em 24/10/2026: a migration privada foi instalada após a
autorização específica de Fernando, com ACL/RLS conferidas e tabelas vazias.
As três funções foram instaladas com setup e escritas explicitamente desativados,
e os três endpoints recusaram chamadas pelo gateway real conforme esperado.
A página ainda não foi publicada; consentimento Google real,
acesso a documentos de clientes e uploads não ocorreram. Ver estado e bloqueios
em `BC_DRIVE_OAUTH_INSTALACAO_TESTE.md`.

## Já informado pelo usuário

Os Edge Secrets `BC_DRIVE_CLIENT_ID` e `BC_DRIVE_CLIENT_SECRET` foram cadastrados
pelo próprio Fernando; o valor do secret novo não foi compartilhado. Na retomada
de 24/10, os digests do cliente público e de `BC_DRIVE_BACKUP_ENABLE_WRITES=false`
foram conferidos sem revelar valores secretos. Foi salvo também
`BC_DRIVE_OAUTH_ENABLE_SETUP=false`. Isso valida os dois controles e o cliente
público esperado, mas ainda não comprova autenticação Google válida.

## Entrega

- Página separada `gestao/configurar-drive/`, sem modificar home/menu.
- Três funções: `drive-oauth-start`, `drive-oauth-callback`, `drive-oauth-setup`.
- Migration aditiva `20261024043221_bc_drive_oauth_test_setup.sql`: duas tabelas
  privadas e RPC limitada a `service_role`; nenhum acesso anon/authenticated.
- Cookie criptografado e state de uso único, PKCE S256, sessão BC revalidada,
  conta Google exata, escopo único `drive.file`, retornos sem tokens/códigos.
- Refresh token salvo automaticamente no Vault, criptografado pelo serviço.
  **Decisão técnica nova:** não será necessário copiar esse token para Edge
  Secrets. O worker antigo, que espera `BC_DRIVE_REFRESH_TOKEN`, fica inalterado
  e ainda precisará de adaptação/revisão antes de qualquer homologação de backup.
- Token temporário do Picker só na memória da página, retornado apenas após
  autenticação e validação de origem. Client secret/refresh token não chegam ao JS.
- Picker mostra somente a pasta esperada e o servidor valida os dois IDs e
  compartilhamento. Não solicita raiz, manifestos ou mídias.

## Instalação restrita — aprovação recebida, pré-requisitos técnicos pendentes

Fernando autorizou especificamente instalar somente esta autorização de teste
em 23/10/2026 às 19:07 (Brasília). Essa autorização não libera backups, dados
clínicos ou merge de toda a branch. Não pedir a mesma aprovação novamente.

1. Conferir Drive API e Google Picker API habilitadas no projeto Google escolhido.
2. Manter OAuth External/Testing e `decolarbh@gmail.com` como usuário de teste.
3. Conferir callback exato:
   `https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-oauth-callback`.
4. Na origem JavaScript do cliente, registrar
   `https://bcesteticaavancada.github.io`, sem caminho nem barra final.
5. Criar chave **pública de navegador** para Picker, restrita à API Google Picker
   e ao HTTP referrer `https://bcesteticaavancada.github.io/*`. Ela precisa pertencer
   ao mesmo projeto do cliente (`530925228983`). Não usar service account ou PAT.
6. Guardar essa chave em `BC_DRIVE_PICKER_API_KEY`. Só depois da liberação, usar
   `BC_DRIVE_OAUTH_ENABLE_SETUP=true`; manter `BC_DRIVE_BACKUP_ENABLE_WRITES=false`.
7. Migration desta entrega já aplicada como versão `20261024043221`; não reaplicar
   no projeto ativo. Em ambiente novo, usar somente esta migration e rollback revisado;
   não aplicar indiscriminadamente migrations pendentes de outras branches.
8. Implantar somente as três funções, com configuração JWT declarada no arquivo
   `supabase/config.toml`; handlers fazem a autenticação/CSRF necessária.
9. Publicar somente a página e seus três arquivos auxiliares e validar a entrada
   BC/Google no próprio aparelho. Não fazer merge de toda a branch de backup
   como atalho para publicar a página.

A migration do item 7 e a instalação desabilitada do item 8 foram executadas e
validadas. Chave Picker, demais configurações Google, publicação da página e
fluxo habilitado ainda precisam de conferência. Habilitar APIs ou
criar chave pode exigir ação no navegador Google Cloud do usuário. Nenhum segredo
deve ser enviado por conversa.

## Homologação real da autorização (depois da liberação)

Entrar no BC Gestão como a conta autorizada, abrir a página separada, tocar em
Continuar com Google, confirmar a conta e selecionar uma pasta por vez. A tela
mostra confirmação somente após verificação no servidor. Testar cancelamento,
nova tentativa e configuração desabilitada. Conferir headers de cookie e
comportamento no Chrome Android; esses detalhes dependem do gateway hospedado.
Nenhum arquivo precisa ser aberto ou enviado para homologar a autorização.

O escopo `drive.file` autoriza itens escolhidos/criados com o aplicativo; o código
restringe esta integração aos dois IDs. Selecionar uma pasta não deve ser tratado
como permissão irrestrita para todos os itens antigos que ela contém.

## Testes reproduzíveis

```sh
npm ci
node --test scripts/test-drive-oauth-db.mjs
node --test tests/gestao/drive-oauth-setup.test.mjs
deno test --no-check --no-remote supabase/functions/_shared/drive-oauth/handler_test.ts
deno check supabase/functions/drive-oauth-start/index.ts supabase/functions/drive-oauth-callback/index.ts supabase/functions/drive-oauth-setup/index.ts
deno test supabase/functions/drive-backup/core_test.ts
npm test
npx playwright install chromium
node --experimental-transform-types scripts/test-drive-oauth-browser.mjs
```

Os testes HTTP usam requests reais e criptografia WebCrypto real, com respostas
Google/Auth simuladas. O teste SQL usa PostgreSQL efêmero PGlite e simula apenas
as funções Vault: valida grants/estado, mas não a criptografia do Vault hospedado.
Não são prova de consentimento, permissões Google reais ou backup/restauração.

O ensaio de navegador usa três hosts HTTPS locais, certificado efêmero e DNS
externo bloqueado. Executa a navegação POST, redirects, cookie Secure/SameSite,
PKCE e seleção das duas pastas com serviços fictícios. O layout de 390 px foi
conferido sem overflow. O bundle público Supabase JS 2.118.0 retornou HTTP 200.

Validação local desta entrega: 12 testes HTTP, 9 testes SQL e 6 testes de interface
passaram; o ensaio Chromium completo passou. A suíte ampla `npm test` também
passou (resultado atualizado no ledger). A execução canônica da suíte antiga
`drive-backup/core_test.ts` ficou bloqueada pela indisponibilidade de resolução
do pacote JSR `@std/assert` neste executor; o worker não foi alterado.

Limite conhecido menor: sessões BC excepcionalmente grandes podem ultrapassar
o limite de cookie do navegador. A sessão é aceita até 3000 caracteres antes da
cifragem; não considerar esse limite como garantia de compatibilidade de cookie.
Validar com a sessão real na homologação e planejar armazenamento de sessão no
servidor se necessário. Nenhuma credencial real foi lida para medir seu tamanho.

## Desligamento/rollback

Desabilitar `BC_DRIVE_OAUTH_ENABLE_SETUP`, retirar a página e interromper/remover
somente as três funções desta fase. Isso não ativa backups nem altera documentos.
Não apagar o secret Vault como medida rotineira: revogação da autorização Google
e remoção da credencial exigem decisão explícita. Não apagar tabelas/dados para
um rollback de interface; uma migration reversa deverá ser revisada à parte.

Aplicativos OAuth externos em Testing podem receber refresh tokens com validade
de sete dias. Não prometer operação contínua enquanto estiverem nesse estágio.

Fontes primárias: [OAuth web](https://developers.google.com/identity/protocols/oauth2/web-server),
[escopos Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[Picker](https://developers.google.com/workspace/drive/picker/guides/overview),
[Vault](https://supabase.com/docs/guides/database/vault).
