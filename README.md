# BC Estética Avançada

Site institucional da **BC Estética Avançada — Beautiful Center**.

## Publicação oficial

Site público: **https://bcesteticaavancada.github.io**

O repositório `bcesteticaavancada/bcesteticaavancada-alt` continua sendo a fonte principal do frontend publicado pelo GitHub Pages.

## Arquitetura

### Frontend

- HTML, CSS e JavaScript ES modules.
- GitHub Pages como hospedagem do site institucional.
- Pré-anamnese nativa em `agendamento/`.
- Rascunho local no navegador para reduzir perda de preenchimento em reload ou falha de rede.
- Assinatura em Canvas 2D com suporte a touch/pointer.
- Download e compartilhamento do PDF após finalização.

### Backend da pré-anamnese

Projeto Supabase: `bc-estetica-pre-anamnese`.

Componentes:

- Postgres com RLS ativa.
- Supabase Auth para a área administrativa.
- Storage privado para assinaturas e PDFs.
- Edge Function `submit-pre-anamnese` para validar, persistir e finalizar fichas.
- PDF institucional gerado no backend com `pdf-lib`.

A chave `service_role` nunca deve ser colocada no frontend ou no repositório.

## Fluxo da pré-anamnese

1. A pessoa preenche o formulário em `agendamento/`.
2. O progresso é salvo localmente durante o preenchimento.
3. A pessoa revisa as respostas, confirma os consentimentos e assina.
4. O navegador envia a ficha para a Edge Function `submit-pre-anamnese`.
5. A função valida o payload e usa `submissionToken` para impedir duplicação em retry/duplo toque.
6. A assinatura é salva no bucket privado `pre-anamnese-signatures`.
7. A ficha é registrada em `pre_anamneses`.
8. O PDF é gerado e salvo no bucket privado `pre-anamnese-pdfs`.
9. O paciente recebe código de ficha e URL assinada temporária para baixar ou compartilhar o documento.

O Base44 não faz parte da operação deste fluxo nativo.

## Área administrativa

Rota prevista: `/admin/`.

A área interna:

- exige login pelo Supabase Auth;
- confere autorização na tabela `admin_users`;
- respeita RLS no banco;
- permite localizar fichas por código, nome e intervalo de datas;
- permite abrir os dados completos da ficha;
- permite alterar somente o `status` do fluxo (`recebida`, `em_avaliacao`, `avaliada`);
- libera PDFs privados apenas por URL assinada temporária.

Não cadastrar senha ou credencial administrativa em HTML, JavaScript ou documentação versionada.

Para liberar uma conta administrativa, crie o usuário no Supabase Auth por um canal seguro e registre o respectivo `user_id` em `public.admin_users` com `active = true`.

## Arquivos principais

- `index.html` — página inicial.
- `styles.css` — sistema visual principal.
- `script.js` — navegação e elementos compartilhados do site.
- `agendamento/index.html` — estrutura da pré-anamnese.
- `agendamento/anamnese.css` — estilos específicos do formulário.
- `agendamento/js/` — estado, validação, condicionais, assinatura, API e finalização.
- `admin/` — área administrativa autenticada.
- `supabase/migrations/` — schema, RLS e privilégios.
- `supabase/functions/submit-pre-anamnese/` — backend de submissão e geração de PDF.
- `tests/anamnese/` — testes do frontend e das regras do painel.

## Configuração pública do Supabase

O frontend utiliza somente:

- URL pública do projeto Supabase;
- chave publishable/anon destinada ao navegador.

Esses valores ficam em `agendamento/js/config.js`.

Nunca adicionar `SUPABASE_SERVICE_ROLE_KEY` a esse arquivo.

## Testes

Frontend e regras JavaScript:

```bash
npm run test:frontend
```

Edge Function / Deno:

```bash
deno test supabase/functions/submit-pre-anamnese/*_test.ts
```

Antes de publicar uma alteração, verificar também:

- navegação mobile;
- restauração de rascunho;
- perguntas condicionais;
- assinatura touch;
- duplo toque no botão Finalizar;
- falha de rede e retry;
- geração/download/compartilhamento do PDF;
- login e negação de acesso no `/admin/`;
- leitura privada de ficha/PDF;
- menu, logo, WhatsApp e páginas institucionais do site.

## Identidade visual

Logo principal disponível em `assets/logo-oficial/`.

A pré-anamnese e o PDF devem permanecer visualmente integrados ao site da BC: tipografia, tons creme/escuros, dourado discreto, hierarquia limpa e experiência mobile-first.
