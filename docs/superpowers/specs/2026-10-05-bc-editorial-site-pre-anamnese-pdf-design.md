# BC Estética Avançada — Redesign editorial do site e da ficha de pré-anamnese

Data: 2026-10-05
Status: design aprovado em conversa; aguardando revisão desta especificação antes do plano de implementação
Repositório: `bcesteticaavancada/bcesteticaavancada-alt`

## 1. Objetivo

Evoluir a presença digital da BC Estética Avançada e a ficha final de pré-anamnese para um padrão visual premium, coeso e tecnicamente sólido, sem reconstruir os fluxos que já funcionam.

O resultado deve comunicar a proposta da BC — estética individualizada, naturalidade, ciência, estratégia e cuidado — e resolver dois problemas concretos:

1. a Home atual é visualmente elegante, mas ainda curta e com lacunas de conteúdo;
2. o PDF da pré-anamnese desperdiça espaço porque cada resposta ocupa praticamente toda a largura da página, mesmo quando é curta.

A meta não é produzir um documento clínico excessivamente decorativo. A meta é criar uma experiência editorial refinada, legível, informativa e eficiente.

## 2. Princípios de produto e marca

### 2.1. Posicionamento

A BC será apresentada como marca institucional protagonista. Os profissionais aparecem como autoridades dentro de suas especialidades, sem transformar o site em perfil pessoal.

Pilares centrais:

- rejuvenescimento natural;
- qualidade da pele;
- estética personalizada;
- ciência, tecnologia e estratégia;
- preservação da identidade do paciente.

Mensagens-base:

- “Menos achismo. Mais ciência.”
- “Estética para realçar, não transformar.”
- “A BC não começa pelo procedimento. Começa pela pessoa.”

### 2.2. Linguagem visual

Preservar e refinar a identidade já existente:

- fundo marfim / papel;
- chocolate / preto quente;
- dourado sóbrio;
- tipografia serifada editorial para títulos;
- tipografia sem serifa para leitura e dados;
- cantos arredondados controlados;
- cartões, faixas e divisões com bastante hierarquia e pouco ruído.

O visual deve parecer “acessível premium”, não ostentação e não estética hospitalar fria.

## 3. Escopo

O trabalho será dividido em quatro frentes integradas.

### Frente A — Home e páginas institucionais

Expandir a Home para contar a história e o método da BC com profundidade suficiente para reduzir espaços vazios, melhorar autoridade e corrigir fragilidades de SEO.

Estrutura recomendada:

1. Hero principal;
2. Método BC;
3. três pilares de autoridade;
4. tratamentos estratégicos;
5. protocolos assinatura;
6. Harmonização Invisível;
7. saúde capilar;
8. tecnologia com propósito;
9. ambiente real da clínica;
10. especialistas;
11. resultados e portfólio;
12. como funciona a avaliação;
13. FAQ enxuto;
14. CTA final para avaliação/agendamento.

A navegação e o menu existentes devem continuar funcionando.

### Frente B — Pré-anamnese no site

A pré-anamnese deve manter a lógica, validações, CPF, consentimentos, rubrica, envio e integração com Supabase já existentes.

A mudança será majoritariamente de apresentação e coerência visual:

- cabeçalho BC mais refinado;
- sensação de “ficha personalizada”, e não formulário genérico;
- melhor agrupamento visual por assunto;
- feedback de progresso claro;
- cards e campos com mesma linguagem da marca;
- responsividade mobile preservada.

Não alterar regras clínicas ou obrigatoriedades sem necessidade técnica documentada.

### Frente C — PDF final da pré-anamnese

O PDF continuará em A4 vertical e poderá ter múltiplas páginas. “Ficha única” significa um único documento personalizado por paciente, não obrigatoriamente uma única folha.

O redesenho deve eliminar o padrão de uma pergunta curta ocupando uma linha/bloco de largura total.

#### 3.1. Grade dinâmica

Cada campo será classificado em uma destas larguras:

- `1/3`: respostas muito curtas ou booleanas;
- `1/2`: dados médios;
- `1/1`: textos longos ou informações críticas.

Exemplos:

- CPF, idade, gestação, alergia, nicotina: 1/3 quando couber;
- WhatsApp, e-mail, condição de saúde curta: 1/2;
- histórico detalhado, expectativa, observações: largura total.

A linha só será renderizada quando houver campos suficientes para preenchê-la. Campos incompatíveis com o espaço restante devem ir para a linha seguinte, sem sobreposição.

#### 3.2. Seções do documento

Ordem visual:

1. cabeçalho premium com logo e identificação da ficha;
2. identificação do paciente;
3. objetivo da avaliação;
4. histórico estético;
5. pele e exposição solar;
6. saúde e segurança;
7. hábitos e contexto;
8. módulo específico do procedimento;
9. expectativas e observações;
10. síntese estruturada da pré-avaliação;
11. consentimentos;
12. rubrica de confirmação;
13. área de assinatura presencial / profissional, se já existente no fluxo.

