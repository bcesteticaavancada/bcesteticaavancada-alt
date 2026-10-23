import {
  getScheduleMonth,
  upsertAvailabilityDay,
  createScheduleBlock,
  deleteScheduleBlock,
  createAgendaInactivation,
  reactivateAgenda,
} from './schedule-api.js';
import { renderScheduleCalendar, monthLabel, shiftMonth } from './schedule-calendar.js';
import { clinicLocalDateTimeToIso } from './agenda-format.js';

const CLINIC_TIME_ZONE = 'America/Sao_Paulo';
const REASONS = [
  ['ferias', 'Férias'],
  ['motivos_pessoais', 'Motivos pessoais'],
  ['motivo_medico', 'Motivo médico'],
  ['licenca_afastamento', 'Licença / afastamento'],
  ['curso_capacitacao', 'Curso / capacitação'],
  ['viagem', 'Viagem'],
  ['folga', 'Folga'],
  ['outro', 'Outro'],
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function currentClinicMonth(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}`;
}

function monthStartDate(month) {
  return `${month}-01`;
}

function timeForInput(value) {
  return value ? String(value).slice(0, 5) : '';
}

function dateTimeForInput(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function setMessage(element, message, kind = '') {
  if (!element) return;
  element.textContent = message ?? '';
  element.dataset.kind = kind;
}

function ensureStyles(root) {
  const doc = root?.nodeType === 9 ? root : root?.ownerDocument;
  if (!doc?.head || doc.querySelector?.('link[data-bc-schedule-calendar]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = '../assets/schedule-calendar.css';
  link.dataset.bcScheduleCalendar = 'true';
  doc.head.append(link);
}

export function ownScheduleProfessionalId(profile) {
  const id = String(profile?.user_id ?? '').trim();
  if (!id) throw new Error('Profissional inválida para controlar a própria agenda.');
  return id;
}

export function renderCollaboratorSchedulePanel() {
  return `<section id="collaboratorScheduleRoot" class="bcg-subpanel bcg-schedule-admin" aria-labelledby="collaboratorScheduleTitle">
    <div class="bcg-section-head"><div><p class="bcg-eyebrow">MINHA DISPONIBILIDADE</p><h3 id="collaboratorScheduleTitle">Calendário mensal</h3><p>Você controla somente sua própria disponibilidade. Horários internos especiais continuam sujeitos a conflitos, bloqueios e inativações.</p></div></div>
    <p id="collaboratorScheduleStatus" class="bcg-status" role="status" aria-live="polite"></p>
    <div class="bcg-schedule-month-toolbar"><button type="button" class="bcg-small-button" data-collaborator-schedule-action="previous-month">← Mês anterior</button><strong id="collaboratorScheduleMonthLabel"></strong><button type="button" class="bcg-small-button" data-collaborator-schedule-action="next-month">Próximo mês →</button></div>
    <div id="collaboratorScheduleCalendar"></div>
    <div class="schedule-calendar__legend"><span><i class="schedule-calendar__dot" data-state="enabled"></i>Disponível ao site</span><span><i class="schedule-calendar__dot" data-state="blocked"></i>Bloqueio</span><span><i class="schedule-calendar__dot" data-state="inactive"></i>Inativa</span><span><i class="schedule-calendar__dot" data-state="appointments"></i>Compromissos</span></div>
    <div class="bcg-subgrid bcg-schedule-editor-grid">
      <article class="bcg-editor-card"><p class="bcg-eyebrow">DIA SELECIONADO</p><form id="collaboratorScheduleDayForm" class="bcg-form"><label>Data<input id="collaboratorScheduleDayDate" class="bcg-input" type="date" required></label><label class="bcg-check-row"><input id="collaboratorScheduleDayEnabled" type="checkbox"> Disponível para agendamento no site</label><div class="bcg-inline-filters"><label>Início<input id="collaboratorScheduleDayStart" class="bcg-input" type="time"></label><label>Fim<input id="collaboratorScheduleDayEnd" class="bcg-input" type="time"></label></div><button class="bcg-button" type="submit">Salvar este dia</button></form></article>
      <article class="bcg-editor-card"><p class="bcg-eyebrow">BLOQUEIO</p><form id="collaboratorScheduleBlockForm" class="bcg-form"><label>Início<input id="collaboratorScheduleBlockStart" class="bcg-input" type="datetime-local" required></label><label>Fim<input id="collaboratorScheduleBlockEnd" class="bcg-input" type="datetime-local" required></label><label>Tipo<select id="collaboratorScheduleBlockType" class="bcg-input" required><option value="compromisso">Compromisso pessoal</option><option value="almoco">Almoço</option><option value="reuniao">Reunião</option><option value="preparacao_manutencao">Preparação / manutenção</option><option value="outro">Outro</option></select></label><label>Observação interna <span class="bcg-optional">opcional</span><textarea id="collaboratorScheduleBlockNote" class="bcg-input bcg-textarea" rows="2"></textarea></label><button class="bcg-button" type="submit">Criar bloqueio</button><p class="bcg-muted">Bloqueios preservam atendimentos já existentes.</p></form><div id="collaboratorScheduleBlocks"></div></article>
      <article class="bcg-editor-card"><p class="bcg-eyebrow">INATIVAR MINHA AGENDA</p><form id="collaboratorScheduleInactivationForm" class="bcg-form"><label>Início<input id="collaboratorScheduleInactiveStart" class="bcg-input" type="date" required></label><label>Fim planejado <span class="bcg-optional">opcional</span><input id="collaboratorScheduleInactiveEnd" class="bcg-input" type="date"></label><label>Motivo<select id="collaboratorScheduleInactiveReason" class="bcg-input" required>${REASONS.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label>Observação interna <span class="bcg-optional">opcional</span><textarea id="collaboratorScheduleInactiveNote" class="bcg-input bcg-textarea" rows="2"></textarea></label><button class="bcg-button" type="submit">Inativar agenda</button></form><p class="bcg-muted">Quando necessário, use “Reativar agenda agora” na inativação ativa.</p><div id="collaboratorScheduleInactivations"></div></article>
    </div>
  </section>`;
}

function renderBlocks(blocks = []) {
  if (!blocks.length) return '<div class="bcg-empty">Nenhum bloqueio neste mês.</div>';
  return `<div class="bcg-compact-list">${blocks.map((block) => `<div><strong>${escapeHtml(dateTimeForInput(block.starts_at).replace('T',' '))} → ${escapeHtml(dateTimeForInput(block.ends_at).replace('T',' '))}</strong><br><span>${escapeHtml(block.block_type || 'bloqueio')}${block.internal_note ? ` • ${escapeHtml(block.internal_note)}` : ''}</span><br><button type="button" class="bcg-small-button" data-collaborator-delete-schedule-block="${escapeHtml(block.id)}">Remover bloqueio</button></div>`).join('')}</div>`;
}

function renderInactivations(items = []) {
  const active = items.filter((item) => !item.reactivated_at);
  if (!active.length) return '<div class="bcg-empty">Sua agenda está ativa neste mês.</div>';
  return `<div class="bcg-compact-list">${active.map((item) => `<div><strong>${escapeHtml(item.starts_on)}${item.planned_ends_on ? ` → ${escapeHtml(item.planned_ends_on)}` : ' → sem data final'}</strong><br><span>${escapeHtml(REASONS.find(([value]) => value === item.reason)?.[1] || item.reason || 'Motivo interno')}${item.internal_note ? ` • ${escapeHtml(item.internal_note)}` : ''}</span><br><button type="button" class="bcg-small-button" data-collaborator-reactivate-schedule="${escapeHtml(item.id)}">Reativar agenda agora</button></div>`).join('')}</div>`;
}

export async function initCollaboratorSchedule({ client, profile, root = document, areaId = 'agenda' }) {
  if (!client || !root?.getElementById) throw new Error('Contexto da disponibilidade da colaboradora inválido.');
  const professionalUserId = ownScheduleProfessionalId(profile);
  const agendaRoot = root.getElementById(areaId);
  if (!agendaRoot) throw new Error('Área de agenda da colaboradora não encontrada.');
  ensureStyles(root);
  if (!root.getElementById('collaboratorScheduleRoot')) agendaRoot.insertAdjacentHTML('beforeend', `<div class="bcg-divider"></div>${renderCollaboratorSchedulePanel()}`);

  const el = (id) => root.getElementById(id);
  const calendar = el('collaboratorScheduleCalendar');
  const status = el('collaboratorScheduleStatus');
  const dayForm = el('collaboratorScheduleDayForm');
  const blockForm = el('collaboratorScheduleBlockForm');
  const inactivationForm = el('collaboratorScheduleInactivationForm');
  let month = currentClinicMonth();
  let selectedDate = `${month}-01`;
  let state = { days: [], blocks: [], inactivations: [] };

  function selectedAvailability() {
    return state.days?.find((item) => String(item.local_date).slice(0, 10) === selectedDate) ?? null;
  }

  function syncDayForm() {
    const item = selectedAvailability();
    el('collaboratorScheduleDayDate').value = selectedDate;
    el('collaboratorScheduleDayEnabled').checked = item?.enabled === true;
    el('collaboratorScheduleDayStart').value = timeForInput(item?.start_time);
    el('collaboratorScheduleDayEnd').value = timeForInput(item?.end_time);
  }

  function render() {
    el('collaboratorScheduleMonthLabel').textContent = monthLabel(month);
    calendar.innerHTML = renderScheduleCalendar({ month, state, selectedDate });
    el('collaboratorScheduleBlocks').innerHTML = renderBlocks(state.blocks ?? []);
    el('collaboratorScheduleInactivations').innerHTML = renderInactivations(state.inactivations ?? []);
    syncDayForm();
  }

  async function refresh() {
    setMessage(status, 'Carregando sua disponibilidade…');
    try {
      state = await getScheduleMonth({ client, professionalUserId, month: monthStartDate(month) }) || {};
      state.days ??= [];
      state.blocks ??= [];
      state.inactivations ??= [];
      render();
      setMessage(status, 'Disponibilidade atualizada.', 'success');
      return state;
    } catch (error) {
      setMessage(status, error?.message || 'Não foi possível carregar sua disponibilidade.', 'error');
      throw error;
    }
  }

  await refresh();

  el('collaboratorScheduleRoot').addEventListener('click', async (event) => {
    const dayButton = event.target.closest?.('[data-date]');
    if (dayButton?.dataset?.date) {
      selectedDate = dayButton.dataset.date;
      render();
      return;
    }
    const actionButton = event.target.closest?.('[data-collaborator-schedule-action]');
    if (actionButton) {
      month = shiftMonth(month, actionButton.dataset.collaboratorScheduleAction === 'previous-month' ? -1 : 1);
      selectedDate = `${month}-01`;
      await refresh();
      return;
    }
    const deleteButton = event.target.closest?.('[data-collaborator-delete-schedule-block]');
    if (deleteButton) {
      deleteButton.disabled = true;
      try { await deleteScheduleBlock({ client, blockId: deleteButton.dataset.collaboratorDeleteScheduleBlock }); await refresh(); }
      catch (error) { setMessage(status, error?.message || 'Não foi possível remover o bloqueio.', 'error'); deleteButton.disabled = false; }
      return;
    }
    const reactivateButton = event.target.closest?.('[data-collaborator-reactivate-schedule]');
    if (reactivateButton) {
      reactivateButton.disabled = true;
      try { await reactivateAgenda({ client, inactivationId: reactivateButton.dataset.collaboratorReactivateSchedule }); await refresh(); setMessage(status, 'Sua agenda foi reativada.', 'success'); }
      catch (error) { setMessage(status, error?.message || 'Não foi possível reativar sua agenda.', 'error'); reactivateButton.disabled = false; }
    }
  });

  calendar.addEventListener('click', async (event) => {
    const navigation = event.target.closest?.('[data-action]');
    if (!navigation) return;
    month = shiftMonth(month, navigation.dataset.action === 'previous-month' ? -1 : 1);
    selectedDate = `${month}-01`;
    await refresh();
  });

  dayForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = dayForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      selectedDate = el('collaboratorScheduleDayDate').value;
      const enabled = el('collaboratorScheduleDayEnabled').checked;
      await upsertAvailabilityDay({ client, professionalUserId, localDate: selectedDate, enabled, startTime: enabled ? el('collaboratorScheduleDayStart').value : null, endTime: enabled ? el('collaboratorScheduleDayEnd').value : null });
      await refresh();
      setMessage(status, 'Dia salvo.', 'success');
    } catch (error) { setMessage(status, error?.message || 'Não foi possível salvar o dia.', 'error'); }
    finally { submit.disabled = false; }
  });

  blockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = blockForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await createScheduleBlock({ client, professionalUserId, startsAt: clinicLocalDateTimeToIso(el('collaboratorScheduleBlockStart').value), endsAt: clinicLocalDateTimeToIso(el('collaboratorScheduleBlockEnd').value), blockType: el('collaboratorScheduleBlockType').value, internalNote: el('collaboratorScheduleBlockNote').value });
      blockForm.reset();
      el('collaboratorScheduleBlockType').value = 'compromisso';
      await refresh();
      setMessage(status, 'Bloqueio criado. Se houver atendimentos já marcados no período, revise-os com a equipe: eles foram preservados.', 'warning');
    } catch (error) { setMessage(status, error?.message || 'Não foi possível criar o bloqueio.', 'error'); }
    finally { submit.disabled = false; }
  });

  inactivationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = inactivationForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await createAgendaInactivation({ client, professionalUserId, startsOn: el('collaboratorScheduleInactiveStart').value, plannedEndsOn: el('collaboratorScheduleInactiveEnd').value || null, reason: el('collaboratorScheduleInactiveReason').value, internalNote: el('collaboratorScheduleInactiveNote').value });
      inactivationForm.reset();
      await refresh();
      const affected = Number(result?.affected_appointments ?? 0);
      setMessage(status, affected > 0 ? `Agenda inativada. ${affected} atendimento(s) já existente(s) foram preservados e precisam ser revisados.` : 'Agenda inativada. Nenhum atendimento existente foi alterado.', affected > 0 ? 'warning' : 'success');
    } catch (error) { setMessage(status, error?.message || 'Não foi possível inativar sua agenda.', 'error'); }
    finally { submit.disabled = false; }
  });

  return { refresh, getMonth: () => month, professionalUserId };
}
