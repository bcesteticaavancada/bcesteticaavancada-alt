# BC Gestão — Fase 5: Financeiro individual, livros semanais e repasses

**Data:** 2026-10-10  
**Status:** design aprovado em conversa; aguardando revisão deste documento antes do plano de implementação  
**Projeto Supabase:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)

## 1. Objetivo

Evoluir o BC Gestão para controlar o financeiro da clínica e os repasses das profissionais com separação rigorosa entre:

- dinheiro recebido da cliente;
- apuração semanal de produção;
- valor devido a cada profissional;
- pagamento do repasse;
- visão individual da colaboradora;
- visão consolidada exclusiva da Mel/ADM.

A colaboradora poderá registrar o pagamento do próprio atendimento, mas não poderá alterar percentuais de comissão, acessar o financeiro de outra profissional nem enxergar o consolidado geral da clínica.

A Mel administra todas as regras financeiras, fecha os livros semanais, configura ciclos de repasse, corrige lançamentos, reabre períodos quando necessário, recalcula valores e dá baixa nos pagamentos das profissionais.

## 2. Princípios de produto

1. **Recebimento da cliente e repasse da profissional são entidades diferentes.** Um valor pode entrar na clínica antes de ser apurado ou repassado à profissional.
2. **A colaboradora vê somente o próprio financeiro.** Nenhuma tela, RPC ou policy deve permitir acesso aos dados financeiros de outra profissional.
3. **Percentuais são privados.** A colaboradora nunca recebe o percentual aplicado, nem por interface nem por API.
4. **Comissão por profissional e procedimento.** A regra é definida pela combinação `profissional × procedimento`, administrada exclusivamente pela Mel.
5. **Base de cálculo pelo valor efetivamente recebido.** O repasse incide sobre `valor_recebido`, inclusive em recebimentos parciais.
6. **Apuração semanal fixa.** A Mel fecha livros semanalmente; somente após esse fechamento o valor de repasse passa a ser exibido para a colaboradora.
7. **Pagamento em ciclos configuráveis.** O repasse pode ocorrer a cada 7, 15 ou 30 dias, conforme configuração da Mel, inclusive por profissional.
8. **Fechar livro não significa pagar.** O fechamento apura e congela o valor; a baixa de pagamento acontece em etapa separada.
9. **Livro fechado é imutável.** Correções que alterem seu cálculo exigem reabertura explícita pela Mel.
10. **Recálculo retroativo é direcionado.** A Mel pode recalcular por profissional, procedimento e período; livros pagos/fechados exigem reabertura antes do recálculo.
11. **Auditoria obrigatória.** Toda ação financeira sensível deve registrar autor, data/hora, entidade e valores relevantes antes/depois.
12. **Segurança no banco.** RLS/RPC são a autoridade; esconder informação no frontend não é mecanismo de segurança.

## 3. Papéis e permissões

### 3.1 Colaboradora ativa

Pode:

- registrar o pagamento de atendimento próprio;
- informar valor recebido, forma de pagamento e demais campos operacionais permitidos;
- consultar os pagamentos vinculados aos próprios atendimentos;
- visualizar livros semanais já fechados pela Mel relativos a si;
- visualizar sua produção recebida apurada por livro;
- visualizar apenas o valor monetário a receber;
- visualizar histórico de repasses pagos;
- visualizar status como `Aguardando fechamento`, `A receber`, `Pago` e `Em revisão`;
- consultar seu histórico por período.

Não pode:

- visualizar o percentual de comissão;
- consultar configuração de comissão;
- visualizar valores de outra profissional;
- visualizar consolidado financeiro da clínica;
- fechar, reabrir ou recalcular livro;
- alterar ciclo de repasse;
- alterar regra `profissional × procedimento`;
- dar baixa em repasse;
- corrigir valores de um livro já fechado;
- consultar trilha global de auditoria financeira.

### 3.2 Mel — administradora e profissional atendente

Pode:

- registrar e corrigir pagamentos;
- consultar todos os pagamentos;
- consultar o financeiro individual de qualquer profissional;
- consultar o financeiro consolidado da BC;
- definir e alterar percentual por `profissional × procedimento`;
- fechar livros semanais;
- reabrir livros;
- recalcular valores por profissional, procedimento e período;
- configurar ciclo de pagamento em 7, 15 ou 30 dias;
- configurar o ciclo individual de cada profissional quando necessário;
- gerar lotes de repasse reunindo um ou mais livros elegíveis;
- dar baixa no pagamento real do repasse;
- consultar auditoria financeira completa;
- realizar correções administrativas justificadas.