#### 3.3. Cabeçalho e rodapé

Cabeçalho:

- logo BC em destaque, sem ocupar espaço excessivo;
- título “Pré-Avaliação Estética Individualizada”;
- código público da ficha;
- data/hora de geração.

Rodapé:

- número da página;
- código público;
- identificação curta da BC;
- aviso discreto de que a pré-anamnese não substitui avaliação profissional.

#### 3.4. Síntese estruturada

A síntese deve reorganizar apenas informações realmente fornecidas pelo paciente.

Nesta versão não haverá dependência de um modelo de IA em tempo de geração do documento.

Motivos:

- evitar que um modelo gere fato clínico não declarado;
- manter geração determinística;
- reduzir dependência externa e custo;
- manter o PDF reproduzível e auditável.

A síntese poderá usar regras determinísticas para agrupar:

- principal objetivo declarado;
- histórico estético relevante;
- informações de saúde informadas;
- alergias/medicações declaradas;
- observações que merecem conversa presencial.

Nunca criar diagnóstico, contraindicação, indicação de procedimento ou conclusão clínica automática.

### Frente D — Mídia editorial, conteúdo e SEO

Completar lacunas visuais e narrativas do site priorizando material real da BC e usar geração de imagem apenas quando faltar um recurso editorial legítimo. A mesma frente inclui os ajustes de SEO técnico e metadados identificados nas auditorias.

## 4. Arquitetura técnica do PDF

O arquivo atual concentra sanitização, labels, paginação, desenho e conteúdo em `supabase/functions/submit-pre-anamnese/pdf.ts`.

O redesign deverá separar responsabilidades para facilitar testes e futuras alterações.

Estrutura preferida:

- `pdf.ts` — orquestra criação do documento e fontes/imagens;
- `pdf-content.ts` — labels humanas, seções e transformação segura dos dados de entrada;
- `pdf-layout.ts` — cálculo de largura, altura, empacotamento em linhas e decisão de quebra de página;
- testes unitários para layout e conteúdo.

Se a estrutura atual tornar a separação excessivamente arriscada, a implementação poderá começar com funções internas puras em `pdf.ts`, desde que o layout seja testável e posteriormente extraível.

### 4.1. Layout planner

O planejador deve receber itens normalizados e produzir uma lista de linhas renderizáveis.

Cada item contém, no mínimo:

- `label`;
- `displayValue`;
- `span` (`1`, `2` ou `3`, em uma grade de 3 colunas);
- `estimatedHeight`;
- `importance`/tipo para impedir compressão inadequada de conteúdo crítico.

A renderização deve calcular a altura máxima da linha e alinhar todos os cards dessa linha pelo topo.

Nenhum card pode atravessar o limite inferior da página.

## 5. Imagens e mídia

### 5.1. Prioridade de uso

Ordem de preferência:

1. fotografia e vídeo reais da BC;
2. assets oficiais já presentes no repositório;
3. material fornecido pela equipe;
4. imagem gerada por IA apenas quando houver lacuna editorial real.

### 5.2. Uso de geração de imagem

Imagem gerada por IA pode ser usada para:

- fundos abstratos;
- texturas editoriais;
- composições não clínicas;
- elementos visuais de apoio;
- placeholders temporários bem identificados internamente.

Não usar IA para inventar:

- “antes e depois”;
- resultado de paciente;
- ambiente apresentado como se fosse foto real da clínica;
- profissional real não fotografado;
- execução de procedimento apresentada como registro real da BC.

Quando a geração for necessária, os arquivos devem entrar em diretório específico, por exemplo `assets/editorial/generated/`, para deixar clara a origem.

## 6. Conteúdo e SEO

O scan atual do Grow My Website apontou nota 71/100 e fragilidades de conteúdo e metadados.

O redesign deve incluir, onde aplicável:

- title descritivo na faixa recomendada;
- meta description específica;
- canonical;
- Open Graph (`og:title`, `og:description`, `og:image`, `og:url`);
- JSON-LD do tipo `LocalBusiness` ou subtipo adequado;
- textos alternativos úteis em imagens;
- conteúdo textual suficiente na Home sem enchimento artificial;
- FAQ real, baseado em dúvidas de clientes, quando couber;
- dados consistentes de endereço, cidade, telefone e horário.

A página de pré-anamnese não deve ser tratada como página de aquisição orgânica. Para ela, privacidade, clareza e usabilidade têm prioridade sobre SEO.

## 7. Dados e segurança

Não haverá regressão nos controles já implementados.

Devem permanecer:

- CPF validado no frontend e backend;
- CPF fora do rascunho local persistente;
- consentimento explícito de tratamento dos dados;
- rubrica validada;
- validação do PNG da rubrica no servidor;
- hashes de integridade da rubrica e payload;
- armazenamento privado do PDF;
- acesso administrativo protegido;
- ausência de dados de teste falsos em produção.

O redesign não deve alterar o modelo de dados do Supabase salvo necessidade inevitável identificada durante implementação. Qualquer mudança de schema deve ser tratada separadamente e migrada de forma aditiva.

## 8. Conteúdo clínico e alegações

As descrições de procedimentos precisam ser atraentes, mas tecnicamente prudentes.

Evitar promessas absolutas ou linguagem como:

- “sem recuperação”;
- “funciona para todos”;
- “elimina gordura”;
- “resultado garantido”.

Preferir formulações como:

- “pode contribuir para…”;
- “indicado após avaliação profissional…”;
- “o protocolo pode combinar tecnologias de acordo com a necessidade…”;
- “resultados e número de sessões variam conforme avaliação e resposta individual”.

## 9. Tratamento da logo

Usar a logo oficial já existente no repositório como referência principal.

Quando o novo arquivo de logo enviado pelo usuário chegar:

1. comparar proporção, fundo e resolução;
2. preservar a marca original sempre que estiver adequada;
3. criar apenas variantes técnicas necessárias para web/PDF, sem redesenhar o símbolo sem autorização específica;
4. preferir PNG/WebP com fundo transparente quando isso melhorar a composição.

## 10. Arquivos que provavelmente serão afetados

Site:

- `index.html`;
- `styles.css`;
- eventualmente `script.js`;
- páginas internas que precisem receber o mesmo sistema visual;
- `agendamento/index.html`;
- `agendamento/anamnese.css`.

PDF / backend:

- `supabase/functions/submit-pre-anamnese/pdf.ts`;
- novos módulos de conteúdo/layout, se adotados;
- testes relacionados ao gerador;
- nenhum schema de banco por padrão.

Assets:

- `assets/logo-oficial/`;
- `assets/` existentes;
- possível novo `assets/editorial/generated/`.

## 11. Estratégia de implementação

A implementação deverá ocorrer em etapas pequenas e verificáveis:

1. testes do planejador do PDF antes da troca visual;
2. novo grid e paginação do PDF;
3. cabeçalho/rodapé e síntese estruturada;
4. validação visual do PDF renderizado;
5. expansão editorial da Home;
6. refinamento visual da pré-anamnese;
7. inserção/otimização de mídia real;
8. geração de imagens apenas para lacunas restantes;
9. SEO técnico;
10. testes e auditorias finais.

## 12. Testes e critérios de aceitação

### PDF

- respostas curtas usam a largura disponível de forma eficiente;
- várias respostas curtas aparecem na mesma linha quando seguro;
- textos longos não são cortados;
- nenhum conteúdo sobrepõe outro;
- nenhuma seção fica cortada pelo rodapé;
- logo e rubrica mantêm proporção;
- CPF, consentimentos e hashes continuam corretos;
- documento permanece legível em impressão A4;
- paginação continua correta com respostas pequenas, médias e muito longas.

### Site

- menu funciona em desktop e mobile;
- nenhuma seção quebra em telas estreitas;
- imagens não causam overflow horizontal;
- CTA de avaliação continua funcional;
- páginas principais carregam sem erros de console;
- imagens possuem `alt` adequado;
- metadados sociais e SEO aparecem no HTML final;
- o site preserva identidade BC em todas as páginas modificadas.

### Conteúdo

- não inventar formação, procedimento, equipamento ou resultado;
- não prometer resultado clínico;
- nomes e especialidades devem corresponder ao material fornecido;
- textos de IA, quando usados como rascunho editorial, passam por revisão antes de publicação.

## 13. Não objetivos desta fase

Ficam fora do escopo, salvo descoberta técnica indispensável:

- reconstruir o sistema inteiro em outro framework;
- migrar GitHub Pages para outra hospedagem apenas por estética;
- trocar Supabase;
- criar prontuário eletrônico completo;
- inserir diagnóstico ou recomendação clínica automática;
- criar chat com IA para pacientes;
- gerar falsos resultados ou depoimentos;
- alterar regras de acesso administrativo sem motivo relacionado ao redesign.

## 14. Resultado esperado

Ao final, o site deve parecer uma extensão digital da experiência BC: elegante, técnica, humana e coerente.

A pré-anamnese deve chegar à profissional como um documento visualmente organizado, compacto e útil para leitura rápida, com densidade de informação adequada e sem páginas quase vazias por causa de respostas curtas.

A experiência inteira deve reforçar uma única mensagem: a BC avalia primeiro, entende a pessoa e então constrói uma estratégia estética individualizada.
