# BC Gestão — Agenda Pública e Disponibilidade da Equipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma agenda pública integrada em tempo real ao BC Gestão, com calendário mensal do mês atual, reserva instantânea segura, WhatsApp pós-confirmação e controle interno de disponibilidade, bloqueios e inativações por profissional.

**Architecture:** O BC Gestão continua sendo a única fonte de verdade dos compromissos. O banco centraliza conflito, autorização e cálculo de disponibilidade; a equipe autenticada usa RPCs internos, enquanto o site público fala somente com uma Supabase Edge Function que devolve DTOs sanitizados e chama RPCs restritos ao backend. A reserva pública nasce como `origem = 'site'` com snapshot de nome/WhatsApp e só é vinculada a um prontuário após confirmação interna de identidade.

**Tech Stack:** HTML/CSS/ES modules sem bundler, Node.js `node:test`, Supabase Postgres/RLS/RPC, Supabase Edge Functions em TypeScript, GitHub Pages, `@supabase/supabase-js` 2.x.

**Spec:** `docs/superpowers/specs/2026-10-14-bc-gestao-agenda-publica-disponibilidade-design.md`

## Global Constraints

- Projeto de dados: somente Supabase `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).
- Fuso clínico: `America/Sao_Paulo` em toda regra de mês, data e horário.
- O público vê somente o mês civil atual; a equipe autenticada pode navegar livremente por meses futuros.
- Grade pública: início de slots a cada 15 minutos; término derivado de `procedimentos.duracao_padrao`.
- Reserva pública pede somente nome + WhatsApp; não coletar CPF, nascimento ou dados clínicos nessa etapa.
- Não auto-vincular uma reserva pública a prontuário por coincidência de nome ou telefone.
- Secret/service role nunca entra no navegador, GitHub Pages, arquivo público ou resposta HTTP.
- Para a nova Edge Function pública, usar `verify_jwt=false`; segredo elevado fica somente no ambiente da função. Se o browser enviar publishable key, usar somente `apikey`, nunca `Authorization: Bearer sb_publishable_...`.
- `/agendamento/` continua sendo pré-anamnese e não deve ser convertido em agenda.
- `/admin/` legado da pré-anamnese permanece intocado.
- Testes e homologação usam apenas dados fictícios; nunca criar/alterar paciente, agenda ou financeiro real em validações automáticas.
- Bloqueios e inativações nunca cancelam, apagam ou remanejam compromissos existentes automaticamente.
- Motivos de inativação são internos e nunca saem para a API pública.
- Todo write de agenda, interno ou público, passa pelo mesmo lock e pela mesma checagem de sobreposição.
- A disponibilidade pública (`professional_availability_days`) governa o que o site oferece; ela não transforma a agenda interna em uma agenda fechada. A equipe pode criar encaixe interno fora de uma janela pública, desde que não haja conflito, bloqueio explícito ou inativação.

## Review Focus

1. **Virada de mês e fuso:** às 23:xx/00:xx em `America/Sao_Paulo`, o público deve enxergar apenas o mês clínico correto, independentemente do fuso do aparelho.
2. **Legado com `fim = null`:** conflito deve derivar o término pela duração do procedimento sem permitir sobreposição silenciosa.
3. **Reserva pública sem cliente clínico:** pode ocupar agenda, mas não pode iniciar atendimento/prontuário até `cliente_id` ser vinculado por equipe autorizada.
4. **Concorrência site × interno:** duas gravações sobrepostas para a mesma profissional/data devem resultar em exatamente uma vencedora.
5. **Inativação aberta com compromissos existentes:** deve impedir novas vagas, preservar compromissos já criados e informar a equipe quantos precisam de revisão.

---

## File Structure

### Banco / Supabase

- Create via CLI: `supabase/migrations/<timestamp>_bc_gestao_public_agenda_schema.sql` — campos de origem/snapshot, tabelas de disponibilidade, bloqueios, inativações e rate limit.
- Create via CLI: `supabase/migrations/<timestamp>_bc_gestao_public_agenda_engine.sql` — cálculo de slots, lock/conflito, RPCs internos/públicos restritos e vínculo de cliente.
- Modify through new migration only: existing `bc_agendamento_create`, `bc_agendamento_update`, `bc_registrar_atendimento`/gates correlatos — sem editar migrations históricas.

### BC Gestão frontend

- Create: `gestao/js/schedule-api.js` — wrappers RPC de disponibilidade, bloqueios, inativações e vínculo.
- Create: `gestao/js/schedule-calendar.js` — regras puras/renderização mensal compartilhada.
- Create: `gestao/js/admin-schedule.js` — gestão de qualquer profissional pela Mel/admin.
- Create: `gestao/js/colaborador-schedule.js` — gestão da própria disponibilidade.
- Modify: `gestao/js/agenda-api.js` — origem/snapshot público e vínculo.
- Modify: `gestao/js/admin-agenda.js` — cards de origem Site, cadastro pendente e fluxo de vínculo.
- Modify: `gestao/js/colaborador-agenda.js` — fallback público e bloqueio de atendimento sem cliente vinculado.
- Modify: `gestao/admin/index.html` — painel mensal de disponibilidade e vínculo.
- Modify: `gestao/colaborador/index.html` — painel mensal da própria agenda.
- Modify: `gestao/assets/gestao.css` — calendário, chips e estados.

### Backend público

- Create: `supabase/functions/public-agenda/index.ts` — CORS, roteamento de ações, rate limit e chamadas RPC server-side.
- Create: `supabase/functions/public-agenda/validation.ts` — validação/normalização de requests.
- Create: `supabase/functions/public-agenda/domain.js` — helpers puros testáveis em Node (mês corrente, telefone, grade, DTOs).

### Site público

- Create: `assets/js/bc-public-config.js` — número WhatsApp, endpoint da função e, se necessário, publishable key pública; nunca secrets.
- Create: `agenda/index.html` — página pública de agenda.
- Create: `agenda/agenda.css` — visual mobile-first do calendário.
- Create: `agenda/js/api.js` — cliente HTTP da Edge Function.
- Create: `agenda/js/calendar.js` — calendário do mês atual.
- Create: `agenda/js/main.js` — fluxo procedimento → profissional → data → slot → nome/WhatsApp → confirmação.
- Create: `home-agenda.js` — widget compacto da Home.
- Modify: `index.html` — widget e CTAs para `/agenda/`.

### Tests

- Create: `tests/gestao/public-agenda-schema.test.mjs`
- Create: `tests/gestao/public-agenda-engine.test.mjs`
- Create: `tests/gestao/schedule-api.test.mjs`
- Create: `tests/gestao/schedule-calendar.test.mjs`
- Create: `tests/gestao/admin-schedule.test.mjs`
- Create: `tests/gestao/colaborador-schedule.test.mjs`
- Modify: `tests/gestao/agenda-api.test.mjs`
- Modify: `tests/gestao/admin-agenda.test.mjs`
- Modify: `tests/gestao/colaborador-agenda.test.mjs`
- Create: `tests/site/public-agenda-domain.test.mjs`
- Create: `tests/site/public-agenda-page.test.mjs`
- Modify: `tests/site/home.test.mjs`

---

### Task 1: Persistência da agenda pública, disponibilidade e inativações

**Files:**
- Create via `supabase migration new bc_gestao_public_agenda_schema`: `supabase/migrations/<timestamp>_bc_gestao_public_agenda_schema.sql`
- Test: `tests/gestao/public-agenda-schema.test.mjs`

**Interfaces:**
- Consumes: tabelas `staff_profiles`, `procedimentos`, `agendamentos`, `audit_log` e helper `private.is_bc_active_staff()` existentes.
- Produces: `professional_availability_days`, `professional_schedule_blocks`, `professional_agenda_inactivations`, `private.public_booking_rate_limits` e campos de snapshot/origem em `agendamentos`.

- [ ] **Step 1: Write the failing schema-contract tests**

Cobrir com assertions de conteúdo SQL:

```js
assert.match(sql, /professional_availability_days/);
assert.match(sql, /unique[^;]*professional_user_id[^;]*local_date/i);
assert.match(sql, /professional_schedule_blocks/);
assert.match(sql, /professional_agenda_inactivations/);
assert.match(sql, /public_booking_name/);
assert.match(sql, /public_booking_phone_normalized/);
assert.match(sql, /origem/);
assert.match(sql, /private\.public_booking_rate_limits/);
assert.match(sql, /enable row level security/i);
assert.match(sql, /revoke all[^;]*from anon/i);
```

Também testar que a migration não concede leitura pública direta às novas tabelas operacionais.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/gestao/public-agenda-schema.test.mjs`

