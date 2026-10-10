# BC Gestão — Fase 4: Clientes compartilhados, agenda individual e auditoria

**Data:** 2026-10-10  
**Status:** design aprovado em conversa; aguardando revisão deste documento antes do plano de implementação  
**Projeto Supabase:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)

## 1. Objetivo

Evoluir o BC Gestão para refletir o funcionamento real da clínica:

- clientes pertencem à **BC Estética**, não a uma profissional específica;
- todas as profissionais ativas podem localizar e consultar todos os clientes;
- uma mesma cliente pode ser atendida por várias profissionais ao longo do tempo;
- cada profissional mantém **agenda individual** e só altera os próprios agendamentos;
- Mel, como administradora, enxerga e administra todas as agendas e também possui agenda própria de atendimento;
- todas as alterações operacionais relevantes ficam registradas em trilha de auditoria;
- financeiro permanece exclusivo da Mel.

Exemplo de jornada de uma mesma cliente:

- Massagem — Kátia;
- Peeling — Alice;
- Botox — Mel.

A cliente continua sendo um único cadastro, com histórico cronológico unificado.

## 2. Princípios de produto

1. **Cadastro único de cliente.** Evitar duplicidade por profissional.
2. **Agenda pessoal por profissional.** Colaboradoras não movimentam a agenda umas das outras.
3. **Administração global pela Mel.** Mel pode ver e alterar qualquer agenda.
4. **Histórico clínico unificado.** Ao abrir um cliente, a equipe vê o histórico de atendimentos daquele cliente.
5. **Auditoria obrigatória.** Toda mudança importante deve registrar autor, data/hora, entidade e conteúdo alterado.
6. **Sem exclusão destrutiva por colaboradora.** Colaboradoras nunca apagam, arquivam ou desativam clientes.
7. **Arquivamento administrativo.** Somente Mel pode arquivar/desativar cliente; dados anteriores permanecem preservados.
8. **Financeiro isolado.** Nenhuma regra desta fase amplia acesso de colaboradoras a pagamentos, valores ou relatórios financeiros.

## 3. Papéis e permissões

### 3.1 Colaboradora ativa

Pode:

- consultar a lista completa de clientes ativos;
- pesquisar qualquer cliente;
- abrir cadastro de qualquer cliente;
- visualizar histórico completo de atendimentos do cliente;
- criar novo cliente;
- editar dados operacionais do cliente, como nome, telefone, e-mail e observações administrativas permitidas;
- criar agendamento apenas para si;
- alterar horário/status apenas dos próprios agendamentos;
- registrar atendimento somente de agendamento próprio;
- visualizar procedimentos e profissionais necessários para navegação da aplicação;
- visualizar metadados básicos de auditoria relevantes na interface, como “última alteração por” quando útil.

Não pode:

- editar, cancelar, mover ou concluir agendamento de outra profissional;
- arquivar, desativar ou excluir cliente;
- alterar papel/perfil de usuária;
- alterar cadastro estrutural de outra profissional;
- acessar pagamentos, valores, repasses ou relatórios financeiros;
- apagar ou reescrever silenciosamente histórico de auditoria.

### 3.2 Mel — administradora e profissional atendente

Pode:

- tudo que uma colaboradora pode;
- possuir agenda própria e receber agendamentos como profissional;
- visualizar todas as agendas;
- criar, mover, cancelar e atualizar agendamento de qualquer profissional;
- cadastrar e editar clientes;
- arquivar/desativar clientes;
- consultar auditoria global;
- administrar cadastros estruturais autorizados;
- manter acesso exclusivo ao financeiro nas fases correspondentes.

## 4. Mel como administradora e profissional

O papel `admin` não deve impedir participação na agenda clínica.

A Fase 4 deve separar os conceitos:

- **papel de acesso:** `admin` ou `colaborador`;
- **capacidade de atender:** flag explícita, por exemplo `atende_clientes boolean` em `staff_profiles`.

Assim:

- Mel: `role = admin`, `atende_clientes = true`;
- Alice/Kátia/etc.: `role = colaborador`, `atende_clientes = true`;
- futuramente, um administrativo sem agenda poderia ser `admin` ou outro papel permitido com `atende_clientes = false`, sem precisar reescrever a arquitetura.

O diretório de profissionais da agenda deve retornar todos os perfis ativos com `atende_clientes = true`, independentemente de serem `admin` ou `colaborador`.

