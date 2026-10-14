# BC Gestão — Agenda Pública integrada e Disponibilidade da Equipe

**Data:** 2026-10-14  
**Status:** design aprovado em conversa; aguardando revisão deste documento antes do plano de implementação  
**Repositório:** `bcesteticaavancada/bcesteticaavancada-alt`  
**Projeto Supabase:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)  
**Fuso clínico:** `America/Sao_Paulo`

## 1. Objetivo

Evoluir a agenda já existente no **BC Gestão** para uma agenda oficial única, capaz de receber reservas diretamente do site público sem duplicar calendários, sem expor dados de clientes e sem permitir que a camada pública contorne as regras internas de segurança.

A solução deve entregar simultaneamente:

- agenda oficial única no BC Gestão;
- calendário público mensal visual;
- escolha explícita de procedimento e profissional;
- disponibilidade calculada em tempo real;
- reserva instantânea do horário;
- proteção contra dupla reserva;
- abertura do WhatsApp da BC após confirmação;
- controle de disponibilidade, bloqueios, folgas e inativações pela equipe;
- navegação interna por meses futuros sem a limitação aplicada ao público;
- privacidade total sobre nomes de clientes, motivos de afastamento, histórico clínico e demais dados internos.

A agenda pública é uma **janela segura de disponibilidade** sobre o BC Gestão. Ela não é uma segunda agenda e não possui base paralela de compromissos.

## 2. Decisões de produto aprovadas

1. O BC Gestão continua sendo a fonte oficial de verdade para todos os agendamentos.
2. O cliente pode escolher a profissional desejada.
3. O sistema não sugere outra profissional quando a escolhida estiver sem vaga.
4. Se não houver horário na data escolhida, exibir apenas `Sem horários disponíveis para esta data`.
5. O cliente pode reservar no mesmo dia até o último horário ainda futuro e realmente disponível; não existe antecedência mínima adicional.
6. A grade de início dos horários públicos usa intervalos de **15 minutos**.
7. A duração efetiva do compromisso vem de `procedimentos.duracao_padrao`.
8. `duracao_padrao` representa todo o tempo bloqueado na agenda, incluindo atendimento e giro/organização necessário da sala.
9. Procedimento ativo sem `duracao_padrao` válida não é agendável online.
10. O formulário público pede somente **nome + WhatsApp**.
11. CPF, data de nascimento, anamnese e demais dados clínicos não fazem parte da reserva pública.
12. O agendamento é confirmado imediatamente; não depende de aprovação posterior da equipe.
13. Depois da confirmação, abrir o WhatsApp da BC com mensagem pré-preenchida contendo nome, procedimento, profissional, data e horário.
14. O cliente não cancela nem remarca sozinho pelo site.
15. Cancelamento e remarcação são feitos pela equipe da BC, normalmente via WhatsApp.
16. O público visualiza somente o **mês civil atual completo**.
17. Exemplo: em outubro de 2026 o calendário público mostra de 1 a 31 de outubro; dias já passados permanecem visíveis, porém desabilitados.
18. O público não navega para o próximo mês nem para meses anteriores.
19. Ao virar o primeiro dia de um novo mês, o calendário público passa automaticamente a mostrar o novo mês completo.
20. Para datas de outro mês, o site oferece CTA `Solicitar pelo WhatsApp`.
21. Mel/admin e colaboradoras autorizadas podem navegar por meses futuros dentro do BC Gestão sem limite artificial de mês.
22. Cada colaboradora controla somente a própria disponibilidade; Mel/admin controla a disponibilidade de qualquer profissional.
23. A disponibilidade é organizada visualmente por **grade mensal**, com todas as datas do mês.
24. A equipe pode definir disponibilidade diária, horário de início/fim e bloqueios parciais.
25. A equipe pode inativar a agenda de uma profissional por período.
26. Motivos internos de inativação: `férias`, `motivos pessoais`, `motivo médico`, `licença/afastamento`, `curso/capacitação`, `viagem`, `folga` e `outro`.
27. Observação interna da inativação é opcional.
28. A data final da inativação pode ser aberta/indefinida.
29. A profissional pode ser reativada antes do prazo previsto.
30. O público nunca recebe o motivo real da inativação; recebe somente `Profissional indisponível neste período` quando aplicável.
31. Inativar agenda ou criar bloqueio nunca apaga, cancela ou remarca automaticamente compromissos já existentes.
32. Se o período afetar compromissos existentes, o BC Gestão apresenta aviso e quantidade de agendamentos para revisão manual.
33. A origem do compromisso deve distinguir ao menos `interno` e `site`.
34. Reserva pública aparece imediatamente na agenda da profissional.
35. O mesmo mecanismo de conflito deve proteger reservas feitas pelo site e agendamentos criados internamente.
36. O diretório legado `/admin/` da pré-anamnese permanece fora desta mudança.
37. A pré-anamnese existente em `/agendamento/` não será misturada com a nova camada de disponibilidade pública.

