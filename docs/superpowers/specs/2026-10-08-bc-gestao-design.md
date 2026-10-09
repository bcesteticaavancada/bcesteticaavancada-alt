# BC Gestão 1.0 — Design e Arquitetura

Data: 2026-10-08
Status: proposta para revisão

## 1. Objetivo

Criar uma área privada de gestão para a BC Estética Avançada sem colocar em risco o site público existente.

A primeira versão deve permitir:

- autenticação por e-mail e senha;
- identificação automática do perfil da pessoa autenticada;
- agenda individual para colaboradoras;
- visão administrativa completa para Mel;
- registro do atendimento realizado;
- histórico longitudinal do cliente para continuidade do cuidado;
- financeiro e contas a receber exclusivos da Mel;
- dashboard administrativo com indicadores básicos.

O sistema deve ser construído de forma isolada do site institucional para que falhas no BC Gestão não derrubem nem corrompam o site público.

## 2. Estado atual do projeto

O site institucional está publicado a partir do repositório `bcesteticaavancada/bcesteticaavancada-alt` via GitHub Pages.

Já existe uma área `/admin/` usada pela pré-anamnese, com autenticação Supabase e leitura de registros privados. Essa área não deve ser sobrescrita nem quebrada durante o BC Gestão 1.0.

A integração do BC Gestão com a pré-anamnese fica para uma fase posterior, depois que a nova área estiver estável.

## 3. Princípios de arquitetura

1. **Site público separado do sistema interno.**
2. **Código versionado e reversível.**
3. **Dados privados nunca armazenados em arquivos públicos do GitHub.**
4. **Supabase Auth para login; nunca armazenar senhas manualmente.**
5. **RLS no banco para aplicar permissões no servidor, não apenas esconder itens na interface.**
6. **Financeiro exclusivo da Mel.**
7. **Dados clínicos/histórico separados de dados financeiros.**
8. **Mudanças graduais: nenhuma migração destrutiva em produção sem backup e teste.**

## 4. Estrutura de navegação proposta

O site público terá apenas um ponto discreto de entrada para o sistema interno, por exemplo `Administrativo`.

No BC Gestão, haverá um único fluxo de login:

- usuário com papel `admin` -> painel da Mel;
- usuário com papel `colaborador` -> painel individual.

Endereços lógicos desejados:

- `/gestao/login/`
- `/gestao/admin/`
- `/gestao/colaborador/`

No futuro, se for desejado, esses caminhos podem ser expostos por domínio/subdomínio próprio sem alterar a lógica interna.

O `/admin/` existente da pré-anamnese permanece intacto enquanto o novo sistema é desenvolvido.

## 5. Perfis e permissões

### 5.1 Mel — `admin`

Pode:

- visualizar todas as agendas;
- criar, editar e cancelar agendamentos;
- visualizar todos os clientes;
- visualizar todo o histórico de atendimentos;
- visualizar todas as colaboradoras;
- cadastrar procedimentos;
- registrar e editar valores;
- registrar forma de pagamento;
- registrar recebimentos parciais ou totais;
- visualizar contas a receber;
- visualizar faturamento e relatórios;
- corrigir status administrativos.

### 5.2 Colaboradora — `colaborador`

Pode:

- visualizar apenas os próprios atendimentos e próximos horários;
- abrir a ficha do cliente quando houver atendimento atribuído a ela;
- visualizar o histórico de atendimento desse cliente para continuidade do cuidado;
- registrar evolução/observações do atendimento atual;
- marcar o status operacional do atendimento conforme regras definidas.

Não pode:

- visualizar dados financeiros;
- alterar valor;
- registrar forma de pagamento;
- consultar agenda completa de outras colaboradoras;
- consultar clientes sem vínculo com seus atendimentos;
- administrar usuários.

### 5.3 Regra de histórico do cliente

Para equilibrar continuidade do cuidado e privacidade, a regra inicial será:

- a colaboradora pode visualizar o histórico clínico/operacional completo de um cliente quando esse cliente estiver vinculado a um atendimento atribuído a ela;
- a colaboradora não pode pesquisar livremente históricos de clientes não atribuídos;
- informações financeiras permanecem invisíveis para colaboradoras;
- Mel pode visualizar todos os históricos.