Expected: FAIL porque a migration ainda não existe.

- [ ] **Step 3: Generate the migration with Supabase CLI**

Run: `supabase migration new bc_gestao_public_agenda_schema`

Expected: CLI cria um único arquivo timestampado sob `supabase/migrations/`.

- [ ] **Step 4: Implement the additive schema migration**

Decisões fixas:

- `agendamentos.cliente_id` torna-se nullable;
- `agendamentos.created_by` torna-se nullable;
- adicionar `origem text not null default 'interno'` com check `('interno','site')`;
- adicionar `public_booking_name`, `public_booking_phone`, `public_booking_phone_normalized`;
- check de integridade: `interno` exige `cliente_id` e `created_by`; `site` exige nome + telefone normalizado;
- `professional_availability_days`: `professional_user_id`, `local_date`, `enabled`, `start_time`, `end_time`, autoria/timestamps, unique profissional+data;
- `professional_schedule_blocks`: profissional, `starts_at`, `ends_at`, `block_type`, `internal_note`, autoria/timestamp;
- `professional_agenda_inactivations`: profissional, `starts_on`, `planned_ends_on`, `reason`, `internal_note`, autoria, reativação;
- motivos exatamente: `ferias`, `motivos_pessoais`, `motivo_medico`, `licenca_afastamento`, `curso_capacitacao`, `viagem`, `folga`, `outro`;
- `private.public_booking_rate_limits`: hash de origem + timestamp, sem IP bruto;
- RLS ligado em todas as novas tabelas `public`;
- `anon` sem DML direto;
- índices somente para consultas previstas: disponibilidade `(professional_user_id, local_date)`, blocks por profissional+intervalo, inativações por profissional+período, rate limit por hash+timestamp.