## 3. Experiência pública

### 3.1 Nova rota pública

Criar uma página pública dedicada em `/agenda/`, apresentada ao usuário como **Agendamento**.

Razões para manter `/agenda/` separado de `/agendamento/`:

- `/agendamento/` hoje é a pré-anamnese clínica;
- a agenda pública tem modelo de dados e risco de segurança diferentes;
- evita regressão no fluxo clínico já publicado;
- permite evoluir a reserva sem acoplar perguntas médicas à escolha de horário.

Os CTAs `Agendar agora` do site institucional passam a apontar para `/agenda/`.

### 3.2 Widget da Home

A Home recebe uma versão compacta da agenda com:

1. seletor de procedimento;
2. seletor de profissional;
3. próximos horários livres do mês atual;
4. CTA `Ver calendário completo` para `/agenda/`;
5. CTA de WhatsApp quando a pessoa desejar consultar outro mês.

A Home não deve carregar nomes de clientes, compromissos ocupados ou qualquer detalhe interno. Ela consome somente DTOs de disponibilidade sanitizados.

### 3.3 Fluxo completo

Fluxo público:

`Procedimento → Profissional → Calendário do mês atual → Data → Horário → Nome + WhatsApp → Confirmar → Reserva criada → WhatsApp`

Não existe opção `qualquer profissional` nesta versão.

### 3.4 Calendário do mês atual

O calendário exibe o mês civil corrente em `America/Sao_Paulo`.

Estados visuais mínimos:

- **hoje**: destaque próprio;
- **selecionado**: destaque forte;
- **dia futuro com ao menos um horário**: habilitado;
- **dia futuro sem horário**: desabilitado;
- **dia passado**: visível e desabilitado;
- **dia fora do mês atual**: não navegável;
- **dia integralmente bloqueado/inativo**: desabilitado.

A API deve rejeitar consultas de disponibilidade pública para datas fora do mês civil atual, mesmo que alguém tente alterar a requisição manualmente.

### 3.5 Mesmo dia e horário já iniciado

Não existe antecedência mínima fixa.

A regra é temporal:

- slots cujo início já passou não podem ser reservados;
- o próximo slot de 15 minutos ainda futuro pode ser reservado se todo o intervalo do procedimento couber na disponibilidade;
- a validação final usa o relógio do banco/backend, não o relógio do navegador.

Exemplo: às 14:07, um slot de 14:00 não é válido; 14:15 continua elegível se todo o período necessário estiver livre.

### 3.6 Procedimentos elegíveis

Só aparecem para reserva pública procedimentos que estejam:

- ativos;
- publicados/operacionais segundo a biblioteca vigente;
- com `duracao_padrao > 0`;
- executáveis pela profissional escolhida segundo `access_mode` e `procedure_professional_permissions`.

Procedimento sem duração válida não gera slot público.

### 3.7 Profissionais elegíveis

O seletor lista profissionais que estejam:

- com `staff_profiles.active = true`;
- com `atende_clientes = true`;
- aptas ao procedimento escolhido;
- não arquivadas/inválidas para operação.

Uma profissional pode continuar aparecendo no seletor mesmo que o mês atual esteja sem horários. Nesse caso, o cliente poderá escolhê-la e receber a indisponibilidade correspondente, preservando a preferência explícita do cliente.

### 3.8 Ausência de vaga

Se a profissional não tiver horários na data:

`Sem horários disponíveis para esta data.`

Não mostrar substituta, ranking ou sugestão automática de outra profissional.

Se a profissional estiver coberta por inativação aplicável:

`Profissional indisponível neste período.`

