# BC Estética — Registro.br → GitHub Pages, sem interromper o site atual

Data: 28/10/2026. Domínio confirmado por comprovantes do usuário: `bcesteticaavancada.com.br`, publicado, vencimento 28/10/2027.
Fase: **VERIFICAÇÃO DE PROPRIEDADE / PRÉ-CORTE**.

## Não modificar produção neste passo
- Não alterar `main`, `Settings > Pages` do repositório, DNS A/CNAME para tráfego, Auth/Supabase ou Google OAuth.
- Manter o site atual em `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`.
- O Registro.br exibir "Publicado" significa domínio registrado/delegado, **não** significa que já atende o site.

## 1. Verificar o domínio no GitHub (agora, seguro)

A conta `bcesteticaavancada` é a proprietária dos repositórios atuais. No GitHub **logado nessa conta**, abrir **foto de perfil → Settings (configurações da conta, não do repositório) → Pages → Add a domain**.
Informar `bcesteticaavancada.com.br` e selecionar **Add domain**.
O GitHub fornece:
- **nome** de um registro DNS TXT (tipicamente `_github-pages-challenge-bcesteticaavancada`); **copiar exatamente o exibido pelo GitHub**;
- **valor** exclusivo do registro TXT; **não inventar nem reaproveitar o token do Search Console**.

No Registro.br, selecionar o domínio → DNS → edição da **Zona DNS** (os títulos podem variar conforme o modo básico/avançado e o provedor DNS). Adicionar **somente o TXT de verificação** com nome/valor fornecidos pelo GitHub. Não mexer em servidores DNS, NS, MX ou outros registros usados por eventuais serviços.

Aguardar propagação e usar **Verify** no GitHub Pages da conta; **manter o TXT** permanentemente para prevenir apropriação indevida do domínio. Esta verificação comprova a propriedade no GitHub, não publica o site.

### Informação importante para a conta
O domínio também deverá ser verificado no Google Search Console pelo método de **propriedade de domínio (TXT do Google)**, que é um **TXT diferente**. A aprovação de marca OAuth poderá continuar sujeita a análise própria.

## 2. Registros previstos para o corte (não adicionar agora)

Após a equipe corrigir e testar caminhos, CORS, Auth, PWA, SEO, Google Picker e OAuth e aprovar publicação, usar o domínio personalizado `www.bcesteticaavancada.com.br` em **Settings → Pages do repositório `bcesteticaavancada-alt`**, que publica via GitHub Actions (não precisa de arquivo CNAME no repositório).

Com o domínio associado ao GitHub Pages, criar registros DNS oficiais:

| Tipo | Nome/host no Registro.br | Destino/valor |
|---|---|---|
| CNAME | `www` | `bcesteticaavancada.github.io` |
| A | raiz (em branco ou `@`, conforme painel) | `185.199.108.153` |
| A | raiz (em branco ou `@`) | `185.199.109.153` |
| A | raiz (em branco ou `@`) | `185.199.110.153` |
| A | raiz (em branco ou `@`) | `185.199.111.153` |

São os quatro IPv4 divulgados pelo GitHub em 28/10/2026. Confirmar novamente nos docs oficiais no momento do corte. Há registros AAAA IPv6 opcionais; só adicionar se também configurados corretamente.

Não usar URL completa, protocolo `https://`, caminho `/bcesteticaavancada-alt/` ou `www` no destino do CNAME. Não criar `*.` wildcard.

O GitHub recomenda adicionar o domínio à configuração de Pages **antes** de apontar o DNS de tráfego e exige HTTPS após emissão do certificado; as alterações de DNS podem levar até 24 horas. Com `www` como domínio canônico, o domínio sem www poderá redirecionar automaticamente, se ambos os registros estiverem corretos.

## 3. Checklist técnico antes da associação ao Pages

1. Refatorar o frontend e seus testes para funcionar na raiz `/` em vez de `/bcesteticaavancada-alt/`.
2. Atualizar as origens permitidas **explicitamente** em Edge Functions Supabase, sem trocar RLS, storage privado ou conceder `Access-Control-Allow-Origin: *`.
3. Adicionar e testar `https://www.bcesteticaavancada.com.br/gestao/redefinir-senha/` nos Redirect URLs de Auth, mantendo alternativa antiga até o corte.
4. Conservar os callbacks OAuth de funções existentes, como as funções `drive-oauth-*` hospedadas em Supabase; eles **não mudam automaticamente** com o novo domínio.
5. Configurar origem correta no Google Picker, URLs públicas do app, consentimentos e Google Search Console.
6. Testar todo o site, agenda pública, perfis, PWA, PDFs fictícios, Maya e backup com dados de teste em Android/iPhone.
7. Confirmar a estratégia de redirecionamento dos links GitHub antigos; a associação do domínio próprio pode redirecionar a URL antiga preservando caminhos legados incompatíveis.
8. Publicar somente após aprovação explícita da administração e janela de corte controlada.

## 4. Verificações depois do corte

- Abrir `https://www.bcesteticaavancada.com.br/`, `/gestao/login/`, `/agendamento/`, `/backup/`, `/backup/privacidade/`, `/backup/termos/`; confirmar sem misturar links.
- Conferir SSL/HTTPS, DNS do apex e `www`, redirecionamento seguro, sitemap/SEO, login/logout, senha, agenda, arquivos/PDF, Google Picker e restauração fictícia.
- Revalidar os links NFC/QR e comunicações; não divulgar novos endereços antes de homologar.
- Se houver regressão crítica, executar reversão documentada na proposta principal, preservando dados do Supabase e Google Drive.

## Referências
- [GitHub — Verificar domínio por TXT](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [GitHub — Configurar domínio e DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub — Domínio de site de projeto](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
