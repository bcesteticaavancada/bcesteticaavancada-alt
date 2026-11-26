# Homologação SEO — BC Estética Avançada

Escopo: somente branch de revisão. Não fazer merge, deploy, alterar DNS, banco, OAuth ou enviar URLs para indexação sem autorização. CNAME e robots.txt atuais preservados.

## Evidência e decisão
Em 26/11/2026, inspeção Search Console das 14 URLs então no sitemap: 3 indexadas, 8 detectadas não indexadas, 1 rastreada não indexada, 1 desconhecida e 1 duplicada com canonical divergente (home: Google escolheu github.io). A propriedade de domínio está conectada ao OpenSEO. Não publicar tokens OAuth, dados pessoais ou relatórios privados no repositório público.
- A home do repositório bcesteticaavancada.github.io aponta para o caminho antigo /bcesteticaavancada-alt/. Corrigir em PR separado; preservar a verificação Google e redirecionar o NFC antigo para o cartão oficial.
- Canonical autoconsistente para todas as URLs públicas do sitemap; incluir /agenda/ (agenda independente) e /nfc/ (cartão público). /agendamento/ inclui também pré-anamnese, portanto é mantida como URL distinta nesta proposta; reavaliar duplicidade com dados reais. /instalar/ e páginas informativas do backup ficam fora do sitemap sem impedir acesso. Páginas privadas continuam noindex e exigem autenticação real.
- Links contextuais estáticos reforçados; rodapé JS atualizado para domínio oficial.
- IndexNow: arquivo público de verificação preparado. Não é segredo de autenticação; não serve ao Google. Após publicação autorizada e confirmação do arquivo por HTTP 200, enviar apenas URLs realmente alteradas (Bing e outros participantes).

## Validação da migração após aprovação
1. Conferir GitHub Pages, domínio customizado, DNS apex e www, HTTPS e redirecionamentos das variantes; usar curl -IL para verificar 301/308 ou documentar redirecionamento HTML do repositório antigo (GitHub Pages estático não permite configurar resposta 301 no HTML). Não trocar DNS nesta etapa.
2. Confirmar HTTP 200 e canonical do destino por página; verificar que o legado aponta diretamente ao domínio novo, sem cadeia intermediária. Não redirecionar rotas desconhecidas indiscriminadamente.
3. Conferir sitemap no Search Console, solicitar indexação manual das páginas prioritárias, principalmente home, equipe e protocolos; acompanhar canonical escolhida pelo Google e cobertura. Sitemap não garante indexação.
4. Rodar npm run test:site e CI; conferir layout mobile/desktop e agendamento. Conferir separadamente o PR do legado.

## GA4 — revisão, sem ativar rastreamento
OpenSEO reconhece conta empresarial mas não lista propriedade GA4. Na revisão dos HTML públicos e script.js não foram identificados os marcadores gtag/Google Tag Manager. Não inventar ID G- nem habilitar coleta neste PR.
Criar/vincular propriedade GA4 e fluxo web após aprovação; revisar LGPD, base legal, consentimento, retenção e políticas do Google. Nunca enviar nome, telefone, e-mail, anamnese, identificadores de clientes, procedimento associado a pessoa, dados de saúde ou conteúdo de formulários. Excluir agenda, agendamento, gestão e rotas clínicas de rastreamento inicial; avaliar também se páginas de tratamentos podem revelar informação sensível. Desabilitar publicidade, remarketing e captura automática de formulários. Usar apenas métricas agregadas de páginas institucionais aprovadas e validar com DebugView/testes de rede antes de ativar. Sem propriedade e revisão de privacidade, manter desligado.

Referências: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes ; https://developers.google.com/search/docs/crawling-indexing/canonicalization ; https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site ; https://support.google.com/analytics/answer/6366371 .
