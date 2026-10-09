import {
  listOwnAppointments,
  listAuthorizedHistory,
  listStaffDirectory,
  setAppointmentStatus,
} from './agenda-api.js';
import {
  clinicDayRange,
  formatClinicDateTime,
  statusLabel,
} from './agenda-format.js';

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

function statusClass(status) {
  return ['agendado', 'atendido', 'cancelado', 'faltou'].includes(status)
    ? `bcg-status-${status}`
    : '';
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

function renderAppointmentDetail(appointment) {
  const client = appointment.clientes || {};
  const procedure = appointment.procedimentos || {};
  const status = appointment.status || 'agendado';
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
    ${status === 'agendado' ? `
      <div class="bcg-actions bcg-detail-actions">
        <button type="button" class="bcg-small-button" data-collab-status="faltou">Marcar falta</button>
        <button type="button" class="bcg-small-button" data-collab-status="cancelado">Cancelar</button>
      </div>` : ''}
  `;
}

function futureRange(today) {
  const start = new Date(today.toIso);
  const endSeed = new Date(start.getTime() + (14 * 24 * 60 * 60 * 1000));
  return {
    fromIso: today.toIso,
    toIso: clinicDayRange(endSeed).toIso,
  };
}

export async function initCollaboratorAgenda({ client, profile, root = document }) {
  if (!client || !profile?.user_id || !root) throw new Error('Contexto da profissional inválido.');

  const el = (id) => root.getElementById(id);
  const todayList = el('todayAgendaList');
  const nextList = el('nextAgendaList');
  const detail = el('appointmentDetail');
  const detailContent = el('appointmentDetailContent');
  const historyTimeline = el('historyTimeline');
  const agendaStatus = el('collaboratorAgendaStatus');
  const closeButton = el('closeAppointmentDetail');

  if (!todayList || !nextList || !detail || !detailContent || !historyTimeline) {
    throw new Error('Estrutura da agenda da colaboradora incompleta.');
  }

  let appointments = new Map();
  let staffMap = new Map();
  let currentAppointmentId = null;

  function setStatus(message, kind = '') {
    if (!agendaStatus) return;
    agendaStatus.textContent = message || '';
    agendaStatus.dataset.kind = kind;
  }

  async function loadStaffDirectory() {
    const staff = await listStaffDirectory({ client });
    staffMap = new Map(staff.map((item) => [item.user_id, item.display_name]));
  }

  async function refresh() {
    setStatus('Carregando sua agenda…');
    const todayRange = clinicDayRange(new Date());
    const nextRange = futureRange(todayRange);
    try {
      const [todayAppointments, nextAppointments] = await Promise.all([
        listOwnAppointments({ client, userId: profile.user_id, ...todayRange }),
        listOwnAppointments({ client, userId: profile.user_id, ...nextRange }),
      ]);

      appointments = new Map(
        [...todayAppointments, ...nextAppointments].map((item) => [item.id, item]),
      );
      todayList.innerHTML = renderCollaboratorAppointments(todayAppointments);
      nextList.innerHTML = renderCollaboratorAppointments(nextAppointments);
      setStatus(`${todayAppointments.length} atendimento(s) hoje.`, 'success');
      return { todayAppointments, nextAppointments };
    } catch (error) {
      todayList.innerHTML = '<div class="bcg-empty">Não foi possível carregar sua agenda.</div>';
      nextList.innerHTML = '<div class="bcg-empty">Não foi possível carregar os próximos atendimentos.</div>';
      setStatus(error?.message || 'Erro ao carregar agenda.', 'error');
      throw error;
    }
  }

  async function openAppointment(appointmentId) {
    const appointment = appointments.get(appointmentId);
    if (!appointment) throw new Error('Atendimento não encontrado na agenda carregada.');

    currentAppointmentId = appointment.id;
    detail.dataset.appointmentId = appointment.id;
    detailContent.innerHTML = renderAppointmentDetail(appointment);
    historyTimeline.innerHTML = '<div class="bcg-empty">Carregando histórico autorizado…</div>';
    detail.hidden = false;

    try {
      const history = await listAuthorizedHistory({ client, clienteId: appointment.cliente_id });
      historyTimeline.innerHTML = renderAuthorizedHistory(history, staffMap);
    } catch (error) {
      historyTimeline.innerHTML = '<div class="bcg-empty">Não foi possível carregar o histórico autorizado.</div>';
      setStatus(error?.message || 'Erro ao carregar histórico.', 'error');
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
  }

  async function handleListClick(event) {
    const button = event.target.closest?.('[data-open-appointment]');
    if (!button) return;
    try {
      await openAppointment(button.dataset.openAppointment);
    } catch (error) {
      setStatus(error?.message || 'Não foi possível abrir o atendimento.', 'error');
    }
  }

  todayList.addEventListener('click', handleListClick);
  nextList.addEventListener('click', handleListClick);
  closeButton?.addEventListener('click', closeDetail);

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
      setStatus(error?.message || 'Não foi possível atualizar o atendimento.', 'error');
      button.disabled = false;
    }
  });

  await loadStaffDirectory();
  await refresh();

  return {
    refresh,
    openAppointment,
    closeDetail,
    getCurrentAppointment: () => appointments.get(currentAppointmentId) || null,
  };
}
