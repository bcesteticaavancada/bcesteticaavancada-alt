# BC Gestão — Fase 6C — Biblioteca Clínica, Consentimentos e Fichas de Atendimento

Data: 2026-10-12
Status: design aprovado em conversa, aguardando revisão final do documento

## 1. Objetivo

Entregar uma Biblioteca Clínica pronta para uso real pela BC Estética, evitando que Mel e colaboradoras precisem construir manualmente cada fluxo clínico. A Fase 6C deve permitir selecionar um procedimento e o sistema já saber quais regras, documentos, permissões, valores, campos e etapas devem ser aplicados.

A solução deve ser simples no uso diário, mas preservar histórico, rastreabilidade, versionamento e segurança clínica.

## 2. Escopo da Fase 6C

Inclui:

- Biblioteca Clínica de procedimentos.
- Cadastro e edição de procedimentos por Mel e colaboradoras autorizadas, incluindo Alice.
- Classe clínica do procedimento: injetável ou não injetável.
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
- Regras para composição automática de consentimentos quando um protocolo incluir componente injetável.

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

## 4. Catálogo inicial oficial da BC

### 4.1. Procedimentos com preço informado

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

### 4.2. Tratamentos adicionais já identificados, ainda sem preço informado

- Jato de Plasma
- Harmonização Facial / Preenchimento
- Lipo de Papada
- Tratamento para Estrias
- Tratamento de Vasinhos
- Remoção a Laser
- Hidratação Facial

Esses itens podem ter estrutura clínica preparada, mas não devem ser ativados para cobrança/agendamento até que preço e status sejam definidos pela BC.

## 5. Valores comerciais

Cada procedimento terá um modo de preço:

- `fixed`: preço fechado;
- `starting_at`: preço-base “a partir de”.

Para procedimentos `starting_at`:

- o sistema registra o preço-base;
- a profissional pode definir o valor final do atendimento;
- quando o valor final diferir do preço-base, a diferença e o valor efetivamente aplicado devem ficar registrados para auditoria e integração financeira.

## 6. Cadastro de procedimento

Mel e colaboradoras autorizadas, incluindo Alice, poderão criar novos procedimentos.

Campos mínimos:

- nome do procedimento;
- classe: `injetável` ou `não injetável`;
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
- indicadores futuros de foto/produto/equipamento.

Mel e Alice podem criar, editar, definir valor e publicar/ativar procedimentos. A Mel/ADM mantém poder superior para desativar/arquivar procedimentos da operação.

## 7. Permissões por profissional

O cargo administrativo não determina a capacidade clínica.

A autorização de execução é específica por procedimento.

Exemplo: Alice pode permanecer com papel administrativo de colaboradora e, ao mesmo tempo, estar autorizada para executar procedimentos injetáveis.

Regras:

- toda profissional autorizada pode visualizar o prontuário clínico compartilhado conforme as regras gerais do BC Gestão;
- somente profissionais explicitamente autorizadas podem iniciar, assinar e finalizar determinado procedimento;
- Botox inicia com autorização para Mel e Alice;
- a mesma estrutura permite habilitar Alice ou outras profissionais para demais injetáveis;
- restrição deve ser validada no backend/RPC, não apenas na interface.

## 8. Dois modelos mestres de consentimento

A 6C adotará apenas dois modelos-base, reduzindo burocracia.

### 8.1. Modelo A — Injetáveis

Documento-base:

`TCLE + Autorização para Procedimento Injetável`

O nome do procedimento é inserido dinamicamente no cabeçalho.

Exemplos:

- TCLE E AUTORIZAÇÃO — BOTOX FULL FACE
- TCLE E AUTORIZAÇÃO — SKINBOOSTER
- TCLE E AUTORIZAÇÃO — BIOESTIMULADOR

O documento deve conter conteúdo geral sólido para procedimentos injetáveis e aceitar complemento específico opcional por procedimento.

A autorização específica é assinada a cada nova sessão/procedimento injetável.

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

## 10. Regra para Protocolos Exclusivos BC™

Os Protocolos Exclusivos BC™ podem ser configurados em dois modos:

- procedimento único;
- protocolo composto por etapas/sessões.

A escolha é configurável por protocolo.

Quando um protocolo composto incluir componente injetável:

- aplica-se o termo básico do protocolo quando pertinente;
- aplica-se também o TCLE + Autorização de Injetável para o componente injetável;
- o tipo de documento exigido deriva da composição real da sessão.

Se a sessão for totalmente não injetável, aplica-se apenas o Termo de Responsabilidade e Consentimento correspondente.

A composição técnica dos Protocolos Exclusivos BC™ será definida pela própria BC e não será inferida por pesquisa externa.

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

Quando houver componente injetável, utiliza o fluxo documental de injetáveis.

### Microagulhamento

- assepsia;
- anestésico tópico;
- microagulhamento com ativo conforme necessidade da paciente.

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

### Tratamento de Vasinhos

