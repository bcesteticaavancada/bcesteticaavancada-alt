# BC Estética — Redesign Editorial Luxury + Cinematic

Data: 05/10/2026
Status: aprovado em conversa; aguardando revisão final deste documento antes do plano de implementação.

## 1. Objetivo

Evoluir o site oficial da BC Estética para uma experiência de alto padrão, com linguagem visual editorial e uso cinematográfico de vídeos reais, sem perder a base técnica, o acolhimento e a clareza clínica.

A percepção desejada é: luxo discreto, ciência, naturalidade, confiança, exclusividade e cuidado.

O site não deve parecer catálogo de procedimentos, landing page genérica de clínica, e-commerce ou startup.

## 2. Fonte oficial e ambientes auxiliares

- GitHub continua sendo a fonte oficial de produção, código, assets e publicação pública.
- GitHub Pages continua no endereço público atual.
- MagicPath é laboratório complementar para testar ideias visuais, interações e composições; não substitui o site oficial.
- Figma pode ser usado como apoio de sistema visual e composição quando houver permissão adequada.
- Notion e Linear podem registrar decisões, conteúdo e tarefas, mas não são fontes públicas do site.
- Replit, Hercules e ferramentas semelhantes não devem criar um site público paralelo.

## 3. Invariantes que não podem regredir

1. Menu funcional com 11 opções.
2. Logo centralizado no cabeçalho.
3. Menu/hambúrguer no topo direito.
4. Drawer sobreposto, sem deslocar a página horizontalmente.
5. Fechar menu por X, overlay, Escape e clique em link.
6. Body scroll lock enquanto o drawer estiver aberto.
7. Home permanece uma página de apresentação, sem virar catálogo.
8. Mel permanece como imagem principal da Home nesta fase.
9. Logo aparece uma única vez na Home.
10. Navegação continua multipágina.
11. Prioridade mobile-first.
12. Não publicar preços não confirmados como oficiais.
13. Não inventar credenciais, especializações, resultados ou promessas clínicas.

## 4. Direção criativa aprovada

### 4.1 Linguagem visual

Combinação principal:

- Editorial Luxury: fotografia grande, respiro, tipografia elegante, hierarquia forte e dourado discreto.
- BC Cinematic: vídeos verticais reais usados como narrativa, não como galeria aleatória.
- Clinical Couture: informação técnica apresentada com refinamento, evitando aparência hospitalar.

### 4.2 Paleta

Base atual preservada e refinada:

- Chocolate/ink: #211B18
- Dark: #171310
- Off-white/paper: #FCFAF8
- Cream/nude: #F2E9DF
- Gold: #B88A45
- Light gold: #D7B676
- Muted: #756C66

O dourado deve ser detalhe, não preenchimento dominante.

### 4.3 Tipografia

- Títulos: serif elegante, com escala editorial.
- Textos e controles: sans limpa e legível.
- Uso de itálico serifado apenas como acento visual.
- Frases curtas e bastante espaço em branco.

## 5. Home

A Home mantém seu papel definido: apresentação e ponto.

### Conteúdo

- Mel continua como fundo principal.
- Eyebrow institucional.
- Conceito: “Menos achismo. Mais ciência.”
- Headline curta e sofisticada.
- Texto de apresentação breve.
- CTA primário: Agende sua avaliação.
- CTA secundário: Conheça os tratamentos.
- Rodapé somente com endereço, telefone e GPS, conforme decisão anterior.

### Visual

- Não adicionar cards de procedimentos, equipe, resultados, preços ou protocolos.
- Microanimações suaves podem ser usadas, desde que não afetem performance nem acessibilidade.
- Vídeos não entram na Home nesta primeira fase; o vídeo deve enriquecer páginas internas para preservar a força da apresentação inicial.

## 6. Nossa Equipe

A página deve parecer um editorial institucional de profissionais.

### Mel

- Foto grande.
- Nome e papel profissional.
- Trajetória e formação já confirmadas.
- CTA para página exclusiva da Mel.

### Alice Rocha

Conteúdo fornecido para apresentação:

- Nome: Alice Rocha.
- Título informado: Biomédica Esteta.
- Formação informada: mais de 10 anos em Estética e Cosmetologia e 4 anos em Biomedicina.
- Atuação informada: renovação/remoção a laser de tatuagem e micropigmentação de sobrancelhas; tratamentos de estrias, cicatrizes, acne e tratamentos corporais.
- Registro informado anteriormente: 19272.

