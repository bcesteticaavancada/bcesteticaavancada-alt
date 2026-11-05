# BC Estética Avançada — Migração integral para domínio próprio (preparação)

Data da proposta: 28/10/2026. Estado: **PREPARAÇÃO / NÃO PUBLICAR**.
Responsável pela decisão de corte: administração da BC. Domínio REGISTRADO: `bcesteticaavancada.com.br` (comprovante do Registro.br apresentado em 28/10/2026; situação **Publicado**, expiração em **28/10/2027**). Titular informado no comprovante: **Maria Luísa Franco de Assis**. Registro não significa DNS apontado, HTTPS ativo nem migração concluída.

## Objetivo e fronteira

Publicar o site institucional, agenda pública, BC Gestão, área das colaboradoras, instalação PWA, Maya e páginas informativas de backup no domínio próprio sem recriar arquivos clínicos nem alterar permissões de pacientes. Preservar o Supabase e o Google Drive como serviços de dados privados. Aguardar homologação de rotas, verificação DNS e aprovação expressa antes de qualquer troca do endereço público.

**Este PR contém documentação, auditoria e código preparatório em branch**: não altera `main`, DNS, GitHub Pages, funções Supabase implantadas, OAuth, banco, usuários, dados clínicos, segredo ou backups. A continuação de frontend, PWA, SEO, suporte/convites e os resultados verificáveis estão em `docs/operacao/homologacao-dominio-bc-2026-10-28.md`.

## Arquitetura verificada no GitHub

- Aplicação completa: `bcesteticaavancada/bcesteticaavancada-alt`, branch `main`, GitHub Pages via `.github/workflows/pages.yml` (publicação por GitHub Actions a partir da raiz do repositório).
- Entrada histórica: `bcesteticaavancada/bcesteticaavancada.github.io`, `index.html` com redirecionamento para `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`.
- URL atual da aplicação: `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`.
- Objetivo de roteamento: `https://www.bcesteticaavancada.com.br/` para a aplicação; `https://bcesteticaavancada.com.br/` redirecionará para `www`, caso a configuração DNS/Pages seja homologada.
- Domínio já registrado em 28/10/2026; **não conectar a GitHub Pages, criar CNAME de produção ou alterar origens implantadas até o site e as integrações estarem preparados.**

## Inventário de dependências que exigem revisão no corte

| Área | Evidência no repositório | O que conferir |
|---|---|---|
| Entrada pública | `index.html`; páginas em `clinica/`, `equipe/`, `mel/`, `procedimentos/`, `protocolos/`, `resultados/`, `agendamento/`, `contato/` | Links relativos/absolutos, imagens, vídeo, fontes, menu, 404 e rotas |
| SEO | `index.html`, `sitemap.xml`, `robots.txt`, canônicos em páginas internas, `tests/site/seo.test.mjs` | Atualizar canônicos, Open Graph, JSON-LD, sitemap, Search Console sem perder o tráfego antigo |
| App instalado | `manifest.webmanifest` (`id: /bcesteticaavancada-alt/`), `instalar/` | Escopo, start_url, ícones, reinstalação do atalho e logout na troca de origem |
| Agenda/anamnese | `agendamento/js/config.js`, `supabase/functions/public-agenda/index.ts`, `supabase/functions/submit-pre-anamnese/index.ts` | Origens oficiais e CORS, submissão fictícia, consulta de horários, imagens/PDF |
| Funções clínicas | `supabase/functions/generate-clinical-pdf/index.ts`, `supabase/functions/generate-anamnese-pdf/index.ts` | CORS e geração autorizada de PDF fictício, sem exposição de Storage |
| Contas/equipe | `gestao/recuperar-senha/index.html`, `supabase/functions/client-support/handler.mjs`, `scripts/ops/staff-identity-maintenance/invite.mjs` | URLs de convite, redefinição de senha e lista de Redirect URLs no Supabase Auth |
| Backup/Drive | `backup/`, `backup/privacidade/`, `backup/termos/`, `gestao/configurar-drive/setup.js` | Branding Google OAuth, origens do Google Picker, callback em `*.supabase.co`, configuração privada existente |
| Testes/CI | `tests/site/`, `tests/gestao/`, `tests/anamnese/` e workflows GitHub | Atualizar expectativas antigas e homologar CI sem alterar dados reais |
| Raiz histórica | `bcesteticaavancada.github.io/index.html` (outro repositório) | Planejar redirecionamento dos acessos antigos e verificar comportamento após domínio personalizado |

