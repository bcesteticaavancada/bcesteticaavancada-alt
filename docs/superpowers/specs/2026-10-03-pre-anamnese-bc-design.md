# BC Estética — Pré-Anamnese Nativa

**Data:** 2026-10-03  
**Status:** Design aprovado em conversa; aguardando revisão da especificação escrita antes do plano de implementação.  
**Projeto:** BC Estética Avançada  
**Repositório oficial:** `bcesteticaavancada/bcesteticaavancada-alt`

## 1. Objetivo

Substituir a dependência funcional do Base44 na pré-anamnese por uma solução própria da BC Estética, integrada visualmente ao site oficial e preparada para armazenar, consultar e exportar fichas com segurança.

O fluxo final deve permitir que uma pessoa:

1. acesse a pré-anamnese dentro do próprio site da BC;
2. preencha as informações em etapas claras e responsivas;
3. revise as respostas;
4. registre consentimentos e assinatura;
5. finalize a ficha;
6. baixe ou compartilhe um PDF com identidade visual da BC;
7. tenha a ficha registrada para consulta posterior pela clínica.

## 2. Resultado esperado

A experiência deve parecer parte nativa do site da BC, sem aparência de aplicativo externo, iframe ou serviço separado.

A clínica deve poder recuperar uma ficha posteriormente por meio de uma área administrativa autenticada, sem expor dados sensíveis publicamente.

A solução deve ser simples de manter, com poucas dependências obrigatórias.

## 3. Arquitetura aprovada

### 3.1 Componentes principais

- **Frontend/site:** GitHub Pages, utilizando o repositório oficial já existente.
- **Banco de dados:** Supabase Postgres.
- **Autenticação administrativa:** Supabase Auth.
- **Armazenamento de arquivos:** Supabase Storage privado.
- **Backend de submissão:** Supabase Edge Function.
- **PDF:** gerado a partir dos dados finalizados da ficha, com identidade visual da BC.

### 3.2 Papel das ferramentas auxiliares

- **GitHub:** fonte oficial do código e publicação do site.
- **Supabase:** banco, autenticação, storage privado e backend.
- **Replit:** ambiente auxiliar de desenvolvimento/teste, sem ser dependência de produção.
- **Linear:** planejamento de tarefas e registro de bugs durante a implementação.
- **Notion:** documentação funcional e de conteúdo, se necessário.
- **Canva/Figma/MagicPath:** apenas apoio visual, não dependência técnica do funcionamento.
- **Vercel:** não obrigatório na primeira versão.
- **Google Drive/Gmail:** integração futura opcional, fora do núcleo inicial.

## 4. Princípios do projeto

1. **Não duplicar sistemas.** A pré-anamnese oficial deve ser a nativa do site.
2. **Não depender do Base44 para operação.** Base44 pode permanecer apenas como referência histórica enquanto a migração é concluída.
3. **Mobile-first.** O fluxo deve funcionar muito bem em Android e iPhone.
4. **Privacidade por padrão.** Dados de ficha, assinatura e PDF não podem ser publicados em diretórios públicos.
5. **Baixa complexidade operacional.** Evitar serviços extras sem necessidade clara.
6. **Identidade visual coerente.** O formulário e o PDF devem parecer documentos e telas oficiais da BC.

## 5. Fluxo do paciente/cliente

### Etapa 1 — Identificação e procedimento

Campos de identificação já previstos na pré-anamnese atual, além da seleção do procedimento de interesse.

### Etapa 2 — Objetivo e histórico estético

Perguntas sobre objetivo principal, histórico de procedimentos e informações relacionadas ao atendimento estético.

### Etapa 3 — Pele e exposição

Perguntas relacionadas à pele, exposição solar e contexto relevante ao atendimento.

### Etapa 4 — Saúde, medicamentos e alergias

Perguntas relacionadas ao histórico de saúde, uso de medicamentos e alergias.

### Etapa 5 — Hábitos e perguntas condicionais

Perguntas de hábitos e módulos específicos conforme o procedimento selecionado.

A interface deve mostrar apenas perguntas pertinentes ao caso atual quando houver lógica condicional.

### Etapa 6 — Revisão

Tela de conferência antes da finalização, permitindo voltar e corrigir respostas.

### Etapa 7 — Consentimentos e assinatura

Exibir os consentimentos definidos pela BC e capturar confirmação explícita.

Disponibilizar campo de assinatura do cliente/paciente.

### Etapa 8 — Finalização

Após validação dos dados:

- gerar um código único da ficha;
- registrar data/hora;
- enviar a ficha ao backend;
- persistir a ficha no banco;
- gerar o PDF;
- disponibilizar **Baixar PDF**;
- disponibilizar **Compartilhar PDF** quando suportado pelo dispositivo.