- [ ] **Step 5: Run schema-contract tests**

Run: `node --test tests/gestao/public-agenda-schema.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_bc_gestao_public_agenda_schema.sql tests/gestao/public-agenda-schema.test.mjs
git commit -m "feat: add public agenda schedule schema"
```

---

### Task 2: Motor de disponibilidade e gate transacional único

**Files:**
- Create via `supabase migration new bc_gestao_public_agenda_engine`: `supabase/migrations/<timestamp>_bc_gestao_public_agenda_engine.sql`
- Test: `tests/gestao/public-agenda-engine.test.mjs`
- Modify through new migration behavior: existing `bc_agendamento_create`, `bc_agendamento_update`, `bc_registrar_atendimento`/treatment guards.

**Interfaces:**
- Consumes: schema da Task 1, `procedimentos.duracao_padrao`, `access_mode`, `procedure_professional_permissions`.
- Produces:
  - `private.bc_schedule_slots(p_professional_user_id uuid, p_procedimento_id uuid, p_local_date date) returns jsonb`
  - `private.bc_agendamento_lock_and_assert_no_conflict(p_professional_user_id uuid, p_inicio timestamptz, p_fim timestamptz, p_ignore_agendamento_id uuid default null) returns void`
  - `private.bc_schedule_assert_public_slot(p_professional_user_id uuid, p_procedimento_id uuid, p_inicio timestamptz, p_fim timestamptz) returns void`
  - `public.bc_schedule_month_get(p_professional_user_id uuid, p_month date) returns jsonb`
  - `public.bc_schedule_day_upsert(...) returns uuid`
  - `public.bc_schedule_days_apply(...) returns integer`
  - `public.bc_schedule_block_create(...) returns uuid`
  - `public.bc_schedule_block_delete(p_block_id uuid) returns uuid`
  - `public.bc_agenda_inactivation_create(...) returns jsonb`
  - `public.bc_agenda_reactivate(p_inactivation_id uuid) returns uuid`
  - `public.bc_agendamento_link_cliente(p_agendamento_id uuid, p_cliente_id uuid) returns uuid`
  - service-role-only RPCs `bc_public_agenda_catalog`, `bc_public_agenda_professionals`, `bc_public_agenda_month`, `bc_public_agenda_slots`, `bc_public_agenda_book`.

- [ ] **Step 1: Write failing engine-contract tests**

Assertions devem fixar:

```js
assert.match(sql, /pg_advisory_xact_lock/);
assert.match(sql, /America\/Sao_Paulo/);
assert.match(sql, /bc_agendamento_lock_and_assert_no_conflict/);
assert.match(sql, /bc_schedule_assert_public_slot/);
assert.match(sql, /bc_public_agenda_book/);
assert.match(sql, /slot_unavailable/);
assert.match(sql, /revoke execute[^;]*bc_public_agenda_book[^;]*from public/i);
assert.match(sql, /grant execute[^;]*bc_public_agenda_book[^;]*to service_role/i);
```

Adicionar checks para:

- `fim is null` derivado por `duracao_padrao`;
- cancelado/faltou não ocupando disponibilidade futura;
- `cliente_id is null` bloqueando início de atendimento formal;
- criação interna sem linha em `professional_availability_days` continuar permitida se não houver sobreposição, bloqueio explícito ou inativação.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/gestao/public-agenda-engine.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Generate the engine migration**

Run: `supabase migration new bc_gestao_public_agenda_engine`

Expected: arquivo timestampado único.

- [ ] **Step 4: Implement `private.bc_schedule_slots(...)`**

Regras obrigatórias para **oferta pública**:

- data calculada em `America/Sao_Paulo`;
- profissional precisa estar ativa e `atende_clientes`;
- procedimento precisa estar ativo, publicado/operacional e `duracao_padrao > 0`;
- procedimento restrito exige permissão ativa em `procedure_professional_permissions`;
- linha diária `enabled=true` define a janela pública;
- inativação vigente zera os slots;
- blocks removem sobreposições;
- `agendado` ocupa; `cancelado` e `faltou` liberam; compromissos históricos não geram slot retroativo;
- inícios alinhados a 15 min;
- início precisa estar no futuro usando relógio do banco;
- o intervalo completo deve caber antes de `end_time`.

- [ ] **Step 5: Implement the shared transaction lock/conflict helper**

`private.bc_agendamento_lock_and_assert_no_conflict(...)` deve:

- adquirir `pg_advisory_xact_lock` por chave derivada de `professional_user_id + data clínica`;
- verificar sobreposição contra compromissos ativos da profissional;
- derivar término de legado `fim=null` pela duração do procedimento quando necessário;
- aceitar `p_ignore_agendamento_id` em remarcação;
- emitir erro estável de conflito.

Esse helper é compartilhado por criação interna, remarcação interna e reserva pública.

- [ ] **Step 6: Implement the public-slot assertion**

`private.bc_schedule_assert_public_slot(...)` chama o lock/conflito compartilhado e, adicionalmente, exige:

- dia explicitamente publicado como disponível;
- intervalo dentro da janela publicada;
- ausência de block;
- ausência de inativação;
- alinhamento de 15 minutos e horário futuro.

- [ ] **Step 7: Harden existing internal create/update without turning public availability into a hard wall**

Preservar assinaturas públicas existentes de `bc_agendamento_create` e `bc_agendamento_update`, mas fazer as implementações privadas:

- derivarem `fim` quando omitido;
- usarem o lock/checagem de sobreposição compartilhado;
- rejeitarem bloqueio explícito e inativação vigente;
- **não exigirem** uma linha `professional_availability_days` para permitir encaixe interno autorizado;
- manterem colaboradora só agendando na própria agenda;
- manterem admin podendo escolher profissional.

- [ ] **Step 8: Implement schedule-management RPCs**

Autorização:

- admin: qualquer profissional;
- colaboradora: somente `auth.uid()`;
- bulk apply retorna quantidade de datas alteradas;
- inativação retorna também `affected_appointments` para o aviso de revisão;
- remoção de bloqueio e reativação são auditáveis; histórico de inativação não é destruído.

- [ ] **Step 9: Implement public service-role RPCs**

`bc_public_agenda_*` devem retornar apenas DTOs mínimos e validar o mês civil corrente no banco. `bc_public_agenda_book` recebe payload sanitizado + `p_network_hash`, aplica rate limit 10/10min, usa `bc_schedule_assert_public_slot` e grava `origem='site'`, snapshot de nome/telefone, `cliente_id=null`, `created_by=null`.

- [ ] **Step 10: Add explicit clinical guard**

Antes de criar/abrir atendimento formal a partir de agendamento, se `agendamentos.cliente_id is null`, devolver erro de domínio claro equivalente a `Cadastro da cliente precisa ser vinculado antes do atendimento.`.

- [ ] **Step 11: Run focused and existing agenda tests**

Run:

```bash
node --test tests/gestao/public-agenda-engine.test.mjs
node --test tests/gestao/agenda-api.test.mjs tests/gestao/treatment-api.test.mjs
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add supabase/migrations/*_bc_gestao_public_agenda_engine.sql tests/gestao/public-agenda-engine.test.mjs
git commit -m "feat: add transactional agenda availability engine"
```

---

### Task 3: API interna compartilhada e compatibilidade com reservas do site

**Files:**
- Create: `gestao/js/schedule-api.js`
- Modify: `gestao/js/agenda-api.js`
- Modify: `tests/gestao/agenda-api.test.mjs`
- Test: `tests/gestao/schedule-api.test.mjs`

**Interfaces:**
- Consumes: RPCs da Task 2.
- Produces:
  - `getScheduleMonth({client, professionalUserId, month}) -> Promise<object>`
  - `upsertAvailabilityDay({client, professionalUserId, localDate, enabled, startTime, endTime}) -> Promise<string>`
  - `applyAvailabilityDays({client, professionalUserId, dates, enabled, startTime, endTime}) -> Promise<number>`
  - `createScheduleBlock({client, professionalUserId, startsAt, endsAt, blockType, internalNote}) -> Promise<string>`
  - `deleteScheduleBlock({client, blockId}) -> Promise<string>`
  - `createAgendaInactivation({client, professionalUserId, startsOn, plannedEndsOn, reason, internalNote}) -> Promise<object>`
  - `reactivateAgenda({client, inactivationId}) -> Promise<string>`
  - `linkPublicAppointment({client, appointmentId, clienteId}) -> Promise<string>`.

- [ ] **Step 1: Write failing wrapper tests**

