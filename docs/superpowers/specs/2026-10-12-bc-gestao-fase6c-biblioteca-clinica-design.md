# BC Gestão — Fase 6C — Biblioteca Clínica, Consentimentos e Fichas de Atendimento

Data: 2026-10-12
Status: design aprovado em conversa, aguardando aprovação final da especificação

## 1. Objetivo

Entregar uma Biblioteca Clínica pronta para uso real pela BC Estética, evitando que Mel e colaboradoras precisem construir manualmente cada fluxo clínico. A Fase 6C deve permitir selecionar um procedimento e o sistema já saber quais regras, documentos, permissões, valores, campos e etapas devem ser aplicados.

A solução deve ser simples no uso diário, com o mínimo de burocracia operacional, sem abrir mão de histórico, rastreabilidade, versionamento e segurança clínica.

## 2. Escopo da Fase 6C

Inclui:

- Biblioteca Clínica de procedimentos e protocolos.
- Catálogo inicial BC previamente configurado.
- Cadastro e edição de procedimentos por Mel e colaboradoras autorizadas, incluindo Alice.
- Classificação documental binária: `injetável` ou `não injetável`.
- Regra de enquadramento de procedimentos invasivos com agulha, cânula, fios de PDO ou outra inserção como classe `injetável` para fins de consentimento.
- Valores fechados ou valores do tipo “a partir de”.
- Permissões de execução por profissional, independentes do cargo administrativo.
- Módulos específicos de avaliação quando necessários.
- Dois modelos mestres de consentimento/documentação.
- Complemento específico opcional por procedimento.
- Ficha de atendimento individual por sessão.
- Fluxo de atendimento por estados.
- Versionamento de procedimentos, termos e fichas.
- Geração de PDFs clínicos finais.
- Protocolos Exclusivos BC™ simples ou compostos.
- Regras para composição automática de consentimentos quando um protocolo incluir componente injetável/invasivo.

Fica explicitamente fora da Fase 6C e permanece para a Fase 6D:

- armazenamento e gestão completa de fotos clínicas;
- biblioteca de produtos, lotes e rastreabilidade detalhada;
- cadastro/uso detalhado de equipamentos e parâmetros;
- registro estruturado de intercorrências.

A 6C pode declarar requisitos futuros como “exige foto” ou “exige produto/lote”, mas não implementará o subsistema completo desses recursos.

## 3. Princípios de desenho

### 3.1. Biblioteca pronta, não construtor vazio

A BC deve receber os procedimentos já previamente configurados. Mel e Alice poderão ajustar, criar e publicar novos procedimentos, mas o sistema não deve depender de preenchimento manual extensivo para começar a funcionar.

### 3.2. Motor clínico híbrido

A solução adotará um motor genérico baseado em metadados e regras, com possibilidade de extensões para procedimentos que precisem de lógica especial.

Não serão criados formulários totalmente independentes em código para cada procedimento, pois isso aumentaria duplicação e manutenção.

### 3.3. Histórico clínico nunca é destruído

Procedimento que já tenha sido utilizado em prontuário não pode ser excluído definitivamente. Pode apenas ser desativado/arquivado. Versões antigas permanecem vinculadas aos atendimentos em que foram usadas.

### 3.4. Simplicidade documental

O sistema deve evitar a criação de dezenas de PDFs independentes. A estratégia aprovada é trabalhar com dois modelos mestres e cabeçalho dinâmico com o nome do procedimento, permitindo complemento específico somente quando necessário.

## 4. Catálogo inicial oficial da BC

O catálogo inicial possui 30 itens únicos com preço informado. “Hidratação Facial” não será criado como item separado: a BC informou que esse nome foi substituído por `Reset Glow™`.

### 4.1. Procedimentos e Protocolos Exclusivos BC™

