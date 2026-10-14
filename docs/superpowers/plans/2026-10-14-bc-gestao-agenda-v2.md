# BC Gestão — Agenda V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Agenda V2 do BC Gestão com as visões `Geral | Site | Interna`, mantendo uma única fonte de verdade em `public.agendamentos`, permitindo que Mel/admin e Alice/Colaboradora Chefe administrem todas as agendas, que as demais colaboradoras administrem apenas a própria agenda, e que o site público consulte disponibilidade e reserve horários sem expor dados internos.

**Architecture:** `public.agendamentos` continua sendo a única agenda física. A origem do compromisso determina apenas a visualização (`site` versus origem interna), enquanto um único motor de conflito protege todas as reservas. Alice continua tecnicamente no papel `colaborador`; a capacidade operacional `pode_gerenciar_agendas=true` transforma sua experiência em **Colaboradora Chefe** sem criar um terceiro fluxo de autenticação. A camada pública recebe apenas disponibilidade sanitizada e uma operação atômica de reserva.

**Tech Stack:** HTML/CSS/JavaScript ES Modules, Supabase/PostgreSQL, Supabase Edge Functions/Deno, Node.js 22 `node:test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-14-bc-gestao-agenda-v2-design.md`

## Global Constraints

- Trabalhar somente em `feature/public-agenda-native` até revisão final; não alterar `main` durante a implementação.
- Não criar duas tabelas de agenda sincronizadas.
- Preservar as origens legadas `agenda` e `encaixe`; visualmente elas pertencem à categoria **Interna**.
- Não hardcodar Alice por nome ou e-mail no código. A diferenciação é pela permissão `pode_gerenciar_agendas`.
- A nova permissão de agenda não amplia acesso financeiro, administração de usuários, autenticação ou configurações críticas.
- Reserva pública com apenas nome + WhatsApp não deve auto-vincular prontuário clínico.
- O site nunca recebe nomes de clientes já agendados, observações internas ou motivos de afastamento.
- Testes devem validar contratos/comportamento; evitar regex dependente de posição incidental de texto em SQL.
- Não criar, alterar ou cancelar pacientes/agendamentos reais durante testes.
- Antes de alterar migrations experimentais já existentes, confirmar se elas já foram aplicadas no projeto Supabase. Se aplicadas, não reescrever histórico; criar migration corretiva nova.
- Antes de implementar ou publicar Edge Function/Supabase security, consultar changelog/docs atuais e rodar advisors quando disponíveis.

## Review Focus

1. A autorização da Alice deve ser de **agenda**, não um atalho para virar Admin.
2. `Geral | Site | Interna` são filtros sobre uma fonte única, não calendários independentes.
3. O conflito entre reservas do site e reservas internas precisa continuar atômico.
4. Reservas públicas sem `cliente_id` ocupam horário, mas não abrem atendimento clínico formal.
5. A migração deve ser compatível com `agenda`/`encaixe` e com o fluxo rápido já existente.
6. A camada pública deve permanecer mínima e não ganhar endpoints de listagem interna.

---

## Task 1 — Reconciliar a tentativa experimental e recuperar baseline verde

**Files:**
- Review/Modify: `supabase/migrations/20261014173500_bc_gestao_public_agenda_schema.sql`
- Review/Modify: `supabase/migrations/20261014184500_bc_gestao_public_agenda_engine.sql`
- Modify: `tests/gestao/public-agenda-schema.test.mjs`
- Modify: `tests/gestao/public-agenda-engine.test.mjs`

- [ ] **1.1 Confirmar histórico de migrations antes de editar SQL**
  - Consultar o projeto Supabase e verificar se `20261014173500` e `20261014184500` já foram aplicadas.
  - Se **não aplicadas**, elas podem ser reconciliadas na branch.
  - Se **aplicadas**, congelar os arquivos históricos e criar migration V2 corretiva com novo timestamp.

- [ ] **1.2 Escrever/ajustar testes RED para os contratos V2**
  - Preservar `agenda`, `encaixe`, `interno`, `site`.
  - Classificar qualquer origem não-`site` já suportada como interna na camada visual.
  - Verificar rate limit por duas propriedades independentes: janela de `10 minutes` e limite `>= 10`, sem exigir que apareçam no mesmo statement SQL.
  - Verificar que a reserva pública aceita snapshot público sem `cliente_id` e que atendimento clínico exige vínculo antes de abrir sessão.

