# BC Mobile V0.8 — paridade editorial com o site

**Data:** 31/10/2026 · **Status:** protótipo nativo isolado, sem merge/publicação.

## Referência visual

Fonte de verdade para a **estrutura editorial**, não para a implementação: `index.html`, `styles.css`, `home-redesign.css` e `editorial.css` do próprio repositório BC. O site usa fundos claros `#fcfaf8`, `#f2e9df`, contraste escuro `#171310`, títulos serifados, fotos institucionais e seções com respiro. No app, o dourado do site é traduzido com acentos **rose gold/champagne** conforme a direção visual definida por Fernando e Mel.

**Princípio:** a cliente reconhece a mesma BC no site e no aplicativo, mas o celular preserva quatro acessos de toque grandes e reduz a leitura.

## Organização do app e correspondência editorial

| Site BC | App mobile | Estado V0.8 |
| --- | --- | --- |
| Início / hero “Beleza com propósito” | Início: hero com ambiente real, avaliação | Implementado na demo |
| A Clínica / Ambiente | Início: cartão visual “A Clínica” | Implementado |
| Nossa Equipe / Mel | Início: grupo + galeria de retratos | Implementado; Vânia em foto coletiva |
| Vídeos / Protocolos | Cuidados: catálogo editorial de procedimentos | Nomes e descrições locais; vídeos futuros |
| Valores | Sem valores não confirmados no app | Pendente validação da Mel |
| Agendamento | Agenda: leitura com fixtures fictícias | Sem gravação em produção |
| Contato | Minha BC: prévia de conversa por atendimento | Sem envio real; acesso seguro futuro |
| Portal da cliente | Minha BC: Pós, Conversas, Arquivos | Prévia local, sem dados reais |

## Componentes reutilizáveis e linguagem

- **Marca:** logo quadrada em alta resolução, sem esticar; menu inferior com quatro destinos e bom tamanho de toque.
- **Tipografia:** títulos grandes serifados, rótulos em caixa alta com espaçamento discreto, corpo legível.
- **Cores:** `siteIdentity` em `src/theme.ts` centraliza fundo, creme, escuro e acentos rose gold/champagne.
- **Hero:** imagem local institucional da sala facial (a mesma base pública da BC), camada escura e CTA “Agende sua avaliação”.
- **Tratamentos:** linhas numeradas e divisórias finas inspiradas na coleção editorial do site, sem emojis grandes ou cartões excessivos.
- **Dados:** somente ativos institucionais e fixtures; não importar fotos de prontuários, documentos ou informações de clientes.

## Fases de refinamento

1. **V0.8 — identidade e estrutura:** home, espaços, equipe, catálogo editorial e coerência visual. Validar CI e APK.
2. **V0.9 — conteúdo curado:** ficha de procedimento resumida, mídia aprovada, apresentação individual das profissionais. Mel aprova textos e autorizações; otimizar imagens.
3. **V0.10 — utilidade operacional em staging:** contato oficial verificado, agendamento real controlado e área da cliente protegida com dados fictícios. Testes RLS, Auth e política de privacidade.
4. **Candidata Play:** recurso funcional auditado, Data safety, política pública, exclusão de conta quando aplicável, declaração Health Apps e homologação física. Somente com autorização expressa.

### Critérios de aceite para V0.8

- [ ] Logo e textos não cortados em Samsung S23 Plus com fonte ampliada.
- [ ] Home é reconhecida como BC e mostra ações principais sem excesso.
- [ ] Catálogo possui pesquisa, filtros, linhas numeradas e detalhe funcional.
- [ ] Agenda continua fictícia e sem escrever em Supabase.
- [ ] Minha BC preserva aviso de demo, triagem de conversas e aviso de urgência.
- [ ] Quatro abas e botão Voltar Android operam corretamente.
- [ ] Fotos institucionais aprovadas e com enquadramento fiel.
- [ ] Nenhum PR de migração, TCLE, Drive ou Maya foi mesclado.