1. Limpeza de pele — R$ 190,00
2. Limpeza de pele com peeling — R$ 219,00
3. Massagem (relaxante, drenagem ou redutora) — R$ 195,00
4. Peeling — a partir de R$ 195,00
5. Black peel — R$ 390,00
6. Despigmentação — a partir de R$ 250,00
7. Botox terço superior — R$ 990,00
8. Botox full face — R$ 1.390,00
9. Botox Nefertiti — R$ 690,00
10. Skinbooster — a partir de R$ 490,00
11. Bioestimulador — a partir de R$ 1.390,00
12. Aplicação de enzimas — a partir de R$ 390,00
13. Profhilo — R$ 990,00 por sessão
14. Microagulhamento — a partir de R$ 490,00 por sessão
15. Ultrassom microfocado — a partir de R$ 990,00 por sessão
16. Radiofrequência / criofrequência fracionada — a partir de R$ 490,00 por sessão
17. Fort Hair™ — protocolo capilar — R$ 490,00 por sessão
18. Fort Hair Plus™ — protocolo capilar inovador — R$ 990,00 por sessão
19. Fort Brow™ — reconstrução de sobrancelhas — R$ 390,00 por sessão
20. Sculpt Cryo™ — R$ 590,00 por sessão
21. Reset Glow™ — R$ 190,00 por sessão
22. Monaco Glow™ — protocolo biorremodelador — R$ 890,00 por sessão
23. Skin Reset™ — a partir de R$ 1.990,00
24. Face Reset™ — a partir de R$ 2.990,00
25. Jato de Plasma — a partir de R$ 190,00
26. Harmonização Facial / Preenchimento — a partir de R$ 990,00
27. Lipo de Papada — a partir de R$ 390,00 por sessão
28. Tratamento para Estrias — a partir de R$ 390,00 por sessão
29. Tratamento de Vasinhos — R$ 180,00 por sessão
30. Remoção a Laser — a partir de R$ 250,00

### 4.2. Alias histórico

`Hidratação Facial` deve ser tratado como nome anterior/alias de `Reset Glow™`, sem duplicar o procedimento no catálogo ativo.

Se houver dado histórico com o nome antigo no futuro, o sistema deve preservá-lo como referência histórica, sem transformar os dois nomes em serviços ativos distintos.

## 5. Valores comerciais

Cada procedimento terá um modo de preço:

- `fixed`: preço fechado;
- `starting_at`: preço-base “a partir de”.

Para procedimentos `starting_at`:

- o sistema registra o preço-base;
- a profissional pode definir o valor final do atendimento;
- quando o valor final diferir do preço-base, o valor efetivamente aplicado e a alteração em relação ao base devem ficar registrados para auditoria e integração financeira.

## 6. Cadastro de procedimento

Mel e colaboradoras autorizadas, incluindo Alice, poderão criar novos procedimentos.

Campos mínimos:

- nome do procedimento;
- classe documental: `injetável` ou `não injetável`;
- categoria/família;
- descrição administrativa/clínica resumida;
- preço e modo de preço;
- duração sugerida;
- status ativo/inativo;
- profissionais autorizadas;
- exige Anamnese Geral válida;
- exige retorno e intervalo sugerido;
- orientações pré e pós;
- campos específicos da ficha de atendimento;
- complemento opcional de consentimento;
- indicadores futuros de foto/produto/equipamento;
- modo do protocolo: simples ou composto, quando aplicável.

Mel e Alice podem criar, editar, definir valor e publicar/ativar procedimentos. A Mel/ADM mantém poder superior para desativar/arquivar procedimentos da operação.

### 6.1. Regra de classificação documental

O sistema mantém apenas duas classes para simplificar o uso:

- `injetável`;
- `não injetável`.

Para fins documentais, entram na classe `injetável` não apenas aplicações por injeção, mas também procedimentos invasivos que utilizem agulha, cânula, fios de PDO ou outra inserção tecidual relevante.

Assim, o rótulo `injetável` funciona como a classe de consentimento mais rigorosa do sistema, sem pretender redefinir tecnicamente o nome do procedimento.

Exemplos de enquadramento aprovado:

- toxina botulínica → `injetável`;
- preenchimento → `injetável`;
- skinbooster → `injetável`;
- bioestimulador injetável → `injetável`;
- aplicação de enzimas/intradermoterapia → `injetável`;
- microagulhamento → `injetável` para fins documentais por envolver agulhas;
- fios de PDO → `injetável` para fins documentais por ser invasivo;
- criofrequência → `não injetável`;
- limpeza de pele → `não injetável`;
- ultrassom microfocado → `não injetável`.

Protocolos compostos podem ter sua classe documental derivada dos componentes da sessão. Se qualquer componente for `injetável`, a sessão exige o modelo de consentimento da classe `injetável`.

## 7. Permissões por profissional

O cargo administrativo não determina a capacidade clínica.

A autorização de execução é específica por procedimento.

Exemplo: Alice pode permanecer com papel administrativo de colaboradora e, ao mesmo tempo, estar autorizada para executar procedimentos injetáveis.

Regras:

- toda profissional autorizada pode visualizar o prontuário clínico compartilhado conforme as regras gerais do BC Gestão;
- somente profissionais explicitamente autorizadas podem iniciar, assinar e finalizar determinado procedimento;
- Botox inicia com autorização para Mel e Alice;
- a mesma estrutura permite habilitar Alice ou outras profissionais para demais injetáveis;
- restrição deve ser validada no backend/RPC, não apenas na interface;
- Mel e Alice podem cadastrar, editar, precificar e publicar procedimentos;
- Mel/ADM pode desativar/arquivar qualquer procedimento da operação.

## 8. Dois modelos mestres de consentimento

A 6C adotará apenas dois modelos-base, reduzindo burocracia.

### 8.1. Modelo A — Injetáveis / Invasivos

Documento-base:

`TCLE + Autorização para Procedimento Injetável/Invasivo`

O nome do procedimento é inserido dinamicamente no cabeçalho.

Exemplos:

- TCLE E AUTORIZAÇÃO — BOTOX FULL FACE
- TCLE E AUTORIZAÇÃO — SKINBOOSTER
- TCLE E AUTORIZAÇÃO — MICROAGULHAMENTO
- TCLE E AUTORIZAÇÃO — FORT HAIR PLUS™

O documento deve conter conteúdo geral sólido para procedimentos injetáveis/invasivos e aceitar complemento específico opcional por procedimento.

A autorização é assinada a cada nova sessão/procedimento enquadrado nessa classe.

### 8.2. Modelo B — Não injetáveis

Documento-base:

`Termo de Responsabilidade e Consentimento`

O nome do procedimento é inserido dinamicamente no cabeçalho.

Exemplos:

- TERMO DE RESPONSABILIDADE E CONSENTIMENTO — LIMPEZA DE PELE
- TERMO DE RESPONSABILIDADE E CONSENTIMENTO — ULTRASSOM MICROFOCADO
- TERMO DE RESPONSABILIDADE E CONSENTIMENTO — SCULPT CRYO™

Para ciclos/protocolos não injetáveis, o termo pode permanecer válido para o ciclo definido, sem exigir nova assinatura em toda sessão, salvo mudança relevante de protocolo ou condição clínica.

## 9. Complemento específico opcional

Cada procedimento poderá possuir um complemento de consentimento específico, sem obrigar a criação de um documento totalmente novo.

O complemento deve ser versionado junto com o procedimento.

Isso permite manter dois modelos mestres simples e, ao mesmo tempo, registrar particularidades clínicas relevantes.

## 10. Protocolos Exclusivos BC™ — definições oficiais fornecidas pela BC

As descrições abaixo são conteúdo oficial fornecido pela própria BC para os protocolos exclusivos. Elas não devem ser substituídas por descrições genéricas encontradas na internet.

Quando necessário, a implementação pode separar `descrição comercial` de `fluxo clínico`, para evitar tratar texto de divulgação como instrução técnica.

### 10.1. Fort Hair™