A foto enviada deve ser tratada como retrato editorial principal da Alice, sem gerar substituta por IA.

### Regra de conteúdo

Não completar automaticamente a frase interrompida “Se...” enviada no texto original. Não inventar especializações, pós-graduações, títulos ou certificações.

## 7. Procedimentos

A página deve deixar de parecer um catálogo de cards iguais e passar a funcionar como uma coleção editorial de tratamentos.

### Conteúdo-base enviado

Procedimentos informados:

- Botox
- Intradermoterapia
- Terapia Capilar
- Microagulhamento
- Ultrassom Micro e Macrofocado
- Skinbooster
- Peeling Químico
- Jato de Plasma
- Harmonização Facial
- Bioestimulador de Colágeno
- Tratamento de papada
- Tratamento para estrias
- Tratamento de vasinhos
- Remoção a Laser
- Tricologia de Sobrancelhas
- Limpeza de pele
- Hidratação facial

### Transformação editorial

Os textos operacionais enviados — assepsia, marcações, aplicação, anestésico, registros fotográficos etc. — são base técnica interna.

No site, a apresentação pública deve ser convertida em blocos como:

1. O que é.
2. O que busca tratar/melhorar.
3. Como é realizado em termos gerais.
4. Avaliação e personalização.
5. Cuidados e observações quando houver informação confirmada.

Evitar publicar passo a passo de execução como manual técnico.

### Linguagem

- Não prometer resultados garantidos.
- Não usar antes/depois não autorizado.
- Não inventar indicação, contraindicação, duração, frequência ou recuperação quando esses dados não estiverem confirmados.
- Evitar superlativos e marketing agressivo.

## 8. Vídeos

Há quatro vídeos verticais reais enviados para o projeto.

### Uso

- Tratar como mídia editorial, não como galeria genérica.
- Preferir autoplay sem som quando tecnicamente adequado, com playsinline e controles acessíveis quando necessário.
- Usar poster/frame de abertura para evitar flashes e melhorar carregamento.
- Lazy-load fora da primeira dobra.
- Preservar proporção 9:16 sem distorção.
- Não reproduzir todos ao mesmo tempo.

### Distribuição prevista

- A Clínica: atmosfera e experiência de atendimento, quando o vídeo for compatível com ambiente/rotina.
- Procedimentos: vídeo contextual próximo ao tratamento correspondente.
- Ambiente: cenas que valorizem espaço, cuidado e experiência.
- Nossa Equipe: somente se houver vídeo realmente adequado à apresentação profissional.

A associação exata de cada arquivo a cada seção será definida após inspeção visual de seu conteúdo, sem adivinhar o procedimento.

## 9. Resultados

- Continuar separado de Procedimentos.
- Usar apenas material autorizado.
- Tratar imagem como evidência visual, não como promessa.
- Legendas discretas e objetivas.
- Não transformar a página em mosaico excessivamente denso.

## 10. A Clínica e Ambiente

### A Clínica

Deve apresentar:

- posicionamento;
- proposta de atendimento;
- dados institucionais confirmados;
- localização;
- experiência BC;
- imagens reais.

### Ambiente

A página pode assumir uma linguagem mais imersiva:

- fotografia grande;
- vídeo pontual;
- textos curtos;
- detalhes do espaço;
- ritmo visual mais lento.

## 11. Mel

A página exclusiva da Mel continua sendo uma peça de autoridade pessoal e institucional.

- Não repetir toda a página Nossa Equipe.
- Aprofundar trajetória, filosofia e Harmonização Invisível usando somente material confirmado.
- Linguagem autoral, natural e sofisticada.

## 12. SEO e descoberta

O redesign deve incluir melhorias técnicas sem descaracterizar a Home.

### Prioridades

1. Títulos de página entre aproximadamente 30–60 caracteres quando natural.
2. Meta descriptions específicas por página.
3. Canonical URL em todas as páginas.
4. Open Graph: og:title, og:description, og:image e og:url.
5. Twitter/X card equivalente quando útil.
6. JSON-LD LocalBusiness/HealthAndBeautyBusiness ou tipo mais adequado após validação, com dados oficiais da clínica.
7. Endereço, telefone, horário e URL consistentes.
8. Sitemap/robots quando necessário.
9. Alt text descritivo em imagens.
10. Conteúdo aprofundado nas páginas internas, sem transformar a Home em texto para buscador.