Testar nomes exatos dos RPCs e payload mínimo; nenhum wrapper aceita `created_by` ou `actor_user_id` enviados pelo frontend.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/gestao/schedule-api.test.mjs tests/gestao/agenda-api.test.mjs`

Expected: FAIL nos novos exports/selects.

- [ ] **Step 3: Implement `schedule-api.js`**

Usar o mesmo padrão `ensureClient`/`throwIfError`/RPC do restante do BC Gestão.

- [ ] **Step 4: Extend `APPOINTMENT_SELECT` in `agenda-api.js`**

Adicionar `origem`, `public_booking_name`, `public_booking_phone`, `public_booking_phone_normalized`; preservar `clientes(...)` como relação nullable. Não expor snapshot em APIs públicas do site, somente na área autenticada.

- [ ] **Step 5: Add `linkPublicAppointment`**

Wrapper chama `bc_agendamento_link_cliente` e nunca tenta decidir identidade no frontend.

- [ ] **Step 6: Run tests**

Run: `node --test tests/gestao/schedule-api.test.mjs tests/gestao/agenda-api.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add gestao/js/schedule-api.js gestao/js/agenda-api.js tests/gestao/schedule-api.test.mjs tests/gestao/agenda-api.test.mjs
git commit -m "feat: expose internal schedule api"
```

---

### Task 4: Calendário mensal compartilhado do BC Gestão

**Files:**
- Create: `gestao/js/schedule-calendar.js`
- Test: `tests/gestao/schedule-calendar.test.mjs`
- Modify: `gestao/assets/gestao.css`

**Interfaces:**
- Consumes: mês `YYYY-MM` e DTO do `bc_schedule_month_get`.
- Produces:
  - `buildMonthGrid(month, state) -> Array<CalendarCell>`
  - `monthLabel(month) -> string`
  - `shiftMonth(month, delta) -> string`
  - `renderScheduleCalendar(model) -> string`.

- [ ] **Step 1: Write failing pure-domain tests**

Cobrir fevereiro 28/29, meses 30/31, mudança dezembro→janeiro, estado `enabled`, `blocked`, `inactive`, `hasAppointments`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/gestao/schedule-calendar.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement pure calendar helpers**

Não depender do fuso do aparelho para calcular rótulos/dias; `month` é string civil `YYYY-MM`.

- [ ] **Step 4: Add focused CSS**

Classes para grid 7 colunas, estados disponível/indisponível/selecionado, chips de bloqueio/inativação e comportamento mobile-first.

- [ ] **Step 5: Run tests**

Run: `node --test tests/gestao/schedule-calendar.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gestao/js/schedule-calendar.js gestao/assets/gestao.css tests/gestao/schedule-calendar.test.mjs
git commit -m "feat: add monthly schedule calendar"
```

---

### Task 5: Controle mensal da Mel/admin

**Files:**
- Create: `gestao/js/admin-schedule.js`
- Modify: `gestao/admin/index.html`
- Modify: `gestao/js/admin-agenda.js`
- Test: `tests/gestao/admin-schedule.test.mjs`
- Modify: `tests/gestao/admin-agenda.test.mjs`

**Interfaces:**
- Consumes: `schedule-api.js`, `schedule-calendar.js`, diretório de profissionais já carregado pela agenda admin.
- Produces: `initAdminSchedule({client, profile, root, staffProvider}) -> Promise<{refresh(): Promise<void>}>`.

- [ ] **Step 1: Write failing admin UI tests**

Fixar presença de:

- calendário mensal;
- seletor de profissional;
- anterior/próximo mês sem limite público;
- formulário dia (`enabled`, início, fim);
- bulk apply por datas/dias da semana/cópia do mês anterior;
- criar/remover bloqueio;
- inativação com motivo obrigatório, data final opcional;
- aviso `affected_appointments` sem cancelamento automático.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/gestao/admin-schedule.test.mjs tests/gestao/admin-agenda.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add the admin schedule panel markup**

Dentro da área `#agenda`, adicionar subpainel `Disponibilidade da equipe`; não criar nova rota e não alterar o `/admin/` legado.

- [ ] **Step 4: Implement `initAdminSchedule`**

Ao trocar profissional/mês, carregar DTO mensal. Salvar dia/bulk/block/inativação via RPC. Exibir motivo e observação somente dentro da área autenticada.

- [ ] **Step 5: Wire it after `initAdminAgenda`**

O bootstrap admin passa o diretório já carregado ao módulo de schedule sem duplicar consultas desnecessárias.

- [ ] **Step 6: Make admin appointment cards public-booking aware**

Se `clientes` for null e `origem==='site'`, renderizar `public_booking_name`, telefone, chip `Site` e `Cadastro pendente`; não mostrar `Cliente` genérico quando o snapshot existir.

- [ ] **Step 7: Run tests**

Run: `node --test tests/gestao/admin-schedule.test.mjs tests/gestao/admin-agenda.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add gestao/js/admin-schedule.js gestao/admin/index.html gestao/js/admin-agenda.js tests/gestao/admin-schedule.test.mjs tests/gestao/admin-agenda.test.mjs
git commit -m "feat: add admin availability management"
```

---

### Task 6: Controle mensal da colaboradora e vínculo de reserva pública

**Files:**
- Create: `gestao/js/colaborador-schedule.js`
- Modify: `gestao/colaborador/index.html`
- Modify: `gestao/js/colaborador-agenda.js`
- Test: `tests/gestao/colaborador-schedule.test.mjs`
- Modify: `tests/gestao/colaborador-agenda.test.mjs`

**Interfaces:**
- Consumes: `schedule-api.js`, `schedule-calendar.js`, `profile.user_id`, `listClients` já disponível.
- Produces: `initCollaboratorSchedule({client, profile, root}) -> Promise<{refresh(): Promise<void>}>`.

- [ ] **Step 1: Write failing collaborator tests**

Provar:

- o módulo usa sempre `profile.user_id` como alvo da própria agenda;
- calendário navega meses futuros;
- colaboradora cria bloqueio/inativação só da própria agenda;
- reserva `site` sem cliente mostra `Cadastro pendente`;
- `Abrir atendimento`/form clínico fica bloqueado até vínculo;
- ação `Vincular cliente` usa seleção explícita da base de clientes e chama `bc_agendamento_link_cliente`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/gestao/colaborador-schedule.test.mjs tests/gestao/colaborador-agenda.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add collaborator schedule markup**

Dentro de `#agenda`, adicionar `Minha disponibilidade` com o mesmo calendário, sem seletor de outra profissional.

- [ ] **Step 4: Implement `initCollaboratorSchedule`**

Derivar sempre o alvo de `profile.user_id`; o backend continua sendo a autoridade e recusa tentativa forjada.

