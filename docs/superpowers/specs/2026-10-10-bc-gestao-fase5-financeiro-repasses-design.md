# BC Gestão — Fase 5: Financeiro individual, livros semanais e repasses

**Data:** 2026-10-10  
**Status:** design aprovado em conversa; aguardando revisão deste documento antes do plano de implementação  
**Projeto Supabase:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)

## 1. Objetivo

Evoluir o BC Gestão para controlar o financeiro da clínica e os repasses das profissionais com separação clara entre:

- recebimentos efetivos de clientes;
- apuração semanal de produção;
- valor devido a cada profissional;
- pagamento real do repasse;
- visão individual da colaboradora;
- visão consolidada exclusiva da Mel/ADM.

A colaboradora poderá registrar recebimentos vinculados aos próprios atendimentos e consultar apenas o próprio financeiro. A Mel administrará percentuais, correções, fechamento de livros, recálculos, ciclos de repasse, baixas e o consolidado geral da BC.

## 2. Decisões de produto aprovadas

1. Cada profissional vê apenas o próprio financeiro.
2. A Mel/ADM vê o financeiro individual de todas e o consolidado geral.
3. A colaboradora registra o recebimento do próprio atendimento.
4. Correções financeiras posteriores e fechamento ficam sob controle da Mel.
5. Comissão é definida por combinação **profissional × procedimento**.
6. Apenas a Mel vê e altera percentuais.
7. A colaboradora vê somente valores monetários de produção, a receber e pagos; nunca o percentual.
8. Comissão incide sobre o valor **efetivamente recebido** pela clínica.
9. Pagamento parcial gera comissão apenas sobre a parcela recebida.
10. O cálculo do repasse ocorre no fechamento do livro, não em tempo real para a colaboradora.
11. A Mel fecha o livro **semanalmente** para publicar o valor devido à colaboradora.
12. Fechar o livro não significa pagar o repasse.
13. O pagamento da profissional pode seguir ciclo de **7, 15 ou 30 dias**, configurável pela Mel, inclusive por profissional.
14. Livro fechado fica congelado.
15. A Mel pode reabrir livro para revisão.
16. Recálculo retroativo pode ser direcionado por profissional, procedimento e período.
17. Livro já pago não pode ser recalculado silenciosamente; exige fluxo administrativo explícito de reabertura/revisão/estorno.
18. Ações financeiras sensíveis entram na auditoria.
19. Segurança é garantida no Supabase por RLS/RPC, não apenas pela interface.

## 3. Papéis e permissões

### 3.1 Colaboradora ativa

Pode:

- registrar recebimento referente a atendimento próprio;
- informar valor recebido, forma de pagamento e dados operacionais permitidos;
- consultar recebimentos dos próprios atendimentos;
- visualizar período atual como `Aguardando fechamento`;
- visualizar livros semanais próprios já fechados;
- visualizar produção recebida apurada;
- visualizar valor a receber;
- visualizar valor já pago;
- visualizar histórico dos próprios repasses;
- visualizar estados `Aguardando fechamento`, `A receber`, `Pago` e `Em revisão`.

Não pode:

- visualizar percentual;
- consultar configuração de comissão;
- visualizar financeiro de outra profissional;
- visualizar consolidado da BC;
- fechar livro;
- reabrir livro;
- recalcular livro;
- alterar ciclo de repasse;
- alterar comissão;
- dar baixa em repasse;
- alterar livro fechado;
- acessar auditoria financeira global.

### 3.2 Mel — administradora e profissional atendente

Pode:

- consultar e administrar todos os recebimentos;
- consultar financeiro individual de qualquer profissional;
- consultar consolidado geral da clínica;
- configurar comissão por profissional/procedimento;
- fechar livros semanais;
- reabrir livros;
- recalcular por profissional, procedimento e período;
- configurar ciclo de 7, 15 ou 30 dias;
- configurar ciclo individual por profissional;
- gerar lotes de repasse;
- dar baixa em repasse;
- corrigir movimentos financeiros;
- consultar auditoria financeira completa.

## 4. Fluxo financeiro principal

Fluxo canônico:

`Atendimento → recebimento da cliente → movimentos de recebimento → livro semanal → cálculo do repasse → lote de repasse → baixa do pagamento da profissional`

