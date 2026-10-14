# BC Estética Avançada

Site institucional da **BC Estética Avançada — Beautiful Center**.

Projeto em produção no GitHub Pages, com identidade visual premium, apresentação dos tratamentos, resultados, protocolos, ambiente da clínica e pré-anamnese integrada ao próprio site.

## Publicação

Site oficial: https://bcesteticaavancada.github.io

Repositório principal: `bcesteticaavancada/bcesteticaavancada-alt`

## Arquitetura

### Frontend

- GitHub Pages
- HTML, CSS e JavaScript ES modules
- `styles.css` como base visual compartilhada
- `script.js` para navegação e componentes institucionais
- `agendamento/` para a pré-anamnese oficial da BC
- `admin/` para a área administrativa autenticada

### Backend da pré-anamnese

Projeto Supabase: `bc-estetica-pre-anamnese`

Responsabilidades do Supabase:

- Postgres para fichas e usuários administrativos
- Supabase Auth para acesso da área administrativa
- Storage privado para assinaturas e PDFs
- Edge Function `submit-pre-anamnese` para submissão pública validada
- Row Level Security (RLS) para bloquear leitura pública das fichas

A chave presente em `agendamento/js/config.js` é somente a chave **publicável** do projeto. Nunca colocar `service_role`, senhas administrativas ou outros segredos no repositório.

## Pré-anamnese

Fluxo oficial: `agendamento/index.html`.

Principais módulos:

- `agendamento/js/state.js` — estado e rascunho local
- `agendamento/js/validation.js` — validação
- `agendamento/js/conditional.js` — perguntas condicionais
- `agendamento/js/review.js` — revisão antes do envio
- `agendamento/js/signature.js` — assinatura touch/canvas
- `agendamento/js/api.js` — submissão, download e compartilhamento do PDF
- `agendamento/js/main.js` — orquestração do fluxo

O rascunho é salvo localmente durante o preenchimento. A ficha definitiva é enviada ao backend somente na finalização.

## PDF

A Edge Function gera o PDF institucional da ficha e o grava no bucket privado `pre-anamnese-pdfs`.

O PDF inclui identidade visual da BC, código da ficha, data, seções da pré-anamnese, consentimentos, assinatura do cliente/paciente e espaço para assinatura profissional. O acesso do paciente usa URL temporária assinada; a área administrativa também obtém URL assinada mediante sessão autorizada.

## Área administrativa

Rota: `/admin/`.

A tela exige autenticação pelo Supabase Auth e uma linha ativa correspondente em `public.admin_users`. Não existe senha fixa no HTML ou JavaScript.

Funções atuais:

- pesquisa por código, nome e período
- listagem por data mais recente
- abertura da ficha completa
- atualização de status (`recebida`, `em_avaliacao`, `avaliada`)
- abertura do PDF privado via URL assinada temporária

Para liberar uma pessoa no painel, primeiro crie/convide o usuário no Supabase Auth e depois registre o respectivo `user_id` em `public.admin_users`. Nunca versionar a senha.

## Banco e migrations

Migrations versionadas em `supabase/migrations/`.

Principais estruturas:

- `public.pre_anamneses`
- `public.admin_users`
- bucket privado `pre-anamnese-signatures`
- bucket privado `pre-anamnese-pdfs`

## Edge Function

Código: `supabase/functions/submit-pre-anamnese/`.

O endpoint recebe apenas a submissão final, valida e normaliza o payload, aplica idempotência por token, grava assinatura/ficha, gera o PDF e devolve somente metadados necessários à confirmação.

## Testes

Frontend:

```bash
npm run test:frontend
```

Edge Function:

```bash
deno test --config supabase/functions/submit-pre-anamnese/deno.json --allow-env --allow-net supabase/functions/submit-pre-anamnese/*_test.ts
```

A branch da pré-anamnese também possui CI em `.github/workflows/pre-anamnese-ci.yml`, que executa as duas suítes.

## Aplicativo instalável (PWA)

O site pode ser adicionado à tela inicial no Android e iPhone, preservando o acesso público e o login individual do BC Gestão. A página `instalar/` explica a instalação no Safari, Chrome e navegadores de computador compatíveis. O menu do site e a entrada do BC Gestão oferecem o link **Instalar app**.

- `manifest.webmanifest` define a identidade única, a abertura na página inicial, o escopo e os atalhos para navegadores compatíveis.
- Todas as páginas públicas e do BC Gestão apontam para o mesmo manifesto e para o ícone Apple. O diretório legado `admin/` permanece inalterado.
- `assets/app/` contém ícones PNG derivados da logo oficial existente; o ícone maskable mantém a marca dentro da área segura circular.
- `pwa-install.js` oferece o botão de instalação apenas quando o navegador disponibiliza `beforeinstallprompt`. No iPhone, a instalação usa o menu Compartilhar do Safari ou Chrome compatível.
- Navegação e ícones usam caminhos relativos ao manifesto. O identificador fixo `/bcesteticaavancada-alt/` distingue este app de outros sites da mesma conta GitHub Pages; não alterar esse ID após a instalação. A URL inicial fixa evita capturar parâmetros ou tokens de recuperação de senha.
- Esta versão requer internet. Não registra service worker nem cria cache offline de páginas, fichas, agenda, autenticação ou financeiro. A instalação não altera as regras de acesso existentes.
- Atualizações de conteúdo seguem a publicação normal do site. A primeira abertura do app pode exigir um novo login.

Verificação: `npm test`. A instalação final e o comportamento do sistema operacional devem ser conferidos em aparelhos reais; testes de JavaScript não simulam a interface nativa do iOS ou Android.

## Identidade visual

Logo padrão:

- `assets/logo-oficial/bc-logo-estetica-avancada-flutuante.webp`

A pré-anamnese e a área administrativa devem reutilizar a identidade BC e não parecer aplicativos externos ao site.

## Estrutura institucional principal

- `index.html` — página inicial
- `styles.css` — identidade visual e responsividade
- `script.js` — navegação e elementos compartilhados
- `procedimentos/` — Vídeos (endereço mantido)
- `resultados/` — resultados
- `protocolos/` — Protocolos 2.0: vitrine mobile-first com 7 temas visuais, 10 famílias compactas com detalhes acessíveis, seção premium Assinaturas BC e mídia progressiva; sem preços e sem carregar vídeo não aprovado
- `ambiente/` — ambiente da clínica
- `assets/portfolio/` — portfólio visual

## Dependências externas antigas

O Base44 não faz parte da arquitetura operacional da pré-anamnese nativa. Referências históricas podem permanecer em documentação de projeto, mas nenhuma rota pública do site deve depender do aplicativo externo para preencher, salvar ou gerar a ficha.