Nenhum motivo interno deve constar na resposta pública.

### 3.9 Outro mês

Abaixo do calendário:

**Precisa agendar para outro mês?**  
`Solicitar pelo WhatsApp`

Mensagem sugerida:

`Olá! Gostaria de consultar disponibilidade na BC Estética para uma data fora do mês disponível na agenda online.`

O público não recebe botão de avançar mês.

## 4. Duração e cálculo dos slots

### 4.1 Grade de 15 minutos

Possíveis inícios:

`09:00, 09:15, 09:30, 09:45...`

A grade define somente o **início**. O término é calculado pela duração do procedimento.

Exemplos:

- procedimento de 45 min: 14:00–14:45;
- procedimento de 60 min: 14:00–15:00;
- procedimento de 50 min: 14:15–15:05.

Um slot só existe se o intervalo inteiro couber em uma janela de disponibilidade contínua.

### 4.2 Fonte da duração

Usar `public.procedimentos.duracao_padrao` como duração operacional oficial da agenda.

A Mel/ADM mantém essa duração pela Biblioteca de Procedimentos. Alterar uma duração afeta **novas disponibilidades calculadas**, mas não deve reescrever o horário final de compromissos antigos já persistidos.

### 4.3 Persistência de `fim`

Para novos agendamentos criados ou alterados após esta fase:

- se o procedimento tiver duração válida e `fim` não for informado explicitamente, o backend deriva e persiste `fim = inicio + duracao_padrao`;
- reserva pública sempre persiste `inicio` e `fim` explícitos;
- o cálculo de conflito usa o intervalo persistido do compromisso.

Agendamentos legados com `fim` nulo continuam suportados, mas o backend deve derivar o intervalo para checagens usando a duração vigente do procedimento quando necessário.

## 5. Identidade do cliente na reserva pública

### 5.1 Não criar identidade clínica a partir de nome + telefone

Nome e WhatsApp não são suficientes para afirmar que uma reserva anônima pertence a um cadastro clínico existente.

Portanto, a reserva pública **não deve auto-vincular** um agendamento a uma cliente já cadastrada apenas porque nome e telefone parecem coincidir.

Isso evita associação indevida entre uma solicitação anônima e prontuário clínico.

### 5.2 Snapshot público no agendamento

Evoluir `public.agendamentos` para suportar reserva pública ainda não vinculada ao cadastro clínico:

- `cliente_id` passa a aceitar `null` durante a etapa pré-clínica;
- `origem text not null default 'interno'` com valores `interno` e `site`;
- `public_booking_name text`;
- `public_booking_phone text`;
- `public_booking_phone_normalized text`;
- `created_by` passa a aceitar `null` exclusivamente quando a origem for pública/anônima.

Regras de integridade:

- agendamento `interno` exige `cliente_id` e `created_by`;
- agendamento `site` exige nome e telefone público válidos;
- todo agendamento deve ter `cliente_id` **ou** dados públicos de reserva suficientes;
- ao vincular posteriormente a uma cliente, os campos públicos permanecem como snapshot histórico da informação enviada na reserva.

### 5.3 Vinculação interna

Um agendamento de origem `site` ainda não vinculado aparece na agenda com indicação visual:

**Origem: Site • Cadastro pendente**

Mel/admin ou a profissional dona do agendamento pode:

1. pesquisar uma cliente existente;
2. confirmar visualmente a identidade;
3. vincular o agendamento ao `cliente_id` correto;
4. ou completar/criar o cadastro clínico pelo fluxo v2, com CPF, nascimento e demais dados necessários.

O backend nunca faz essa decisão clínica automaticamente.

### 5.4 Atendimento clínico

Um agendamento público sem `cliente_id` pode ocupar horário e aparecer na agenda, mas **não pode iniciar prontuário/atendimento clínico formal**.

Antes de `Abrir atendimento`, o BC Gestão exige vinculação a uma cliente válida.

Isso preserva os contratos da Fase 6, onde tratamento e documentos clínicos dependem de `cliente_id` real.

## 6. Disponibilidade mensal da equipe

### 6.1 Modelo por data

A disponibilidade operacional é configurada por data, não por agenda semanal recorrente obrigatória.

Criar estrutura conceitual `professional_availability_days` com:

- `id`;
- `professional_user_id`;
- `local_date`;
- `enabled`;
- `start_time`;
- `end_time`;
- `created_by`;
- `updated_by`;
- `created_at`;
- `updated_at`.

Restrição única por `professional_user_id + local_date`.

Se não houver linha habilitada para uma data, a data não oferece horários públicos.

`end_time` deve ser maior que `start_time`.

### 6.2 Tela mensal

Dentro do BC Gestão, cada profissional possui **Minha disponibilidade**.

A Mel/admin pode alternar a profissional visualizada.

A tela mostra calendário mensal com navegação livre para meses futuros.

Ao selecionar um dia:

- `Disponível para atendimento: Sim/Não`;
- `Início`;
- `Fim`;
- lista de bloqueios;
- ação `Adicionar bloqueio`;
- ação `Marcar dia inteiro indisponível`.

### 6.3 Operações em massa

Para evitar preenchimento dia a dia, oferecer:

- selecionar várias datas e aplicar o mesmo horário;
- aplicar horário a um conjunto de dias da semana dentro do mês visualizado;
- copiar configuração do mês anterior;
- marcar várias datas como indisponíveis.

Essas ações continuam gravando disponibilidade explícita por data.

Não introduzir agenda recorrente infinita nesta fase.

### 6.4 Permissões

**Mel/admin:**

- consulta e altera disponibilidade de qualquer profissional;
- cria/remove bloqueios de qualquer profissional;
- cria e encerra inativações de qualquer profissional;
- navega livremente por meses futuros.

**Colaboradora ativa:**

- consulta e altera somente a própria disponibilidade;
- cria/remove somente os próprios bloqueios;
- pode inativar/reativar somente a própria agenda;
- navega livremente por meses futuros da própria agenda;
- não altera agenda de outra profissional.

A autoridade é backend/RPC; esconder controles no frontend não substitui autorização.

## 7. Bloqueios parciais

Criar estrutura conceitual `professional_schedule_blocks`:

- `id`;
- `professional_user_id`;
- `starts_at`;
- `ends_at`;
- `block_type`;
- `internal_note` opcional;
- `created_by`;
- `created_at`.

Tipos iniciais de bloqueio podem incluir:

- almoço;
- compromisso;
- reunião;
- preparação/manutenção;
- outro.

O texto detalhado é interno.

Bloqueio parcial remove somente slots cujo intervalo colida com o bloqueio.

Exemplo: disponibilidade 09:00–18:00 e bloqueio 12:00–13:00 não afeta slots antes de 12:00 nem após 13:00, desde que a duração inteira caiba fora do bloqueio.

## 8. Inativação da agenda

### 8.1 Estrutura

Criar estrutura conceitual `professional_agenda_inactivations`:

- `id`;
- `professional_user_id`;
- `starts_on`;
- `planned_ends_on` opcional;
- `reason`;
- `internal_note` opcional;
- `created_by`;
- `created_at`;
- `reactivated_at` opcional;
- `reactivated_by` opcional.

Motivos permitidos:

- `ferias`;
- `motivos_pessoais`;
- `motivo_medico`;
- `licenca_afastamento`;
- `curso_capacitacao`;
- `viagem`;
- `folga`;
- `outro`.

### 8.2 Inativação aberta

`planned_ends_on = null` significa período sem data final definida.

A profissional ou a Mel pode usar `Reativar agenda agora`, conforme permissão.

A reativação registra autoria e timestamp, preservando o período originalmente informado no histórico.

### 8.3 Privacidade

Motivo e observação são exclusivamente internos.

A API pública não retorna:

- `reason`;
- `internal_note`;
- autor da inativação;
- datas internas além do necessário para responder disponibilidade.

Para o público, a resposta é somente:

`Profissional indisponível neste período.`

### 8.4 Compromissos existentes

Antes de confirmar uma inativação, o backend calcula quantos agendamentos não cancelados já existem no período.

A interface avisa, por exemplo:

`Existem 4 agendamentos confirmados neste período. A inativação impedirá novas reservas, mas esses compromissos continuarão na agenda para revisão.`

Confirmar a inativação:

- não cancela;
- não altera status;
- não muda profissional;
- não remarca;
- não apaga compromisso.

## 9. Motor de disponibilidade

### 9.1 Regra central