## 6. Modelo de dados inicial

### `staff_profiles`

- `user_id`
- `display_name`
- `role` (`admin` | `colaborador`)
- `active`
- `created_at`

### `clientes`

- `id`
- `nome`
- `telefone`
- `email` opcional
- `created_at`
- `updated_at`

A versão 1.0 deve coletar somente os dados necessários para operação. Dados clínicos mais sensíveis devem ficar em estrutura separada.

### `procedimentos`

- `id`
- `nome`
- `ativo`
- `duracao_padrao` opcional
- `created_at`

### `agendamentos`

- `id`
- `cliente_id`
- `colaboradora_user_id`
- `procedimento_id`
- `inicio`
- `fim` opcional
- `status` (`agendado`, `atendido`, `cancelado`, `faltou`)
- `observacao_administrativa` opcional
- `created_by`
- `created_at`
- `updated_at`

### `atendimentos`

Representa a sessão efetivamente realizada.

- `id`
- `agendamento_id`
- `cliente_id`
- `colaboradora_user_id`
- `procedimento_id`
- `data_atendimento`
- `queixa_objetivo`
- `observacoes`
- `reacoes`
- `intercorrencias`
- `feedback_cliente`
- `orientacoes`
- `recomendacao_proxima_sessao`
- `created_by`
- `created_at`
- `updated_at`

Cada edição deve preservar rastreabilidade por usuário e horário. Se o escopo crescer, será criada uma tabela de auditoria explícita.

### `pagamentos`

Somente admin.

- `id`
- `agendamento_id` ou `atendimento_id`
- `cliente_id`
- `valor_total`
- `valor_recebido`
- `forma_pagamento`
- `status` (`pendente`, `parcial`, `pago`, `cancelado`)
- `vencimento` opcional
- `data_recebimento` opcional
- `created_by`
- `created_at`
- `updated_at`

## 7. Fluxo da colaboradora

1. Login.
2. Sistema identifica `role=colaborador`.
3. Abre agenda do dia.
4. Mostra próximos atendimentos.
5. Ao abrir um atendimento, mostra dados básicos do cliente e histórico permitido.
6. Colaboradora registra a sessão atual.
7. Atendimento fica salvo no banco com autoria e horário.
8. No atendimento seguinte, esse histórico aparece automaticamente para a profissional autorizada.

Exemplo de histórico:

- data e procedimento;
- profissional responsável;
- queixa/objetivo;
- reação/evolução;
- elogios ou reclamações relatadas;
- intercorrências;
- orientações;
- recomendação para próxima sessão.

## 8. Fluxo da Mel

1. Login.
2. Sistema identifica `role=admin`.
3. Abre dashboard BC Gestão.
4. Visualiza agenda geral e status dos atendimentos.
5. Pode abrir qualquer cliente e histórico.
6. Registra/ajusta financeiro.
7. Visualiza recebidos, pendentes e vencidos.
8. Visualiza resumo por profissional, procedimento e forma de pagamento.

## 9. Dashboard 1.0

Indicadores mínimos:

- faturamento do dia;
- atendimentos do dia;
- ticket médio;
- valor a receber;
- total por profissional;
- total por forma de pagamento;
- cancelamentos;
- faltas.

Relatórios avançados ficam para etapa posterior.

## 10. Segurança

### Autenticação

- Supabase Auth com e-mail e senha.
- Sessão gerenciada pelo SDK oficial.
- Recuperação de senha pelo fluxo do provedor.

### Chaves

- chave pública/publishable pode ser usada no cliente conforme arquitetura do Supabase;
- `service_role` nunca entra em JavaScript público, GitHub Pages ou repositório;
- ações privilegiadas que exijam segredo devem ser executadas no servidor/função protegida.

### RLS

Políticas devem garantir, no mínimo:

- colaboradora lê apenas agendamentos onde `colaboradora_user_id = auth.uid()`;
- colaboradora cria/edita atendimento apenas para agendamentos atribuídos a ela;
- colaboradora acessa histórico do cliente somente quando existir vínculo autorizado com atendimento;
- colaboradora não acessa `pagamentos`;
- admin lê e administra os dados necessários.

