# BC Gestão — Agenda V2: Geral, Site e Interna

**Data:** 2026-10-14  
**Status:** design aprovado em conversa; aguardando revisão formal desta spec  
**Repositório:** `bcesteticaavancada/bcesteticaavancada-alt`  
**Branch de trabalho:** `feature/public-agenda-native`  
**Projeto Supabase:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)  
**Fuso:** `America/Sao_Paulo`

> Esta spec **substitui a arquitetura de agenda da spec anterior** `2026-10-14-bc-gestao-agenda-publica-disponibilidade-design.md` nos pontos de visualização, papéis e integração público/interno. As decisões de produto não contraditas aqui permanecem válidas.

## 1. Objetivo

Simplificar a agenda da BC Estética sem criar duas bases que precisem ser sincronizadas.

A experiência será dividida em duas origens operacionais:

- **Agenda do Site:** reservas feitas pelo cliente no site público;
- **Agenda Interna:** reservas criadas pela equipe no BC Gestão.

Por baixo, ambas usam **um único núcleo de agendamentos e conflitos**. Portanto, não existe cópia de compromisso nem sincronização assíncrona entre duas tabelas de agenda.

O BC Gestão oferece três visualizações:

1. **Geral** — Site + Interna;
2. **Site** — somente reservas originadas no site;
3. **Interna** — somente reservas criadas pela equipe.

Essa separação deve ser principalmente de **interface e origem**, não de armazenamento duplicado.

## 2. Princípio arquitetural

### 2.1 Uma fonte de verdade

`public.agendamentos` continua sendo a fonte oficial de compromissos.

Cada registro possui uma origem operacional:

- `site` — criado pelo fluxo público;
- `interno` — criado pelo BC Gestão.

Valores legados que já existam no projeto, como `agenda` e `encaixe`, devem ser preservados ou migrados de forma compatível. Nenhuma migration pode quebrar fluxos atuais para fazer a V2 caber em uma constraint nova.

### 2.2 Duas agendas visuais, um motor

Não criar:

- `agendamentos_site` + `agendamentos_internos` com replicação;
- filas de sincronização entre agendas;
- jobs para copiar marcações entre tabelas;
- lógica de conflito baseada em eventual consistency.

Criar apenas filtros/visões sobre o mesmo conjunto oficial de compromissos.

Consequência:

- se o site reserva 14:00, 14:00 deixa de estar livre para a equipe;
- se a equipe reserva 15:00, 15:00 deixa de estar livre no site;
- cancelamento/reagendamento altera o mesmo registro oficial;
- o mesmo mecanismo de conflito protege as duas origens.

## 3. Perfis de acesso

A V2 terá somente três perfis funcionais para a agenda.

### 3.1 Admin — Mel

Acesso total à agenda e às configurações operacionais da clínica.

Pode:

- visualizar todas as profissionais;
- visualizar Geral, Site e Interna;
- criar, editar, reagendar e cancelar qualquer agendamento;
- configurar disponibilidade de qualquer profissional;
- criar bloqueios;
- inativar/reativar agenda;
- registrar férias, afastamentos e outros períodos indisponíveis;
- administrar configurações sensíveis e papéis conforme regras já existentes do BC Gestão.

### 3.2 Colaboradora Chefe — Alice

É uma colaboradora com poderes de gerente interna, sem se tornar Admin.

Pode:

- visualizar a agenda de todas as profissionais;
- visualizar Geral, Site e Interna;
- criar agendamento para qualquer profissional;
- editar, reagendar e cancelar agendamentos;
- configurar disponibilidade das colaboradoras;
- criar e remover bloqueios operacionais;
- inativar/reativar agenda por férias, afastamento ou motivo operacional;
- revisar reservas vindas do site;
- vincular reserva pública ao cadastro clínico correto, quando autorizado pelo fluxo clínico.

Não pode:

- alterar o próprio papel ou o papel de outros usuários;
- promover alguém a Admin;
- criar permissões estruturais novas;
- administrar chaves, segurança, RLS, autenticação ou configurações críticas do sistema;
- excluir contas administrativas por decisão própria.

A nomenclatura exibida na interface é **Colaboradora Chefe**.

### 3.3 Colaboradora

Pode:

- visualizar as abas Geral, Site e Interna **somente para os próprios atendimentos**;
- criar agendamentos na própria agenda;
- editar/reagendar/cancelar compromissos próprios, conforme regras vigentes;
- configurar a própria disponibilidade;
- criar bloqueios próprios;
- solicitar/registrar indisponibilidade própria quando permitido pelo fluxo.

Não pode administrar a agenda de outra profissional.

## 4. Interface do BC Gestão

