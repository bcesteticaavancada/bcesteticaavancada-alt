# BC Estética — CPF + Rubrica de Confirmação na Pré-Anamnese

**Data:** 2026-10-03  
**Status:** design aprovado em conversa; especificação escrita aguardando revisão do usuário antes do plano de implementação  
**Projeto:** BC Estética Avançada  
**Repositório oficial:** `bcesteticaavancada/bcesteticaavancada-alt`  
**Dependência proibida:** Base44 não faz parte desta arquitetura

## 1. Objetivo

Adicionar à pré-anamnese nativa da BC Estética:

1. coleta de CPF já na primeira etapa, junto aos demais dados de identificação;
2. autorização explícita para tratamento dos dados informados na própria primeira etapa;
3. rubrica manuscrita feita diretamente na tela do celular/tablet com o dedo, em experiência semelhante a comprovantes de recebimento em terminais móveis;
4. vínculo técnico entre rubrica, nome, CPF, data/hora, protocolo e ficha enviada;
5. apresentação elegante e organizada dessa confirmação no PDF final da BC.

A rubrica desta pré-anamnese não será apresentada como assinatura digital qualificada, assinatura contratual definitiva ou substituta da assinatura presencial. Sua finalidade é confirmar que a pessoa revisou e concluiu o preenchimento da pré-anamnese. A assinatura formal e os termos específicos do procedimento serão realizados presencialmente pela BC Estética.

## 2. Escopo aprovado

### 2.1 Incluído

- campo obrigatório de CPF na etapa 1;
- máscara visual de CPF;
- validação matemática de CPF no frontend e no backend;
- autorização obrigatória de tratamento dos dados na etapa 1;
- campo de rubrica na etapa de consentimentos;
- desenho da rubrica com dedo/caneta em celular e tablet;
- botão para limpar e refazer;
- impedimento de avanço/finalização sem rubrica válida;
- correção do problema de canvas inicializado enquanto a etapa está oculta;
- armazenamento privado da rubrica;
- vínculo do CPF como campo próprio da ficha;
- registro de data/hora pelo servidor na finalização;
- hash SHA-256 da rubrica e do conteúdo final da submissão para trilha de integridade;
- bloco de confirmação no PDF com logo, rubrica, nome, CPF, data/hora e protocolo;
- testes automatizados de frontend, backend e geração do PDF.

### 2.2 Fora deste escopo

- certificado ICP-Brasil;
- assinatura eletrônica qualificada;
- código OTP por SMS/WhatsApp;
- captura de biometria;
- reconhecimento facial;
- coleta de localização precisa;
- captura de IP como requisito de negócio;
- Base44;
- assinatura da profissional aplicada automaticamente.

## 3. Fluxo do cliente/paciente

### Etapa 1 — Identificação

A primeira etapa deverá conter, entre os dados já existentes:

- nome completo;
- CPF;
- data de nascimento;
- idade;
- WhatsApp;
- e-mail;
- sexo, quando aplicável;
- procedimento(s) de interesse.

O CPF será obrigatório.

Abaixo dos dados de identificação deverá existir uma autorização obrigatória, com linguagem simples e visualmente clara. Texto-base aprovado para produto:

> Declaro estar ciente e autorizo o tratamento dos dados informados nesta pré-anamnese, incluindo CPF, exclusivamente para identificação, preparação e continuidade do atendimento na BC Estética.

A pessoa não poderá avançar sem marcar essa autorização.

### Etapas intermediárias

As demais etapas da pré-anamnese permanecem com a estrutura atual, inclusive revisão e perguntas condicionais.

### Etapa de rubrica

O título do componente deve evitar linguagem que sugira assinatura qualificada. Usar:

**Rubrica de confirmação da pré-anamnese**

Texto de apoio:

> Faça sua rubrica no campo abaixo usando o dedo. Esta rubrica confirma o preenchimento desta pré-anamnese. A assinatura formal e os termos específicos do procedimento serão realizados presencialmente.

A interface deverá mostrar:

- área ampla de desenho;
- fundo branco;
- traço escuro, nítido e suave;
- suporte a toque, caneta e mouse;
- botão `Limpar e refazer`;
- nome completo da pessoa;
- CPF formatado;
- indicação de que a data/hora oficial será registrada pelo servidor no envio.

A rubrica deve permanecer visível se a tela for redimensionada ou o dispositivo mudar de orientação.

### Finalização

Na finalização:

1. validar todos os campos obrigatórios;
2. validar CPF novamente no backend;
3. verificar se existe rubrica válida;
4. gerar código público da ficha;
5. registrar `created_at` no servidor;
6. armazenar rubrica em bucket privado;
7. persistir a ficha no banco;
8. calcular hashes de integridade;
9. gerar PDF final;
10. devolver ao frontend apenas os dados necessários para confirmação e acesso temporário ao PDF.