## 13. Performance

### Imagens

- Preferir WebP/AVIF quando compatível.
- Definir width/height ou aspect-ratio para reduzir CLS.
- Lazy-load em mídia fora da primeira dobra.

### Vídeo

- Criar versões web otimizadas preservando originais.
- Preferir MP4/H.264 de ampla compatibilidade, com compressão equilibrada.
- Usar preload="metadata" ou "none" fora da dobra.
- Poster otimizado.
- Não baixar quatro vídeos simultaneamente no carregamento inicial.

### JavaScript

- Preservar o menu sem frameworks desnecessários.
- Animações preferencialmente em CSS e IntersectionObserver leve.
- Respeitar prefers-reduced-motion.

## 14. Acessibilidade

- Contraste suficiente para textos sobre vídeo/foto.
- Alt text em imagens informativas.
- Legendas/transcrição para vídeo falado quando aplicável.
- Controles acessíveis por teclado.
- Foco visível.
- Motion reduzido para quem solicitar.
- Não depender apenas de hover.

## 15. Componentes visuais a criar/refinar

1. Hero editorial interno.
2. Retrato profissional editorial.
3. Bloco de vídeo cinematográfico 9:16.
4. Tratamento editorial expandível.
5. Marcas/tags discretas para áreas de atuação.
6. Section heading premium.
7. Quote/manifesto institucional.
8. CTA final de avaliação.
9. Metadados e rodapés consistentes por página.

## 16. Assets de IA

IA visual pode ser usada apenas para material complementar quando faltar asset real, por exemplo:

- OG/social background sem pessoa real;
- textura abstrata;
- fundo editorial;
- detalhe conceitual.

Não usar IA para:

- representar Alice ou Mel como se fosse foto real;
- fabricar pacientes;
- fabricar resultados antes/depois;
- simular procedimento realizado na clínica como evidência.

## 17. Dados e segurança

- O redesign visual não deve alterar o funcionamento da pré-anamnese sem uma tarefa específica.
- Dados pessoais da pré-anamnese não entram em analytics, páginas públicas ou assets.
- A área de assinatura/rubrica do PDF permanece fora deste redesign.

## 18. Estratégia de implementação

A implementação deverá ser incremental, com uma página/área por vez, preservando o site publicável a cada commit.

Ordem recomendada:

1. Sistema visual global e tokens.
2. Nossa Equipe + Alice e Mel.
3. Ingestão/otimização dos quatro vídeos e componente de mídia.
4. Procedimentos com novo conteúdo editorial.
5. A Clínica e Ambiente com vídeos contextuais.
6. Página Mel.
7. Resultados.
8. SEO técnico global e Open Graph.
9. Revisão mobile completa.
10. Auditoria final de performance, links, SEO e acessibilidade.

## 19. Critérios de aceitação

O trabalho é considerado concluído quando:

- o menu continua 100% funcional no mobile;
- logo central e menu à direita não regrediram;
- Home continua limpa e sem conteúdo indevido;
- Alice aparece com foto real e conteúdo confirmado;
- vídeos reais aparecem apenas em contextos coerentes;
- nenhuma mídia distorce ou causa overflow lateral;
- nenhuma página depende de autoplay com áudio;
- performance mobile não sofre regressão grave;
- páginas internas ganham densidade editorial suficiente;
- metadados/canonical/OG/schema estão presentes onde planejado;
- nenhum preço ou claim clínico não confirmado é publicado;
- o site permanece no GitHub Pages oficial.

## 20. Não objetivos desta fase

- Trocar domínio.
- Migrar hospedagem.
- Criar novo CMS.
- Criar app separado.
- Reescrever a pré-anamnese.
- Alterar a assinatura/rubrica do PDF.
- Publicar tabela de preços não confirmada.
- Criar área de login/paciente.

## 21. Princípio final

A BC deve parecer uma marca de estética de alto padrão antes de parecer um catálogo de procedimentos.

A forma deve comunicar sofisticação; o conteúdo deve comunicar ciência, cuidado e transparência; e a tecnologia deve permanecer leve, confiável e discreta.