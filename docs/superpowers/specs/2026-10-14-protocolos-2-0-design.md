# BC Estética — Protocolos 2.0

Data: 14/10/2026
Status: design aprovado pelo Fernando Victor em 14/10/2026
Escopo: reformulação estrutural da página pública `/protocolos/`
Repositório: `bcesteticaavancada/bcesteticaavancada-alt`

## 1. Objetivo

Transformar a página de Protocolos em uma vitrine visual mais curta, elegante e orientada à decisão, especialmente no celular. A nova experiência deve reduzir a sensação de catálogo extenso sem perder o portfólio de tratamentos da BC Estética.

A página atual apresenta cerca de 30 procedimentos/protocolos em cards longos. A nova versão deve agrupar procedimentos semelhantes por objetivo ou família clínica, destacar poucos temas principais em vídeo curto e apresentar o restante em cards compactos com imagem, título e descrição breve.

## 2. Princípios do redesign

- Mobile-first.
- Hierarquia visual clara e escaneável.
- Menos repetição entre procedimentos semelhantes.
- Um vídeo pode representar uma família de tratamentos, mas nunca deve comunicar que procedimentos diferentes são equivalentes.
- O catálogo completo deve continuar preservado no repositório.
- A página pública pode priorizar apenas o que tem mídia aprovada e boa apresentação.
- A avaliação individual continua sendo o CTA clínico principal.
- Evitar promessas de resultado, superlativos médicos ou linguagem absoluta.
- Manter a identidade premium da BC: fundo claro/escuro, dourado, tipografia editorial e imagens próprias sempre que possível.

## 3. Estrutura da página

### 3.1 Hero

Manter o conceito atual:

- Eyebrow: `BC ESTÉTICA AVANÇADA · PROCEDIMENTOS E PROTOCOLOS`
- Título: `Cada cuidado começa por você.`
- Texto curto explicando que a avaliação individual orienta o plano.
- CTA: `Agendar avaliação`.
- Foto das três salas já existente, porém com bloco mais compacto para reduzir altura inicial no celular.

### 3.2 Destaques em vídeo

Adicionar uma seção logo após o hero:

Título sugerido: `Conheça os tratamentos mais procurados`

Formato:

- Até 7 vídeos curtos.
- Duração alvo: 20–30 segundos.
- Formato vertical preferencial 9:16.
- No celular, carrossel horizontal com snap.
- Primeiro vídeo visível em destaque.
- Autoplay somente se compatível com política do navegador, sempre sem som inicialmente.
- `playsinline` obrigatório.
- Botão de som/pausa acessível quando houver vídeo real.
- Poster estático WebP para cada vídeo.
- Lazy-load dos vídeos não visíveis; não baixar os 7 MP4s no carregamento inicial.
- Respeitar `prefers-reduced-motion`.

### 3.3 Os 7 temas de vídeo

#### Vídeo 01 — Toxina Botulínica / Botox
Representa a família de toxina botulínica e associa:
- Botox Terço Superior
- Botox Full Face
- Botox Nefertiti

Observação: manter as diferenças entre indicações nos textos secundários.

#### Vídeo 02 — Harmonização e Preenchimento
Representa:
- Harmonização Facial
- Preenchimento com ácido hialurônico
- Face Reset™ como protocolo autoral relacionado

#### Vídeo 03 — Bioestimulador de Colágeno
Representa tratamentos focados em estímulo progressivo de colágeno e qualidade de pele.

#### Vídeo 04 — Skinbooster / Biorremodelação
Representa:
- Skinbooster
- Profhilo®
- Monaco Glow™ / Reset Glow™ como experiências relacionadas quando fizer sentido

Importante: não afirmar que Skinbooster e Profhilo® são o mesmo procedimento.

#### Vídeo 05 — Microagulhamento / Renovação da Pele
Representa o eixo de renovação e textura da pele, relacionado a:
- Microagulhamento
- Peeling
- Black Peel
- Despigmentação
- Limpeza + Peeling

#### Vídeo 06 — Ultrassom Microfocado / Firmeza
Representa tecnologias de firmeza e estímulo tecidual:
- Ultrassom Microfocado
- Radiofrequência
- Criofrequência Fracionada
- Jato de Plasma como tecnologia relacionada, sem equivalência clínica

#### Vídeo 07 — Contorno Corporal / Sculpt Cryo
Representa:
- Sculpt Cryo™
- Aplicação de enzimas / intradermoterapia corporal
- protocolos de contorno corporal
- outros cuidados corporais relacionados

## 4. Navegação por objetivo

Abaixo ou integrada à área de vídeos, criar chips/filtros horizontais:

- Rosto
- Pele
- Colágeno
- Corpo
- Capilar
- Bem-estar

Comportamento esperado:

- Scroll horizontal suave no mobile.
- Estado ativo visualmente claro.
- O filtro pode apenas navegar/rolar para a seção correspondente; não é obrigatório esconder DOM inteiro na primeira versão.
- Não depender exclusivamente de JavaScript para o conteúdo ser acessível.

## 5. Catálogo compacto por famílias

Substituir os cards gigantes atuais por cards menores. Cada card deve conter:

- imagem WebP 4:5 ou quadrada;
- título;
- descrição de 1–2 linhas;
- ação `Saiba mais` ou expansão inline;
- opcionalmente uma linha com os tratamentos incluídos naquela família.

### 5.1 Famílias propostas

#### Toxina Botulínica
- Terço Superior
- Full Face
- Nefertiti

#### Limpeza e Renovação
- Limpeza de Pele
- Limpeza de Pele com Peeling
- Peeling
- Black Peel
- Despigmentação

#### Hidratação e Qualidade da Pele
- Skinbooster
- Profhilo®
- Reset Glow™
- Monaco Glow™

#### Colágeno e Textura
- Bioestimulador de Colágeno
- Microagulhamento
- Skin Reset™

#### Harmonização Facial
- Harmonização Facial / Preenchimento
- Face Reset™

#### Tecnologias de Firmeza
- Ultrassom Microfocado
- Radiofrequência / Criofrequência Fracionada
- Jato de Plasma

#### Contorno Corporal
- Sculpt Cryo™
- Aplicação de Enzimas / Intradermoterapia
- Lipo/Tratamento de Papada
- cuidados de contorno corporal

#### Massagens e Bem-estar
- Massagem Relaxante
- Drenagem
- Redutora / Modeladora

#### Capilar e Sobrancelhas
- Fort Hair™
- Fort Hair Plus™
- Fort Brow™
- Terapia Capilar / Tricologia quando houver mídia aprovada

#### Cuidados Específicos
- Tratamento para Estrias
- Tratamento de Vasinhos
- Remoção a Laser

## 6. Protocolos autorais BC

Criar uma faixa visual separada, premium, para os protocolos de marca própria.

Título sugerido: `Assinaturas BC`

Subtítulo: `Protocolos desenvolvidos para combinar técnicas e tecnologias de acordo com cada objetivo.`

Protocolos:
- Fort Hair™
- Fort Hair Plus™
- Fort Brow™
- Sculpt Cryo™
- Reset Glow™
- Monaco Glow™
- Skin Reset™
- Face Reset™

Layout:

- fundo escuro;
- tipografia dourada / clara;
- carrossel horizontal no mobile;
- 2–4 itens visíveis conforme largura no desktop;
- imagem + nome + frase curta;
- não repetir descrições longas já apresentadas em outros blocos.

## 7. Detalhes e expansão

Para não alongar a página, os detalhes completos de cada procedimento devem aparecer por uma destas opções:

1. acordeão inline por família; ou
2. modal/drawer acessível; ou
3. página/âncora de detalhe já existente, caso o projeto adote isso no futuro.

Preferência para a primeira implementação: acordeão inline ou `<details>` estilizado, por ser simples, acessível e resistente a falhas de JavaScript.

Cada detalhe deve manter:

- definição curta;
- objetivo esperado em linguagem não absoluta;
- aviso de necessidade de avaliação;
- CTA de agendamento.

## 8. Conteúdo e segurança clínica

Regras de copy:

- usar `pode ajudar`, `busca`, `pode favorecer`, `conforme avaliação`;
- evitar `garante`, `elimina`, `resultado certo`, `sem risco`, `definitivo`;
- deixar claro quando tratamentos agrupados têm mecanismos e indicações diferentes;
- não comparar procedimentos como substitutos automáticos entre si;
- manter disclaimer geral no fim da página.

## 9. Mídia e performance

### Imagens

- WebP preferencial.
- Gerar versões responsivas, por exemplo 360/560/900 quando necessário.
- `loading="lazy"` para conteúdo abaixo da dobra.
- largura/altura definidas para evitar CLS.

### Vídeos

- MP4/H.264 ou formato amplamente compatível com navegador, com poster WebP.
- Não usar preload pesado nos vídeos fora da viewport.
- `preload="metadata"` ou `none` conforme teste de performance.
- Primeira dobra deve carregar sem depender do download de vídeos completos.
- Evitar áudio automático.

### Metas práticas

- A página deve parecer mais rápida do que a versão atual no celular.
- Evitar salto de layout durante carregamento.
- Não introduzir bibliotecas grandes apenas para carrossel; usar CSS scroll-snap + JavaScript mínimo quando possível.

