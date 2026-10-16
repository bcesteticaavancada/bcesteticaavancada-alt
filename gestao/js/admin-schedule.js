import {
  getScheduleMonth,
  upsertAvailabilityDay,
  applyAvailabilityDays,
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

function parseMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month ?? ''));
  if (!match) throw new Error('Mês inválido.');
  return { year: Number(match[1]), month: Number(match[2]) };
}

function daysInMonth(month) {
  const parsed = parseMonth(month);
  return new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
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

function monthStartDate(month) {
  return `${month}-01`;
}

function normalizeStaff(staff = []) {
  const seen = new Set();
  return (Array.isArray(staff) ? staff : []).filter((item) => {
    const id = String(item?.user_id ?? '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function monthDatesByWeekdays(month, weekdays = []) {
  const wanted = new Set((Array.isArray(weekdays) ? weekdays : []).map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6));
  if (!wanted.size) return [];
  const { year, month: monthNumber } = parseMonth(month);
  const total = daysInMonth(month);
  const output = [];
  for (let day = 1; day <= total; day += 1) {
    const weekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay();
    if (wanted.has(weekday)) output.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  return output;
}

export function copyAvailabilityToMonth(targetMonth, sourceDays = []) {
  const maxDay = daysInMonth(targetMonth);
  return (Array.isArray(sourceDays) ? sourceDays : [])
    .map((item) => {
      const match = /-(\d{2})$/.exec(String(item?.local_date ?? '').slice(0, 10));
      if (!match) return null;
      const day = Number(match[1]);
      if (day < 1 || day > maxDay) return null;
      return {
        localDate: `${targetMonth}-${String(day).padStart(2, '0')}`,
        enabled: item.enabled === true,
        startTime: item.start_time ?? null,
        endTime: item.end_time ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
}

export function renderAdminSchedulePanel() {
  const weekdayLabels = [['0','Dom'],['1','Seg'],['2','Ter'],['3','Qua'],['4','Qui'],['5','Sex'],['6','Sáb']];
  return `<section id="adminScheduleRoot" class="bcg-subpanel bcg-schedule-admin" aria-labelledby="adminScheduleTitle">
    <div class="bcg-section-head"><div><p class="bcg-eyebrow">DISPONIBILIDADE DA EQUIPE</p><h3 id="adminScheduleTitle">Agenda mensal</h3><p>Defina o que aparece livre no site. Agendamentos internos continuam possíveis fora da janela pública quando não houver conflito, bloqueio ou inativação.</p></div><label class="bcg-field bcg-field-compact">Profissional<select id="adminScheduleProfessional" class="bcg-input"></select></label></div>
    <p id="adminScheduleStatus" class="bcg-status" role="status" aria-live="polite"></p>
    <div class="bcg-schedule-month-toolbar"><button type="button" class="bcg-small-button" data-admin-schedule-action="previous-month">← Mês anterior</button><strong id="adminScheduleMonthLabel"></strong><button type="button" class="bcg-small-button" data-admin-schedule-action="next-month">Próximo mês →</button></div>
    <div id="adminScheduleCalendar"></div>
    <div class="schedule-calendar__legend"><span><i class="schedule-calendar__dot" data-state="enabled"></i>Disponível ao site</span><span><i class="schedule-calendar__dot" data-state="blocked"></i>Bloqueio</span><span><i class="schedule-calendar__dot" data-state="inactive"></i>Inativa</span><span><i class="schedule-calendar__dot" data-state="appointments"></i>Compromissos</span></div>
    <div class="bcg-subgrid bcg-schedule-editor-grid">
      <article class="bcg-editor-card"><p class="bcg-eyebrow">DIA SELECIONADO</p><form id="adminScheduleDayForm" class="bcg-form"><label>Data<input id="adminScheduleDayDate" class="bcg-input" type="date" required></label><label class="bcg-check-row"><input id="adminScheduleDayEnabled" type="checkbox"> Disponível para agendamento no site</label><div class="bcg-inline-filters"><label>Início<input id="adminScheduleDayStart" class="bcg-input" type="time"></label><label>Fim<input id="adminScheduleDayEnd" class="bcg-input" type="time"></label></div><button class="bcg-button" type="submit">Salvar este dia</button></form></article>
      <article class="bcg-editor-card"><p class="bcg-eyebrow">APLICAR EM LOTE</p><form id="adminScheduleBulkForm" class="bcg-form"><label>Datas específicas <span class="bcg-optional">separe por vírgula</span><textarea id="adminScheduleBulkDates" class="bcg-input bcg-textarea" rows="2" placeholder="2026-10-05, 2026-10-06"></textarea></label><div class="bcg-weekday-checks">${weekdayLabels.map(([value,label]) => `<label><input type="checkbox" name="adminScheduleWeekday" value="${value}"> ${label}</label>`).join('')}</div><label class="bcg-check-row"><input id="adminScheduleBulkEnabled" type="checkbox" checked> Disponível no site</label><div class="bcg-inline-filters"><label>Início<input id="adminScheduleBulkStart" class="bcg-input" type="time" value="09:00"></label><label>Fim<input id="adminScheduleBulkEnd" class="bcg-input" type="time" value="18:00"></label></div><div class="bcg-form-actions"><button class="bcg-small-button" type="submit">Aplicar nas datas</button><button class="bcg-small-button" type="button" data-admin-schedule-action="apply-weekdays">Aplicar nos dias da semana</button><button class="bcg-small-button" type="button" data-admin-schedule-action="copy-previous-month">Copiar mês anterior</button></div></form></article>
      <article class="bcg-editor-card"><p class="bcg-eyebrow">BLOQUEIO</p><form id="adminScheduleBlockForm" class="bcg-form"><label>Início<input id="adminScheduleBlockStart" class="bcg-input" type="datetime-local" required></label><label>Fim<input id="adminScheduleBlockEnd" class="bcg-input" type="datetime-local" required></label><label>Tipo<select id="adminScheduleBlockType" class="bcg-input" required><option value="compromisso">Compromisso pessoal</option><option value="almoco">Almoço</option><option value="reuniao">Reunião</option><option value="preparacao_manutencao">Preparação / manutenção</option><option value="outro">Outro</option></select></label><label>Observação interna <span class="bcg-optional">opcional</span><textarea id="adminScheduleBlockNote" class="bcg-input bcg-textarea" rows="2"></textarea></label><button class="bcg-button" type="submit">Criar bloqueio</button><p class="bcg-muted">Bloquear um período não cancela nem move atendimentos já existentes.</p></form><div id="adminScheduleBlocks"></div></article>
      <article class="bcg-editor-card"><p class="bcg-eyebrow">INATIVAR AGENDA</p><form id="adminScheduleInactivationForm" class="bcg-form"><label>Início<input id="adminScheduleInactiveStart" class="bcg-input" type="date" required></label><label>Fim planejado <span class="bcg-optional">opcional</span><input id="adminScheduleInactiveEnd" class="bcg-input" type="date"></label><label>Motivo<select id="adminScheduleInactiveReason" class="bcg-input" required>${REASONS.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label>Observação interna <span class="bcg-optional">opcional</span><textarea id="adminScheduleInactiveNote" class="bcg-input bcg-textarea" rows="2"></textarea></label><button class="bcg-button" type="submit">Inativar agenda</button></form><div id="adminScheduleInactivations"></div></article>
    </div>
  </section>`;
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

function setMessage(element, message, kind = '') {
  if (!element) return;
  element.textContent = message ?? '';
  element.dataset.kind = kind;
}

function renderStaffOptions(staff, selected) {
  return normalizeStaff(staff).map((item) => `<option value="${escapeHtml(item.user_id)}"${String(item.user_id) === String(selected) ? ' selected' : ''}>${escapeHtml(item.display_name || 'Profissional')}</option>`).join('');
}

function parseBulkDates(value, month) {
  const unique = new Set(String(value ?? '').split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean));
  return [...unique].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(`${month}-`));
}

function renderBlocks(blocks = []) {
  if (!blocks.length) return '<div class="bcg-empty">Nenhum bloqueio neste mês.</div>';
  return `<div class="bcg-compact-list">${blocks.map((block) => `<div><strong>${escapeHtml(dateTimeForInput(block.starts_at).replace('T',' '))} → ${escapeHtml(dateTimeForInput(block.ends_at).replace('T',' '))}</strong><br><span>${escapeHtml(block.block_type || 'bloqueio')}${block.internal_note ? ` • ${escapeHtml(block.internal_note)}` : ''}</span><br><button type="button" class="bcg-small-button" data-delete-schedule-block="${escapeHtml(block.id)}">Remover bloqueio</button></div>`).join('')}</div>`;
}

function renderInactivations(items = []) {
  const active = items.filter((item) => !item.reactivated_at);
  if (!active.length) return '<div class="bcg-empty">Agenda ativa neste mês.</div>';
  return `<div class="bcg-compact-list">${active.map((item) => `<div><strong>${escapeHtml(item.starts_on)}${item.planned_ends_on ? ` → ${escapeHtml(item.planned_ends_on)}` : ' → sem data final'}</strong><br><span>${escapeHtml(REASONS.find(([value]) => value === item.reason)?.[1] || item.reason || 'Motivo interno')}${item.internal_note ? ` • ${escapeHtml(item.internal_note)}` : ''}</span><br><button type="button" class="bcg-small-button" data-reactivate-schedule="${escapeHtml(item.id)}">Reativar agenda agora</button></div>`).join('')}</div>`;
}

export async function initAdminSchedule({ client, profile, root = document, staffProvider }) {
  if (!client || !profile?.user_id || !root?.getElementById) throw new Error('Contexto da disponibilidade administrativa inválido.');
  const agendaRoot = root.getElementById('agenda');
  if (!agendaRoot) throw new Error('Área de agenda administrativa não encontrada.');
  ensureStyles(root);
  if (!root.getElementById('adminScheduleRoot')) agendaRoot.insertAdjacentHTML('beforeend', `<div class="bcg-divider"></div>${renderAdminSchedulePanel()}`);

  const el = (id) => root.getElementById(id);
  const professional = el('adminScheduleProfessional');
  const calendar = el('adminScheduleCalendar');
  const status = el('adminScheduleStatus');
  const monthLabelEl = el('adminScheduleMonthLabel');
  const dayForm = el('adminScheduleDayForm');
  const bulkForm = el('adminScheduleBulkForm');
  const blockForm = el('adminScheduleBlockForm');
  const inactivationForm = el('adminScheduleInactivationForm');
  let month = currentClinicMonth();
  let state = { days: [], blocks: [], inactivations: [] };
  let staff = [];
  let selectedDate = `${month}-01`;

  async function loadStaff() {
    const provided = typeof staffProvider === 'function' ? await staffProvider() : [];
    staff = normalizeStaff(provided);
    if (!staff.length) staff = [{ user_id: profile.user_id, display_name: profile.display_name || 'Mel' }];
    const preferred = professional.value || (staff.some((item) => item.user_id === profile.user_id) ? profile.user_id : staff[0].user_id);
    professional.innerHTML = renderStaffOptions(staff, preferred);
    professional.value = preferred;
    return staff;
  }

  function selectedAvailability() {
    return state.days?.find((item) => String(item.local_date).slice(0, 10) === selectedDate) ?? null;
  }

  function syncDayForm() {
    const item = selectedAvailability();
    el('adminScheduleDayDate').value = selectedDate;
    el('adminScheduleDayEnabled').checked = item?.enabled === true;
    el('adminScheduleDayStart').value = timeForInput(item?.start_time);
    el('adminScheduleDayEnd').value = timeForInput(item?.end_time);
  }

  function render() {
    monthLabelEl.textContent = monthLabel(month);
    calendar.innerHTML = renderScheduleCalendar({ month, state, selectedDate });
    el('adminScheduleBlocks').innerHTML = renderBlocks(state.blocks ?? []);
    el('adminScheduleInactivations').innerHTML = renderInactivations(state.inactivations ?? []);
    syncDayForm();
  }

  async function refresh() {
    if (!professional.value) return;
    setMessage(status, 'Carregando disponibilidade…');
    try {
      state = await getScheduleMonth({ client, professionalUserId: professional.value, month: monthStartDate(month) }) || {};
      state.days ??= [];
      state.blocks ??= [];
      state.inactivations ??= [];
      render();
      setMessage(status, 'Disponibilidade atualizada.', 'success');
      return state;
    } catch (error) {
      setMessage(status, error?.message || 'Não foi possível carregar a disponibilidade.', 'error');
      throw error;
    }
  }

  async function saveBulk(dates) {
    if (!dates.length) throw new Error('Selecione ao menos uma data válida do mês atual.');
    const enabled = el('adminScheduleBulkEnabled').checked;
    await applyAvailabilityDays({
      client,
      professionalUserId: professional.value,
      dates,
      enabled,
      startTime: enabled ? el('adminScheduleBulkStart').value : null,
      endTime: enabled ? el('adminScheduleBulkEnd').value : null,
    });
    await refresh();
  }

  await loadStaff();
  await refresh();

  professional.addEventListener('change', refresh);
  el('adminScheduleRoot').addEventListener('click', async (event) => {
    const dayButton = event.target.closest?.('[data-date]');
    if (dayButton?.dataset?.date) {
      selectedDate = dayButton.dataset.date;
      render();
      return;
    }
    const actionButton = event.target.closest?.('[data-admin-schedule-action]');
    const action = actionButton?.dataset?.adminScheduleAction;
    if (action === 'previous-month' || action === 'next-month') {
      month = shiftMonth(month, action === 'previous-month' ? -1 : 1);
      selectedDate = `${month}-01`;
      await refresh();
      return;
    }
    if (action === 'apply-weekdays') {
      actionButton.disabled = true;
      try {
        const weekdays = [...root.querySelectorAll('input[name="adminScheduleWeekday"]:checked')].map((input) => Number(input.value));
        await saveBulk(monthDatesByWeekdays(month, weekdays));
        setMessage(status, 'Disponibilidade aplicada aos dias da semana selecionados.', 'success');
      } catch (error) { setMessage(status, error?.message || 'Não foi possível aplicar em lote.', 'error'); }
      finally { actionButton.disabled = false; }
      return;
    }
    if (action === 'copy-previous-month') {
      actionButton.disabled = true;
      try {
        const previous = shiftMonth(month, -1);
        const previousState = await getScheduleMonth({ client, professionalUserId: professional.value, month: monthStartDate(previous) });
        const configs = copyAvailabilityToMonth(month, previousState?.days ?? []);
        if (!configs.length) throw new Error('O mês anterior não possui disponibilidade configurada para copiar.');
        for (const config of configs) await upsertAvailabilityDay({ client, professionalUserId: professional.value, ...config });
        await refresh();
        setMessage(status, `${configs.length} dia(s) copiado(s) do mês anterior.`, 'success');
      } catch (error) { setMessage(status, error?.message || 'Não foi possível copiar o mês anterior.', 'error'); }
      finally { actionButton.disabled = false; }
      return;
    }
    const deleteBlockButton = event.target.closest?.('[data-delete-schedule-block]');
    if (deleteBlockButton) {
      deleteBlockButton.disabled = true;
      try { await deleteScheduleBlock({ client, blockId: deleteBlockButton.dataset.deleteScheduleBlock }); await refresh(); }
      catch (error) { setMessage(status, error?.message || 'Não foi possível remover o bloqueio.', 'error'); deleteBlockButton.disabled = false; }
      return;
    }
    const reactivateButton = event.target.closest?.('[data-reactivate-schedule]');
    if (reactivateButton) {
      reactivateButton.disabled = true;
      try { await reactivateAgenda({ client, inactivationId: reactivateButton.dataset.reactivateSchedule }); await refresh(); setMessage(status, 'Agenda reativada.', 'success'); }
      catch (error) { setMessage(status, error?.message || 'Não foi possível reativar a agenda.', 'error'); reactivateButton.disabled = false; }
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
      selectedDate = el('adminScheduleDayDate').value;
      const enabled = el('adminScheduleDayEnabled').checked;
      await upsertAvailabilityDay({ client, professionalUserId: professional.value, localDate: selectedDate, enabled, startTime: enabled ? el('adminScheduleDayStart').value : null, endTime: enabled ? el('adminScheduleDayEnd').value : null });
      await refresh();
      setMessage(status, 'Dia salvo.', 'success');
    } catch (error) { setMessage(status, error?.message || 'Não foi possível salvar o dia.', 'error'); }
    finally { submit.disabled = false; }
  });

  bulkForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = bulkForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try { await saveBulk(parseBulkDates(el('adminScheduleBulkDates').value, month)); setMessage(status, 'Datas atualizadas em lote.', 'success'); }
    catch (error) { setMessage(status, error?.message || 'Não foi possível aplicar as datas.', 'error'); }
    finally { submit.disabled = false; }
  });

  blockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = blockForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await createScheduleBlock({ client, professionalUserId: professional.value, startsAt: clinicLocalDateTimeToIso(el('adminScheduleBlockStart').value), endsAt: clinicLocalDateTimeToIso(el('adminScheduleBlockEnd').value), blockType: el('adminScheduleBlockType').value, internalNote: el('adminScheduleBlockNote').value });
      blockForm.reset();
      el('adminScheduleBlockType').value = 'compromisso';
      await refresh();
      setMessage(status, 'Bloqueio criado. Atendimentos existentes foram preservados.', 'success');
    } catch (error) { setMessage(status, error?.message || 'Não foi possível criar o bloqueio.', 'error'); }
    finally { submit.disabled = false; }
  });

  inactivationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = inactivationForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await createAgendaInactivation({ client, professionalUserId: professional.value, startsOn: el('adminScheduleInactiveStart').value, plannedEndsOn: el('adminScheduleInactiveEnd').value || null, reason: el('adminScheduleInactiveReason').value, internalNote: el('adminScheduleInactiveNote').value });
      inactivationForm.reset();
      await refresh();
      const affected = Number(result?.affected_appointments ?? 0);
      setMessage(status, affected > 0 ? `Agenda inativada. Atenção: ${affected} atendimento(s) já existente(s) foram preservados e precisam ser revisados pela equipe.` : 'Agenda inativada. Nenhum atendimento existente foi alterado.', affected > 0 ? 'warning' : 'success');
    } catch (error) { setMessage(status, error?.message || 'Não foi possível inativar a agenda.', 'error'); }
    finally { submit.disabled = false; }
  });

  return { refresh, refreshStaff: async () => { await loadStaff(); return refresh(); }, getMonth: () => month };
}