- [ ] **Step 5: Update collaborator appointment rendering/detail**

Fallback do nome: `clientes?.nome || public_booking_name || 'Cliente'`.

Para site sem vínculo:

- mostrar telefone do snapshot;
- mostrar chips `Site` e `Cadastro pendente`;
- esconder/desabilitar histórico e registro clínico dependentes de `cliente_id`;
- oferecer `Vincular cliente`.

- [ ] **Step 6: After linking, refresh clients/agenda/detail**

O card passa a usar cadastro oficial, mantendo snapshot apenas como histórico no banco.

- [ ] **Step 7: Run tests**

Run: `node --test tests/gestao/colaborador-schedule.test.mjs tests/gestao/colaborador-agenda.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add gestao/js/colaborador-schedule.js gestao/colaborador/index.html gestao/js/colaborador-agenda.js tests/gestao/colaborador-schedule.test.mjs tests/gestao/colaborador-agenda.test.mjs
git commit -m "feat: add collaborator availability controls"
```

---

### Task 7: Edge Function pública sanitizada

**Files:**
- Create: `supabase/functions/public-agenda/index.ts`
- Create: `supabase/functions/public-agenda/validation.ts`
- Create: `supabase/functions/public-agenda/domain.js`
- Test: `tests/site/public-agenda-domain.test.mjs`

**Interfaces:**
- Consumes: service-role-only `bc_public_agenda_*` RPCs da Task 2.
- Produces HTTP `POST` JSON actions:
  - `{action:'catalog'}` -> `{procedures:[{id,name,durationMinutes}]}`
  - `{action:'professionals', procedureId}` -> `{professionals:[{id,name}]}`
  - `{action:'month', procedureId, professionalId}` -> `{month:'YYYY-MM', days:[{date,available,state}]}`
  - `{action:'slots', procedureId, professionalId, date}` -> `{slots:['HH:MM']}`
  - `{action:'book', procedureId, professionalId, date, time, name, phone, website:''}` -> `{booking:{id,procedureName,professionalName,date,time}}`.

- [ ] **Step 1: Write failing pure-domain tests**

Testar:

- normalização de telefone para dígitos e rejeição de entradas implausíveis;
- honeypot `website` preenchido rejeita;
- ação desconhecida rejeita;
- `month`/`date` em formato inválido rejeitam;
- nome com menos de 2 caracteres rejeita;
- DTO sanitizado descarta qualquer chave como `cliente_id`, `internal_note`, `reason`, `observacao_administrativa`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/site/public-agenda-domain.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement `domain.js` and `validation.ts`**

Manter helpers puros sem dependência de Deno quando possível; `validation.ts` compõe esses helpers para a runtime da função.

- [ ] **Step 4: Implement `index.ts` as a deliberately public endpoint**

Seguir CORS do projeto e a documentação atual do Supabase:

- função implantada com `verify_jwt=false`;
- permitir produção GitHub Pages e localhost de desenvolvimento;
- `OPTIONS` 204;
- somente `POST`;
- `Cache-Control: no-store` para book/slots;
- segredo de banco vem de `SUPABASE_SECRET_KEYS['default']` no ambiente da Edge Function; não usar secret no browser;
- criar client admin somente dentro da função;
- nunca devolver erro SQL bruto.

Se o projeto ainda não tiver secret key nova configurada, criar/configurar uma secret key de backend antes do deploy; não introduzir nova dependência em legacy `service_role` para esta função.

- [ ] **Step 5: Define browser key semantics correctly**

A função é pública por desenho e sua segurança vem de validação + rate limit + superfície RPC mínima. Se o frontend enviar `BC_GESTAO_PUBLISHABLE_KEY`, enviar em `apikey`; não tratá-la como segredo nem como autorização do usuário, e nunca colocá-la em `Authorization: Bearer`.

- [ ] **Step 6: Implement network-hash rate-limit input**

Derivar hash de `x-forwarded-for` + secret `PUBLIC_AGENDA_RATE_LIMIT_SALT`; não persistir IP bruto; passar somente o hash ao RPC de booking.

- [ ] **Step 7: Map stable domain errors to public copy**

`slot_unavailable` -> 409 com `Esse horário acabou de ser reservado. Escolha outro horário disponível.`

Rate limit -> 429 com `Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.`

Demais falhas -> mensagem genérica + WhatsApp.

- [ ] **Step 8: Run tests**

Run: `node --test tests/site/public-agenda-domain.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/public-agenda tests/site/public-agenda-domain.test.mjs
git commit -m "feat: add public agenda edge function"
```

---

### Task 8: Página pública `/agenda/`

**Files:**
- Create: `assets/js/bc-public-config.js`
- Create: `agenda/index.html`
- Create: `agenda/agenda.css`
- Create: `agenda/js/api.js`
- Create: `agenda/js/calendar.js`
- Create: `agenda/js/main.js`
- Test: `tests/site/public-agenda-page.test.mjs`

**Interfaces:**
- Consumes: HTTP contract da Task 7.
- Produces: experiência pública completa e `initPublicAgenda({root=document, api=createPublicAgendaApi(...)})`.

- [ ] **Step 1: Write failing page-contract tests**