## 10. Acessibilidade

- navegação por teclado;
- foco visível;
- controles de vídeo com rótulos acessíveis;
- texto alternativo útil nas imagens;
- contraste adequado;
- `aria-expanded` quando houver componentes expansíveis customizados;
- suporte a `prefers-reduced-motion`;
- conteúdo essencial disponível mesmo sem JavaScript.

## 11. SEO

Manter o canonical atual e atualizar title/description somente se necessário para refletir a nova arquitetura.

A página deve continuar contendo texto semântico sobre:
- procedimentos faciais;
- procedimentos corporais;
- toxina botulínica;
- bioestimulação;
- tecnologias estéticas;
- Belo Horizonte;
- avaliação individualizada.

Não esconder todo o conteúdo relevante dentro de elementos que só existam após execução de JavaScript.

## 12. CTA final

Manter um bloco final simples e forte:

Eyebrow: `SEU PRÓXIMO PASSO`
Título: `Não sabe qual tratamento combina com seu objetivo?`
Texto: `A avaliação individual ajuda a definir o cuidado mais adequado para sua pele, seu corpo e o resultado que você busca.`
CTA: `Agendar avaliação`

Manter também acesso rápido ao WhatsApp.

## 13. Arquivos esperados na implementação

A implementação deverá avaliar e provavelmente modificar:

- `protocolos/index.html`
- `protocolos/protocolos.css`
- `script.js` somente se necessário para comportamento compartilhado
- arquivos de mídia em `assets/procedimentos/`

Preferência: comportamento específico da página deve ficar em arquivo próprio, por exemplo `protocolos/protocolos.js`, caso ultrapasse um script curto.

Novos assets sugeridos:

- `assets/procedimentos/videos/`
- `assets/procedimentos/posters/`
- `assets/procedimentos/familias/`

Não mover ou excluir mídia existente sem necessidade.

## 14. Migração do conteúdo existente

- Os 30 itens atuais não devem ser simplesmente apagados do histórico do projeto.
- Procedimentos retirados da apresentação principal continuam documentados em `docs/catalogo-procedimentos-em-espera.md` ou em outro catálogo de referência.
- Itens sem foto/vídeo aprovado podem permanecer fora da vitrine visual até existir mídia adequada.
- O conteúdo deve ser reaproveitado nas expansões de detalhes, reduzindo duplicação de copy.

## 15. Critérios de aceitação

A Protocolos 2.0 estará pronta quando:

1. A primeira tela estiver visualmente mais curta que a atual.
2. Os 7 temas principais estiverem definidos no layout, mesmo que alguns iniciem com poster/imagem antes do vídeo final.
3. Botox aparecer como uma única família visual, sem três cards gigantes separados.
4. Procedimentos semelhantes estiverem agrupados sem perder suas diferenças clínicas.
5. O restante do catálogo estiver representado em cards menores ou expansões.
6. Protocolos autorais BC tiverem uma seção própria e premium.
7. O layout funcionar bem em 360 px, tablet e desktop.
8. Não houver overflow horizontal acidental.
9. O menu e o CTA de agendamento continuarem funcionando.
10. A página continuar utilizável sem JavaScript para leitura do conteúdo essencial.
11. Imagens abaixo da dobra usarem lazy-load.
12. Vídeos fora da viewport não forem baixados integralmente no carregamento inicial.
13. Lighthouse/manual review não revelar regressão óbvia de acessibilidade ou performance em relação à versão atual.
14. Textos clínicos continuarem usando linguagem prudente e individualizada.
15. A versão publicada não remover o catálogo de referência do repositório.

## 16. Fora de escopo nesta fase

- sistema de recomendação automática de tratamento;
- diagnóstico online;
- cálculo automático de preço/pacote;
- integração da página com prontuário clínico;
- criação automática dos 7 vídeos dentro do código do site;
- nova identidade visual global da BC;
- refatoração completa do restante do site.

## 17. Sequência visual resumida

1. Header
2. Hero compacto + três salas
3. Destaques em vídeo
4. Chips por objetivo
5. Famílias de tratamentos em cards compactos
6. Assinaturas BC em carrossel premium
7. Cuidados específicos / catálogo complementar
8. Disclaimer
9. CTA final
10. Footer

## 18. Decisão aprovada

A direção aprovada é uma página de Protocolos mais visual, curta e dinâmica, baseada em famílias de tratamento e 7 vídeos principais. O vídeo de Botox já produzido será tratado como Vídeo 01 e servirá de referência visual para os demais vídeos curtos.