- [ ] **1.3 Rodar RED focado**

```bash
npm run test:gestao -- --test-name-pattern="agenda pública|motor|origem|rate"
```

Expected: falhar apenas onde o contrato V2 ainda não está reconciliado.

- [ ] **1.4 Ajustar o SQL experimental somente onde contradiz a V2**
  - Reaproveitar `professional_availability_days`, `professional_schedule_blocks` e `professional_agenda_inactivations` se compatíveis.
  - Manter o lock/conflito único se estiver correto.
  - Remover pressupostos exclusivos da arquitetura antiga.
  - Não mudar lógica correta apenas para satisfazer regex textual.

- [ ] **1.5 Rodar GREEN da suíte de gestão**

```bash
npm run test:gestao
```

Expected: todos os testes verdes.

- [ ] **1.6 Commit**

```bash
git add supabase/migrations tests/gestao/public-agenda-*.test.mjs
git commit -m "test: reconcile agenda v2 baseline"
```

---

## Task 2 — Adicionar a capacidade Colaboradora Chefe sem criar terceiro papel de login

**Files:**
- Create/Modify migration V2: `supabase/migrations/<timestamp>_bc_gestao_agenda_v2_permissions.sql`
- Modify: `gestao/js/auth.js`
- Modify: `tests/gestao/auth-routing.test.mjs`
- Create: `tests/gestao/agenda-manager-permissions.test.mjs`

**Interface:**

```text
staff_profiles.pode_gerenciar_agendas boolean not null default false

admin                         => gerencia todas as agendas
colaborador + flag true       => Colaboradora Chefe, gerencia todas as agendas
colaborador + flag false      => somente a própria agenda
```

- [ ] **2.1 Escrever testes RED**
  - `getCurrentProfile()` deve trazer `pode_gerenciar_agendas`.
  - `role='colaborador'` continua roteando para `/colaborador/` com ou sem a flag.
  - A flag não concede role `admin` nem libera áreas financeiras/admin.
  - Criar contrato SQL para função/helper de autorização de escopo de agenda.

- [ ] **2.2 Rodar RED**

```bash
node --test tests/gestao/auth-routing.test.mjs tests/gestao/agenda-manager-permissions.test.mjs
```

Expected: falha porque a nova capacidade ainda não existe.

- [ ] **2.3 Implementar migration mínima**
  - Adicionar `pode_gerenciar_agendas` em `staff_profiles` com default `false`.
  - Criar helper privado/seguro para decidir `can_manage_all_agendas(auth.uid())` usando `role='admin' OR pode_gerenciar_agendas=true`.
  - Não alterar `VALID_ROLES` nem `ROLE_DESTINATIONS`.

- [ ] **2.4 Atualizar `auth.js`**
  - Incluir a flag no profile retornado.
  - Continuar rejeitando roles desconhecidos.

- [ ] **2.5 Rodar GREEN**

```bash
node --test tests/gestao/auth-routing.test.mjs tests/gestao/agenda-manager-permissions.test.mjs
```

- [ ] **2.6 Commit**

```bash
git add supabase/migrations gestao/js/auth.js tests/gestao
git commit -m "feat: add agenda manager capability"
```

---

## Task 3 — Criar uma API autenticada única para Geral, Site e Interna

**Files:**
- Modify/Create migration V2 engine: `supabase/migrations/<timestamp>_bc_gestao_agenda_v2_engine.sql`
- Modify: `gestao/js/agenda-api.js`
- Create: `gestao/js/agenda-origin.js`
- Modify: `tests/gestao/agenda-api.test.mjs`
- Create: `tests/gestao/agenda-origin.test.mjs`

**Interfaces:**

```js
listAppointments({ client, fromIso, toIso, origin = 'all' })
// origin: 'all' | 'site' | 'internal'

normalizeAgendaView(value)
agendaOriginKind(appointment) // 'site' | 'internal'
agendaOriginLabel(appointment) // 'Site' | 'Interno'
```

