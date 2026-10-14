# BC Gestão — Fase 6E.1: Planos, Pacotes e Saldo de Sessões

**Data:** 2026-10-14  
**Status:** design aprovado em conversa; aguardando revisão formal desta spec antes do plano de implementação  
**Repositório:** `bcesteticaavancada/bcesteticaavancada-alt`  
**Supabase correto:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)  
**Supabase proibido/legado:** `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`)  
**Fuso clínico:** `America/Sao_Paulo`

## 1. Objetivo

Entregar a primeira fatia da Fase 6E permitindo que a equipe da BC Estética construa, salve, venda e acompanhe **planos/combos/pacotes de tratamento** formados a partir dos procedimentos e protocolos já cadastrados na Biblioteca Clínica.

O cliente não monta plano nem pacote no site público. No fluxo público ele continua agendando um **procedimento**. Planos, combinações, quantidade de sessões, condições comerciais e descontos são definidos internamente e, quando necessário, presencialmente pela equipe.

A Biblioteca Clínica continua sendo a fonte canônica dos procedimentos. Um plano/pacote é uma camada comercial e operacional sobre esses procedimentos; ele **não cria um procedimento clínico falso** e não substitui a ficha individual de cada sessão.

## 2. Princípios de produto aprovados

1. **Biblioteca Clínica = caixa de peças.** Procedimentos e protocolos já existentes permanecem canônicos e reutilizáveis.
2. **Plano/pacote = agrupamento comercial.** Pode combinar um ou vários procedimentos diferentes, com qualquer quantidade de sessões.
3. **Cada sessão continua clínica e independente.** Quando uma sessão é realizada, ela abre o procedimento real correspondente, com suas próprias regras de anamnese, TCLE, fotos, produto/lote, equipamento, intercorrências, parecer e PDF.
4. **Cliente não monta pacote online.** O site/agenda pública permanece focado em agendamento de procedimento.
5. **Toda equipe clínica/autorizada pode criar combos/pacotes.** Não restringir a criação somente à Mel.
6. **Procedimentos existentes já aparecem prontos para seleção.** Ninguém precisa recadastrar Botox, Drenagem, Enzimas, Limpeza de Pele, Bioestimulador etc. só para colocá-los em um combo.
7. **Novo procedimento continua sendo cadastro da Biblioteca Clínica.** Se surgir algo que não existe, a equipe usa o fluxo de cadastro de procedimento já existente; não criar um cadastro paralelo dentro de Pacotes.
8. **Pacotes podem ser mistos.** Ex.: Botox Full Face + Limpeza de Pele + Drenagem + aplicação de Enzimas.
9. **Pacote pode ser reutilizável ou personalizado.** Pode existir como modelo da BC ou como plano específico de uma cliente.
10. **Venda pode ter desconto negociado.** O sistema mostra valor cheio, percentual de desconto, motivo e valor final.
11. **Colaboradora pode conceder qualquer percentual no momento da venda.** Não bloquear a conclusão da venda esperando aprovação prévia.
12. **Desconto aplicado por colaboradora vai para revisão posterior da Mel.** A revisão não desfaz automaticamente pagamento/venda já realizada.
13. **Sessão só consome saldo quando o atendimento correspondente é finalizado.** Agendamento, criação de encaixe ou abertura de ficha não devem consumir saldo.
14. **Sem exclusão destrutiva.** Plano, composição, venda, desconto e consumo de sessão precisam manter histórico auditável.
15. **Não quebrar Fase 5 nem 6A–6D.** A 6E.1 deve reutilizar financeiro, agenda, Central da Cliente, Biblioteca Clínica e `clinical_treatments` existentes.

## 3. Escopo desta entrega

### Incluído