A interface nunca será considerada mecanismo de segurança; o banco deve negar acessos indevidos mesmo quando chamados manualmente.

## 11. Privacidade e LGPD

Nome, contato, agenda e histórico de tratamento são dados pessoais. Reações, intercorrências e informações clínicas podem incluir dados pessoais sensíveis relacionados à saúde.

Por isso:

- coletar apenas dados necessários;
- restringir acesso por função e vínculo;
- manter histórico de autoria;
- evitar exposição de dados em URLs, logs públicos ou repositórios;
- separar financeiro de histórico clínico;
- deixar fotos clínicas, anamnese completa e documentos médicos para fase posterior com política específica.

## 12. Isolamento do site público

O BC Gestão deve ser desenvolvido sem substituir as páginas institucionais atuais.

Preferência arquitetural:

- site público continua no GitHub Pages;
- BC Gestão é desenvolvido isoladamente em branch/projeto próprio;
- Supabase fornece Auth, PostgreSQL e RLS;
- Vercel pode hospedar a aplicação privada e funções server-side quando necessário;
- o site público apenas aponta para a entrada do BC Gestão.

## 13. Fase 0 — proteção antes de construir

A Fase 0 existe para garantir reversibilidade.

### 13.1 Referência estável

Registrar como baseline o commit atual do `main` antes de qualquer mudança do BC Gestão.

Baseline observado em 2026-10-08: `5b4ed4ee957db6dc91f0b2b3a5d15171360a95f4`.

### 13.2 Branch dedicada

Criar uma branch exclusiva para o BC Gestão a partir do baseline, por exemplo:

`feature/bc-gestao-1`

Nenhum desenvolvimento do BC Gestão deve começar diretamente no `main`.

### 13.3 Regra de integração

- mudanças entram por commits pequenos;
- testar antes de integrar;
- não alterar tabelas existentes de pré-anamnese durante a fundação;
- nenhuma migração destrutiva sem backup/exportação e caminho de rollback;
- site público permanece publicável a partir de `main`.

### 13.4 Rollback

Se uma integração futura apresentar problema:

- retornar ao commit estável anterior no código;
- migrations devem ter estratégia reversível ou correção forward-safe;
- dados não devem ser apagados como mecanismo de rollback.

## 14. Ordem de implementação

1. Fase 0 — baseline, branch e isolamento.
2. Fundação do BC Gestão.
3. Supabase: perfis, clientes, procedimentos e agendamentos.
4. Auth e roteamento por papel.
5. Agenda da colaboradora.
6. Registro do atendimento e histórico.
7. Financeiro exclusivo da Mel.
8. Contas a receber.
9. Dashboard da Mel.
10. Relatórios básicos.
11. Integração futura da pré-anamnese.

## 15. Fora do escopo do BC Gestão 1.0

- prontuário médico completo;
- upload de fotos clínicas;
- prescrição;
- automação de marketing;
- estoque;
- folha de pagamento;
- emissão fiscal;
- integração bancária automática;
- comissão complexa;
- migração da pré-anamnese atual.

Esses itens podem ser adicionados depois sem bloquear o MVP.

## 16. Critérios de sucesso do MVP

O BC Gestão 1.0 estará funcional quando:

- Mel e uma colaboradora de teste conseguirem autenticar;
- cada perfil for direcionado ao painel correto;
- colaboradora enxergar somente sua agenda;
- colaboradora conseguir registrar um atendimento;
- histórico salvo aparecer no próximo atendimento autorizado daquele cliente;
- colaboradora não conseguir ler financeiro nem dados de clientes sem vínculo;
- Mel enxergar agenda geral, histórico e financeiro;
- Mel conseguir registrar pagamento parcial/total e consultar a receber;
- o site institucional continuar funcionando sem dependência do BC Gestão;
- existir um caminho documentado de rollback do código.

## 17. Próximo passo após aprovação desta especificação

Após a revisão e aprovação deste documento, será criado o plano técnico de implementação. A primeira execução será exclusivamente a Fase 0: criar a branch dedicada a partir do baseline atual e validar que nenhuma alteração do BC Gestão atinge o site publicado.