Para uma combinação `procedimento + profissional + data`, os slots resultam de:

`janela diária habilitada`

menos

`inativação aplicável`

menos

`bloqueios parciais`

menos

`agendamentos conflitantes`

respeitando

`duração do procedimento + grade de 15 min + horário atual`.

### 9.2 Conflitos de agendamento

Considerar como ocupando horário compromissos cujo status não libere o intervalo.

Inicialmente:

- `agendado`: ocupa;
- `atendido`: ocupa o intervalo histórico;
- `cancelado`: não ocupa;
- `faltou`: não ocupa para disponibilidade futura após alteração de status.

A mesma rotina de conflito deve ser usada por:

- reserva pública;
- criação interna;
- remarcação interna.

### 9.3 Concorrência

A disponibilidade exibida é apenas informativa até a confirmação final.

No momento da gravação:

1. iniciar transação;
2. adquirir `pg_advisory_xact_lock` por chave derivada de `professional_user_id + data clínica`;
3. recalcular disponibilidade usando dados atuais;
4. validar duração, agenda ativa, janela, bloqueios e conflitos;
5. inserir/atualizar o compromisso;
6. commit libera o lock automaticamente.

Assim, duas reservas concorrentes do mesmo horário não podem vencer simultaneamente.

A segunda chamada recebe erro estável equivalente a `slot_unavailable`.

Mensagem pública:

`Esse horário acabou de ser reservado. Escolha outro horário disponível.`

### 9.4 Índices

A implementação deve manter/garantir índices adequados para:

- `agendamentos(colaboradora_user_id, inicio)`;
- disponibilidade por `professional_user_id, local_date`;
- bloqueios por profissional e início/fim;
- inativações por profissional e período.

Não criar índices especulativos sem consulta correspondente; verificar com testes/`EXPLAIN` quando necessário.

## 10. Reserva pública

### 10.1 Backend público

A camada pública não acessa tabelas do BC Gestão diretamente.

Criar uma **Supabase Edge Function** dedicada, conceitualmente `public-agenda`, como fronteira HTTP pública.

Ela oferece operações sanitizadas equivalentes a:

- listar procedimentos públicos agendáveis;
- listar profissionais aptas ao procedimento;
- carregar disponibilidade do mês atual;
- carregar slots de uma data;
- confirmar reserva.

O navegador utiliza somente a chave publishable já apropriada para frontend e nunca recebe `service_role`/secret.

### 10.2 RPCs de backend

A Edge Function chama RPCs restritos ao backend/service role. Funções públicas de banco usadas pela Edge Function devem:

- revogar `EXECUTE` de `PUBLIC`, `anon` e `authenticated`;
- conceder `EXECUTE` somente ao papel necessário do backend;
- delegar lógica privilegiada para helpers no schema `private` quando necessário;
- usar `search_path` fixo/vazio e nomes de schema explícitos nas funções `SECURITY DEFINER`;
- retornar DTOs mínimos.

Não expor uma função `SECURITY DEFINER` gravadora diretamente ao papel `anon`.

### 10.3 Dados públicos retornados

Podem sair:

- ID público/técnico do procedimento necessário à requisição;
- nome público do procedimento;
- duração operacional quando necessária para UX;
- ID técnico da profissional;
- nome público da profissional;
- datas habilitadas;
- horários livres.

Nunca podem sair:

- nome de cliente já agendado;
- telefone/e-mail de cliente;
- `cliente_id` de terceiros;
- observação administrativa;
- motivo de inativação;
- observação médica/pessoal;
- prontuário;
- anamnese;
- financeiro;
- audit log;
- quantidade/detalhes de compromissos ocupados por terceiros.

### 10.4 Validação da reserva

No POST final, validar novamente no backend:

- nome não vazio e com limite de tamanho;
- telefone normalizado plausível;
- procedimento ativo e com duração;
- profissional ativa e apta ao procedimento;
- data pertencente ao mês público atual;
- início ainda futuro;
- início alinhado à grade de 15 min;
- intervalo dentro da disponibilidade;
- ausência de inativação;
- ausência de bloqueio;
- ausência de conflito;
- limite antiabuso.

Nenhuma validação crítica depende apenas de HTML/JavaScript.

### 10.5 Antiabuso

A confirmação pública deve usar proteção mínima contra automação abusiva:

- campo honeypot invisível para bots simples;
- rate limit server-side para tentativas de criação;
- armazenar somente hash do identificador de rede necessário ao rate limit, nunca IP bruto em tabela operacional;
- padrão inicial: até **10 tentativas de confirmação por 10 minutos por origem de rede hash**;
- respostas de rate limit não revelam detalhes internos.

A implementação pode elevar a proteção futuramente com challenge dedicado se houver abuso real, sem alterar o modelo de agenda.

## 11. Confirmação e WhatsApp

### 11.1 Tela de sucesso

Após commit confirmado pelo backend:

**Agendamento realizado com sucesso.**

Mostrar:

- procedimento;
- profissional;
- data;
- horário;
- orientação de que cancelamentos/remarcações são tratados pela BC.

### 11.2 Mensagem pronta

Abrir WhatsApp da BC com mensagem semelhante a:

`Olá! Acabei de realizar meu agendamento pelo site da BC Estética.`

`Nome: <nome>`  
`Procedimento: <procedimento>`  
`Profissional: <profissional>`  
`Data: <data>`  
`Horário: <horário>`

O número da BC deve ficar centralizado em configuração compartilhada, evitando hardcode divergente em vários módulos.

### 11.3 Cancelamento/remarcação

Não criar token público de edição nesta fase.

A página pode oferecer:

`Precisa alterar este agendamento? Fale com a BC pelo WhatsApp.`

A alteração real é feita no BC Gestão por profissional autorizada.

## 12. Experiência interna da agenda

### 12.1 Cards de compromisso

Agenda interna continua mostrando cliente/procedimento/status para equipe autorizada.

Para origem `site` ainda não vinculada:

- usar `public_booking_name` como nome visual;
- exibir telefone informado;
- chip `Site`;
- chip/alerta `Cadastro pendente`;
- ação `Vincular cliente`.

Depois da vinculação, usar o cadastro oficial como identidade principal, preservando o snapshot público no banco.

### 12.2 Navegação mensal

Mel/admin e colaboradoras passam a contar com navegação mensal, incluindo meses futuros.

A limitação de mês atual é exclusivamente pública.

### 12.3 Disponibilidade no admin

Mel visualiza:

- calendário geral;
- filtros por profissional;
- disponibilidade mensal de cada profissional;
- bloqueios;
- inativações;
- alertas de compromissos afetados.

### 12.4 Disponibilidade da colaboradora

Colaboradora visualiza:

- própria agenda;
- própria disponibilidade;
- próprios bloqueios;
- própria inativação;
- meses futuros próprios.

Não recebe controles de outra profissional.

## 13. RPCs internos conceituais

A implementação deve preservar o padrão atual de wrappers públicos + helpers privados com autorização explícita.

Operações internas mínimas:

- listar disponibilidade mensal autorizada;
- upsert de dia disponível;
- aplicação em massa a datas selecionadas;
- criar/remover bloqueio;
- criar inativação;
- reativar agenda;
- vincular agendamento público a cliente verificada;
- criar/remarcar agendamento usando o mesmo gate de conflito.

A colaboradora só pode passar o próprio `user_id` como alvo efetivo; o backend não confia em seleção do frontend.

## 14. Segurança e RLS

### 14.1 Princípio geral

O site público não recebe leitura direta de:

- `agendamentos`;
- `clientes`;
- `staff_profiles` completos;
- disponibilidade interna bruta;
- bloqueios;
- inativações.

Os novos objetos operacionais em `public` devem ter RLS habilitado e grants mínimos.

Quando o frontend público precisar de informação, ela sai por DTO sanitizado da Edge Function.

### 14.2 Chaves

- publishable key pode permanecer no frontend conforme modelo Supabase + RLS;
- `service_role`/secret nunca entra em HTML, JS público, GitHub Pages ou resposta HTTP;
- secrets necessários à Edge Function ficam apenas no ambiente seguro da função.

### 14.3 Funções privilegiadas

Para qualquer `SECURITY DEFINER`:

- preferir schema `private`;
- `search_path` fixo/vazio;
- relações schema-qualified;
- validação explícita de autorização/contexto;
- `REVOKE EXECUTE` de `PUBLIC` por padrão;
- concessão somente ao papel necessário.

### 14.4 Escrita da agenda