Fixar:

- rota contém `Procedimento`, `Profissional`, calendário, horários, Nome, WhatsApp e confirmação;
- não contém CPF/data de nascimento;
- calendário não possui botão de avançar mês;
- CTA de outro mês aponta ao WhatsApp;
- cancelamento/remarcação só orienta contato com a BC;
- sucesso inclui procedimento, profissional, data e hora;
- assets são relativos e compatíveis com GitHub Pages subpath.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/site/public-agenda-page.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement `bc-public-config.js`**

Exportar somente valores públicos necessários:

- `BC_WHATSAPP_NUMBER` centralizado;
- `PUBLIC_AGENDA_FUNCTION_URL`;
- `BC_GESTAO_PUBLISHABLE_KEY` somente se a chamada optar por enviar header `apikey`.

Nunca incluir secret/service key.

- [ ] **Step 4: Implement `agenda/js/api.js`**

Um único `post(actionPayload)` com tratamento de 409/429/5xx e funções `getCatalog`, `getProfessionals`, `getMonth`, `getSlots`, `book`. Se houver publishable key configurada, enviar como `apikey`, sem header Bearer.

- [ ] **Step 5: Implement current-month calendar**

`calendar.js` recebe `YYYY-MM` retornado pelo backend e desenha do dia 1 ao último dia; dias passados visíveis/desabilitados; apenas datas com `available=true` clicáveis; sem navegação de mês.

- [ ] **Step 6: Implement `main.js` state machine**

Sequência obrigatória:

`procedimento → profissional → data → slot → nome + WhatsApp → confirmar`.

Ao trocar procedimento, limpar profissional/data/slot. Ao trocar profissional, limpar data/slot. Antes de POST de booking, desabilitar submit contra duplo clique.

- [ ] **Step 7: Implement success + WhatsApp**

Só abrir WhatsApp depois de resposta 2xx confirmando commit. Mensagem inclui nome, procedimento, profissional, data e horário. Exibir também botão manual de WhatsApp se o navegador bloquear abertura automática.

- [ ] **Step 8: Run page tests**

Run: `node --test tests/site/public-agenda-page.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add assets/js/bc-public-config.js agenda tests/site/public-agenda-page.test.mjs
git commit -m "feat: add public booking calendar"
```

---

### Task 9: Widget da Home e atualização dos CTAs

**Files:**
- Create: `home-agenda.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/site/home.test.mjs`

**Interfaces:**
- Consumes: `bc-public-config.js` e ações `catalog`, `professionals`, `month`, `slots` da Edge Function.
- Produces: widget compacto com próximos horários do mês atual e link `/agenda/`.

- [ ] **Step 1: Write failing Home tests**

Provar:

- header CTA `Agendar` aponta para `agenda/`;
- demais CTAs institucionais `Agendar agora` relevantes apontam para `agenda/`;
- Home contém widget `Agenda BC Estética`;
- widget não contém nomes/horários ocupados ou dados de terceiros;
- CTA `Ver calendário completo` aponta para `agenda/`;
- CTA de data futura abre WhatsApp.

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/site/home.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add compact widget markup and styles**

Mobile-first, sem transformar a Home em tela administrativa. Limitar a poucos horários livres e sempre oferecer `/agenda/` para o fluxo completo.

- [ ] **Step 4: Implement `home-agenda.js`**

Carregar catálogo/profissionais sob interação do usuário; não fazer leitura de agenda privada. Reusar o mesmo endpoint público.

- [ ] **Step 5: Replace public booking CTAs**

Trocar `agendamento/` por `agenda/` somente nos CTAs de marcação de horário. Links explícitos de pré-anamnese, caso existam, permanecem em `/agendamento/`.

- [ ] **Step 6: Run site tests**