Protocolo capilar intensivo indicado para pessoas que percebem maior exposição do couro cabeludo, afinamento dos fios ou áreas visivelmente mais ralas.

A proposta combina ativos de alta performance, incluindo exossomos e fatores de crescimento, com microestimulação, LED e tecnologias voltadas ao folículo.

Preço inicial: R$ 490,00 por sessão.

Classificação documental: deve ser derivada dos componentes efetivamente utilizados. Se a microestimulação ou outra etapa envolver agulha/inserção invasiva, utiliza a classe `injetável`; caso contrário, utiliza `não injetável`.

### 10.2. Fort Hair Plus™

Protocolo capilar desenvolvido com três pilares informados pela BC:

- fios de PDO + bioestimulação;
- eletroporação, descrita pela BC como microagulhamento sem agulhas por pulsos elétricos;
- homecare direcionado.

A descrição da BC associa os fios de PDO ao estímulo na região do bulbo capilar, microcirculação e colágeno, e a eletroporação à abertura temporária de canais celulares para favorecer penetração dos ativos.

Preço inicial: R$ 990,00 por sessão.

Classificação documental: `injetável`, por envolver fios de PDO/inserção invasiva, independentemente de a eletroporação ser não invasiva.

### 10.3. Fort Brow™

Protocolo de reconstrução de sobrancelhas, desenvolvido para melhorar aparência e densidade dos fios conforme a causa da rarefação e a avaliação individual.

Preço inicial: R$ 390,00 por sessão.

A técnica específica pode reutilizar o fluxo de tricologia de sobrancelhas já informado pela BC quando essa equivalência for confirmada pela clínica. Até essa confirmação, a descrição comercial não deve ser convertida automaticamente em técnica invasiva.

Classificação documental: derivada dos componentes efetivamente cadastrados para a sessão.

### 10.4. Sculpt Cryo™

Protocolo corporal para gordura localizada e flacidez. A BC informa uso de criofrequência, combinando radiofrequência em profundidade com resfriamento superficial da ponteira, incluindo referência operacional de resfriamento até −6 °C.

A descrição comercial da BC associa o contraste térmico à redução de medidas e estímulo de colágeno.

Preço inicial: R$ 590,00 por sessão.

Classificação documental inicial: `não injetável`.

Parâmetros específicos do equipamento permanecem para a Fase 6D e devem respeitar o aparelho/fabricante realmente utilizado.

### 10.5. Reset Glow™

Protocolo de revitalização facial com foco em viço e luminosidade, voltado a pele com aspecto mais descansado, uniforme e iluminado.

A BC o descreve como sem dor, sem agulhas e sem downtime.

Preço inicial: R$ 190,00 por sessão.

Classificação documental inicial: `não injetável`.

`Hidratação Facial` passa a ser tratado como nome anterior/alias deste protocolo.

### 10.6. Monaco Glow™

Protocolo biorremodelador descrito pela BC com PDRN, NADH, peptídeos biomiméticos, niacinamida e precursores da matriz dérmica, com foco em regeneração e qualidade global da pele, incluindo textura, firmeza e hidratação.

Preço inicial: R$ 890,00 por sessão.

A via de aplicação não foi especificada na definição recebida. Portanto, a classe documental deve ser derivada dos componentes/rota realmente cadastrados pela BC e não inferida externamente.

### 10.7. Skin Reset™

Protocolo de estímulo da pele em múltiplas camadas, combinando tecnologia, bioestimulador de colágeno e microagulhamento com selamento personalizado.

Preço inicial: a partir de R$ 1.990,00.

Classificação documental inicial: `injetável`, pois a composição informada inclui bioestimulador e microagulhamento, enquadrando-se na regra de consentimento mais rigorosa.

### 10.8. Face Reset™

Protocolo de “harmonização invisível” que combina toxina botulínica e preenchimento com ácido hialurônico de forma estratégica e personalizada, com proposta de restaurar estrutura facial preservando a fisionomia.