O sistema deve manter separados:

- obrigação/valor do atendimento;
- movimentos reais de entrada de dinheiro;
- apuração do repasse;
- pagamento da profissional.

## 5. Pagamentos e movimentos de recebimento

### 5.1 Tabela `pagamentos`

`pagamentos` continua representando a situação financeira do atendimento/cliente, usando os campos atuais quando aplicável, como:

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

`valor_recebido` pode continuar como total consolidado para conveniência, mas não deve ser a única fonte histórica para apuração semanal.

### 5.2 Nova entidade de movimentos

Para evitar dupla contagem em pagamentos parciais, criar entidade conceitual `recebimentos` ou `pagamento_movimentos`.

Cada entrada real de dinheiro deve gerar um movimento individual com, no mínimo:

- `id uuid`;
- `pagamento_id uuid`;
- `atendimento_id uuid`;
- `cliente_id uuid`;
- `profissional_user_id uuid` derivado no backend;
- `valor numeric`;
- `forma_pagamento text`;
- `recebido_at timestamptz`;
- `created_by uuid`;
- `created_at timestamptz`;
- campos de correção/estorno quando necessários.

A profissional não deve ser aceita como autoridade vinda do browser; deve ser derivada do atendimento/agendamento persistido.

### 5.3 Pagamento parcial

Exemplo:

- procedimento: R$ 600;
- cliente paga R$ 300 na semana 1;
- movimento 1: R$ 300;
- livro da semana 1 considera somente movimento 1;
- cliente paga outros R$ 300 na semana 2;
- movimento 2: R$ 300;
- livro da semana 2 considera somente movimento 2.

Assim o mesmo valor não entra duas vezes na apuração.

Correções de movimento já usado em livro fechado exigem revisão administrativa do livro afetado.

## 6. Regra de comissão

### 6.1 Configuração privada

Criar estrutura de comissão por:

- profissional;
- procedimento;
- percentual;
- status ativo;
- quem criou/alterou;
- timestamps.

Somente Mel/admin pode ler e alterar essa configuração.

### 6.2 Privacidade do percentual

A colaboradora nunca deve receber percentual por:

- tela;
- payload;
- view autorizada;
- RPC;
- consulta direta permitida.

Ela recebe somente valores derivados já apurados.

### 6.3 Percentual aplicado

No fechamento, cada item do livro deve armazenar internamente o percentual aplicado naquele cálculo para garantir rastreabilidade.

Esse campo permanece admin-only.

Quando a Mel executar recálculo retroativo autorizado, o sistema reaplica a regra de comissão definida para o recálculo e registra na auditoria o valor anterior e o novo valor.

## 7. Livros semanais

### 7.1 Conceito

Cada livro representa a apuração de uma profissional em um intervalo de 7 dias, usando o fuso da clínica (`America/Sao_Paulo`).

Os limites exatos do período ficam gravados em `periodo_inicio` e `periodo_fim`, evitando ambiguidade.

Antes do fechamento:

- a colaboradora pode ver os próprios recebimentos operacionais;
- o período aparece como `Aguardando fechamento`;
- nenhum valor de comissão/repasse é exibido como definitivo.

Depois do fechamento:

- produção recebida do período é publicada;
- valor a receber é publicado;
- o livro fica congelado.

### 7.2 Estados mínimos

- `aberto` — aguardando fechamento;
- `fechado` — apurado e visível como valor a receber;
- `em_revisao` — reaberto pela Mel;
- `pago` — quitado por repasse baixado.

### 7.3 Fechamento

Somente Mel fecha livro.

A operação deve ser transacional e:

1. selecionar movimentos de recebimento elegíveis da profissional no período;
2. impedir movimento já incorporado em outro livro fechado;
3. identificar o procedimento de cada movimento;
4. validar existência de comissão configurada;
5. calcular repasse sobre o valor do movimento recebido;
6. persistir itens detalhados;
7. persistir produção total recebida;
8. persistir repasse total;
9. marcar livro como fechado;
10. registrar auditoria.

Se existir inconsistência impeditiva, o fechamento inteiro falha sem alteração parcial.

## 8. Estrutura de dados proposta

Os nomes finais podem variar, mas os conceitos devem ser preservados.

