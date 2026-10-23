# OAuth Google Drive — avanço isolado de homologação

Data: 23/10/2026. Branch: `backup/drive-paralelo-v1`.

## O que foi preparado

- `supabase/functions/drive-backup/oauth_core.ts` gera estado aleatório e verificador PKCE S256, com expiração nominal de 5 minutos e hash do estado para armazenamento privado futuro.
- Monta URL de consentimento com `drive.file` exclusivamente, `access_type=offline`, seleção explícita da conta Google e callback HTTPS fixo do projeto.
- Valida origem/caminho do callback, estado, expiração, duplicação de parâmetros, erros do Google e tentativa de ampliação de escopo.
- `oauth_core_test.ts` usa dados fictícios e não realiza requisições à Google API. Adicionado à suíte CI.

**Não há endpoint de login/callback implantado, nem refresh token obtido ou armazenado.** O módulo ainda não é importado pelo worker em produção, pelo site ou pela Maya.

## Falta implementar antes de autorizar qualquer conexão

1. Definir identidade de acesso à tela administrativa reservada: Fernando e Mel devem ser reconhecidos por IDs de sessão do Supabase, sem presumir que o login `decolarbh@gmail.com` é exclusivo de Fernando. O acesso financeiro permanece separado.
2. Implementar armazenamento privado do desafio com hash de estado, verificador PKCE e associação ao usuário/sessão, prazo curto e consumo **atômico de uso único**. Um token de callback jamais pode ser aceito duas vezes; não usar memória da Edge Function como banco.
3. Criar `drive-oauth-start` (sessão Supabase autenticada, autorização explícita, sem dados sensíveis no HTML) e `drive-oauth-callback` (redirecionamento público do Google, estado consumido previamente, troca de código exclusivamente no servidor).
4. Projetar guarda segura do **refresh token**, protegido no servidor com mecanismo de rotação/revogação. Não enviar JSON OAuth, client secret, refresh token ou token de acesso em chats, commits, screenshots ou navegadores públicos.
5. Permitir acesso pelo Google Picker às **quatro pastas** necessárias: raiz, documentos clínicos, arquivos de clientes e manifestos. `drive.file` não cria, sozinho, um bloqueio de autorização por ID de pasta; o servidor deve validar os destinos a cada envio.
6. Validar a chave/segredo atual do cliente OAuth no Google Cloud sem copiá-los para relatórios. Se uma credencial foi mostrada em screenshot ou conversa, revogá-la/rotacioná-la antes de utilizar.
7. Testar o callback, falha de consentimento, alteração de `state`, expiração, segunda tentativa, escopo ampliado, conta errada e interrupção durante a troca. Usar dados inteiramente fictícios, sem acionador automático.
8. Somente depois pedir aprovação específica para implantação experimental. Produção e transferência real continuam expressamente bloqueadas.

## Configuração já conhecida

- Projeto Supabase: `tpqsmerlxquyrzrjbogj`
- Redirecionamento OAuth exato: `https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-oauth-callback`
- Origem do site público, `https://bcesteticaavancada.github.io`, não recebe tokens ou credenciais.
- Conta Google prevista: `decolarbh@gmail.com`; Mel é a segunda destinatária autorizada das pastas.

A preparação é reversível e não publica nada. Conferir a situação real do cliente OAuth antes da próxima alteração na configuração Google.