Preço inicial: a partir de R$ 2.990,00.

Classificação documental inicial: `injetável`.

### 10.9. Regra de protocolos simples e compostos

Os Protocolos Exclusivos BC™ podem ser configurados em dois modos:

- procedimento único;
- protocolo composto por etapas/sessões.

A escolha é configurável por protocolo.

Quando um protocolo composto incluir componente `injetável`:

- aplica-se o termo básico do protocolo quando pertinente;
- aplica-se também o TCLE + Autorização da classe `injetável` para a sessão/componente;
- o tipo de documento exigido deriva da composição real da sessão.

Se a sessão for totalmente `não injetável`, aplica-se apenas o Termo de Responsabilidade e Consentimento correspondente.

## 11. Fluxos operacionais já informados pela BC

Esses fluxos representam a descrição operacional fornecida pela BC e devem orientar os modelos iniciais, sem adicionar etapas inventadas.

### Botox

- assepsia da face;
- registro fotográfico;
- marcações dos pontos;
- aplicação da toxina botulínica.

### Intradermoterapia

- assepsia;
- delimitação da área;
- injeções intradérmicas enzimáticas.

### Terapia Capilar

- análise microscópica;
- assepsia da região;
- aplicação de enzimas para estímulo de crescimento, nutrição e hidratação.

Quando houver componente injetável/invasivo, utiliza o fluxo documental da classe `injetável`.

### Microagulhamento

- assepsia;
- anestésico tópico;
- microagulhamento com ativo conforme necessidade da paciente.

Por envolver agulhas, a classe documental é `injetável` conforme regra simplificada aprovada pela BC.

### Ultrassom Micro e Macrofocado

- assepsia;
- gel condutor;
- aplicação do ultrassom micro ou macrofocado.

### Skinbooster

- higienização;
- marcações da área;
- aplicação do produto para estímulo de colágeno, elastina e hidratação facial.

### Peeling Químico

- higienização;
- aplicação do peeling nas áreas definidas;
- neutralização conforme técnica utilizada;
- remoção;
- protetor solar.

### Jato de Plasma

- assepsia;
- registros fotográficos;
- delimitação da área;
- aplicação no local desejado;
- protetor solar.

### Harmonização Facial / Preenchimento

- registros fotográficos;
- assepsia;
- demarcações dos pontos;
- anestesia do local quando aplicável;
- aplicação do preenchimento.

### Bioestimulador de Colágeno

- registros fotográficos;
- higienização;
- demarcação dos pontos;
- anestesia quando aplicável;
- aplicação do bioestimulador.

### Lipo de Papada

- registros fotográficos;
- assepsia;
- delimitação da área;
- aplicação de enzimas lipolíticas.

### Tratamento para Estrias

- registros fotográficos;
- assepsia;
- microagulhamento com ativos regeneradores conforme protocolo da BC.

Por envolver microagulhamento, a classe documental é `injetável` para fins do motor simplificado.

### Tratamento de Vasinhos

- registros fotográficos;
- assepsia;
- aplicação dos ativos definidos pelo protocolo da BC.

Quando houver aplicação injetável, utiliza a classe `injetável`.

### Remoção a Laser

- registros fotográficos;
- análise de pele/resíduo pigmentar conforme método adotado pela BC;
- assepsia;
- aplicação do laser.

### Tricologia de Sobrancelhas

- registros fotográficos;
- assepsia;
- alta frequência;
- microagulhamento com ativos regeneradores do folículo piloso.

Por envolver microagulhamento, utiliza a classe documental `injetável`.

### Limpeza de Pele

- registros fotográficos;
- higienização com produto adequado ao tipo de pele;
- emoliência;
- vapor com ozônio;
- extração;
- alta frequência;
- máscara hidratante/calmante;
- protetor solar.

### Reset Glow™ / antigo “Hidratação Facial”

O nome oficial no catálogo é `Reset Glow™`.