### 8.1 `comissao_profissional_procedimento`

Campos conceituais:

- `id uuid`;
- `profissional_user_id uuid`;
- `procedimento_id uuid`;
- `percentual numeric`;
- `ativo boolean`;
- `created_by uuid`;
- `updated_by uuid`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Regra: unicidade lógica por combinação ativa profissional/procedimento.

### 8.2 `pagamento_movimentos`

Campos conceituais:

- `id uuid`;
- `pagamento_id uuid`;
- `atendimento_id uuid`;
- `cliente_id uuid`;
- `profissional_user_id uuid`;
- `valor numeric`;
- `forma_pagamento text`;
- `recebido_at timestamptz`;
- `created_by uuid`;
- `created_at timestamptz`;
- `status text` para suportar correção/estorno controlado, se necessário.

### 8.3 `livros_financeiros`

Campos conceituais:

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

Evitar sobreposição de livros fechados da mesma profissional para o mesmo intervalo operacional.

### 8.4 `livro_financeiro_itens`

Campos conceituais:

- `id uuid`;
- `livro_id uuid`;
- `movimento_recebimento_id uuid`;
- `pagamento_id uuid`;
- `atendimento_id uuid`;
- `procedimento_id uuid`;
- `valor_recebido_base numeric`;
- `percentual_aplicado numeric`;
- `valor_repasse numeric`;
- `created_at timestamptz`.

`percentual_aplicado` é admin-only.

Cada movimento de recebimento pode participar de no máximo um livro fechado válido.

### 8.5 `config_repasses`

Campos conceituais:

- `profissional_user_id uuid`;
- `ciclo_dias integer` limitado a 7, 15 ou 30;
- `updated_by uuid`;
- `updated_at timestamptz`.

Pode existir padrão global com sobrescrita por profissional, desde que a regra final seja determinística.

### 8.6 `repasses`

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

### 8.7 `repasse_livros`

Liga um repasse a um ou mais livros semanais.

Regra: um mesmo livro não pode integrar dois repasses ativos/concluídos.

## 9. Ciclo de pagamento da profissional

A apuração é semanal, mas o pagamento pode ocorrer a cada 7, 15 ou 30 dias.

Exemplo de ciclo de 15 dias:

- livro semana 1 fecha e vira `A receber`;
- livro semana 2 fecha e vira `A receber`;
- Mel gera um único repasse reunindo os dois livros;
- após pagamento real, Mel dá baixa;
- os livros associados passam a refletir estado pago.

A colaboradora continua vendo cada livro semanal separadamente e também o histórico dos repasses que quitaram esses livros.

## 10. Reabertura e recálculo retroativo

### 10.1 Livro fechado

Livro fechado não pode ser alterado silenciosamente.

Para revisar:

1. Mel reabre;
2. status muda para `em_revisao`;
3. colaboradora vê `Em revisão`;
4. valor anterior deixa de ser tratado como definitivo;
5. ação é auditada.

### 10.2 Recálculo direcionado

Mel pode recalcular por:

- profissional;
- procedimento;
- período;
- combinação desses filtros.

Exemplo:

`Alice + Peeling + 01/10 a 15/10`

Itens fora do filtro não podem ser alterados.

Após recálculo, totais do livro devem ser recompostos integralmente para permanecer consistentes.

### 10.3 Livro já pago

Livro associado a repasse já baixado exige fluxo administrativo explícito antes de qualquer recálculo que mude valor pago.

A implementação deve preservar:

- valor anterior;
- novo valor;
- responsável;
- data/hora;
- motivo/observação quando aplicável.

## 11. Correções financeiras

A colaboradora registra recebimento do próprio atendimento.

Depois do registro:

- não altera percentuais;
- não altera livro fechado;
- não corrige valor consolidado de repasse.

Correção posterior do recebimento fica sob controle da Mel quando puder afetar apuração.

Se o movimento já estiver em livro fechado, a operação deve bloquear correção silenciosa e exigir revisão do livro.

Preferência técnica: preservar histórico por movimento de correção/estorno ou versão auditável, em vez de sobrescrever dados sem rastreabilidade.

## 12. Segurança, RLS e RPC

### 12.1 Princípio

Toda privacidade financeira deve ser garantida no banco.