A regra de conflito não pode existir somente no frontend.

Criar e atualizar compromisso devem passar por rotinas transacionais que executem o mesmo gate de disponibilidade.

A reserva pública não recebe poder genérico de `insert` em `agendamentos`.

### 14.5 Auditoria

Registrar eventos mínimos:

- disponibilidade diária criada/alterada;
- bloqueio criado/removido;
- agenda inativada;
- agenda reativada;
- agendamento público criado;
- agendamento público vinculado a cliente;
- alterações internas de horário/status continuam auditadas.

Para evento público anônimo, `actor_user_id` pode ser `null`; `origem = site` diferencia o contexto.

Não gravar motivo médico/pessoal em payload público nem em analytics público.

## 15. Regras de privacidade

1. Cliente público nunca enxerga quem ocupa um horário.
2. Cliente público nunca enxerga procedimento de outra pessoa.
3. Cliente público nunca recebe motivo de indisponibilidade de uma profissional.
4. `motivo médico`, `pessoal`, `férias` etc. são informação interna.
5. WhatsApp informado na reserva é usado para operação do agendamento e fica visível apenas à equipe autorizada.
6. Dados clínicos continuam isolados do site público.
7. Disponibilidade pública é derivada, não uma cópia de dados privados.

## 16. Compatibilidade com o BC Gestão existente

### 16.1 Agenda atual

Preservar:

- `listOwnAppointments`;
- `listAdminAppointments`;
- fluxo de status;
- histórico autorizado;
- integração com atendimento;
- financeiro ligado a atendimento;
- auditoria atual.

Evoluir os selects para suportar origem `site` e snapshot público quando `clientes` ainda for nulo.

### 16.2 Biblioteca de procedimentos

Reutilizar:

- `procedimentos.ativo`;
- `procedimentos.duracao_padrao`;
- `procedimentos.access_mode`;
- `procedure_professional_permissions`.

Não criar uma segunda tabela de autorização profissional para agenda.

### 16.3 Prontuário

Tratamento clínico formal continua exigindo cliente vinculada.

A reserva pública não cria anamnese, consentimento, atendimento ou documento clínico automaticamente.

### 16.4 Financeiro

Reserva pública não cria recebimento nem pagamento automaticamente.

Financeiro mantém as regras já aprovadas das fases anteriores.

## 17. Estados e mensagens de erro

Mensagens públicas devem ser curtas e não revelar arquitetura.

Casos mínimos:

- `Sem horários disponíveis para esta data.`
- `Profissional indisponível neste período.`
- `Esse horário acabou de ser reservado. Escolha outro horário disponível.`
- `Este procedimento não está disponível para agendamento online.`
- `Não foi possível concluir agora. Tente novamente ou fale com a BC pelo WhatsApp.`
- `Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.`

Erros internos podem ser mais detalhados para equipe autenticada, sem vazar segredo/chave.

## 18. Testes obrigatórios

### 18.1 Domínio/calendário

Cobrir:

- mês com 28/29/30/31 dias;
- primeiro e último dia do mês;
- dias passados desabilitados;
- hoje;
- virada automática de mês em `America/Sao_Paulo`;
- tentativa pública de consultar mês futuro rejeitada;
- slot de 15 min;
- duração que termina exatamente no fim da janela;
- duração que ultrapassa janela;
- bloqueio parcial;
- dia indisponível;
- inativação aberta e com término;
- reativação antecipada.

### 18.2 Concorrência

Teste de integração deve disparar duas tentativas de reservar o mesmo `profissional + horário` e provar:

- exatamente uma grava;
- a segunda recebe conflito controlado;
- não existem dois compromissos ativos sobrepostos.

Também testar corrida entre reserva pública e criação interna.

### 18.3 Permissões internas

Provar:

- Mel/admin altera qualquer agenda;
- colaboradora altera a própria;
- colaboradora não altera outra profissional;
- colaboradora não vincula agendamento de outra profissional;
- usuário não autenticado não chama RPC interno.

### 18.4 Segurança pública

Provar que as respostas públicas não contêm:

- nomes/telefones de terceiros;
- `cliente_id` de terceiros;
- observações;
- motivo interno de inativação;
- prontuário;
- dados financeiros.