A busca de código na branch `main` encontrou referências explícitas a `bcesteticaavancada.github.io` e `/bcesteticaavancada-alt/` em HTML, JavaScript, manifesto, funções Edge, SEO e testes. **Não basta configurar somente o DNS.**

## Etapas e gates

### G0 — Registro, sem alteração de produção
1. **CONCLUÍDO (comprovante apresentado pelo usuário):** `bcesteticaavancada.com.br` registrado e publicado no Registro.br em 28/10/2026; vence em 28/10/2027; titular Maria Luísa Franco de Assis.
2. **PENDENTE:** garantir e-mail de renovação/recuperação do painel e eventual renovação automática. Não guardar senha, token ou dados pessoais sensíveis no GitHub.
3. **DECISÃO DE PROJETO:** `www.bcesteticaavancada.com.br` como URL canônica; manter endereço sem `www` com redirecionamento pelo GitHub Pages após configuração.
4. **CONCLUÍDO:** propriedades verificadas por TXT no GitHub Pages da **conta bcesteticaavancada** e no Google Search Console, conforme capturas confirmadas na conversa. Preservar ambos os TXT. Essa verificação não publica o site. Veja `docs/operacao/dns-e-corte-dominio-bc-2026-10-28.md`.
5. **NÃO FAZER AGORA:** configurar domínio personalizado no repositório em produção, apontar CNAME/A ou modificar OAuth antes de ajustes e homologação do frontend e das funções.

### G1 — Preparação isolada e testes
1. Revisar ocorrências com `node scripts/auditar-dominio-bc.mjs` (arquivo neste PR); classificar URLs de navegação, backend, código operacional e testes.
2. Preparar alterações em branch separada, com variável/configuração central de origem quando viável; manter **origem antiga e nova** permitidas durante coexistência, sem ampliar a qualquer origem.
3. Atualizar URLs de página, links internos absolutos, PWA e SEO no ramo de teste. Não forçar link novo sobre usuários em produção antes do corte.
4. Preparar alterações CORS nas Edge Functions afetadas, com testes e revisão de segurança. Não realizar deploy de backend nesta etapa.
5. Preparar Redirect URLs adicionais no Supabase Auth sem remover os endereços legados antes da homologação.
6. Preservar PRs/branches paralelos; a migração não deve incorporar mudanças não aprovadas de TCLE, backup e Maya.

### G2 — Domínio e GitHub Pages
1. Confirmar verificação do domínio no GitHub por DNS TXT (sem misturar com verificação do Google Search Console, que é independente).
2. Em Settings > Pages **do repositório da aplicação** (`bcesteticaavancada-alt`), adicionar o domínio personalizado. Como a publicação é via GitHub Actions, não depender de um `CNAME` no artefato de deploy.
3. DNS: `www` com CNAME apontando para `bcesteticaavancada.github.io` **sem caminho de repositório**; apex com A/ALIAS conforme documentação oficial do GitHub Pages. Habilitar HTTPS depois da emissão do certificado.
4. Verificar DNS, HTTPS, homepage, rotas internas e ativos em ambiente de teste apropriado. A mudança de domínio no Pages pode alterar acesso dos links legados; documentar e testar o comportamento real antes de divulgar.