## 4. CPF — tratamento técnico

### 4.1 Formato

Na interface, exibir no padrão:

`000.000.000-00`

No banco e no payload normalizado, armazenar somente os 11 dígitos:

`00000000000`

### 4.2 Validação

Implementar validação matemática de CPF no frontend para feedback imediato e repetir a validação no backend como regra confiável.

Rejeitar:

- quantidade diferente de 11 dígitos;
- sequências inválidas como `00000000000`, `11111111111` etc.;
- dígitos verificadores incompatíveis.

### 4.3 Persistência local

O CPF não deve ser persistido no rascunho durável do `localStorage`.

Durante a sessão atual ele pode permanecer em memória da página. Se a pessoa recarregar a página antes de enviar, o CPF deverá ser digitado novamente. Essa decisão prioriza privacidade em dispositivos compartilhados.

Após envio bem-sucedido, qualquer cópia temporária do CPF mantida no frontend deve ser descartada.

## 5. Rubrica manuscrita

### 5.1 Componente

Manter o canvas nativo já existente, sem introduzir biblioteca obrigatória adicional.

O componente deve:

- inicializar o tamanho real somente quando a etapa estiver visível;
- considerar `devicePixelRatio` para nitidez;
- usar `Pointer Events` para compatibilidade com toque, caneta e mouse;
- preservar desenho em resize/orientação;
- permitir limpar completamente;
- exportar PNG;
- registrar internamente se houve traço real.

### 5.2 Validação de traço

No frontend, considerar a rubrica válida apenas quando houver movimento suficiente para representar um traço real, e não apenas um toque isolado.

A validação deve considerar pelo menos:

- quantidade mínima de pontos/movimentos;
- distância total mínima do traço;
- caixa delimitadora mínima em largura ou altura.

Esses critérios são de UX e prevenção de envio vazio; não são mecanismo de autenticação.

### 5.3 Validação no backend

O backend deve:

- exigir Data URL PNG;
- validar assinatura mágica PNG;
- validar tamanho máximo permitido;
- ler dimensões do PNG a partir do cabeçalho/IHDR e rejeitar imagem com dimensões anormais ou incompatíveis com o componente esperado;
- rejeitar conteúdo malformado;
- calcular SHA-256 dos bytes finais da rubrica antes de persistir metadados de integridade.

## 6. Modelo de dados

Adicionar campos dedicados à tabela `pre_anamneses`:

- `patient_cpf` — texto normalizado com 11 dígitos;
- `data_authorization_accepted_at` — timestamp do aceite da autorização de dados;
- `rubric_sha256` — hash SHA-256 da rubrica;
- `payload_sha256` — hash SHA-256 do conteúdo canônico da submissão final;
- `rubric_confirmed_at` — timestamp do servidor correspondente à confirmação/finalização.

Manter:

- `signature_path` ou renomear futuramente para `rubric_path` apenas se houver migração segura e benefício claro;
- `public_code`;
- `created_at`;
- `source_version`;
- demais dados já existentes.

Para evitar quebra de compatibilidade imediata, a primeira implementação pode manter o nome técnico `signature_path` internamente, desde que a interface e o PDF usem a terminologia correta: **rubrica de confirmação**.

## 7. Integridade da submissão

Antes de gerar o PDF, o backend deverá construir uma representação canônica do conteúdo essencial da ficha e calcular `payload_sha256`.

O conteúdo canônico deve incluir no mínimo:

- código da ficha;
- nome;
- CPF normalizado;
- respostas;
- consentimentos;
- procedimento(s);
- versão do formulário;
- hash da rubrica;
- timestamp de confirmação.

O objetivo é permitir verificar posteriormente se o conteúdo persistido corresponde ao conjunto de dados usado na geração daquele documento.

## 8. Segurança e privacidade

- rubricas e PDFs permanecem em buckets privados do Supabase;
- o frontend público não recebe chave administrativa;
- a Edge Function permanece responsável pela gravação confiável;
- RLS continua ativa nas tabelas;
- URLs de PDF permanecem temporárias/assinadas;
- não registrar CPF em logs de aplicação;
- mensagens de erro não devem ecoar CPF completo;
- no painel administrativo, o CPF pode ser exibido integralmente apenas para usuário autenticado autorizado;
- evitar coleta de dados adicionais sem finalidade definida.

## 9. PDF final — direção visual “Hollywood BC”

O PDF deve transmitir luxo discreto, ciência, organização e identidade institucional. Não deve parecer formulário bruto nem recibo genérico.