**Backend RPC:**

```text
bc_agenda_list(p_from, p_to, p_origin)
```

Server-side scope:
- admin ou `pode_gerenciar_agendas=true`: todas as profissionais;
- colaboradora comum: apenas `colaboradora_user_id = auth.uid()`.

Origem:
- `site` => somente `origem='site'`;
- `internal` => origens internas, incluindo `interno`, `agenda`, `encaixe`;
- `all` => ambas.

- [ ] **3.1 Escrever testes RED para origem e escopo**
  - `agenda`, `encaixe` e `interno` renderizam como **Interno**.
  - `site` renderiza como **Site**.
  - API usa RPC única e não confia em filtro frontend para autorização.
  - DTO de agenda inclui `origem`, `public_booking_name` e os campos necessários ao snapshot público.

- [ ] **3.2 Rodar RED**

```bash
node --test tests/gestao/agenda-api.test.mjs tests/gestao/agenda-origin.test.mjs tests/gestao/agenda-manager-permissions.test.mjs
```

- [ ] **3.3 Implementar RPC de leitura com escopo server-side**
  - Validar `p_origin` em `all/site/internal`.
  - Fazer a autorização antes do filtro visual.
  - Não expor observações ou dados além do necessário à UI autorizada.

- [ ] **3.4 Endurecer writes internos existentes**
  - `bc_agendamento_create/update/status`: admin/Colaboradora Chefe podem atuar em qualquer agenda operacional; colaboradora comum somente na própria.
  - O mesmo motor de conflito é usado para todos.
  - Manter compatibilidade com o fluxo legado de encaixe.

- [ ] **3.5 Implementar wrappers JS**
  - Adicionar `listAppointments()`.
  - Manter aliases antigos temporariamente se isso reduzir regressão durante a transição.
  - Centralizar classificação de origem em `agenda-origin.js`.

- [ ] **3.6 Rodar GREEN**

```bash
npm run test:gestao
```

- [ ] **3.7 Commit**

```bash
git add supabase/migrations gestao/js/agenda-api.js gestao/js/agenda-origin.js tests/gestao
git commit -m "feat: add scoped agenda v2 api"
```

---

## Task 4 — Implementar `Geral | Site | Interna` no BC Gestão