## 6. Salvamento temporário no dispositivo

Durante o preenchimento, o formulário deve salvar progresso localmente no navegador para reduzir risco de perda por fechamento acidental, recarregamento ou troca de tela.

Esse rascunho local:

- não deve ser considerado ficha final;
- deve poder ser retomado;
- deve ser limpo após uma finalização bem-sucedida, salvo decisão posterior em contrário.

## 7. Identificador da ficha

Cada ficha finalizada deve possuir um código humano-legível, por exemplo:

`BC-20261003-X7P4K`

Requisitos:

- único dentro do sistema;
- exibido no PDF;
- armazenado no banco;
- utilizável em busca administrativa;
- não deve servir como mecanismo de autenticação por si só.

## 8. Modelo de dados inicial

### 8.1 Tabela principal: `pre_anamneses`

Campos conceituais mínimos:

- `id` — UUID interno;
- `public_code` — código legível da ficha;
- `created_at`;
- `updated_at`;
- `status` — inicialmente `recebida`, `em_avaliacao`, `avaliada`;
- `patient_name`;
- `patient_email`;
- `patient_phone`;
- `procedure`;
- `answers` — JSON estruturado com respostas completas;
- `consents` — JSON estruturado;
- `signature_path` — referência privada, se assinatura for salva como arquivo;
- `pdf_path` — referência privada do PDF gerado;
- `source_version` — versão do formulário usada na submissão.

### 8.2 Considerações de modelagem

Dados de formulário variáveis e módulos condicionais devem ficar em JSON estruturado na primeira versão, evitando dezenas de colunas frágeis.

Campos usados com frequência em busca administrativa podem existir como colunas dedicadas.

## 9. Segurança e privacidade

### 9.1 Princípio

O navegador público não deve possuir credenciais administrativas nem permissão de leitura ampla sobre anamneses.

### 9.2 Submissão pública

O frontend deve enviar a ficha final para uma **Supabase Edge Function**.

A função deve:

- validar formato mínimo dos dados;
- normalizar/sanitizar strings;
- gerar ou validar o código único;
- registrar a ficha;
- iniciar ou concluir a geração/armazenamento do PDF;
- responder apenas com os dados necessários para a confirmação do envio.

### 9.3 Leitura de fichas

A leitura deve ser restrita à área administrativa autenticada.

Não criar listagem pública de fichas.

### 9.4 Storage

Assinaturas e PDFs devem ficar em bucket privado.

Downloads administrativos devem usar acesso autenticado ou URL temporária assinada.

### 9.5 RLS

As tabelas de dados clínicos/estéticos devem possuir Row Level Security ativa.

A política inicial deve impedir acesso público direto às fichas.

Acesso administrativo será liberado apenas para usuários autenticados autorizados.

## 10. Área administrativa

Criar uma rota interna, inicialmente prevista como `/admin/`.

### Funções mínimas

- login;
- listagem de fichas;
- pesquisa por nome;
- pesquisa por código;
- filtro por data;
- visualização da ficha completa;
- download do PDF;
- atualização de status.

### Requisitos

- não exibir acesso administrativo no menu público principal;
- não usar senha fixa dentro do HTML;
- exigir autenticação real;
- manter interface simples na primeira versão.

## 11. PDF oficial da BC

O PDF não deve parecer um dump de texto do formulário.

### 11.1 Estrutura visual

- formato A4;
- logo oficial da BC;
- nome “BC Estética Avançada”;
- título “Ficha de Pré-Anamnese”;
- código da ficha;
- data e hora de geração;
- seções bem delimitadas;
- tipografia compatível com a identidade da marca;
- uso discreto das cores da BC;
- espaçamento consistente;
- paginação;
- rodapé institucional.

### 11.2 Conteúdo

- identificação;
- procedimento;
- respostas por seção;
- módulos condicionais aplicáveis;
- observações;
- consentimentos;
- aviso de que a ficha é uma pré-avaliação e não substitui a avaliação profissional, conforme texto institucional definido pela BC.

### 11.3 Assinaturas

Na página final incluir:

- assinatura do cliente/paciente;
- linha/campo de data;
- espaço de assinatura da profissional responsável.

Não inserir automaticamente assinatura profissional sem ação e autorização explícita.

### 11.4 Compatibilidade de caracteres

A geração deve normalizar Unicode e usar fonte compatível para evitar caracteres corrompidos ou símbolos inválidos no PDF.

## 12. Download e compartilhamento do PDF

A finalização deve oferecer dois caminhos:

1. **Baixar PDF** — fluxo tradicional de download.
2. **Compartilhar PDF** — usando API de compartilhamento do dispositivo quando suportada.

A interface deve possuir fallback claro caso compartilhamento nativo não seja suportado.