- cadastro de modelos de planos/pacotes;
- composição de pacote usando procedimentos/protocolos existentes;
- pacote simples ou misto;
- quantidade por item;
- valor cheio calculado automaticamente;
- desconto percentual padrão opcional no modelo;
- venda/atribuição de plano a uma cliente;
- desconto negociado específico da venda;
- revisão posterior de descontos pela Mel;
- saldo contratado, realizado e restante por procedimento dentro do plano;
- vínculo de sessão clínica finalizada ao item do plano;
- entrada “Sessão de plano/pacote” dentro do atendimento da cliente;
- seleção somente entre itens com saldo disponível e procedimento executável pela profissional;
- resumo do plano ativo na Central da Cliente;
- histórico e auditoria das ações sensíveis.

### Fora desta entrega

- checkout público de pacotes;
- cliente montar combo pelo site;
- pagamento online;
- cobrança automática;
- estorno automático de pagamento em caso de revisão negativa de desconto;
- programas de pontos/fidelidade;
- assinatura recorrente/mensalidade;
- transferência de saldo entre clientes;
- marketplace de pacotes;
- desconto automático por regras promocionais complexas;
- exportação completa de prontuário (6F);
- mensagens automáticas de WhatsApp/e-mail;
- regras clínicas novas fora da Biblioteca Clínica existente.

## 4. Arquitetura

A 6E.1 deve acrescentar uma camada comercial sem duplicar domínio clínico.

Fluxo de referência:

`Biblioteca Clínica → Modelo de Plano/Pacote → Venda para Cliente → Saldo por Item → Agenda/Atendimento → Finalização da Sessão → Consumo do Saldo`

Fontes canônicas:

- `procedimentos` / `procedure_versions`: procedimento/protocolo;
- `clientes`: cliente;
- `agendamentos`: agenda;
- `clinical_treatments`: sessão clínica;
- financeiro da Fase 5: recebimentos/pagamentos/repasses conforme regras já existentes.

A nova camada não deve copiar conteúdo clínico do procedimento. Ela guarda apenas IDs, snapshots comerciais necessários e quantidade contratada.

## 5. Modelos de Plano/Pacote

### 5.1 Conceito

Um modelo é uma composição reutilizável da BC.

Exemplos:

**Pacote Renovação Facial**
- 1× Botox Full Face
- 2× Limpeza de Pele
- 1× Peeling

**Protocolo Corporal**
- 4× Drenagem Linfática
- 3× Massagem Redutora
- 2× Aplicação de Enzimas
- 2× Radiofrequência

### 5.2 Campos propostos

Tabela conceitual `treatment_plan_templates`:

- `id uuid pk`
- `name text not null`
- `description text null`
- `status text not null` (`ativo`, `inativo`)
- `default_discount_percent numeric null`
- `created_by uuid not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `reviewed_by uuid null`
- `reviewed_at timestamptz null`

Composição `treatment_plan_template_items`:

- `id uuid pk`
- `template_id uuid not null`
- `procedure_id uuid not null`
- `quantity integer not null`
- `position integer not null`
- snapshot do nome e valor-base vigente na data de composição quando necessário para histórico comercial.

### 5.3 Quem pode criar

Equipe autenticada/autorizada da BC pode criar modelo de pacote.

Criação por colaboradora não deve ser bloqueada esperando aprovação prévia. O sistema registra autoria. A Mel mantém visão administrativa para revisar posteriormente composição e condições comerciais.

### 5.4 Edição

Alterar um modelo não pode reescrever silenciosamente vendas antigas. Uma venda já criada mantém snapshot da composição e preço daquela negociação.

A edição do modelo afeta apenas usos futuros.

## 6. Valor cheio e desconto

### 6.1 Valor cheio

Ao montar um pacote, o sistema soma automaticamente:

`valor cheio = Σ (valor-base vigente do procedimento × quantidade)`

A soma é referência comercial e deve ficar visível para a equipe.

### 6.2 Desconto padrão do modelo

Modelo pode ter percentual de desconto padrão opcional.

Exemplo:

- valor cheio: R$ 2.000,00;
- desconto padrão: 10%;
- valor de referência do pacote: R$ 1.800,00.

### 6.3 Desconto específico da venda

Na atribuição/venda para uma cliente, a equipe pode aplicar outro percentual.

Campos mínimos:

- percentual de desconto;
- motivo;
- observação opcional;
- colaboradora que concedeu;
- data/hora;
- valor cheio no momento da venda;
- valor final calculado.

Motivos iniciais sugeridos:

- `pagamento_a_vista`;
- `negociado_anteriormente`;
- `negociado_na_venda`;
- `campanha_promocional`;
- `fidelizacao`;
- `outro`.

Percentual deve ser numericamente válido e não produzir valor final negativo.

## 7. Revisão posterior de desconto pela Mel

A revisão é **posterior**, não prévia.

Estados propostos para revisão:

- `pendente_revisao`;
- `revisado_ok`;
- `revisado_atencao`.

Regras:

- colaboradora pode conceder qualquer percentual permitido pelo backend no momento da venda;
- a venda não fica travada esperando Mel;
- Mel visualiza descontos pendentes em painel administrativo;
- Mel pode marcar como OK ou como “atenção” e registrar nota administrativa;
- revisão não altera retroativamente o valor já cobrado;
- revisão não apaga nem substitui percentual original;
- eventual bloqueio futuro de uma colaboradora para descontos fica reservado para evolução posterior, fora da primeira 6E.1.

## 8. Venda/Atribuição de Plano à Cliente

### 8.1 Conceito

Uma venda transforma um modelo — ou uma composição personalizada — em um plano próprio da cliente.

Tabela conceitual `client_treatment_plans`:

- `id uuid pk`
- `cliente_id uuid not null`
- `template_id uuid null`
- `name_snapshot text not null`
- `status text not null`
- `full_price numeric not null`
- `discount_percent numeric not null default 0`
- `discount_reason text null`
- `discount_note text null`
- `final_price numeric not null`
- `discount_review_status text not null`
- `discount_reviewed_by uuid null`
- `discount_reviewed_at timestamptz null`
- `discount_review_note text null`
- `sold_by uuid not null`
- `sold_at timestamptz not null`
- `created_at timestamptz not null`

Estados iniciais do plano:

- `ativo`;
- `concluido`;
- `pausado`;
- `cancelado`.

Nenhum cancelamento apaga histórico ou sessões já consumidas.

### 8.2 Plano personalizado

A equipe pode criar um plano diretamente para a cliente, selecionando procedimentos existentes, sem precisar primeiro salvar um template global.

Opcionalmente, depois pode salvar aquela composição como novo modelo reutilizável da BC.

## 9. Itens e saldo de sessões

Tabela conceitual `client_treatment_plan_items`:

- `id uuid pk`
- `plan_id uuid not null`
- `procedure_id uuid not null`
- `procedure_name_snapshot text not null`
- `unit_price_snapshot numeric not null`
- `quantity_contracted integer not null`
- `quantity_consumed integer not null default 0`
- `position integer not null`

Saldo derivado:

`restante = contratado - consumido`

Não persistir saldo duplicado se puder ser derivado com segurança.

Regras:

- não permitir consumo acima do contratado;
- não permitir quantidade contratada <= 0;
- uma sessão clínica só pode consumir um item compatível com o mesmo `procedure_id`;
- protocolo composto continua abrindo as regras clínicas próprias da Biblioteca, independentemente de estar dentro de pacote.

## 10. Consumo por Atendimento

### 10.1 Seleção

Na Central da Cliente, ao iniciar atendimento, a equipe escolhe:

- `Procedimento avulso`; ou
- `Sessão de plano/pacote`.

Ao escolher plano/pacote, mostrar:

- planos ativos da cliente;
- itens com saldo disponível;
- procedimento;
- contratado / realizado / restante;
- somente opções que a profissional autenticada pode executar.

### 10.2 Momento do consumo

Saldo **não** é consumido em:

- agendamento;
- encaixe;
- criação do tratamento;
- início do tratamento.

Saldo é consumido apenas quando o `clinical_treatment` vinculado é finalizado com sucesso.

### 10.3 Idempotência

A mesma sessão clínica não pode consumir saldo duas vezes, mesmo em retry, duplo clique ou reprocessamento.

Criar relação explícita entre atendimento e consumo, por exemplo `treatment_plan_session_usages`, com unicidade por `treatment_id`.

### 10.4 Correção/reabertura

Correção clínica de uma ficha já finalizada não consome nova sessão.

Se houver cancelamento administrativo que exija devolver saldo, isso deve ser ação explícita e auditável; nunca simplesmente apagar o uso anterior.

## 11. Central da Cliente

A Central passa a mostrar no Resumo:

- plano(s) ativo(s);
- progresso geral;
- próxima sessão/retorno quando houver;
- itens pendentes;
- alertas administrativos simples, sem misturar valores financeiros para quem não tem permissão.

Nova área/aba recomendada: **Planos e Pacotes**.

Conteúdo:

- nome do plano;
- status;
- sessões por procedimento;
- realizado/restante;
- data de criação/venda;
- ações conforme permissão.

Valores e descontos obedecem segregação financeira da Fase 5.

## 12. Área Procedimentos

A área Procedimentos continua sendo a administração da Biblioteca Clínica e recebe uma navegação clara para:

- **Procedimentos/Protocolos** — catálogo clínico existente;
- **Planos e Pacotes** — construtor de combos reutilizáveis.

Não criar uma segunda tabela de “procedimentos de pacote”.

Botão de novo pacote:

`+ Novo plano/pacote`

Fluxo:

`nome → selecionar procedimentos → quantidades → visualizar valor cheio → desconto padrão opcional → salvar`

A seleção usa os procedimentos/protocolos já cadastrados e ativos.

## 13. Integração com Financeiro da Fase 5

A 6E.1 não deve substituir o motor financeiro já existente.

Objetivos desta fatia:

- registrar valor comercial cheio/final da venda do plano;
- permitir referência consistente da venda no financeiro;
- manter privacidade dos percentuais e valores conforme papel;
- preparar chave estável para 6E.3 aprofundar integração por cliente.

Nesta primeira fatia, nenhuma colaboradora ganha acesso ao consolidado financeiro de outras profissionais.

A Mel continua com visão administrativa completa conforme regras da Fase 5.

## 14. Permissões

### Equipe clínica/colaboradora ativa

Pode:

- consultar modelos ativos;
- criar novo modelo de pacote;
- montar plano personalizado para cliente;
- selecionar procedimentos existentes;
- definir quantidades;
- aplicar percentual de desconto;
- registrar motivo do desconto;
- usar sessão disponível no atendimento quando puder executar o procedimento.

Não pode:

- alterar histórico financeiro de outra profissional;
- apagar consumo já registrado;
- alterar venda histórica sem fluxo auditado;
- marcar a própria revisão administrativa de desconto como se fosse Mel.

### Mel/Admin

Além das ações acima, pode:

- revisar descontos;
- marcar `revisado_ok` / `revisado_atencao`;
- inativar modelos;
- visualizar valores administrativos completos;
- acompanhar descontos por colaboradora.

## 15. Auditoria

Eventos mínimos:

- modelo criado/alterado/inativado;
- plano atribuído à cliente;
- desconto aplicado;
- desconto revisado;
- item adicionado/removido antes da venda;
- sessão consumida;
- devolução manual de saldo, se futuramente implementada;
- plano pausado/cancelado/concluído.

Não duplicar dados clínicos sensíveis desnecessariamente no `audit_log`.

## 16. Integridade e concorrência

Backend deve ser autoridade para:

- cálculo do valor cheio;
- cálculo do valor final;
- validade do percentual;
- procedimentos ativos/existentes;
- quantidade contratada;
- saldo disponível;
- unicidade do consumo por tratamento;
- vínculo cliente/plano/tratamento;
- permissão da profissional para executar o procedimento;
- autoria por `auth.uid()`.

Dois atendimentos concorrentes não podem consumir a última sessão do mesmo item duas vezes. Usar lock transacional apropriado no item/plano durante o consumo.

## 17. UX mobile-first

Priorizar cards, não tabelas largas.

### Card de modelo

- nome;
- composição resumida;
- valor cheio;
- desconto padrão;
- valor de referência;
- status.

### Card do plano da cliente

- nome;
- status;
- progresso;
- por item: `2/4 realizadas • 2 restantes`;
- ação `Usar sessão` quando aplicável.

### Construtor

Cada procedimento selecionado aparece como linha/card com:

- nome;
- quantidade `− / +`;
- valor unitário;
- subtotal;
- remover.

Resumo fixo:

- valor cheio;
- desconto %;
- valor final.

## 18. Compatibilidade com atendimento atual

O fluxo de `+ Novo atendimento` continua funcionando para procedimento avulso.

Adicionar a opção de usar uma sessão de plano sem criar outro wizard clínico paralelo.

Depois da seleção da sessão do plano, abrir o mesmo `treatment-panel` canônico existente.

O `clinical_treatment` deve carregar referência opcional ao item/uso do plano, mas continuar sendo o prontuário oficial daquela sessão.

## 19. Testes e homologação

### Testes obrigatórios

- pacote com um procedimento;
- pacote misto;
- valores calculados por quantidade;
- desconto zero;
- desconto negociado;
- desconto por colaboradora entra em revisão pendente;
- Mel revisa sem alterar valor histórico;
- modelo editado não altera venda antiga;
- plano personalizado sem template;
- seleção de sessão com saldo;
- procedimento sem saldo não aparece como utilizável;
- profissional sem `can_execute` não usa item;
- agendar não consome saldo;
- iniciar não consome saldo;
- finalizar consome exatamente uma unidade;
- retry de finalização não duplica consumo;
- dois consumos concorrentes da última sessão: apenas um vence;
- correção de ficha não consome segunda sessão;
- cliente errada/plano errado rejeitados no backend;
- colaboradora não vê financeiro de outra profissional;
- `/admin/` legado permanece intocado.

### Homologação

Usar apenas dados sintéticos e preferir transação com `ROLLBACK` para fluxo integrado.

Cenário mínimo:

`criar modelo misto → atribuir a cliente fictícia → aplicar desconto → criar atendimento de um item → finalizar → consumir 1 sessão → conferir saldo → revisar desconto como admin → rollback → verificar zero resíduos`

## 20. Critérios de aceite

A 6E.1 está pronta quando:

1. equipe consegue montar combo usando protocolos existentes;
2. procedimento novo continua entrando pela Biblioteca Clínica, sem cadastro paralelo;
3. pacote pode misturar procedimentos e quantidades;
4. valor cheio é calculado automaticamente;
5. desconto percentual pode ser definido no modelo e/ou venda;
6. colaboradora pode conceder desconto sem esperar aprovação prévia;
7. Mel consegue revisar posteriormente sem reescrever a venda;
8. plano pode ser modelo reutilizável ou personalizado por cliente;
9. Central mostra saldo de sessões;
10. atendimento pode partir de uma sessão do plano;
11. sessão finalizada consome saldo uma única vez;
12. todas as regras clínicas do procedimento continuam valendo;
13. financeiro mantém segregação da Fase 5;
14. nenhuma alteração é feita no `/admin/` legado;
15. regressão completa, advisors e homologação sintética passam antes do rollout.

## 21. Continuação da Fase 6E

Após a 6E.1:

### 6E.2 — Retornos e Pendências

- retorno recomendado/obrigatório;
- ação `Agendar retorno` ou `Agendar depois`;
- pendências na Central;
- próxima sessão de plano;
- atrasos e acompanhamento.

### 6E.3 — Financeiro por Cliente

- integração completa plano/pacote ↔ recebimentos;
- pagamentos/saldo financeiro;
- créditos;
- visão completa da Mel;
- visão individual da colaboradora conforme Fase 5;
- relatórios administrativos por cliente/plano.

Essas etapas não devem alterar o princípio central: **o atendimento clínico sempre é um procedimento real da Biblioteca Clínica, nunca o pacote em si**.