**Files:**
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/js/admin-agenda.js`
- Modify: `gestao/js/colaborador-agenda.js`
- Modify: `gestao/assets/gestao.css`
- Modify: `tests/gestao/admin-agenda.test.mjs`
- Modify: `tests/gestao/colaborador-agenda.test.mjs`
- Create: `tests/gestao/agenda-views.test.mjs`

- [ ] **4.1 Escrever testes RED para as três abas**
  - Admin tem `Geral | Site | Interna`.
  - Colaboradora comum tem as três abas, mas os dados continuam limitados à própria agenda.
  - Colaboradora Chefe vê seletor de profissional/todas e pode administrar a clínica.
  - Perfil com flag mostra nomenclatura **Colaboradora Chefe**.
  - Nenhum teste depende de nome/e-mail da Alice.

- [ ] **4.2 Escrever testes RED para cards**
  - Card mostra chip `Site` ou `Interno`.
  - Reserva pública sem vínculo usa `public_booking_name` e chip `Cadastro pendente`.
  - Botão de abrir atendimento clínico fica indisponível enquanto `cliente_id` estiver vazio.

- [ ] **4.3 Rodar RED**

```bash
node --test tests/gestao/admin-agenda.test.mjs tests/gestao/colaborador-agenda.test.mjs tests/gestao/agenda-views.test.mjs
```

- [ ] **4.4 Implementar UI compartilhando o máximo possível**
  - Adicionar tabs simples, acessíveis e mobile-first.
  - Recarregar pela API com `origin=all/site/internal` em vez de buscar tudo e confiar só no DOM.
  - Admin mantém filtro por profissional.
  - Colaboradora Chefe ganha filtro profissional; colaboradora comum não.
  - Não criar nova rota/página exclusiva para gerente.

- [ ] **4.5 Preservar financeiro e outras áreas**
  - Alice continua na rota `/colaborador/`.
  - `pode_gerenciar_agendas` não altera os módulos financeiros nem áreas administrativas.

- [ ] **4.6 Rodar GREEN**

```bash
npm run test:gestao
```

- [ ] **4.7 Commit**

```bash
git add gestao tests/gestao
git commit -m "feat: add agenda geral site interna views"
```

---

## Task 5 — Disponibilidade, bloqueios e inativação com painel simples

**Files:**
- Create: `gestao/js/agenda-disponibilidade.js`
- Modify: `gestao/js/agenda-api.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/assets/gestao.css`
- Create: `tests/gestao/agenda-disponibilidade.test.mjs`
- Modify/Create migration V2 authorization for schedule RPCs as required.

**Minimal scope:**
- calendário/mês atual selecionável internamente com navegação futura;
- habilitar/desabilitar dia;
- início/fim do dia;
- bloqueio parcial;
- inativação por período + motivo interno + observação opcional;
- reativação.

Não implementar nesta fase recorrências sofisticadas, calendário externo ou regras de salas.

- [ ] **5.1 Escrever testes RED de autorização**
  - Admin/Colaboradora Chefe podem editar qualquer profissional.
  - Colaboradora comum só edita a própria disponibilidade.
  - Motivo de inativação nunca entra no DTO público.

- [ ] **5.2 Escrever testes RED da interface mínima**
  - Formulários/controles existem e usam a profissional correta.
  - Bloqueio/inativação não remove compromissos existentes.
  - Quando houver compromissos no período, resposta informa quantidade para revisão manual.

- [ ] **5.3 Implementar/reconciliar RPCs existentes**
  - Reusar, se compatíveis: `bc_schedule_month_get`, `bc_schedule_day_upsert`, `bc_schedule_block_create/delete`, `bc_agenda_inactivation_create`, `bc_agenda_reactivate`.
  - Centralizar autorização pelo helper de agenda-manager.

- [ ] **5.4 Implementar painel simples compartilhado**
  - Um único módulo `agenda-disponibilidade.js` usado por admin e colaboradora.
  - O módulo decide escopo a partir do profile, mas o banco também valida.

- [ ] **5.5 Rodar GREEN**

```bash
node --test tests/gestao/agenda-disponibilidade.test.mjs
npm run test:gestao
```

- [ ] **5.6 Commit**

```bash
git add supabase/migrations gestao tests/gestao
git commit -m "feat: add simple staff availability management"
```

---

## Task 6 — Criar backend público mínimo e página `/agenda/`

**Files:**
- Create: `supabase/functions/public-agenda/index.ts`
- Create: `supabase/functions/public-agenda/domain.ts`
- Create: `supabase/functions/public-agenda/domain_test.ts`
- Create: `agenda/index.html`
- Create: `agenda/agenda.css`
- Create: `agenda/js/api.js`
- Create: `agenda/js/main.js`
- Modify: `index.html`
- Create: `tests/site/public-agenda-page.test.mjs`

**Public capabilities only:**

```text
1. listar catálogo/profissionais elegíveis e disponibilidade sanitizada
2. reservar um slot após revalidação atômica
```

Sem endpoint público para listar compromissos existentes.

- [ ] **6.1 Verificar documentação atual do Supabase**
  - Consultar changelog/docs de Edge Functions, API keys, auth e CORS antes de implementar.
  - Confirmar configuração pública apropriada (`verify_jwt`/publishable key) para a versão vigente.

- [ ] **6.2 Escrever testes RED do domínio público**
  - mês civil atual em `America/Sao_Paulo`;
  - apenas slots futuros;
  - inícios de 15 minutos;
  - duração vem de `duracao_padrao`;
  - `site` e interno nunca ocupam o mesmo intervalo;
  - conflito simultâneo retorna mensagem amigável;
  - rate limit testa janela e limite separadamente;
  - snapshot público nunca auto-vincula `cliente_id`.

- [ ] **6.3 Implementar Edge Function mínima**
  - Sem secret/service key no browser.
  - Validar payloads e tamanhos.
  - Consultar apenas RPCs/contratos públicos mínimos.
  - Revalidar o slot dentro da operação de reserva.

- [ ] **6.4 Rodar testes da função**

```bash
deno test supabase/functions/public-agenda/domain_test.ts
```

Expected: PASS.

- [ ] **6.5 Escrever teste RED da página pública**
  - rota `/agenda/` existe;
  - fluxo contém procedimento, profissional, calendário, horários, nome, WhatsApp e confirmação;
  - não inclui campos clínicos;
  - não inclui navegação pública para próximo mês;
  - CTA de outro mês usa WhatsApp;
  - sucesso oferece pré-anamnese `/agendamento/`.

- [ ] **6.6 Implementar página pública**
  - Layout premium BC e mobile-first.
  - Fluxo: Procedimento → Profissional → Data → Horário → Nome + WhatsApp → Confirmar.
  - Mensagens de ausência de vaga/inativação conforme spec.
  - Após sucesso, manter confirmação visível mesmo se WhatsApp não abrir.

- [ ] **6.7 Atualizar Home**
  - `Agendar agora` aponta para `/agenda/`.
  - `/agendamento/` continua sendo pré-anamnese e não é mesclado.

- [ ] **6.8 Rodar GREEN**

```bash
node --test tests/site/public-agenda-page.test.mjs
npm run test:site
```

- [ ] **6.9 Commit**

```bash
git add supabase/functions/public-agenda agenda index.html tests/site
git commit -m "feat: add public agenda booking flow"
```

---

## Task 7 — Verificação integral e preparação de rollout

**Files:**
- Review: all changed agenda/migration/function/test files
- Update only if findings require corrections.

- [ ] **7.1 Rodar toda a suíte Node**

```bash
npm test
```

Expected: PASS, zero testes falhando.

- [ ] **7.2 Rodar Edge Function tests**

```bash
deno test supabase/functions/public-agenda/domain_test.ts
```

E manter verdes também os testes de PDF já executados pela CI.

- [ ] **7.3 Segurança Supabase**
  - Executar advisors disponíveis.
  - Confirmar RLS/grants mínimos.
  - Confirmar que `anon` não tem acesso direto a tabelas de agenda/disponibilidade/clientes.
  - Confirmar que nenhuma secret/service key foi commitada em HTML/JS público.

- [ ] **7.4 Revisão de regressão funcional**
  - `agenda`/`encaixe` legados ainda funcionam.
  - Admin atual continua funcional.
  - colaboradora comum continua limitada à própria agenda.
  - Alice/manager scope não amplia financeiro ou administração.
  - reserva pública sem cliente não inicia atendimento clínico.
  - bloqueio/inativação não apaga agendamentos.

- [ ] **7.5 Validar GitHub Actions no commit final da branch**
  - Site CI deve ficar completamente verde.
  - Se houver falha, corrigir antes de qualquer merge.

- [ ] **7.6 Preparar rollout da Alice**
  - Confirmar o `staff_profiles.user_id` correto da Alice no projeto real.
  - Somente então definir `pode_gerenciar_agendas=true` para esse registro.
  - Não hardcodar identidade no repositório.

- [ ] **7.7 Comparar branch contra `main`**
  - Revisar migrations, segurança e UI.
  - Não fazer merge automaticamente como parte desta task; apresentar estado final para revisão.

- [ ] **7.8 Commit final de correções, se necessário**

```bash
git add -A
git commit -m "test: verify BC agenda v2 end to end"
```

---

## Definition of Done

A implementação está pronta para revisão quando:

- `Geral | Site | Interna` funcionam no BC Gestão;
- Mel vê/administra todas as agendas;
- Alice aparece como **Colaboradora Chefe** e administra todas as agendas sem virar Admin;
- demais colaboradoras só veem/administram a própria agenda;
- site e interno usam uma única fonte de verdade e um único motor de conflito;
- `/agenda/` mostra somente disponibilidade pública e cria reservas `site`;
- reservas públicas pendentes não são vinculadas automaticamente ao prontuário;
- disponibilidade/bloqueio/inativação funcionam com escopo correto;
- origens legadas permanecem compatíveis;
- todas as suítes e o GitHub Actions estão verdes;
- nenhuma alteração foi mesclada no `main` sem revisão final.