O fluxo operacional anteriormente informado como “Hidratação Facial” pode ser mantido como referência inicial editável:

- registros fotográficos;
- higienização;
- peeling de diamante;
- máscara enzimática;
- LED vermelho e azul;
- ativos e fatores de crescimento conforme protocolo da BC;
- máscara de hidratação;
- protetor solar.

A descrição oficial mais recente da BC define o Reset Glow™ como protocolo de revitalização facial sem agulhas e sem downtime. Caso o fluxo técnico final seja alterado pela clínica, deve prevalecer a versão publicada mais recente, preservando histórico.

## 12. Classificação documental inicial

A classe `injetável` é a classe documental de maior rigor e também engloba invasivos com agulha, cânula ou fios de PDO.

Itens claramente enquadrados como `injetável` a partir das informações disponíveis:

- Botox Terço Superior;
- Botox Full Face;
- Botox Nefertiti;
- Skinbooster;
- Bioestimulador;
- Aplicação de Enzimas / Intradermoterapia;
- Profhilo;
- Harmonização Facial / Preenchimento;
- Lipo de Papada com enzimas;
- Tratamento de Vasinhos quando realizado por aplicação injetável;
- Terapia Capilar quando envolver aplicação injetável/invasiva;
- Microagulhamento;
- Tratamento para Estrias por microagulhamento;
- Tricologia de Sobrancelhas com microagulhamento;
- Fort Hair Plus™ por fios de PDO;
- Skin Reset™;
- Face Reset™.

Itens claramente `não injetáveis` a partir das informações atuais incluem:

- Limpeza de Pele;
- Limpeza de Pele com Peeling, quando sem componente invasivo;
- Peeling;
- Black Peel, quando sem componente invasivo;
- Despigmentação, quando sem componente invasivo;
- Massagem;
- Ultrassom micro/macro focado;
- Radiofrequência / criofrequência fracionada;
- Sculpt Cryo™;
- Reset Glow™;
- Remoção a Laser;
- Jato de Plasma, quando não envolver etapa invasiva adicional.

Fort Hair™, Fort Brow™ e Monaco Glow™ devem derivar a classe dos componentes realmente cadastrados enquanto a BC não tiver especificado de forma inequívoca a via/técnica invasiva de cada sessão.

## 13. Ficha de atendimento

Cada sessão/procedimento gera uma ficha própria, mesmo quando:

- ocorre no mesmo dia de outro procedimento;
- faz parte de um protocolo composto;
- faz parte de pacote/plano de tratamento.

Campos genéricos mínimos:

- paciente;
- procedimento e versão;
- profissional responsável;
- data/hora;
- situação da Anamnese Geral;
- confirmação de atualização de saúde;
- alertas revisados;
- consentimento aplicável e versão;
- área/região tratada;
- observações clínicas;
- campos específicos do procedimento;
- orientações pós registradas;
- retorno recomendado;
- assinatura da profissional;
- estado do atendimento.

A paciente não precisa assinar novamente a ficha técnica final se já assinou o consentimento exigido para aquele atendimento/ciclo.

## 14. Estados do atendimento

Fluxo aprovado:

`Rascunho -> Pronto para iniciar -> Em atendimento -> Finalizado`

### Rascunho

Pode ser salvo enquanto a profissional prepara o atendimento.

### Pronto para iniciar

Somente quando os requisitos configurados estiverem satisfeitos:

- Anamnese Geral válida quando exigida;
- atualização de saúde do dia;
- alertas clínicos revisados;
- profissional autorizada;
- consentimento correto assinado;
- módulo específico obrigatório concluído, quando houver.

### Em atendimento

Representa sessão efetivamente iniciada.

### Finalizado

Ficha concluída e assinada pela profissional. Gera documento final imutável e referência de PDF.

## 15. Assinaturas e frequência

### Classe `injetável`

- consentimento/autorização assinado em cada nova sessão/procedimento;
- nova assinatura também exigida se houver mudança relevante de protocolo ou condição clínica.