Run: `npm run test:site`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css home-agenda.js tests/site/home.test.mjs
git commit -m "feat: connect site to public agenda"
```

---

### Task 10: Verificação de banco, concorrência, segurança e rollout

**Files:**
- Create: `docs/bc-gestao/public-agenda-verification.md`
- Modify if needed: tests from Tasks 1–9 only when verification reveals a real gap.

**Interfaces:**
- Consumes: implementação completa.
- Produces: evidência de homologação e checklist de ativação.

- [ ] **Step 1: Run repository test suites**

Run:

```bash
npm run test:gestao
npm run test:site
npm test
```

Expected: todas verdes.

- [ ] **Step 2: Verify Supabase CLI version and commands before DB work**

Run:

```bash
supabase --version
supabase db --help
supabase migration --help
supabase functions --help
```

Não adivinhar flags.

- [ ] **Step 3: Apply migrations only to a controlled environment**

Usar projeto/branch de homologação quando disponível. Não criar dados reais. Validar migration list após aplicação.

- [ ] **Step 4: Run database advisors**

Executar advisors de segurança e performance. Corrigir qualquer finding de `anon`/`authenticated` executando `SECURITY DEFINER` indevido, grant amplo ou índice claramente ausente antes de avançar.

- [ ] **Step 5: Prove internal authorization with fictitious identities**

Casos:

- admin altera agenda de profissional fictícia;
- colaboradora altera a própria;
- colaboradora recebe 42501 ao tentar outra profissional;
- usuário não autenticado não executa RPC interno.

- [ ] **Step 6: Prove internal special-slot compatibility**

Em dia sem `professional_availability_days`, um encaixe interno fictício sem conflito/block/inativação deve poder ser criado. O mesmo dia deve continuar sem vagas no site público até a equipe publicar disponibilidade.

- [ ] **Step 7: Prove public privacy contract**

Inspecionar respostas `catalog/professionals/month/slots/book` e afirmar ausência de `cliente_id`, telefone de terceiros, observações, `reason`, `internal_note`, prontuário e financeiro.

- [ ] **Step 8: Prove Review Focus #1 — timezone/month rollover**

Com clock controlado/test data, validar último instante de um mês e primeiro instante do mês seguinte em `America/Sao_Paulo`; o backend rejeita mês que não seja o corrente.

- [ ] **Step 9: Prove Review Focus #2 — legacy `fim = null`**

Criar compromisso fictício legado com `fim=null` e procedimento com duração; tentativa sobreposta deve falhar pelo intervalo derivado.

- [ ] **Step 10: Prove Review Focus #3 — public booking without client**

Criar reserva fictícia `origem=site`; confirmar que aparece na agenda e que tentativa de abrir atendimento formal falha até `bc_agendamento_link_cliente` vincular uma cliente fictícia.

- [ ] **Step 11: Prove Review Focus #4 — concurrency**

Disparar duas transações concorrentes para o mesmo `professional + slot`, incluindo cenário uma pública e uma interna. Assertar exatamente um agendamento ativo sobre o intervalo e erro `slot_unavailable`/conflito estável na perdedora.

- [ ] **Step 12: Prove Review Focus #5 — open-ended inactivation**

Criar inativação fictícia com `planned_ends_on=null` sobre período que contenha agendamento já existente. Confirmar que novas vagas somem, o compromisso existente permanece e o retorno interno informa `affected_appointments >= 1`.

- [ ] **Step 13: Verify Edge Function deployment/auth model**

Antes de deploy, confirmar pela CLI atual como aplicar `verify_jwt=false`. Confirmar `SUPABASE_SECRET_KEYS` disponível no ambiente da função e que nenhum secret foi commitado. Testar CORS de produção/localhost, OPTIONS, 405, payload inválido 422, conflito 409, rate limit 429 e falha genérica sem SQL bruto.

- [ ] **Step 14: Fill `public-agenda-verification.md`**

Registrar comandos, ambiente, resultados, advisors, checks de segurança e decisão `GO/NO-GO`. Não registrar secrets, IPs, dados reais ou chaves privadas.

- [ ] **Step 15: Activate in safe order**

1. migrations;
2. telas internas de disponibilidade;
3. preencher disponibilidade real manualmente pela equipe;
4. Edge Function pública;
5. `/agenda/`;
6. somente depois trocar CTAs da Home;
7. observar erros/logs nas primeiras reservas.

- [ ] **Step 16: Commit verification evidence**

```bash
git add docs/bc-gestao/public-agenda-verification.md
git commit -m "docs: verify public agenda rollout"
```

---

## Self-Review Notes

### Spec coverage

- Agenda única, mês público atual, profissional escolhida, sem sugestão automática: Tasks 2, 7, 8.
- Duração, grade 15 min e mesmo dia sem antecedência mínima: Task 2.
- Nome + WhatsApp e WhatsApp pós-confirmação: Tasks 7–8.
- Meses futuros internos: Tasks 4–6.
- Bloqueios, bulk apply e inativação com motivos privados: Tasks 1–6.
- Reserva `site` sem auto-vínculo clínico: Tasks 1–3, 6.
- Proteção contra dupla reserva: Tasks 2 e 10.
- Encaixe interno sem exigir publicação pública do dia: Tasks 2 e 10.
- Segurança/RLS/Edge Function sanitizada: Tasks 1–2, 7, 10.
- Home + `/agenda/`: Tasks 8–9.
- Preservação de `/agendamento/` e `/admin/` legado: Global Constraints + Task 9.
- Testes/rollout sem dados reais: Task 10.

### Type/interface consistency

- `professionalUserId` é o nome frontend; RPCs usam `p_professional_user_id`.
- Mês civil trafega como `YYYY-MM`; datas civis como `YYYY-MM-DD`; horários públicos como `HH:MM`; timestamps internos como ISO/timestamptz.
- `linkPublicAppointment()` sempre recebe `appointmentId + clienteId`; não recebe nome/telefone para decidir identidade.
- `bc_public_agenda_book` é o único write público e é chamado apenas pela Edge Function com credencial secreta de backend.
- O lock/checagem de sobreposição é compartilhado; a validação de janela pública é um gate adicional exclusivo da reserva pública.

### Proportion / YAGNI

- Não incluir pagamento online, lista de espera, Google Calendar, cancelamento/remarcação pública, recorrência semanal infinita ou escolha `qualquer profissional` nesta fase.
- Não criar segunda tabela de autorização de procedimento; reutilizar `procedure_professional_permissions`.
- Não criar segunda agenda nem sincronização entre agendas.