Provar que `anon` não possui `SELECT/INSERT/UPDATE/DELETE` sobre as novas tabelas internas nem `EXECUTE` sobre RPCs privilegiados de escrita.

### 18.5 Identidade clínica

Provar:

- reserva pública nasce sem auto-associação a prontuário existente;
- atendimento formal é bloqueado enquanto `cliente_id` estiver ausente;
- profissional autorizada consegue vincular cliente verificada;
- snapshot público permanece após a vinculação.

### 18.6 Regressão

Executar:

- suíte `npm run test:gestao`;
- suíte completa `npm test`;
- testes de banco/RLS pertinentes;
- advisors de segurança e performance do Supabase após implantação em ambiente controlado.

## 19. Validação sem dados reais

Durante desenvolvimento/homologação:

- usar somente clientes fictícios;
- não criar reserva em agenda real de profissional durante teste automático;
- preferir transações com rollback para validações de banco;
- não alterar paciente, documento, financeiro ou agenda real sem ação explícita de produção;
- validar concorrência com IDs/dados sintéticos.

## 20. Rollout

Ordem recomendada:

1. adicionar modelo de disponibilidade, bloqueios e inativações;
2. adicionar origem/snapshot público no agendamento e compatibilidade de leitura;
3. centralizar gate transacional de conflito para criação/remarcação interna;
4. criar RPCs internos de disponibilidade;
5. implementar telas mensais da Mel e colaboradoras;
6. validar disponibilidade internamente com dados fictícios;
7. criar backend público/Edge Function sanitizado;
8. criar `/agenda/` pública;
9. integrar widget compacto da Home;
10. habilitar reserva pública somente após testes de concorrência, RLS e privacidade;
11. alterar CTAs institucionais `Agendar agora` para `/agenda/`;
12. observar logs/erros nas primeiras reservas e revisar rate limit se necessário.

## 21. Fora de escopo desta fase

Não incluir agora:

- cancelamento público autônomo;
- remarcação pública autônoma;
- pagamento online;
- escolha automática de `qualquer profissional`;
- sugestão automática de outra profissional;
- navegação pública em meses futuros;
- recorrência semanal infinita de disponibilidade;
- integração com Google Calendar como fonte de verdade;
- criação automática de anamnese ao reservar;
- envio automático de SMS;
- motor de lista de espera.

Esses itens podem ser evoluções futuras sem alterar a premissa central de agenda única.

## 22. Critérios de aceite

A fase está pronta quando:

1. cliente escolhe procedimento e profissional no site;
2. vê somente o mês civil atual;
3. vê datas/horários realmente livres;
4. consegue reservar horário do mesmo dia se ainda estiver futuro;
5. duas pessoas não conseguem ocupar o mesmo intervalo;
6. a reserva aparece imediatamente no BC Gestão com `Origem: Site`;
7. cliente público não vê nenhum dado de terceiros;
8. confirmação abre WhatsApp com mensagem pronta;
9. alteração/cancelamento continua sob controle da equipe;
10. Mel pode configurar qualquer agenda e navegar para meses futuros;
11. colaboradora configura apenas a própria agenda e navega para meses futuros;
12. inativação exige motivo interno e pode ter período aberto;
13. motivo da inativação nunca é mostrado publicamente;
14. compromissos existentes sobrevivem a bloqueios/inativações e são sinalizados para revisão;
15. procedimento sem duração não gera slot online;
16. permissões de procedimento já existentes são respeitadas;
17. reserva pública não é automaticamente associada a prontuário clínico;
18. agendamento público precisa ser vinculado a cliente válida antes de iniciar atendimento clínico;
19. suíte automatizada e validações de segurança ficam verdes;
20. nenhum secret privilegiado é exposto no navegador.

## 23. Decisão arquitetural final

A solução adotada é:

**Site público / Home + `/agenda/` → Edge Function pública sanitizada → RPCs/backend do BC Gestão → mesma tabela oficial de `agendamentos` + disponibilidade/bloqueios/inativações → agenda interna Mel/colaboradoras.**

Não haverá sincronização entre duas agendas porque não haverá duas agendas.

A camada pública conhece apenas o necessário para oferecer e reservar horários. A camada interna continua responsável por identidade clínica, prontuário, remarcação, cancelamento, disponibilidade detalhada e motivos de indisponibilidade.