## 13. Integração visual com o site

O formulário deve reutilizar o sistema visual já aprovado no site da BC:

- cabeçalho;
- logo;
- tipografia;
- cores;
- espaçamentos;
- botões;
- bordas;
- sombras;
- rodapé;
- comportamento responsivo.

A pré-anamnese deve parecer uma seção do site e não um aplicativo terceirizado.

## 14. Migração a partir do estado atual

O repositório já possui uma pré-anamnese nativa em `agendamento/index.html`.

Essa implementação será tratada como base de conteúdo e comportamento a ser revisada, não como arquitetura final automaticamente aprovada.

A migração deve preservar o que estiver correto no conteúdo atual, ao mesmo tempo em que separa:

- apresentação;
- estado do formulário;
- validação;
- integração com backend;
- geração de PDF.

Não manter dois formulários oficiais em paralelo.

## 15. Fora do escopo da primeira versão

Para evitar excesso de complexidade, ficam fora da primeira entrega:

- integração obrigatória com Gmail;
- cópia automática para Google Drive;
- envio automático por WhatsApp;
- dashboard analítico avançado;
- prontuário clínico completo;
- pagamentos;
- agenda de horários;
- múltiplas unidades com segregação complexa;
- automações de marketing.

Esses itens podem ser adicionados em fases futuras.

## 16. Estratégia de implantação

A implementação deverá ser feita em etapas pequenas, verificáveis e reversíveis.

Ordem conceitual:

1. preparar projeto Supabase;
2. criar schema e políticas;
3. criar função de submissão;
4. refatorar o formulário existente sem alterar o conteúdo aprovado;
5. conectar finalização ao backend;
6. implementar geração de PDF;
7. implementar assinatura;
8. criar área administrativa;
9. testar mobile/desktop;
10. substituir definitivamente o fluxo dependente do Base44.

## 17. Critérios de aceitação

A primeira versão será considerada pronta quando:

- o formulário funcionar no domínio/site oficial da BC;
- o preenchimento puder ser retomado após recarregamento acidental;
- perguntas condicionais funcionarem corretamente;
- a ficha puder ser revisada antes da finalização;
- consentimentos forem obrigatórios quando aplicáveis;
- a assinatura puder ser registrada;
- a ficha finalizada for persistida no Supabase;
- não houver leitura pública direta das fichas;
- o PDF for gerado com identidade visual da BC;
- o PDF tiver código, data, seções, consentimentos e área de assinatura;
- o botão Baixar PDF funcionar em navegadores móveis modernos;
- o compartilhamento nativo funcionar quando disponível;
- a área administrativa exigir autenticação;
- a equipe puder localizar e abrir uma ficha;
- a equipe puder baixar o PDF de uma ficha;
- o site público continuar funcionando sem regressões visíveis.

## 18. Testes mínimos

### Frontend

- validação de campos obrigatórios;
- navegação entre etapas;
- volta para etapa anterior sem perda de dados;
- restauração de rascunho local;
- lógica condicional;
- revisão final;
- assinatura em tela touch;
- download do PDF;
- compartilhamento do PDF;
- telas pequenas e grandes.

### Backend

- submissão válida;
- submissão incompleta;
- caracteres especiais;
- payload excessivo;
- geração de código único;
- gravação no banco;
- gravação no storage;
- negação de leitura pública.

### Administrativo

- login válido/inválido;
- busca;
- abertura de ficha;
- mudança de status;
- download do PDF;
- tentativa de acesso sem sessão.

## 19. Observabilidade e manutenção

Na primeira versão, manter logs suficientes para diagnosticar:

- falhas de submissão;
- falhas de geração de PDF;
- falhas de armazenamento;
- erros de autenticação administrativa.

Evitar registrar conteúdo sensível completo em logs de erro.

## 20. Decisões fechadas nesta especificação

- GitHub permanece como fonte oficial do frontend/site.
- Supabase será o backend principal.
- Base44 deixará de ser dependência funcional da pré-anamnese.
- PDFs e assinaturas serão privados.
- haverá área administrativa autenticada.
- o PDF será tratado como documento oficial da BC, não como relatório cru.
- o fluxo será mobile-first.
- não serão adicionadas integrações extras sem necessidade concreta.

## 21. Pontos deliberadamente deixados para o plano de implementação

A especificação não fixa ainda:

- biblioteca exata de geração de PDF;
- biblioteca exata de assinatura em canvas;
- estrutura final de pastas do frontend;
- implementação exata da Edge Function;
- modelo definitivo de roles administrativas;
- formato visual final do PDF em pixels.

Essas escolhas devem ser decididas no plano de implementação após revisão desta especificação, com preferência por soluções simples, estáveis e compatíveis com GitHub Pages + Supabase.
