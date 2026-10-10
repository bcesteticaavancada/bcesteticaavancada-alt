import {
  listOwnAppointments,
  listAuthorizedHistory,
  listStaffDirectory,
  listActiveProcedures,
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
} from './agenda-api.js';
import { listClients } from './clientes-api.js';
import {
  clinicDayRange,
  clinicLocalDateTimeToIso,
  formatClinicDateTime,
  statusLabel,
  CLINIC_TIME_ZONE,
} from './agenda-format.js';
import { canRegisterAttendance } from './atendimento-form.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function appointmentTime(iso) {
  const formatted = formatClinicDateTime(iso);
  const match = formatted.match(/\b\d{2}:\d{2}\b/);
  return match?.[0] || formatted;
}

function localInputValue(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CLINIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function statusClass(status) {
  return ['agendado', 'atendido', 'cancelado', 'faltou'].includes(status)
    ? `bcg-status-${status}`
    : '';
}

function option(label, value, selected = false) {
  return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

export function ownAppointmentPayload(profile, values) {
  if (!profile?.user_id) throw new Error('Profissional inválida.');
  return {
    clienteId: values.clienteId,
    colaboradoraUserId: profile.user_id,
    procedimentoId: values.procedimentoId,
    inicioIso: values.inicioIso,
    fimIso: values.fimIso ?? null,
    observacao: values.observacao ?? null,
  };
}

export function renderCollaboratorAppointments(appointments = []) {
  if (!appointments.length) {
    return '<div class="bcg-empty">Nenhum atendimento encontrado neste período.</div>';
  }

  return `<div class="bcg-agenda-list">${appointments.map((appointment) => {
    const clientName = appointment.clientes?.nome || 'Cliente';
    const procedureName = appointment.procedimentos?.nome || 'Procedimento';
    const status = appointment.status || 'agendado';
    return `
      <article class="bcg-appointment-card bcg-collaborator-card" data-appointment-id="${escapeHtml(appointment.id)}">
        <div class="bcg-appointment-time">${escapeHtml(appointmentTime(appointment.inicio))}</div>
        <div class="bcg-appointment-main">
          <strong>${escapeHtml(clientName)}</strong>
          <span>${escapeHtml(procedureName)}</span>
        </div>
        <span class="bcg-chip ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
        <div class="bcg-actions">
          <button type="button" class="bcg-small-button" data-open-appointment="${escapeHtml(appointment.id)}">Abrir atendimento</button>
        </div>
      </article>`;
  }).join('')}</div>`;
}

function fieldBlock(label, value) {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  return `<div class="bcg-history-field"><span>${escapeHtml(label)}</span><p>${escapeHtml(clean)}</p></div>`;
}

export function renderAuthorizedHistory(history = [], staffMap = new Map()) {
  if (!history.length) {
    return '<div class="bcg-empty">Nenhum histórico anterior disponível para este cliente.</div>';
  }

  return `<div class="bcg-history-timeline">${history.map((entry) => {
    const professional = staffMap.get(entry.colaboradora_user_id) || 'Profissional';
    const procedure = entry.procedimentos?.nome || 'Procedimento';
    return `
      <article class="bcg-history-entry">
        <header>
          <div><strong>${escapeHtml(procedure)}</strong><span>${escapeHtml(professional)}</span></div>
          <time>${escapeHtml(formatClinicDateTime(entry.data_atendimento))}</time>
        </header>
        <div class="bcg-history-grid">
          ${fieldBlock('Queixa / objetivo', entry.queixa_objetivo)}
          ${fieldBlock('Observações', entry.observacoes)}
          ${fieldBlock('Reações', entry.reacoes)}
          ${fieldBlock('Intercorrências', entry.intercorrencias)}
          ${fieldBlock('Feedback da cliente', entry.feedback_cliente)}
          ${fieldBlock('Orientações', entry.orientacoes)}
          ${fieldBlock('Próxima sessão', entry.recomendacao_proxima_sessao)}
        </div>
      </article>`;
  }).join('')}</div>`;
}

function renderAppointmentDetail(appointment, procedures = []) {
  const client = appointment.clientes || {};
  const procedure = appointment.procedimentos || {};
  const status = appointment.status || 'agendado';
  const edit = status === 'agendado' ? `
    <form class="bcg-form bcg-form-grid bcg-appointment-edit" data-own-appointment-edit data-appointment-id="${escapeHtml(appointment.id)}">
      <label>Procedimento
        <select class="bcg-input" name="procedimento_id" required>
          ${procedures.map((item) => option(item.nome, item.id, item.id === appointment.procedimento_id)).join('')}
        </select>
      </label>
      <label>Início
        <input class="bcg-input" name="inicio" type="datetime-local" value="${escapeHtml(localInputValue(appointment.inicio))}" required>
      </label>
      <label>Fim <span class="bcg-optional">opcional</span>
        <input class="bcg-input" name="fim" type="datetime-local" value="${escapeHtml(localInputValue(appointment.fim))}">
      </label>
      <label class="bcg-field-wide">Observação administrativa <span class="bcg-optional">opcional</span>
        <textarea class="bcg-input bcg-textarea" name="observacao" rows="2">${escapeHtml(appointment.observacao_administrativa || '')}</textarea>
      </label>
      <div class="bcg-form-actions bcg-field-wide">
        <button class="bcg-button" type="submit">Salvar horário</button>
        <span class="bcg-status" data-own-appointment-status></span>
      </div>
    </form>` : '';

  return `
    <div class="bcg-detail-head">
      <div>
        <p class="bcg-eyebrow">ATENDIMENTO</p>
        <h3>${escapeHtml(client.nome || 'Cliente')}</h3>
        <p>${escapeHtml(procedure.nome || 'Procedimento')} • ${escapeHtml(formatClinicDateTime(appointment.inicio))}</p>
      </div>
      <span class="bcg-chip ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
    </div>
    <div class="bcg-detail-meta">
      ${client.telefone ? `<div><span>Telefone</span><strong>${escapeHtml(client.telefone)}</strong></div>` : ''}
      ${client.email ? `<div><span>E-mail</span><strong>${escapeHtml(client.email)}</strong></div>` : ''}
    </div>
    ${edit}
    ${status === 'agendado' ? `
      <div class="bcg-actions bcg-detail-actions">
        <button type="button" class="bcg-small-button" data-collab-status="faltou">Marcar falta</button>
        <button type="button" class="bcg-small-button" data-collab-status="cancelado">Cancelar</button>
      </div>` : ''}
  `;
}

function futureRange(today) {
  const startIso = today.toIso || today.fromIso;
  const start = new Date(startIso);
  const endSeed = new Date(start.getTime() + (14 * 24 * 60 * 60 * 1000));
  const endRange = clinicDayRange(endSeed);
  return {
    fromIso: startIso,
    toIso: endRange.toIso,
  };
}

function replaceOptions(select, items, emptyText) {
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(emptyText)}</option>${items.map((item) => option(item.nome, item.id)).join('')}`;
}

function setStatus(element, message, kind = '') {
  if (!element) return;
  element.textContent = message || '';
  element.dataset.kind = kind;
}

export async function initCollaboratorAgenda({ client, profile, root = document }) {
  if (!client || !profile?.user_id || !root) throw new Error('Contexto da profissional inválido.');

  const el = (id) => root.getElementById(id);
  const todayList = el('todayAgendaList');
  const nextList = el('nextAgendaList');
  const detail = el('appointmentDetail');
  const detailContent = el('appointmentDetailContent');
  const historyTimeline = el('historyTimeline');
  const attendanceFormSlot = el('attendanceFormSlot');
  const agendaStatus = el('collaboratorAgendaStatus');
  const closeButton = el('closeAppointmentDetail');
  const appointmentForm = el('collaboratorAppointmentForm');
  const clientSelect = el('collaboratorAppointmentClient');
  const procedureSelect = el('collaboratorAppointmentProcedure');

  if (!todayList || !nextList || !detail || !detailContent || !historyTimeline || !attendanceFormSlot || !appointmentForm || !clientSelect || !procedureSelect) {
    throw new Error('Estrutura da agenda da colaboradora incompleta.');
  }

  let appointments = new Map();
  let staffMap = new Map();
  let procedures = [];
  let currentAppointmentId = null;

  function syncAttendanceForm(appointment = null) {
    const allowed = Boolean(appointment && canRegisterAttendance(appointment.status));
    attendanceFormSlot.hidden = !allowed;
    if (allowed) attendanceFormSlot.dataset.appointmentId = appointment.id;
    else delete attendanceFormSlot.dataset.appointmentId;
  }

  async function refreshClients() {
    const clients = await listClients({ client });
    replaceOptions(clientSelect, clients, 'Selecione o cliente');
    return clients;
  }

  async function loadLookups() {
    const [staff, procedureRows] = await Promise.all([
      listStaffDirectory({ client }),
      listActiveProcedures({ client }),
    ]);
    staffMap = new Map(staff.map((item) => [item.user_id, item.display_name]));
    procedures = procedureRows;
    replaceOptions(procedureSelect, procedures, 'Selecione o procedimento');
    await refreshClients();
  }

  async function refresh() {
    setStatus(agendaStatus, 'Carregando sua agenda…');
    const todayRange = clinicDayRange(new Date());
    const nextRange = futureRange(todayRange);
    try {
      const [todayAppointments, nextAppointments] = await Promise.all([
        listOwnAppointments({ client, userId: profile.user_id, ...todayRange }),
        listOwnAppointments({ client, userId: profile.user_id, ...nextRange }),
      ]);
      appointments = new Map([...todayAppointments, ...nextAppointments].map((item) => [item.id, item]));
      todayList.innerHTML = renderCollaboratorAppointments(todayAppointments);
      nextList.innerHTML = renderCollaboratorAppointments(nextAppointments);
      setStatus(agendaStatus, `${todayAppointments.length} atendimento(s) hoje.`, 'success');
      return { todayAppointments, nextAppointments };
    } catch (error) {
      todayList.innerHTML = '<div class="bcg-empty">Não foi possível carregar sua agenda.</div>';
      nextList.innerHTML = '<div class="bcg-empty">Não foi possível carregar os próximos atendimentos.</div>';
      setStatus(agendaStatus, error?.message || 'Erro ao carregar agenda.', 'error');
      throw error;
    }
  }

  async function openAppointment(appointmentId) {
    const appointment = appointments.get(appointmentId);
    if (!appointment) throw new Error('Atendimento não encontrado na agenda carregada.');

    currentAppointmentId = appointment.id;
    detail.dataset.appointmentId = appointment.id;
    detailContent.innerHTML = renderAppointmentDetail(appointment, procedures);
    historyTimeline.innerHTML = '<div class="bcg-empty">Carregando histórico da cliente…</div>';
    syncAttendanceForm(appointment);
    detail.hidden = false;

    try {
      const history = await listAuthorizedHistory({ client, clienteId: appointment.cliente_id });
      historyTimeline.innerHTML = renderAuthorizedHistory(history, staffMap);
    } catch (error) {
      historyTimeline.innerHTML = '<div class="bcg-empty">Não foi possível carregar o histórico da cliente.</div>';
      setStatus(agendaStatus, error?.message || 'Erro ao carregar histórico.', 'error');
    }

    detail.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    return appointment;
  }

  function closeDetail() {
    currentAppointmentId = null;
    delete detail.dataset.appointmentId;
    detail.hidden = true;
    detailContent.innerHTML = '';
    historyTimeline.innerHTML = '';
    syncAttendanceForm(null);
  }

  appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = appointmentForm.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    const statusEl = el('collaboratorAppointmentStatus');
    try {
      const start = el('collaboratorAppointmentStart').value;
      const end = el('collaboratorAppointmentEnd').value;
      await createAppointment({
        client,
        ...ownAppointmentPayload(profile, {
          clienteId: clientSelect.value,
          procedimentoId: procedureSelect.value,
          inicioIso: clinicLocalDateTimeToIso(start),
          fimIso: end ? clinicLocalDateTimeToIso(end) : null,
          observacao: el('collaboratorAppointmentNote').value,
        }),
      });
      appointmentForm.reset();
      setStatus(statusEl, 'Agendamento criado.', 'success');
      await refresh();
    } catch (error) {
      setStatus(statusEl, error?.message || 'Não foi possível criar o agendamento.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  async function handleListClick(event) {
    const button = event.target.closest?.('[data-open-appointment]');
    if (!button) return;
    try {
      await openAppointment(button.dataset.openAppointment);
    } catch (error) {
      setStatus(agendaStatus, error?.message || 'Não foi possível abrir o atendimento.', 'error');
    }
  }

  todayList.addEventListener('click', handleListClick);
  nextList.addEventListener('click', handleListClick);
  closeButton?.addEventListener('click', closeDetail);

  detail.addEventListener('submit', async (event) => {
    const form = event.target.closest?.('[data-own-appointment-edit]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const start = data.get('inicio');
    const end = data.get('fim');
    const statusEl = form.querySelector('[data-own-appointment-status]');
    try {
      await updateAppointment({
        client,
        appointmentId: form.dataset.appointmentId,
        procedimentoId: data.get('procedimento_id'),
        inicioIso: clinicLocalDateTimeToIso(start),
        fimIso: end ? clinicLocalDateTimeToIso(end) : null,
        observacao: data.get('observacao'),
      });
      setStatus(statusEl, 'Horário atualizado.', 'success');
      const id = form.dataset.appointmentId;
      await refresh();
      await openAppointment(id);
    } catch (error) {
      setStatus(statusEl, error?.message || 'Não foi possível atualizar o horário.', 'error');
    }
  });

  detail.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-collab-status]');
    if (!button || !currentAppointmentId) return;
    button.disabled = true;
    try {
      await setAppointmentStatus({
        client,
        appointmentId: currentAppointmentId,
        status: button.dataset.collabStatus,
      });
      closeDetail();
      await refresh();
    } catch (error) {
      setStatus(agendaStatus, error?.message || 'Não foi possível atualizar o atendimento.', 'error');
      button.disabled = false;
    }
  });

  syncAttendanceForm(null);
  await loadLookups();
  await refresh();

  return {
    refresh,
    refreshClients,
    openAppointment,
    closeDetail,
    getCurrentAppointment: () => appointments.get(currentAppointmentId) || null,
  };
}