## 5. Clientes compartilhados

### 5.1 Cadastro

`clientes` passa a ser recurso compartilhado da clínica.

Toda equipe ativa autenticada pode fazer `SELECT` de clientes ativos e consultar seus dados operacionais.

Toda equipe ativa pode criar clientes.

Toda equipe ativa pode editar apenas campos explicitamente permitidos da ficha cadastral.

### 5.2 Arquivamento

Não haverá exclusão física pela interface normal.

Adicionar comportamento de arquivamento/desativação, preferencialmente com campos equivalentes a:

- `ativo boolean not null default true`;
- `arquivado_at timestamptz null`;
- `arquivado_by uuid null`.

Somente Mel/admin pode executar arquivamento ou reativação.

Cliente arquivado:

- deixa de aparecer por padrão em novos agendamentos;
- continua acessível no histórico administrativo;
- mantém atendimentos, agendamentos e auditoria anteriores;
- nunca causa deleção em cascata de histórico.

## 6. Agenda individual

### 6.1 Regra principal

Cada profissional atendente possui sua própria agenda.

Colaboradora:

- lê sua própria agenda;
- cria agendamento para si;
- altera somente agendamento cuja `colaboradora_user_id = auth.uid()`;
- registra atendimento apenas de agendamento próprio.

Mel/admin:

- lê todas as agendas;
- cria agendamento para qualquer profissional atendente, inclusive para si;
- altera qualquer agendamento;
- registra/regulariza operações administrativas quando necessário.

### 6.2 Visibilidade de agenda

A agenda operacional de uma colaboradora não precisa expor a grade de outra colaboradora.

A visão global permanece exclusiva da Mel.

Isso não limita o acesso ao histórico de clientes: a equipe pode abrir um cliente e ver atendimentos realizados por outras profissionais.

## 7. Histórico unificado do cliente

Ao abrir um cliente, a aplicação deve apresentar uma timeline cronológica de atendimentos.

Cada item deve exibir, quando disponível:

- data/hora;
- procedimento;
- profissional;
- status do atendimento;
- queixa/objetivo;
- observações;
- reações;
- intercorrências;
- feedback;
- orientações;
- recomendação para próxima sessão.

A leitura do histórico deixa de depender de “vínculo prévio com a profissional”. O critério passa a ser: usuária autenticada, ativa e pertencente à equipe da BC.

A escrita continua restrita: colaboradora registra somente o próprio atendimento.

## 8. Auditoria

### 8.1 Finalidade

Permitir responder com segurança:

- quem criou um cliente;
- quem editou um cadastro;
- quem criou ou moveu um agendamento;
- quem alterou um status;
- quem arquivou ou reativou um cliente;
- quando cada ação aconteceu;
- quais valores relevantes mudaram.

### 8.2 Estrutura proposta

Criar tabela imutável de auditoria, por exemplo `audit_log`, contendo no mínimo:

- `id uuid`;
- `actor_user_id uuid`;
- `action text`;
- `entity_type text`;
- `entity_id uuid`;
- `old_data jsonb`;
- `new_data jsonb`;
- `created_at timestamptz`;
- opcionalmente `source text` ou `metadata jsonb`.

### 8.3 Escrita da auditoria

Preferência: auditoria gerada no banco, por triggers e/ou RPCs transacionais, nunca confiando no browser para informar o autor real.

O autor deve derivar de `auth.uid()`.

Eventos mínimos:

- `cliente_created`;
- `cliente_updated`;
- `cliente_archived`;
- `cliente_reactivated`;
- `agendamento_created`;
- `agendamento_updated`;
- `agendamento_status_changed`;
- `atendimento_created`.

### 8.4 Leitura da auditoria

- Mel/admin: acesso à auditoria global.
- Colaboradora: não recebe dump global de auditoria.
- Interface de colaboradora pode mostrar informações derivadas e pontuais, como autor/data da última alteração, sem abrir trilha administrativa completa.

## 9. Segurança e RLS

RLS continua sendo a autoridade real de segurança; ocultar botão no frontend não é suficiente.

Mudanças esperadas:

- `clientes`: SELECT para toda equipe ativa autenticada;
- `clientes`: INSERT para toda equipe ativa;
- `clientes`: UPDATE operacional para toda equipe ativa, limitado por RPC ou coluna/policy segura;
- arquivamento/reactivação: somente admin por RPC específica;
- `agendamentos`: colaboradora SELECT/INSERT/UPDATE apenas onde `colaboradora_user_id = auth.uid()`;
- `agendamentos`: admin com acesso global;
- `atendimentos`: SELECT para toda equipe ativa;
- `atendimentos`: INSERT somente para atendimento próprio ou admin;
- `pagamentos`: mantém policy admin-only;
- `audit_log`: escrita automatizada; leitura global somente admin;
- `staff_profiles`: diretório clínico expõe somente dados mínimos necessários.

Operações sensíveis devem preferir RPCs pequenas, com validação explícita e grants apenas para `authenticated`.

`service_role` continua proibida no frontend/repositório público.

## 10. Interface

### 10.1 Colaboradora

Navegação mínima:

- **Minha agenda**
- **Clientes**
- **Histórico do cliente**

Em “Clientes”:

- busca;
- lista de clientes ativos;
- botão “Novo cliente”;
- edição de dados permitidos;
- nenhum botão de arquivar/desativar.

Ao clicar no cliente:

- ficha básica;
- histórico cronológico completo;
- indicação de profissional em cada atendimento.

Em “Minha agenda”:

- criar agendamento para si;
- editar/mover/cancelar somente os próprios;
- abrir atendimento;
- registrar sessão.

### 10.2 Mel/admin

Navegação mínima:

- **Agenda geral**
- **Minha agenda** ou filtro “Mel” dentro da agenda geral;
- **Clientes**
- **Histórico**
- **Auditoria**
- **Financeiro** permanece separado e restrito.

Agenda geral deve permitir filtrar por profissional e incluir Mel entre as profissionais atendentes.

## 11. Migração dos dados atuais

A mudança deve ser forward-safe e não apagar dados existentes.

Passos conceituais:

1. adicionar colunas novas com defaults seguros;
2. marcar profissionais atuais que atendem como `atende_clientes = true`;
3. garantir que Mel seja retornada no diretório de profissionais;
4. ampliar leitura de clientes/histórico para equipe ativa;
5. criar RPCs/policies para escrita segura;
6. ativar auditoria;
7. manter agendamento fictício de homologação existente sem duplicá-lo;
8. não criar nem modificar paciente real durante testes técnicos.

## 12. Testes obrigatórios

### Permissões

- Alice consegue listar todos os clientes ativos;
- Alice consegue abrir histórico de cliente atendido por outra profissional;
- Alice consegue cadastrar cliente;
- Alice consegue editar dado operacional permitido;
- Alice não consegue arquivar cliente;
- Alice não consegue alterar agendamento da Kátia/Mel;
- Alice consegue criar/alterar agendamento próprio;
- Mel consegue criar e alterar qualquer agenda;
- Mel aparece como profissional atendente;
- pagamentos continuam invisíveis para colaboradora.

### Auditoria

- criar cliente gera evento;
- editar cliente guarda autor e antes/depois;
- mover agendamento gera evento;
- arquivar cliente gera evento e exige admin;
- colaboradora não consegue apagar ou alterar log.

### Regressão

- login e recuperação de senha permanecem funcionando;
- Alice continua roteando para `/gestao/colaborador/`;
- Mel continua roteando para `/gestao/admin/`;
- `/admin/` legado permanece intocado;
- datas continuam exibidas em `America/Sao_Paulo`;
- Security Advisor não introduz novos problemas críticos.

## 13. Fora de escopo desta fase

- implementação completa do financeiro;
- repasses/comissões;
- integrações contábeis;
- prontuário com anexos/fotos clínicas;
- assinatura digital;
- exclusão física de clientes;
- permissões por procedimento específico;
- agenda pública para cliente final.

## 14. Critério de conclusão

A Fase 4 estará concluída quando:

1. Mel aparecer e funcionar como profissional atendente e admin;
2. todas as profissionais ativas puderem consultar todos os clientes e históricos;
3. colaboradoras puderem criar/editar clientes sem poder arquivá-los;
4. cada colaboradora puder operar somente a própria agenda;
5. Mel puder operar todas as agendas;
6. auditoria registrar automaticamente as alterações críticas;
7. financeiro continuar exclusivo da Mel;
8. testes e Security Advisor passarem sem regressão relevante.