- registros fotográficos;
- assepsia;
- aplicação dos ativos definidos pelo protocolo da BC.

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

### Limpeza de Pele

- registros fotográficos;
- higienização com produto adequado ao tipo de pele;
- emoliência;
- vapor com ozônio;
- extração;
- alta frequência;
- máscara hidratante/calmante;
- protetor solar.

### Hidratação Facial

- registros fotográficos;
- higienização;
- peeling de diamante;
- máscara enzimática;
- LED vermelho e azul;
- ativos e fatores de crescimento conforme protocolo da BC;
- máscara de hidratação;
- protetor solar.

## 12. Classificação documental inicial

Procedimentos claramente injetáveis já identificados:

- Botox Terço Superior;
- Botox Full Face;
- Botox Nefertiti;
- Skinbooster;
- Bioestimulador;
- Aplicação de Enzimas / Intradermoterapia;
- Profhilo;
- Harmonização Facial / Preenchimento;
- Lipo de Papada com enzimas;
- Tratamento de Vasinhos quando realizado por aplicação injetável de ativos;
- Terapia Capilar quando envolver aplicação injetável.

Procedimentos não injetáveis usam o termo básico, salvo quando um protocolo específico incluir componente injetável.

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

### Injetáveis

- consentimento/autorização assinado em cada nova sessão/procedimento;
- nova assinatura também exigida se houver mudança relevante de protocolo ou condição clínica.

### Não injetáveis

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
- modelo mestre quando alterado.

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

- TCLE + Autorização para Procedimento Injetável;
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

PDF finalizado é imutável. Correção posterior produz nova versão/documento, preservando o anterior.

## 19. Conteúdo técnico e fontes

Para procedimentos comuns, os modelos pré-definidos devem ser construídos a partir de fontes técnicas e regulatórias apropriadas e atuais, priorizando:

1. Anvisa e normas sanitárias aplicáveis;
2. conselhos profissionais competentes;
3. instruções de uso/fabricante quando produto ou equipamento específico estiver envolvido;
4. literatura técnica confiável quando necessária.

O sistema não deve inventar contraindicações, doses, concentrações, profundidades, energia, parâmetros de aparelho ou condutas clínicas.

Nos Protocolos Exclusivos BC™, a composição vem da própria BC.

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
3. O nome do procedimento aparecer automaticamente no cabeçalho do documento.
4. Complemento específico puder ser associado sem criar um novo modelo inteiro.
5. Procedimentos puderem receber autorização por profissional.
6. Alice puder executar procedimentos injetáveis quando explicitamente autorizada.
7. Procedimento usado em prontuário não puder ser excluído, apenas arquivado.
8. Procedimentos “a partir de” aceitarem valor final diferente do base com registro auditável.
9. Protocolos exclusivos puderem ser simples ou compostos.
10. Protocolo composto herdar automaticamente autorização de injetável quando houver componente injetável.
11. Cada sessão gerar ficha individual.
12. O fluxo `Rascunho -> Pronto para iniciar -> Em atendimento -> Finalizado` respeitar os gates clínicos.
13. Termos, procedimentos e fichas preservarem versões históricas.
14. PDFs finais serem imutáveis e vinculados ao prontuário.
15. Fotos clínicas, lotes/equipamentos e intercorrências permanecerem fora da implementação desta fase, sem bloquear a futura 6D.

## 22. Não objetivos

Esta fase não deve:

- substituir avaliação profissional;
- determinar automaticamente aptidão clínica;
- emitir diagnóstico;
- sugerir doses ou parâmetros de aplicação;
- liberar profissional não autorizada;
- apagar histórico clínico;
- incorporar de forma improvisada os subsistemas reservados para 6D.

## 23. Decisões finais aprovadas em conversa

- Biblioteca Clínica previamente pronta.
- Catálogo oficial inicial da BC com 24 procedimentos precificados.
- Sete tratamentos adicionais mantidos sem preço até definição.
- Preço-base + valor final auditável para itens “a partir de”.
- Permissão clínica por profissional, independente do cargo administrativo.
- Alice pode realizar injetáveis quando autorizada.
- Mel e Alice podem cadastrar, editar, precificar e publicar procedimentos.
- Mel/ADM pode desativar/arquivar procedimentos.
- Procedimento usado nunca é apagado.
- Dois modelos mestres de documentos: injetável e não injetável.
- Nome do procedimento dinâmico no cabeçalho.
- Complemento específico opcional por procedimento.
- Injetáveis exigem nova autorização a cada sessão.
- Não injetáveis podem usar termo por ciclo/protocolo.
- Protocolos exclusivos podem ser simples ou compostos.
- Protocolos compostos herdam exigência de consentimento injetável conforme a composição real da sessão.
- Cada sessão gera ficha própria.
- Fluxo de atendimento aprovado em quatro estados.
- 6D permanece responsável por fotos clínicas, produtos/lotes/equipamentos e intercorrências.