A tela principal de agenda terá três abas simples:

`Geral | Site | Interna`

### 4.1 Geral

Mostra todos os compromissos que o usuário tem permissão para visualizar.

Cada compromisso deve ter um indicador discreto de origem:

- `Site`;
- `Interno`;
- valores legados podem receber rótulo equivalente durante a transição.

### 4.2 Site

Filtra apenas reservas de origem pública.

Objetivos:

- facilitar acompanhamento de conversão do site;
- localizar clientes que ainda precisam de contato/vínculo clínico;
- permitir que Mel e Alice gerenciem as entradas online sem misturar visualmente com marcações internas.

### 4.3 Interna

Filtra compromissos criados pela equipe.

Não é uma tabela separada; é um filtro por origem operacional.

### 4.4 Permissão aplicada antes do filtro

A autorização vem antes da visualização.

Exemplo:

- Mel e Alice recebem o conjunto autorizado de toda a clínica e então alternam Geral/Site/Interna;
- uma colaboradora recebe somente seus compromissos e então alterna Geral/Site/Interna dentro desse subconjunto.

O frontend nunca deve usar filtro visual como substituto de autorização no banco/backend.

## 5. Site público

O site da BC exibe apenas a **Agenda do Site** na forma de disponibilidade.

O cliente nunca vê:

- Agenda Interna;
- nomes de clientes;
- horários ocupados com detalhes;
- motivo de férias/afastamento;
- observações administrativas;
- histórico clínico;
- disponibilidade de outras profissionais além do que for necessário para seleção pública.

### 5.1 Fluxo

`Procedimento → Profissional → Data → Horário livre → Nome + WhatsApp → Confirmar`

Depois da confirmação:

- o compromisso é criado imediatamente;
- origem = `site`;
- o horário deixa de estar disponível para qualquer outra origem;
- exibir confirmação;
- oferecer/abrir WhatsApp com mensagem pré-preenchida;
- oferecer CTA para a pré-anamnese existente quando apropriado.

### 5.2 Calendário público

Mantêm-se as decisões já aprovadas:

- somente mês civil atual;
- dias passados visíveis e desabilitados;
- somente horários futuros;
- grade de início de 15 minutos;
- duração vinda de `procedimentos.duracao_padrao`;
- sem antecedência mínima fixa;
- outro mês solicitado pelo WhatsApp;
- cliente escolhe explicitamente a profissional;
- não sugerir automaticamente outra profissional.

## 6. Disponibilidade e bloqueios

A disponibilidade continua pertencendo à profissional, não à origem do agendamento.

Isso é importante: não existirão “horários do site” separados de “horários internos”.

Existe apenas:

`tempo da profissional` → menos `bloqueios/inativação` → menos `agendamentos existentes` → `horários livres`.

A camada pública aplica ainda a regra de que a data precisa estar publicada/habilitada para reserva online.

A equipe interna pode realizar encaixe autorizado fora da janela publicada ao site, desde que:

- não exista conflito com outro compromisso;
- não atravesse bloqueio impeditivo;
- não atravesse inativação/afastamento;
- o usuário tenha permissão para aquela profissional.

## 7. Inativação da agenda

Mantém-se a solução simples:

- início obrigatório;
- fim opcional;
- motivo interno;
- observação opcional;
- reativação antecipada permitida.

Motivos sugeridos:

- Férias;
- Motivos pessoais;
- Motivo médico;
- Licença/Afastamento;
- Curso/Capacitação;
- Viagem;
- Folga;
- Outro.

No site público, o motivo nunca é exposto. Quando necessário, mostrar somente:

`Profissional indisponível neste período.`

Bloqueio/inativação não cancela compromissos existentes silenciosamente. O sistema alerta Mel/Alice quando houver agendamentos dentro do período para revisão manual.

## 8. Reserva pública e identidade clínica

O site coleta somente:

- nome;
- WhatsApp.

Isso não é suficiente para afirmar identidade clínica.

Logo:

- reserva de origem `site` pode existir antes de estar vinculada a `cliente_id`;
- não auto-vincular prontuário apenas por nome ou telefone parecido;
- Mel/Alice podem revisar e vincular depois;
- antes de abrir atendimento clínico formal, exigir cliente válido conforme regras clínicas existentes.

Na agenda, reserva ainda não vinculada pode aparecer como:

`Site • Cadastro pendente`

## 9. Motor de conflito

O mecanismo de conflito é único para Site e Interna.

Ao criar/reagendar:

1. validar profissional e procedimento;
2. calcular `fim` pela duração operacional quando aplicável;
3. validar bloqueios/inativação;
4. adquirir proteção transacional adequada para a agenda da profissional;
5. revalidar sobreposição;
6. persistir somente se o intervalo continuar livre.