### Classe `não injetável`

- termo pode valer pelo ciclo/protocolo definido;
- nova assinatura exigida em caso de mudança relevante de procedimento, protocolo ou condição clínica.

### Profissional

- assinatura profissional na ficha final de cada sessão.

## 16. Versionamento

Publicar alteração relevante cria nova versão.

Devem ser versionados:

- procedimento;
- campos específicos;
- orientações;
- complemento de consentimento;
- regras de retorno;
- regras de acesso;
- modelo mestre quando alterado;
- composição de protocolos exclusivos.

Atendimentos antigos permanecem vinculados às versões efetivamente usadas.

Exemplo:

- atendimento antigo usa `Botox Full Face v1`;
- procedimento atual está em `v4`;
- o prontuário antigo continua apontando para `v1`.

Documentos finais não são sobrescritos.

## 17. Correção e reabertura

Mantém as regras gerais já aprovadas para o prontuário:

- correção pelo autor durante o mesmo dia clínico preserva versão anterior;
- após o encerramento do dia clínico em America/Sao_Paulo, o registro fica bloqueado;
- alteração posterior exige reabertura temporária autorizada pela Mel/ADM;
- a correção é feita pelo autor original;
- toda ação fica auditada.

## 18. PDFs clínicos

A 6C deve gerar PDFs institucionais a partir dos dados estruturados.

Tipos:

- TCLE + Autorização para Procedimento Injetável/Invasivo;
- Termo de Responsabilidade e Consentimento para Não Injetável;
- Ficha de Atendimento Finalizada.

Características:

- cabeçalho dinâmico com nome do procedimento;
- identificação da paciente;
- identificação profissional e snapshot de credenciais;
- versão do procedimento e do documento;
- assinaturas aplicáveis;
- código/identificador único;
- data/hora;
- referência à Anamnese Geral válida;
- referência a complementos específicos quando existentes.

Exemplos automáticos:

- `TCLE E AUTORIZAÇÃO — BOTOX FULL FACE`;
- `TCLE E AUTORIZAÇÃO — MICROAGULHAMENTO`;
- `TERMO DE RESPONSABILIDADE E CONSENTIMENTO — RESET GLOW™`.

PDF finalizado é imutável. Correção posterior produz nova versão/documento, preservando o anterior.

## 19. Conteúdo técnico e fontes

Para procedimentos comuns, os modelos pré-definidos devem ser construídos a partir de fontes técnicas e regulatórias apropriadas e atuais, priorizando:

1. Anvisa e normas sanitárias aplicáveis;
2. conselhos profissionais competentes;
3. instruções de uso/fabricante quando produto ou equipamento específico estiver envolvido;
4. literatura técnica confiável quando necessária.

O sistema não deve inventar contraindicações, doses, concentrações, profundidades, energia, parâmetros de aparelho ou condutas clínicas.

Nos Protocolos Exclusivos BC™, a composição e a identidade comercial vêm da própria BC.

Descrições comerciais fornecidas pela BC devem ser preservadas como conteúdo institucional, mas não devem ser tratadas automaticamente como evidência regulatória ou como instrução técnica quando não trouxerem detalhes suficientes.

Antes do uso real, conteúdos clínicos pré-definidos devem permanecer editáveis e sujeitos à validação profissional da clínica.

## 20. Integração com fases posteriores

### Fase 6D

Receberá:

- fotos clínicas privadas;
- produtos/lotes;
- equipamentos/parâmetros;
- intercorrências.

A estrutura de 6C deve permitir referenciar esses recursos futuramente sem quebra de schema.

### Fase 6E

Planos/pacotes poderão reutilizar os procedimentos da Biblioteca Clínica. Cada sessão continuará gerando ficha individual.

## 21. Critérios de aceite da Fase 6C

A fase será considerada funcional quando:

1. Mel e Alice conseguirem cadastrar e publicar procedimento com nome, classe, preço e regras básicas.
2. O sistema escolher automaticamente o modelo de consentimento pela classe `injetável`/`não injetável`.
3. Procedimentos com agulha, cânula, fios de PDO ou inserção invasiva forem direcionados ao modelo documental `injetável`.
4. O nome do procedimento aparecer automaticamente no cabeçalho do documento.
5. Complemento específico puder ser associado sem criar um novo modelo inteiro.
6. Procedimentos puderem receber autorização por profissional.
7. Alice puder executar procedimentos injetáveis quando explicitamente autorizada.
8. Procedimento usado em prontuário não puder ser excluído, apenas arquivado.
9. Procedimentos “a partir de” aceitarem valor final diferente do base com registro auditável.
10. Os 30 itens iniciais estiverem precificados no seed inicial, sem duplicar Hidratação Facial/Reset Glow™.
11. Protocolos exclusivos puderem ser simples ou compostos.
12. Protocolo composto herdar automaticamente autorização da classe `injetável` quando houver componente injetável/invasivo.
13. Cada sessão gerar ficha individual.
14. O fluxo `Rascunho -> Pronto para iniciar -> Em atendimento -> Finalizado` respeitar os gates clínicos.
15. Termos, procedimentos e fichas preservarem versões históricas.
16. PDFs finais serem imutáveis e vinculados ao prontuário.
17. Fotos clínicas, lotes/equipamentos e intercorrências permanecerem fora da implementação desta fase, sem bloquear a futura 6D.

## 22. Não objetivos

Esta fase não deve:

- substituir avaliação profissional;
- determinar automaticamente aptidão clínica;
- emitir diagnóstico;
- sugerir doses ou parâmetros de aplicação;
- liberar profissional não autorizada;
- apagar histórico clínico;
- incorporar de forma improvisada os subsistemas reservados para 6D;
- inferir técnica clínica de protocolos exclusivos quando a BC não tiver fornecido informação suficiente.

## 23. Decisões finais aprovadas em conversa

- Biblioteca Clínica previamente pronta.
- Catálogo oficial inicial com 30 itens únicos precificados.
- `Hidratação Facial` deixa de existir como item ativo separado e passa a ser alias/nome anterior de `Reset Glow™`.
- Jato de Plasma — a partir de R$ 190,00.
- Harmonização Facial / Preenchimento — a partir de R$ 990,00.
- Lipo de Papada — a partir de R$ 390,00 por sessão.
- Tratamento para Estrias — a partir de R$ 390,00 por sessão.
- Tratamento de Vasinhos — R$ 180,00 por sessão.
- Remoção a Laser — a partir de R$ 250,00.
- Preço-base + valor final auditável para itens “a partir de”.
- Permissão clínica por profissional, independente do cargo administrativo.
- Alice pode realizar injetáveis quando autorizada.
- Mel e Alice podem cadastrar, editar, precificar e publicar procedimentos.
- Mel/ADM pode desativar/arquivar procedimentos.
- Procedimento usado nunca é apagado.
- Dois modelos mestres de documentos: `injetável` e `não injetável`.
- Para simplificar, procedimentos invasivos com agulha, cânula, fios de PDO ou inserção entram na classe documental `injetável`.
- Nome do procedimento dinâmico no cabeçalho.
- Complemento específico opcional por procedimento.
- Classe `injetável` exige nova autorização a cada sessão.
- Classe `não injetável` pode usar termo por ciclo/protocolo.
- Protocolos exclusivos podem ser simples ou compostos.
- Protocolos compostos herdam exigência da classe `injetável` conforme a composição real da sessão.
- Definições oficiais de Fort Hair™, Fort Hair Plus™, Fort Brow™, Sculpt Cryo™, Reset Glow™, Monaco Glow™, Skin Reset™ e Face Reset™ vêm da própria BC.
- Cada sessão gera ficha própria.
- Fluxo de atendimento aprovado em quatro estados.
- 6D permanece responsável por fotos clínicas, produtos/lotes/equipamentos e intercorrências.
