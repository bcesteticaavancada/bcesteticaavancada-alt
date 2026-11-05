# Marco Search Console — aviso de boas-vindas e próxima fase SEO

**Registro no projeto:** 28/10/2026 (horário da BC, Belo Horizonte).
**Evidência:** captura de e-mail apresentada na conversa pelo administrador. **O cabeçalho de envio não está visível na captura**, portanto não presumir hora de entrega nem afirmar leitura dos relatórios.

## Evento confirmado pelo usuário

Chegou e-mail do Google com o assunto exibido **“Otimize a presença de bcesteticaavancada.com.br no Google”**. O corpo informa que os sistemas Google reconhecem a **verificação recente da propriedade no Search Console** e indicam primeiros passos, utilização dos relatórios e possibilidade de compartilhar acesso com equipe. É **um e-mail informativo de boas-vindas**: **não é aprovação do branding OAuth**, **não ativa o Drive**, **não prova que o site esteja publicado nesse domínio** nem significa indexação de todas as URLs.

A propriedade tipo **Domínio** `bcesteticaavancada.com.br` já foi verificada por registro DNS TXT, com tela de “Você é um proprietário verificado”. O GitHub Pages também verificou o mesmo domínio por TXT separado. **Ambos os TXT devem ser preservados no Registro.br.**

## Estado técnico da migração

- Endereço atual em produção: `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`.
- Endereço alvo: `https://www.bcesteticaavancada.com.br/`, quando DNS/Pages/HTTPS forem homologados e autorizados.
- PR #69: frontend, sitemap, robots, SEO canônico, PWA, CORS e convites preparados na branch; **não mesclado nem publicado**.
- Os testes automatizados no PR #69 foram informados como aprovados; ainda faltam testes do Auth hospedado, Google OAuth, Drive e aparelhos físicos.
- **Não enviar ainda** ao Search Console sitemap do domínio novo enquanto os URLs não responderem em produção; **não declarar mudança de endereço** antes de redirecionamentos e URLs reais.
- Na migração, manter mapeamento de URLs antigas→novas, redirecionar para as equivalentes e testar canônicos, imagens, status HTTP, páginas privacidade/termos, agenda, rotas profundas, robots e sitemap. Considerar restrições do provedor GitHub Pages para redirecionamentos.
- Após corte e verificação HTTPS/URLs: enviar `https://www.bcesteticaavancada.com.br/sitemap.xml` no Search Console, inspecionar amostra de páginas, acompanhar indexação e monitorar ambas as propriedades. Avaliar ferramenta “Mudança de endereço” do Search Console **somente se compatível com a propriedade URL-prefix do host compartilhado github.io**; não presumir elegibilidade.
- Evitar duas versões do site competindo na busca com conteúdo duplicado, priorizando URLs canônicos novos e redirecionamentos corretos.
- Atenção: Google Search Console **não substitui Google Cloud OAuth**. O projeto `BC Estética - Backup` continua dependente de branding/consentimento/URLs coerentes e testes específicos com `drive.file`.

## Colaboração segura com IA

- O ChatGPT não dispõe de um endereço de e-mail Google próprio para ser cadastrado como usuário no Search Console; não conceder “Proprietário” a um endereço desconhecido ou compartilhar senha.
- Usar uma integração de análises com autenticação OAuth autorizada pelo titular para permitir leitura dos dados da propriedade, **com escopo mínimo**. Uma integração elegível é Windsor.ai, que anuncia importação de dados do Google Search Console para análise em conversa; a instalação/conexão precisa ser aprovada pelo usuário e o suporte concreto deve ser verificado após conexão.
- Para humanos da equipe, no Search Console: **Configurações → Usuários e permissões → Adicionar usuário**, preferir **Usuário pleno/restrito** conforme necessidade; não conceder propriedade sem razão.

## Próxima etapa no PR #69 (não publicar)

1. Preparar plano de corte Search Console, com mapeamento URL antigas/novas e verificação de todas as páginas de entrada.
2. Adaptar OAuth do Drive em branch isolada da fonte existente, com retorno assinado e permitido às três origens, evitando redirecionamento aberto; homologar os testes de PKCE, state, CORS e callback.
3. Validar backend Auth, agenda, PDFs, Maya e Drive com dados fictícios e celulares físicos.
4. Autorização expressa da administração para merge/deploy e DNS; só então sitemap, monitoramento e eventual mudança de endereço.

**Não executar agora:** login ou convite a contas externas não autorizadas, publicação no site, redirecionamento do site antigo, troca de DNS, consentimento OAuth ou conexão do Drive em produção.

Fontes de referência:
- https://support.google.com/webmasters/answer/7687615?hl=pt-BR
- https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes?hl=pt-BR