Se duas solicitações disputarem o mesmo horário, somente uma pode vencer.

Mensagem pública sugerida para a perdedora:

`Esse horário acabou de ser reservado. Escolha outro horário disponível.`

O detalhe técnico do lock/constraint será definido no plano de implementação, reutilizando sempre que possível o mecanismo já existente no BC Gestão em vez de criar motores concorrentes.

## 10. Camada pública simplificada

Para reduzir complexidade e superfície de segurança, o site necessita apenas de duas capacidades públicas conceituais:

1. **Consultar disponibilidade sanitizada**;
2. **Reservar um slot que acabou de ser revalidado**.

Nenhuma API pública precisa listar agendamentos da clínica.

Nenhuma API pública precisa receber a agenda interna.

Nenhuma chave privilegiada pode existir no navegador.

A implementação deve seguir o modelo atual de segurança do Supabase, com autorização no servidor/banco, RLS quando aplicável e privilégios mínimos.

## 11. Tratamento da implementação experimental já existente

A branch `feature/public-agenda-native` contém trabalho experimental das Tasks 1 e 2 da arquitetura anterior.

Esse código **não é automaticamente considerado correto para a V2**.

Antes de continuar a implementação:

1. comparar migrations/testes experimentais com esta spec;
2. preservar somente estruturas compatíveis e úteis;
3. remover/reverter contratos que existam apenas para a arquitetura antiga;
4. atualizar testes para validar comportamento real, evitando regex frágeis que dependam de formatação do SQL;
5. manter compatibilidade com origens e fluxos legados já utilizados pelo BC Gestão;
6. só avançar depois de a suíte da nova base ficar verde.

A falha anterior de teste relacionada ao rate limit não justifica alterar lógica de produção correta apenas para satisfazer uma expressão regular. Testes devem verificar contratos e comportamento relevante, não a posição textual de tokens no SQL.

## 12. Fora de escopo desta versão

Para manter a solução simples, não implementar agora:

- duas tabelas de agenda sincronizadas;
- calendário Google/Apple bidirecional;
- fila de espera;
- sugestão automática de outra profissional;
- auto-remarcação;
- cancelamento público self-service;
- CRM de marketing;
- analytics avançado de conversão;
- regras complexas de comissão;
- múltiplas unidades/salas como motor de recurso nesta fase.

Esses itens podem ser avaliados depois sem alterar a fundação da V2.

## 13. Critérios de aceite

A V2 é considerada correta quando:

1. BC Gestão oferece `Geral | Site | Interna`;
2. Mel visualiza e administra toda a clínica;
3. Alice, como `Colaboradora Chefe`, visualiza e administra todas as agendas operacionais sem receber poderes de Admin;
4. demais colaboradoras visualizam e administram apenas a própria agenda;
5. reservas do site aparecem imediatamente na aba Site e também na Geral;
6. reservas internas aparecem na Interna e também na Geral;
7. Site e Interna nunca conseguem ocupar simultaneamente o mesmo intervalo da mesma profissional;
8. um compromisso é armazenado uma única vez, sem sincronização entre tabelas duplicadas;
9. site público recebe somente horários livres e dados públicos mínimos;
10. motivos de afastamento nunca aparecem publicamente;
11. bloqueios/inativações não apagam compromissos existentes;
12. procedimentos sem duração operacional válida não geram horário público;
13. reserva pública não auto-vincula prontuário por similaridade de nome/telefone;
14. fluxo clínico exige vínculo válido antes do atendimento formal;
15. valores/origens legados usados atualmente pelo BC Gestão continuam compatíveis durante a migração;
16. testes de agenda validam comportamento/contratos e não dependem de formatação incidental do arquivo SQL;
17. suíte existente do BC Gestão permanece verde antes de qualquer merge no `main`.

## 14. Resumo da arquitetura

```text
                         BC GESTÃO
              ┌────────────┼────────────┐
              │            │            │
            GERAL         SITE        INTERNA
              │            │            │
              └────────────┼────────────┘
                           │ filtros por origem
                           ▼
                  public.agendamentos
                    FONTE ÚNICA
                           │
               ┌───────────┴───────────┐
               │                       │
          origem = site          origem = interno
               ▲                       ▲
               │                       │
        Site BC Estética          Equipe BC Gestão
               │                       │
               └───────────┬───────────┘
                           ▼
                   MOTOR DE CONFLITO
                     ÚNICO E ATÔMICO
```

A V2 entrega a separação visual desejada sem pagar o custo e o risco de manter duas agendas físicas sincronizadas.