### 12.2 `pagamentos` e `pagamento_movimentos`

- Mel/admin: leitura e administração global;
- colaboradora: leitura apenas de registros derivados dos próprios atendimentos;
- colaboradora: criação de movimento apenas para atendimento próprio;
- colaboradora não informa autoridade sobre profissional;
- correções sensíveis ficam sob RPC validada/admin.

### 12.3 Comissões

- leitura: admin-only;
- alteração: admin-only;
- percentual nunca aparece em API de colaboradora;
- cálculo acontece no backend.

### 12.4 Livros

- Mel/admin: leitura e mutação global;
- colaboradora: leitura apenas dos próprios livros;
- colaboradora não faz INSERT/UPDATE/DELETE direto;
- fechamento/reabertura/recálculo: RPC admin-only.

### 12.5 Repasses

- Mel/admin: leitura e mutação global;
- colaboradora: leitura apenas dos próprios repasses;
- baixa: admin-only.

### 12.6 RPCs candidatas

- registrar recebimento próprio;
- corrigir/estornar recebimento;
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
- usar `SECURITY DEFINER` apenas quando necessário;
- fixar `search_path` seguro;
- revogar `PUBLIC`/`anon` quando apropriado;
- conceder `EXECUTE` apenas a `authenticated` ou papel estritamente necessário;
- nunca confiar em `created_by`, `profissional_user_id` ou papel enviados pelo navegador quando deriváveis no servidor.

`service_role` permanece proibida no frontend e no repositório público.

## 13. Interface da colaboradora

Adicionar área **Meu financeiro**.

Mostrar:

- período atual;
- próprios recebimentos operacionais;
- `Aguardando fechamento` antes da publicação semanal;
- livros semanais fechados;
- produção recebida de cada livro;
- valor a receber;
- valor pago;
- histórico de repasses;
- `Em revisão` quando livro for reaberto.

Não mostrar:

- percentual;
- configuração de comissão;
- margem da clínica;
- valores de outra profissional;
- consolidado geral;
- botões de fechamento, reabertura, recálculo ou baixa.

Exemplo:

**Semana 01–07/10**  
Produção recebida: R$ 2.000,00  
Valor a receber: R$ 720,00  
Status: A receber

## 14. Interface da Mel/ADM

Adicionar módulo **Financeiro** com áreas:

- Visão geral BC;
- Por profissional;
- Recebimentos;
- Livros semanais;
- Comissões;
- Repasses;
- Auditoria financeira.

### 14.1 Visão geral

Indicadores possíveis:

- total recebido no período;
- total pendente de clientes;
- total de repasses a pagar;
- total de repasses pagos;
- produção por profissional;
- produção por procedimento.

### 14.2 Comissões

Mel configura percentual por profissional/procedimento.

Toda alteração entra em auditoria.

### 14.3 Fechamento semanal

Mel escolhe profissional e semana, revisa movimentos elegíveis e fecha.

Bloqueios mínimos:

- comissão ausente;
- movimento sem vínculo válido;
- movimento já usado em outro livro;
- atendimento inconsistente.

### 14.4 Repasses

Mel filtra livros elegíveis conforme ciclo 7/15/30 dias, cria lote, confirma pagamento real e dá baixa.

## 15. Auditoria financeira

Ampliar `audit_log` ou mecanismo equivalente para eventos mínimos:

- `recebimento_created`;
- `recebimento_corrected`;
- `recebimento_reversed` quando aplicável;
- `comissao_created`;
- `comissao_updated`;
- `livro_closed`;
- `livro_reopened`;
- `livro_recalculated`;
- `repasse_created`;
- `repasse_paid`;
- `repasse_reopened` ou `repasse_reversed`, se suportado.

Registrar quando aplicável:

- ator;
- entidade;
- profissional afetada;
- período;
- valores anteriores;
- valores novos;
- motivo;
- timestamp.

Colaboradora não recebe acesso global à auditoria.

## 16. Regras de consistência

O sistema deve impedir:

- mesmo movimento entrar em dois livros fechados;
- mesmo livro entrar em dois repasses pagos;
- colaboradora consultar financeiro alheio;
- colaboradora descobrir percentual por endpoint autorizado;
- fechamento sem comissão configurada;
- fechamento com movimento inconsistente;
- alteração silenciosa de livro fechado;
- alteração silenciosa de livro pago;
- recálculo que deixe totais divergentes;
- dupla contagem de pagamento parcial;
- baixa de repasse sem livro elegível;
- valor de repasse negativo sem fluxo administrativo explícito.

Operações compostas devem ser transacionais.

## 17. Tratamento de erros

Mensagens de negócio devem ser claras e não vazar dados de outras profissionais.

Exemplos:

- `Recebimento não pertence à profissional autenticada.`
- `Livro já está fechado.`
- `Livro pago precisa de revisão administrativa antes da correção.`
- `Comissão não configurada para este procedimento.`
- `Movimento já incluído em outro livro.`
- `Repasse já foi pago.`

Frontend deve preservar dados digitados em erros recuperáveis de rede/validação.

## 18. Estratégia de testes

Implementação deve seguir TDD onde aplicável.

### 18.1 Banco e segurança

Cobrir pelo menos:

- Alice lê apenas próprios recebimentos;
- Alice não lê recebimentos da Mel;
- Mel lê todos;
- Alice registra recebimento apenas de atendimento próprio;
- profissional é derivada no backend;
- Alice não consulta percentuais;
- Alice lê apenas próprios livros;
- Alice lê apenas próprios repasses;
- Mel fecha livro de qualquer profissional;
- colaboradora não fecha livro;
- movimento não duplica entre livros;
- livro não duplica entre repasses;
- dois pagamentos parciais em semanas diferentes entram uma vez em cada semana;
- livro fechado exige reabertura para alteração;
- livro pago exige fluxo administrativo antes de recálculo;
- recálculo direcionado não altera itens fora do filtro;
- auditoria é criada para ações sensíveis.

### 18.2 Frontend

Cobrir:

- colaboradora possui `Meu financeiro`;
- percentual não aparece na interface nem em payloads permitidos à colaboradora;
- estados `Aguardando fechamento`, `A receber`, `Pago`, `Em revisão`;
- admin possui visão geral, filtros e controles de fechamento;
- erros recuperáveis preservam formulários.

### 18.3 Homologação

Usar apenas dados fictícios e rollback quando possível.

Não criar nem alterar paciente real durante homologação técnica.

## 19. Compatibilidade e migração

A Fase 5 parte do estado atual em que `pagamentos` possui policy `admin-only`.

A migração deve abrir apenas o acesso individual necessário e manter isolamento entre profissionais.

Não alterar:

- projeto Supabase antigo `bc-estetica-pre-anamnese`;
- `/admin/` legado da pré-anamnese.

Escopo técnico permanece em:

- Supabase `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`);
- rotas `/gestao/`;
- repositório `bcesteticaavancada/bcesteticaavancada-alt`.

## 20. Fora do escopo

Ficam fora desta fase:

- NF-e/emissão fiscal;
- integração bancária automática;
- Open Finance;
- conciliação bancária automática;
- folha de pagamento formal;
- tributação;
- contabilidade externa;
- gateway de pagamento;
- PIX automático;
- antecipação de recebíveis;
- margem líquida contábil completa por insumos.

## 21. Critérios de aceite

A Fase 5 será considerada concluída quando:

1. colaboradora registrar recebimento apenas do próprio atendimento;
2. recebimentos parciais forem representados por movimentos sem dupla contagem;
3. colaboradora consultar apenas o próprio financeiro;
4. percentual nunca for exposto à colaboradora;
5. Mel administrar comissão por profissional/procedimento;
6. livros forem fechados semanalmente pela Mel;
7. colaboradora só enxergar valor de repasse após fechamento;
8. repasses seguirem ciclos configuráveis de 7, 15 ou 30 dias;
9. fechamento e pagamento forem etapas distintas;
10. Mel puder reabrir e recalcular de forma direcionada;
11. livro fechado/pago permanecer protegido contra alteração silenciosa;
12. consolidado geral permanecer exclusivo da Mel;
13. auditoria registrar ações financeiras sensíveis;
14. RLS/RPC impedirem acesso cruzado entre profissionais;
15. testes automatizados cobrirem regras críticas;
16. homologação com dados fictícios confirmar o comportamento sem tocar em pacientes reais.