## 4. Fluxo financeiro principal

O fluxo canônico será:

`Atendimento → pagamento da cliente → livro semanal → cálculo do repasse → lote de pagamento → baixa do repasse`

### 4.1 Pagamento da cliente

O pagamento continua vinculado ao atendimento/agendamento/cliente.

A colaboradora pode registrar o recebimento apenas quando o atendimento pertence a ela.

O vínculo com a profissional não deve ser informado pelo navegador. O backend deve derivar a profissional a partir do `agendamento_id` e/ou `atendimento_id` já persistido.

Campos existentes em `pagamentos` podem continuar sendo usados, incluindo:

- `agendamento_id`;
- `atendimento_id`;
- `cliente_id`;
- `valor_total`;
- `valor_recebido`;
- `forma_pagamento`;
- `status`;
- `vencimento`;
- `data_recebimento`;
- `created_by`;
- timestamps.

A Fase 5 poderá acrescentar metadados necessários, mas deve evitar duplicar informações já presentes.

### 4.2 Pagamento parcial

O repasse é calculado somente sobre o valor efetivamente recebido.

Exemplo:

- procedimento: R$ 600;
- cliente pagou inicialmente: R$ 300;
- livro semanal considera apenas os R$ 300 recebidos naquele momento;
- quando entrar o restante, o novo recebimento passa a compor a apuração aplicável.

Não existe obrigação de repasse sobre valor ainda não recebido pela clínica.

## 5. Regra de comissão

### 5.1 Configuração

Criar estrutura privada de comissão por combinação:

- profissional;
- procedimento;
- percentual;
- vigência ou timestamp de atualização;
- quem alterou;
- timestamps.

Somente Mel/admin pode ler ou alterar essa configuração.

### 5.2 Privacidade do percentual

A colaboradora nunca deve receber o percentual em payload, view, RPC ou consulta direta autorizada.

A tela individual mostra somente valores monetários derivados, por exemplo:

- produção recebida;
- valor a receber;
- valor pago.

A ocultação deve ser garantida por desenho de API/RPC e RLS, não apenas por CSS ou ausência de coluna na tela.

## 6. Livros semanais

### 6.1 Conceito

Um livro semanal representa a apuração fechada de uma profissional em um intervalo semanal.

A apuração semanal é a unidade de visibilidade financeira da colaboradora.

Antes do fechamento, ela pode ver seus próprios pagamentos operacionais, mas o período permanece em estado `Aguardando fechamento` e não expõe valor de comissão/repasse apurado.

Depois do fechamento, o livro passa a mostrar:

- período;
- produção efetivamente recebida;
- valor a receber;
- status;
- data do fechamento;
- posteriormente, vínculo com pagamento do repasse quando houver.

### 6.2 Estados mínimos

Estados sugeridos:

- `aberto` — ainda recebendo movimentos e não publicado como apuração final;
- `fechado` — cálculo concluído e visível à profissional como valor a receber;
- `em_revisao` — livro reaberto pela Mel;
- `pago` — incluído em repasse efetivamente baixado.

Os nomes finais podem variar na implementação, desde que a semântica seja preservada.

### 6.3 Fechamento semanal

Somente a Mel fecha o livro.

No fechamento, o backend deve:

1. selecionar os pagamentos elegíveis da profissional no período;
2. impedir reutilização de pagamento já incorporado em outro livro fechado;
3. identificar o procedimento e a regra de comissão correspondente;
4. calcular o valor de repasse sobre o valor efetivamente recebido;
5. persistir itens detalhados do livro;
6. persistir o total da produção recebida;
7. persistir o total do repasse;
8. marcar o livro como fechado;
9. registrar auditoria.

O cálculo deve acontecer no banco, em operação transacional, preferencialmente via RPC segura.

## 7. Estrutura de dados proposta

A implementação pode ajustar nomes, mas deve preservar estes conceitos.

### 7.1 `comissao_profissional_procedimento`

Campos mínimos conceituais:

- `id uuid`;
- `profissional_user_id uuid`;
- `procedimento_id uuid`;
- `percentual numeric`;
- `ativo boolean`;
- `created_by uuid`;
- `updated_by uuid`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Garantir unicidade lógica por profissional/procedimento ativo.

### 7.2 `livros_financeiros`

Campos mínimos conceituais:

- `id uuid`;
- `profissional_user_id uuid`;
- `periodo_inicio date`;
- `periodo_fim date`;
- `status text`;
- `producao_recebida numeric`;
- `repasse_total numeric`;
- `fechado_at timestamptz`;
- `fechado_by uuid`;
- `reaberto_at timestamptz`;
- `reaberto_by uuid`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

### 7.3 `livro_financeiro_itens`

Cada item registra a origem do cálculo.

Campos mínimos conceituais:

- `id uuid`;
- `livro_id uuid`;
- `pagamento_id uuid`;
- `atendimento_id uuid`;
- `procedimento_id uuid`;
- `valor_recebido_base numeric`;
- `percentual_aplicado numeric`;
- `valor_repasse numeric`;
- `created_at timestamptz`.

`percentual_aplicado` é informação privada administrativa. Não deve ser retornado em consultas da colaboradora.

Persistir o percentual aplicado permite auditoria e recálculo controlado sem depender apenas da configuração atual.

### 7.4 `config_repasses`

Campos conceituais:

- `profissional_user_id uuid`;
- `ciclo_dias integer` restrito a 7, 15 ou 30;
- `updated_by uuid`;
- `updated_at timestamptz`.

Pode existir um padrão global e sobrescrita por profissional, desde que a regra final seja determinística.

### 7.5 `repasses`

Representa pagamento real da BC para uma profissional.

Campos conceituais:

- `id uuid`;
- `profissional_user_id uuid`;
- `periodo_inicio date`;
- `periodo_fim date`;
- `valor_total numeric`;
- `status text`;
- `pago_at timestamptz`;
- `pago_by uuid`;
- `observacao text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

### 7.6 `repasse_livros`

Tabela de ligação entre um repasse e um ou mais livros semanais.

Deve impedir que o mesmo livro seja pago em dois repasses ativos/concluídos.

## 8. Ciclo de pagamento

A apuração é semanal, mas o pagamento pode ocorrer em 7, 15 ou 30 dias.

Exemplo com ciclo de 15 dias:

- semana 1 fecha e gera livro `A receber`;
- semana 2 fecha e gera novo livro `A receber`;
- a Mel cria um único repasse com os dois livros;
- após pagamento real, dá baixa;
- os dois livros passam a refletir estado pago.

A colaboradora visualiza os livros semanais individualmente e também o histórico dos repasses que os quitaram.

## 9. Reabertura e recálculo retroativo

### 9.1 Regra geral

Livro fechado é congelado.

Para alterar valores já apurados, a Mel deve reabrir explicitamente o livro.

Ao reabrir:

- status muda para `em_revisao`;
- a colaboradora passa a ver o período como `Em revisão`;
- o valor anterior deixa de ser tratado como definitivo;
- a ação entra na auditoria.

### 9.2 Recálculo direcionado

A Mel pode solicitar recálculo por:

- profissional;
- procedimento;
- período;
- combinação desses filtros.

Exemplo:

`Alice + Peeling + 01/10 a 15/10`

Somente os itens correspondentes devem ser recalculados.

O recálculo usa o valor efetivamente recebido e a regra de comissão definida pela Mel para o escopo aplicável.

### 9.3 Livro já pago

Livro associado a repasse já baixado não pode ser recalculado silenciosamente.

A implementação deve exigir fluxo administrativo explícito de reabertura/estorno/revisão antes de qualquer alteração que afete valor já pago.

A ação deve ser auditada e preservar rastreabilidade do valor anterior e do novo valor.

## 10. Correções de pagamento

A colaboradora registra o pagamento do próprio atendimento.

Depois do registro:

- ela não altera percentuais;
- ela não altera livros fechados;
- correção financeira posterior que afete apuração fica sob controle da Mel.

Se a correção alterar pagamento já incluído em livro fechado, o sistema deve bloquear alteração silenciosa e exigir reabertura/revisão administrativa do livro afetado.

## 11. Segurança, RLS e RPC

### 11.1 Princípio

Toda regra de privacidade financeira deve ser aplicada no banco.

### 11.2 `pagamentos`

Substituir o modelo atual `admin-only` por acesso controlado:

- Mel/admin: leitura e administração global;
- colaboradora: leitura somente dos pagamentos vinculados a atendimentos próprios;
- colaboradora: criação/registro somente para atendimento próprio;
- correções sensíveis: RPC validada ou admin-only conforme regra final;
- nenhuma colaboradora pode selecionar pagamento de outra profissional.

### 11.3 Comissões

- configuração: admin-only;
- percentual: nunca exposto para colaboradora;
- cálculos: executados no backend;
- grants: apenas papéis estritamente necessários.

### 11.4 Livros

- Mel/admin: acesso global e mutação;
- colaboradora: leitura somente dos próprios livros;
- colaboradora não faz INSERT/UPDATE/DELETE direto;
- fechamento, reabertura e recálculo por RPC admin-only.

### 11.5 Repasses

- Mel/admin: acesso global e mutação;
- colaboradora: leitura somente dos próprios repasses;
- baixa exclusivamente admin;
- colaboradora não altera status.

### 11.6 RPCs

Operações candidatas a RPCs transacionais:

- registrar pagamento próprio;
- corrigir pagamento;
- configurar comissão;
- fechar livro semanal;
- reabrir livro;
- recalcular livro/itens;
- criar lote de repasse;
- dar baixa em repasse;
- reabrir/estornar repasse quando aplicável.

RPCs devem:

- derivar identidade via `auth.uid()`;
- validar papel no banco;
- usar `SECURITY DEFINER` somente quando necessário;
- definir `search_path` seguro;
- revogar `PUBLIC`/`anon` quando apropriado;
- conceder `EXECUTE` apenas a `authenticated` ou ao papel estritamente necessário;
- nunca confiar em `created_by`, `profissional_user_id` ou papel enviados pelo browser quando puderem ser derivados no servidor.

`service_role` continua proibida no frontend e no repositório público.

## 12. Interface da colaboradora

Adicionar área **Meu financeiro**.

### 12.1 Visão principal

Mostrar:

- período atual;
- pagamentos registrados no período;
- status `Aguardando fechamento` enquanto não houver livro fechado;
- livros semanais anteriores;
- produção recebida por livro fechado;
- valor a receber;
- valor pago;
- histórico de repasses.

Não mostrar:

- percentual;
- comissão configurada;
- margem da clínica;
- faturamento de outra profissional;
- consolidado geral;
- controles de fechamento/reabertura/recálculo.

### 12.2 Livro fechado

Exemplo de apresentação:

**Semana 01–07/10**  
Produção recebida: R$ 2.000,00  
Valor a receber: R$ 720,00  
Status: A receber

Se reaberto:

**Status: Em revisão**

Se pago:

**Status: Pago**  
Data do pagamento: 16/10/2026

## 13. Interface da Mel/ADM

Adicionar módulo **Financeiro** com seções conceituais:

- visão geral BC;
- por profissional;
- pagamentos recebidos;
- livros semanais;
- comissões;
- repasses;
- auditoria financeira.

### 13.1 Visão geral

Indicadores possíveis:

- total recebido no período;
- total pendente de clientes;
- total de repasses a pagar;
- total de repasses pagos;
- produção por profissional;
- produção por procedimento.

### 13.2 Comissões

Tela administrativa para definir percentual por profissional e procedimento.

A alteração deve registrar auditoria.

### 13.3 Fechamento semanal

A Mel seleciona semana e profissional, revisa pagamentos elegíveis e executa fechamento.

O sistema deve mostrar inconsistências antes de fechar, por exemplo:

- procedimento sem comissão configurada;
- pagamento sem vínculo válido;
- pagamento já incluído em outro livro;
- atendimento inconsistente.

O fechamento deve falhar de forma atômica se houver condição impeditiva.

### 13.4 Repasses

A Mel filtra livros elegíveis conforme ciclo de 7/15/30 dias, gera lote, confirma pagamento real e dá baixa.

## 14. Auditoria financeira

A Fase 5 amplia `audit_log` ou mecanismo equivalente para eventos mínimos:

- `pagamento_created`;
- `pagamento_corrected`;
- `comissao_created`;
- `comissao_updated`;
- `livro_closed`;
- `livro_reopened`;
- `livro_recalculated`;
- `repasse_created`;
- `repasse_paid`;
- `repasse_reopened` ou `repasse_reversed`, se suportado.

Registrar, quando aplicável:

- ator;
- entidade;
- profissional afetada;
- período;
- valores anteriores;
- valores novos;
- motivo/observação quando necessário;
- timestamp.

A colaboradora não recebe acesso global a essa auditoria.

## 15. Regras de consistência

O sistema deve impedir:

- pagamento da mesma origem entrar em dois livros fechados;
- livro entrar em dois repasses pagos;
- colaboradora consultar financeiro alheio;
- colaboradora descobrir percentual por endpoint autorizado;
- fechamento sem comissão configurada para item elegível;
- fechamento com pagamento inconsistente;
- alteração silenciosa de livro fechado;
- alteração silenciosa de livro pago;
- baixa de repasse sem livros elegíveis;
- valor de repasse negativo sem fluxo administrativo explícito;
- recálculo parcial que deixe totais do livro inconsistentes.

Operações compostas devem ocorrer em transação única.

## 16. Tratamento de erros

Erros de negócio devem ser claros e não vazar dados de outras profissionais.

Exemplos:

- `Pagamento não pertence à profissional autenticada.`
- `Livro já está fechado.`
- `Livro pago precisa ser reaberto antes da correção.`
- `Comissão não configurada para este procedimento.`
- `Pagamento já incluído em outro livro.`
- `Repasse já foi pago.`

Frontend deve preservar dados digitados quando uma operação falhar por erro de rede ou validação recuperável.

## 17. Estratégia de testes

Implementação deve seguir TDD onde aplicável.

### 17.1 Banco e segurança

Cobrir pelo menos:

- Alice só lê próprios pagamentos;
- Alice não lê pagamento da Mel;
- Mel lê todos;
- Alice registra pagamento apenas de atendimento próprio;
- Alice não consulta percentuais;
- Alice não lê configuração de comissão;
- Alice lê apenas próprios livros;
- Alice lê apenas próprios repasses;
- Mel fecha livro de qualquer profissional;
- colaboradora não fecha livro;
- pagamento não pode duplicar entre livros;
- livro não pode duplicar entre repasses;
- livro fechado não é alterado sem reabertura;
- livro pago exige fluxo administrativo antes de recálculo;
- recálculo direcionado não altera itens fora do filtro;
- auditoria é criada para ações sensíveis.

### 17.2 Frontend

Cobrir:

- colaboradora possui área `Meu financeiro`;
- percentual não aparece no HTML/DOM nem em objetos de dados expostos à camada da colaboradora;
- estados `Aguardando fechamento`, `A receber`, `Pago` e `Em revisão`;
- admin possui visão geral, filtros por profissional e controles de fechamento;
- erros preservam formulários quando apropriado.

### 17.3 Homologação

Usar dados exclusivamente fictícios e transações com rollback quando possível.

Não criar nem alterar paciente real durante a homologação técnica.

## 18. Compatibilidade e migração

A Fase 5 parte do estado atual em que `pagamentos` possui policy `admin-only`.

A implementação deve migrar para o novo modelo sem abrir acesso amplo indevido.

Não alterar o projeto Supabase antigo `bc-estetica-pre-anamnese`.

Não modificar o `/admin/` legado da pré-anamnese.

O trabalho permanece no projeto `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`) e nas rotas `/gestao/`.

## 19. Fora do escopo desta fase

Ficam fora da Fase 5, salvo aprovação posterior:

- emissão fiscal/NF-e;
- integração bancária automática;
- conciliação bancária por Open Finance;
- folha de pagamento formal;
- cálculo tributário;
- integração com contabilidade externa;
- gateway de pagamento;
- PIX automático;
- antecipação de recebíveis;
- custos de insumos e margem líquida contábil completa.

A Fase 5 trata de recebimentos operacionais, apuração, repasses, fechamento e visibilidade financeira interna da BC.

## 20. Critérios de aceite

A Fase 5 será considerada concluída quando:

1. colaboradora registrar pagamento apenas do próprio atendimento;
2. colaboradora consultar apenas o próprio financeiro;
3. percentual não for exposto à colaboradora;
4. Mel administrar comissão por profissional/procedimento;
5. livros forem fechados semanalmente pela Mel;
6. colaboradora só enxergar valor de repasse após fechamento;
7. repasses puderem seguir ciclos de 7, 15 ou 30 dias configuráveis pela Mel;
8. fechamento e pagamento forem etapas distintas;
9. Mel conseguir reabrir e recalcular de forma direcionada;
10. livro fechado/pago permanecer protegido contra alteração silenciosa;
11. financeiro geral permanecer exclusivo da Mel;
12. auditoria registrar ações financeiras sensíveis;
13. RLS/RPC impedirem acesso cruzado entre profissionais;
14. testes automatizados cobrirem as regras críticas;
15. homologação com dados fictícios confirmar o comportamento sem tocar em pacientes reais.
