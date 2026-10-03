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

## Identidade visual

Logo padrão:

- `assets/logo-oficial/bc-logo-estetica-avancada-flutuante.webp`

A pré-anamnese e a área administrativa devem reutilizar a identidade BC e não parecer aplicativos externos ao site.

## Estrutura institucional principal

- `index.html` — página inicial
- `styles.css` — identidade visual e responsividade
- `script.js` — navegação e elementos compartilhados
- `procedimentos/` — procedimentos
- `resultados/` — resultados
- `protocolos/` — protocolos
- `ambiente/` — ambiente da clínica
- `assets/portfolio/` — portfólio visual

## Dependências externas antigas

O Base44 não faz parte da arquitetura operacional da pré-anamnese nativa. Referências históricas podem permanecer em documentação de projeto, mas nenhuma rota pública do site deve depender do aplicativo externo para preencher, salvar ou gerar a ficha.
