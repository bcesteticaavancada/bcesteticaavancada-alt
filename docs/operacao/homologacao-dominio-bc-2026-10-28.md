# BC — preparação do domínio: frontend, Auth e integrações

Atualizado em 28/10/2026. PR #69, **rascunho / sem publicação**.

## Entrega desta rodada

- Navegação do rodapé passa a usar a base da instalação: raiz no domínio próprio ou prefixo no GitHub. Menu, Gestão e atalhos continuam relativos.
- Canônicos de 16 páginas públicas, Open Graph e JSON-LD da home, robots e sitemap preparados para `https://www.bcesteticaavancada.com.br/`. O sitemap preserva as 11 rotas anteriores e acrescenta `agenda/`.
- Manifesto sem `id` fixo: o identificador padrão é o `start_url`. Na origem legada, continua exatamente `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`; no domínio próprio, passa a ser sua raiz. `id: ./` seria incorreto no GitHub porque esse campo relativo usa a origem do `start_url`, não o diretório do manifesto.
- `client-support` incluída na revisão de origens: permite somente os três hosts oficiais e devolve CORS para a origem exata. Convites voltam à página de redefinição da instalação solicitante; requisições internas sem Origin mantêm o destino legado. O corpo não escolhe o destino, o papel nem a identidade administrativa.
- Adicionados testes HTTP das quatro funções já preparadas, além dos testes executáveis de suporte. Os testes PDF capturam apenas o registro do servidor; executam os entrypoints reais até a barreira de origem/autenticação, sem banco ou geração de documento real.

Estas alterações estão apenas no branch do PR. Canônicos novos não devem ser publicados isoladamente antes da janela de corte.

## Evidência e reprodução

| Verificação | Resultado desta rodada |
|---|---|
| Base antes das alterações | `npm test`: 934/934 aprovados |
| Regressão Node após as alterações | `npm test`: 949/949 aprovados — 69 pré-anamnese, 144 site, 736 Gestão |
| Navegação, manifesto e SEO focados | 10/10; testes falharam primeiro nos endereços antigos e depois passaram |
| Suporte | 23/23; inclui preflight, convite, origens maliciosas, sessão obrigatória, fallback e destino injetado no corpo |
| CORS das quatro funções | 16 cenários Deno adicionados ao Site CI; conferir o resultado no SHA atual do PR |
| Navegadores | `node scripts/test-custom-domain-browser.mjs`: seis cenários previstos, Chromium/WebKit nas três bases HTTPS simuladas; conferir o resultado no SHA atual do PR |
| Limite do ambiente local | Deno e binários de navegador ausentes. O download do Playwright retornou arquivos vazios/inválidos; a validação de navegador local parou na inicialização, sem resultado funcional. Execução transferida ao CI |
| Aparelhos físicos | Pendente, sem substituir por emulação de viewport |

O roteiro de navegador intercepta todas as requisições. Serve os arquivos reais do branch, simula somente SDK/serviços externos e bloqueia qualquer chamada não prevista. Exercita menu → Protocolos → rodapé → pré-anamnese, reserva fictícia, manifesto/ícones, recuperação de senha com e-mail `example.invalid`, Maya com perfil fictício e páginas de informação/configuração do Drive. Não envia e-mail nem autoriza Google. A geração de PDFs e o OAuth/Picker hospedados exigem homologação própria.

Comandos:

```sh
npm test
deno test --allow-env --config supabase/functions/generate-clinical-pdf/deno.json tests/edge/custom-domain-cors_test.ts
node scripts/test-custom-domain-browser.mjs
node scripts/auditar-dominio-bc.mjs
```

Os resultados remotos devem ser conferidos no **commit exato** do PR #69. Logs de outra branch ou de um SHA anterior não homologam este código.

## Supabase Auth — configuração preparada, não aplicada

A ferramenta conectada não disponibiliza a leitura de URL Configuration de Auth. Portanto a lista hospedada atual **não foi confirmada nem alterada**. Na janela apropriada, conferir e acrescentar as seguintes URLs exatas, preservando as demais entradas válidas:

| Uso | URL |
|---|---|
| Recuperação/convite principal | `https://www.bcesteticaavancada.com.br/gestao/redefinir-senha/` |
| Recuperação/convite apex durante coexistência | `https://bcesteticaavancada.com.br/gestao/redefinir-senha/` |
| Recuperação/convite legado | `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/redefinir-senha/` |
| Login principal | `https://www.bcesteticaavancada.com.br/gestao/login/` |
| Login apex | `https://bcesteticaavancada.com.br/gestao/login/` |
| Login legado | `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/login/` |

Após HTTPS e homologação, usar como Site URL padrão a página de login principal acima, que inicializa o SDK e reconhece a sessão. Não trocar o Site URL antes do corte. Conferir os templates de e-mail: mensagens que usam somente `SiteURL` podem ignorar o destino solicitado; validar o fluxo real com uma conta fictícia, sem enviar a colaboradoras existentes.

O teste do frontend confirma o `redirectTo` enviado; não comprova que a lista hospedada aceita esse endereço nem que o e-mail chegou. Convites, redefinição, expiração/reutilização de links, logout e papéis continuam gates de integração. Uma sessão da origem antiga não deve ser copiada para o novo domínio; entrar novamente.

## Drive — bloqueio concreto confirmado por leitura

Leitura somente das fontes implantadas em `tpqsmerlxquyrzrjbogj`:

| Função | Versão observada | Pendência |
|---|---|---|
| `drive-oauth-start` | 3 | `appOrigin` está fixo na origem GitHub; início rejeita a nova origem |
| `drive-oauth-callback` | 4 | Retorno concatena `/bcesteticaavancada-alt/gestao/configurar-drive/` à origem fixa |
| `drive-oauth-setup` | 3 | CORS, preflight e autorização de origem ainda aceitam somente GitHub |

Essas fontes compartilhadas não estão na `main` deste PR; não importar ou publicar os PRs paralelos de backup por consequência da migração. Preparar a adaptação com seus responsáveis, preservando PKCE, state de uso único, cookies, a verificação de conta e `drive.file`.

Próxima implementação necessária: mapa exato das bases aprovadas no fluxo de início/setup e persistência autenticada da base de retorno no handshake. O callback deve usar a base validada do início, sem confiar em parâmetro arbitrário recebido no retorno. Testar iniciar por cada origem, cancelar, recusar state/origem forjados e concluir no endereço correto, mantendo as duas pastas privadas.

O callback Google permanece no backend, `https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-oauth-callback`; confirmar o endereço cadastrado no cliente Google antes de qualquer alteração. O domínio próprio muda as origens de frontend/Picker e as URLs de apresentação, privacidade e termos, não o hostname do Supabase. Branding, domínio autorizado, restrições da chave do Picker e modo de publicação do OAuth continuam sem mudança nesta rodada.

## Referências legadas mantidas conscientemente

- Listas CORS e bases de convite: coexistência, sem curinga.
- Logo remoto de `submit-pre-anamnese` e script de prévia: origem anterior preservada enquanto o domínio novo ainda não está ativo; verificar o fetch da imagem depois do corte.
- Rotinas de identidade em `scripts/ops`: são históricas e de uso único. A função de manutenção permanece encerrada (410); não reativá-la para migrar domínio.
- Testes que citam a origem GitHub: regressão do caminho antigo, não links de navegação ativos.

## Gates ainda abertos

1. Revisar resultados do CI no SHA atual e compatibilidade com mudanças novas na `main` antes de integrar.
2. Preparar e homologar a migração do fluxo Drive descrito acima; conferir configuração hospedada do Auth e Google sem expor documentos.
3. Homologar login/logout, recuperação, convite, PDFs fictícios e restauração de backup em sessão hospedada apropriada.
4. Aceite visual e testes físicos Android/iPhone pela administração/equipe.
5. Aprovação expressa e janela de corte para merge, Pages, DNS e HTTPS. Os TXT já verificados permanecem; não há ação adicional no Registro.br nesta fase.

## Fontes

- [Identidade do manifesto — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)
- [Escopo do manifesto — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope)
- [Redirect URLs — Supabase](https://supabase.com/docs/guides/auth/redirect-urls)
- [Domínios personalizados — GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