### 9.1 Logo da BC

Usar a logo oficial sem fundo já existente no repositório.

Direção aprovada:

- na primeira página, logo em posição de destaque elegante, preferencialmente centralizada no topo ou alinhada em composição editorial com o título;
- respeitar área de respiro ao redor da marca;
- nunca esticar ou distorcer a logo;
- largura proporcional e consistente;
- nas páginas internas, usar versão menor no cabeçalho ou assinatura visual sutil, sem repetir uma logo grande em todas as páginas;
- evitar sobreposição com textos, linhas ou bordas.

### 9.2 Estilo

Paleta:

- branco/off-white como base;
- grafite/preto suave para texto;
- dourado/champagne discreto para linhas e destaques;
- rosé/nude apenas como apoio, sem excesso.

Tipografia e composição:

- títulos elegantes e bem espaçados;
- corpo de texto altamente legível;
- alinhamento consistente;
- margens generosas;
- seções em blocos claros;
- linhas finas e discretas;
- hierarquia visual forte;
- paginação e rodapé institucional.

### 9.3 Primeira página

Composição sugerida:

1. logo oficial com respiro;
2. `BC Estética Avançada`;
3. título `Ficha de Pré-Anamnese`;
4. slogan `Menos achismo. Mais ciência.` em tratamento discreto;
5. nome da pessoa;
6. protocolo;
7. data da ficha;
8. linha dourada/champagne fina separando capa/cabeçalho do conteúdo.

### 9.4 Página final — confirmação por rubrica

Criar um bloco visual premium e organizado com título:

**Confirmação do preenchimento**

Dentro do bloco:

- rubrica em tamanho confortável, centralizada e preservando proporção;
- nome completo;
- CPF formatado;
- data e hora do servidor;
- protocolo BC;
- hash abreviado opcional para auditoria visual, sem poluir o documento.

Texto institucional abaixo:

> Rubrica eletrônica referente exclusivamente à confirmação das informações prestadas nesta pré-anamnese. A documentação e assinatura definitiva relacionadas ao procedimento serão formalizadas presencialmente pela BC Estética.

A logo pode aparecer novamente nesta página em tamanho pequeno e editorial, desde que não concorra visualmente com a rubrica.

## 10. Arquivos/componentes previstos para implementação

Frontend:

- `agendamento/index.html`;
- `agendamento/anamnese.css`;
- `agendamento/js/state.js`;
- `agendamento/js/validation.js`;
- `agendamento/js/signature.js`;
- `agendamento/js/main.js`;
- `agendamento/js/api.js`;
- `agendamento/js/finalize.js`.

Backend/Supabase:

- nova migration em `supabase/migrations/`;
- `supabase/functions/submit-pre-anamnese/validation.ts`;
- `supabase/functions/submit-pre-anamnese/signature.ts`;
- `supabase/functions/submit-pre-anamnese/index.ts`;
- `supabase/functions/submit-pre-anamnese/pdf.ts`.

Testes:

- testes de CPF no frontend;
- testes de CPF no backend;
- testes do canvas oculto → visível;
- testes de preservação da rubrica em resize;
- testes de rejeição de rubrica vazia/insuficiente;
- testes de validação PNG e dimensões;
- testes de hash;
- testes do bloco de confirmação do PDF.

## 11. Critérios de aceite

A implementação será considerada concluída quando:

1. CPF aparecer na primeira etapa com máscara e validação;
2. autorização de tratamento de dados for obrigatória antes de avançar;
3. CPF não for salvo no rascunho durável do `localStorage`;
4. rubrica funcionar corretamente em Android, iPhone/iPad e desktop compatível;
5. rubrica não desaparecer ao redimensionar ou girar a tela;
6. toque isolado não for aceito como rubrica válida;
7. backend rejeitar PNG inválido ou de dimensões incompatíveis;
8. ficha armazenar CPF dedicado, hashes e timestamps previstos;
9. PDF incluir rubrica, nome, CPF, data/hora e protocolo;
10. logo oficial da BC estiver corretamente posicionada, proporcional e com respiro visual;
11. PDF tiver acabamento premium, alinhado e organizado, com identidade visual da BC;
12. todos os testes existentes continuarem passando;
13. novos testes do módulo também passarem no CI.

## 12. Sequência depois desta especificação

Após aprovação desta especificação escrita:

1. criar plano de implementação detalhado;
2. implementar com TDD, começando por CPF e correção do canvas/rubrica;
3. validar CI;
4. testar envio real no ambiente integrado;
5. em seguida atacar download do PDF;
6. depois integrar envio do PDF por e-mail;
7. por fim fazer refinamento visual final do PDF e QA mobile.