### G3 — Integrações e consentimento
1. Validar lista de origens permitidas nas funções Supabase e seus testes. Não enfraquecer autorização, RLS ou privado.
2. Atualizar `Site URL` e Redirect URLs no Supabase Auth **somente na janela de corte** e preservar redirecionamentos alternativos usados; validar e-mails, login, logout, recuperação e convites.
3. Google Cloud OAuth: atualizar página inicial, Privacidade, Termos, domínios autorizados e, se exigido, origens JavaScript. Preservar callback exato da Edge Function do Supabase; não inventar callback novo.
4. Search Console: verificar domínio próprio por DNS TXT, solicitar indexação das novas páginas e acompanhar eventuais alertas de marca. Aprovação OAuth não é automática.
5. Verificar o Google Picker e o fluxo de autorização das duas pastas privadas. Não pedir permissão abrangente do Drive e não tornar documentos públicos.

### G4 — Homologação com dados fictícios e aprovação
Matriz de testes obrigatória:
- Site institucional: Home, equipe, clínica, vídeos, procedimentos, preços quando aplicáveis, contato, menu, atalhos e URLs profundas.
- Android e iPhone: navegação e tela instalada/PWA; considerar que a troca de origem exige novo login/atalho e não transporta armazenamento local.
- Agenda: disponibilidade, reserva fictícia, bloqueios, conflitos e privacidade dos nomes.
- Gestão: login e logout, funções por papel, cadastro fictício, recuperação/convite, documentos e PDFs de teste.
- Maya: abrir no perfil permitido e conferir roteamento/ajuda sem ampliar escopo de produção.
- Drive: OAuth `drive.file`, seleção de destinos, verificação da privacidade, execução fictícia e restauração testada; sem dados reais de pacientes.
- SEO: HTTP 200, 404, canônicos, sitemap, robots, Open Graph, HTTPS, imagens e redirecionamentos antigos.
- CI: todos os workflows e testes afetados aprovados; revisão explícita da Mel das interfaces pertinentes.

**Gate de corte:** somente mudar `main`/GitHub Pages/DNS/OAuth/Supabase após registro, homologação e aprovação expressa. Não prometer zero downtime; reservar janela de publicação.

### G5 — Corte, monitoramento e reversão
1. Publicar mudanças já homologadas na sequência controlada: permitir nova origem no backend (preservando antiga), configurar DNS/Pages/HTTPS, trocar URLs de frontend e redirect, validar OAuth.
2. Conferir logs de erros, agenda, login e PDF/Drive; informar colaboradores de eventual novo login e nova instalação do atalho.
3. Preservar domínio GitHub de origem e acessos antigos quando tecnicamente possível. Corrigir links externos e QR/NFC.
4. Se falhar uma função crítica: suspender divulgação; retornar domínio no Pages/DNS, restaurar versão anterior do site, manter ambas origens temporariamente e revalidar URLs de autenticação. O rollback não apaga nem altera documentos.
5. Somente encerrar a transição depois da aprovação operacional da administração.

## Dependências externas e limitações

- Registro confirmado por capturas do Registro.br enviadas pelo usuário em 28/10/2026. DNS, certificado, URLs e serviços ainda não foram migrados. Não armazenar comprovantes com identificadores pessoais no repositório.
- DNS/Google Cloud/Supabase são configurações independentes; não são alteradas automaticamente por um commit GitHub.
- Permissão `drive.file` e backup já existente devem permanecer inalterados até nova homologação. Revisão de branding OAuth pelo Google não é garantida.
- A publicação pelo GitHub Pages por Actions ignora um arquivo `CNAME` do artefato; configurar o domínio em Settings > Pages.
- Trocar `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/` por `https://www.<dominio>/` muda **origem e caminho base**. Rotas absolutas, testes, CORS, Auth, manifesto e SEO requerem revisão.
- Nenhum dado clínico, financeiro, usuário ou pastas do Drive deve ser copiado ou exposto como parte da migração de domínio.

## Fontes técnicas

- [GitHub — domínio personalizado no GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub — domínios e caminhos de sites de projeto](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- [Supabase — redirect URLs de Auth](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google — verificação de marca OAuth e domínio](https://developers.google.com/identity/verification/authentication-policy-compliance)
- [Registro.br — registro de domínio .br](https://registro.br/dominio)
- [GitHub Pages — verificar domínio por TXT antes de usar](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
