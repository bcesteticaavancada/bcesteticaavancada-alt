import { agendaOriginKind } from './agenda-origin.js';
import {
  listOwnAppointments,
  listAdminAppointments,
  listAuthorizedHistory,
  listStaffDirectory,
  listEligibleProcedures,
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
} from './agenda-api.js';
import { listClients } from './clientes-api.js';
import { linkPublicAppointment } from './schedule-api.js';
import { initProcedurePanel } from './procedure-panel.js';
import { initCollaboratorSchedule } from './colaborador-schedule.js';
import { initAdminSchedule } from './admin-schedule.js';
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
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(iso)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function statusClass(status) {
  return ['agendado', 'atendido', 'cancelado', 'faltou'].includes(status) ? `bcg-status-${status}` : '';
}

function option(label, value, selected = false) {
  return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

export function isAgendaManager(profile) {
  return profile?.role === 'colaborador' && profile?.pode_gerenciar_agendas === true;
}

export function isOwnClinicalAppointment(profile, appointment) {
  return Boolean(profile?.user_id && appointment?.colaboradora_user_id === profile.user_id);
}

export function ownAppointmentPayload(profile, values) {
  if (!profile?.user_id) throw new Error('Profissional inválida.');
  const targetProfessional = isAgendaManager(profile)
    ? String(values.colaboradoraUserId || profile.user_id).trim()
    : profile.user_id;
  return {
    clienteId: values.clienteId,
    colaboradoraUserId: targetProfessional,
    procedimentoId: values.procedimentoId,
    inicioIso: values.inicioIso,
    fimIso: values.fimIso ?? null,
    observacao: values.observacao ?? null,
  };
}

export function canOpenClinicalAppointment(appointment) {
  return Boolean(appointment?.cliente_id);
}

export async function linkPendingPublicBooking({ client, appointmentId, clienteId }) {
  return linkPublicAppointment({ client, appointmentId, clienteId });
}

export function renderCollaboratorAppointments(appointments = [], staffMap = new Map()) {
  if (!appointments.length) return '<div class="bcg-empty">Nenhum atendimento encontrado neste período.</div>';
  return `<div class="bcg-agenda-list">${appointments.map((appointment) => {
    const pendingSite = agendaOriginKind(appointment) === 'site' && !appointment.cliente_id;
    const clientName = appointment.clientes?.nome || appointment.public_booking_name || 'Cliente';
    const phone = pendingSite ? appointment.public_booking_phone : '';
    const procedureName = appointment.procedimentos?.nome || 'Procedimento';
    const professionalName = staffMap.get(appointment.colaboradora_user_id) || '';
    const status = appointment.status || 'agendado';
    const chips = [
      `<span class="bcg-chip ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>`,
      agendaOriginKind(appointment) === 'site' ? '<span class="bcg-chip">Site</span>' : '',
      pendingSite ? '<span class="bcg-chip bcg-status-pending">Cadastro pendente</span>' : '',
    ].join('');
    const secondary = [procedureName, professionalName, phone].filter(Boolean).join(' • ');
    return `
      <article class="bcg-appointment-card bcg-collaborator-card" data-appointment-id="${escapeHtml(appointment.id)}">
        <div class="bcg-appointment-time">${escapeHtml(appointmentTime(appointment.inicio))}</div>
        <div class="bcg-appointment-main"><strong>${escapeHtml(clientName)}</strong><span>${escapeHtml(secondary)}</span></div>
        <div class="bcg-appointment-chips">${chips}</div>
        <div class="bcg-actions"><button type="button" class="bcg-small-button" data-open-appointment="${escapeHtml(appointment.id)}">${pendingSite ? 'Vincular cliente' : 'Abrir atendimento'}</button></div>
      </article>`;
  }).join('')}</div>`;
}

function fieldBlock(label, value) {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  return `<div class="bcg-history-field"><span>${escapeHtml(label)}</span><p>${escapeHtml(clean)}</p></div>`;
}

export function renderAuthorizedHistory(history = [], staffMap = new Map()) {
  if (!history.length) return '<div class="bcg-empty">Nenhum histórico anterior disponível para este cliente.</div>';
  return `<div class="bcg-history-timeline">${history.map((entry) => {
    const professional = staffMap.get(entry.colaboradora_user_id) || 'Profissional';
    const procedure = entry.procedimentos?.nome || 'Procedimento';
    return `<article class="bcg-history-entry"><header><div><strong>${escapeHtml(procedure)}</strong><span>${escapeHtml(professional)}</span></div><time>${escapeHtml(formatClinicDateTime(entry.data_atendimento))}</time></header><div class="bcg-history-grid">${fieldBlock('Queixa / objetivo', entry.queixa_objetivo)}${fieldBlock('Observações', entry.observacoes)}${fieldBlock('Reações', entry.reacoes)}${fieldBlock('Intercorrências', entry.intercorrencias)}${fieldBlock('Feedback da cliente', entry.feedback_cliente)}${fieldBlock('Orientações', entry.orientacoes)}${fieldBlock('Próxima sessão', entry.recomendacao_proxima_sessao)}</div></article>`;
  }).join('')}</div>`;
}

export function renderAppointmentDetail(appointment, procedures = [], clients = []) {
  const pendingSite = agendaOriginKind(appointment) === 'site' && !appointment.cliente_id;
  const client = appointment.clientes || {};
  const procedure = appointment.procedimentos || {};
  const status = appointment.status || 'agendado';
  const edit = status === 'agendado' ? `<form class="bcg-form bcg-form-grid bcg-appointment-edit" data-own-appointment-edit data-appointment-id="${escapeHtml(appointment.id)}"><label>Procedimento<select class="bcg-input" name="procedimento_id" required>${procedures.map((item) => option(item.nome, item.id, item.id === appointment.procedimento_id)).join('')}</select></label><label>Início<input class="bcg-input" name="inicio" type="datetime-local" value="${escapeHtml(localInputValue(appointment.inicio))}" required></label><label>Fim <span class="bcg-optional">opcional</span><input class="bcg-input" name="fim" type="datetime-local" value="${escapeHtml(localInputValue(appointment.fim))}"></label><label class="bcg-field-wide">Observação administrativa <span class="bcg-optional">opcional</span><textarea class="bcg-input bcg-textarea" name="observacao" rows="2">${escapeHtml(appointment.observacao_administrativa || '')}</textarea></label><div class="bcg-form-actions bcg-field-wide"><button class="bcg-button" type="submit">Salvar horário</button><span class="bcg-status" data-own-appointment-status></span></div></form>` : '';
  if (pendingSite) {
    const name = appointment.public_booking_name || 'Cliente do site';
    const phone = appointment.public_booking_phone || '';
    return `<div class="bcg-detail-head"><div><p class="bcg-eyebrow">RESERVA DO SITE</p><h3>${escapeHtml(name)}</h3><p>${escapeHtml(procedure.nome || 'Procedimento')} • ${escapeHtml(formatClinicDateTime(appointment.inicio))}</p></div><div class="bcg-appointment-chips"><span class="bcg-chip">Site</span><span class="bcg-chip bcg-status-pending">Cadastro pendente</span></div></div><div class="bcg-detail-meta">${phone ? `<div><span>WhatsApp informado</span><strong>${escapeHtml(phone)}</strong></div>` : ''}</div><article class="bcg-editor-card bcg-link-public-booking"><p class="bcg-eyebrow">VINCULAR CADASTRO</p><p>A ficha clínica está bloqueada até esta reserva ser vinculada explicitamente a um cadastro oficial da clínica.</p><form class="bcg-form" data-public-booking-link data-appointment-id="${escapeHtml(appointment.id)}"><label>Cliente cadastrado<select class="bcg-input" name="cliente_id" required><option value="">Selecione o cadastro correto</option>${clients.map((item) => option(item.nome, item.id)).join('')}</select></label><div class="bcg-form-actions"><button class="bcg-button" type="submit">Vincular cliente</button><span class="bcg-status" data-public-booking-link-status></span></div></form></article>${edit}${status === 'agendado' ? `<div class="bcg-actions"><button type="button" class="bcg-small-button" data-collab-status="cancelado">Cancelar</button></div>` : ''}`;
  }

  return `<div class="bcg-detail-head"><div><p class="bcg-eyebrow">ATENDIMENTO</p><h3>${escapeHtml(client.nome || 'Cliente')}</h3><p>${escapeHtml(procedure.nome || 'Procedimento')} • ${escapeHtml(formatClinicDateTime(appointment.inicio))}</p></div><span class="bcg-chip ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span></div><div class="bcg-detail-meta">${client.telefone ? `<div><span>Telefone</span><strong>${escapeHtml(client.telefone)}</strong></div>` : ''}${client.email ? `<div><span>E-mail</span><strong>${escapeHtml(client.email)}</strong></div>` : ''}</div>${edit}${status === 'agendado' ? `<div class="bcg-actions bcg-detail-actions"><button type="button" class="bcg-small-button" data-collab-status="faltou">Marcar falta</button><button type="button" class="bcg-small-button" data-collab-status="cancelado">Cancelar</button></div>` : ''}`;
}

function futureRange(today) {
  const startIso = today.toIso || today.fromIso;
  const start = new Date(startIso);
  const endRange = clinicDayRange(new Date(start.getTime() + (14 * 24 * 60 * 60 * 1000)));
  return { fromIso: startIso, toIso: endRange.toIso };
}

export function collaboratorAgendaRanges(localDate = localInputValue(new Date().toISOString()).slice(0, 10)) {
  const value = String(localDate).trim();
  const date = new Date(`${value}T12:00:00-03:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())
      || localInputValue(date.toISOString()).slice(0, 10) !== value) throw new Error('Data da agenda inválida.');
  const day = clinicDayRange(date);
  return { day, next: futureRange(day) };
}

export function filterCollaboratorAppointments(rows, profile, professionalId = '') {
  const selected = isAgendaManager(profile) ? String(professionalId || '') : profile?.user_id;
  return selected ? rows.filter((row) => row.colaboradora_user_id === selected) : rows;
}

function replaceOptions(select, items, emptyText, valueKey = 'id', labelKey = 'nome') {
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(emptyText)}</option>${items.map((item) => option(item[labelKey] || item.display_name || 'Profissional', item[valueKey] || item.user_id)).join('')}`;
}

function setStatus(element, message, kind = '') {
  if (!element) return;
  element.textContent = message || '';
  element.dataset.kind = kind;
}

export async function initCollaboratorAgenda({ client, profile, root = document }) {
  if (!client || !profile?.user_id || !root) throw new Error('Contexto da profissional inválido.');
  const manager = isAgendaManager(profile);
  const el = (id) => root.getElementById(id);
  const originFilter = el('collaboratorAgendaOriginFilter');
  const agendaDate = el('collaboratorAgendaDate');
  const agendaProfessional = el('collaboratorAgendaProfessionalFilter');
  const agendaProfessionalField = el('collaboratorAgendaProfessionalField');
  if (agendaDate && !agendaDate.value) agendaDate.value = localInputValue(new Date().toISOString()).slice(0, 10);
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
  const professionalField = el('appointmentProfessionalField');
  const professionalSelect = el('appointmentProfessional');
  const scopeText = el('collaboratorAgendaScopeText');
  if (!todayList || !nextList || !detail || !detailContent || !historyTimeline || !attendanceFormSlot || !appointmentForm || !clientSelect || !procedureSelect) throw new Error('Estrutura da agenda da colaboradora incompleta.');

  let refreshVersion = 0;
  let eligibilityVersion = 0;
  let openingVersion = 0;
  let appointments = new Map();
  let staffMap = new Map();
  let staffRows = [];
  let procedures = [];
  let clients = [];
  let currentAppointmentId = null;

  function canOperateClinicalAppointment(appointment) {
    return isOwnClinicalAppointment(profile, appointment) && canOpenClinicalAppointment(appointment);
  }

  function syncAttendanceForm(appointment = null) {
    const allowed = Boolean(appointment && canOperateClinicalAppointment(appointment) && canRegisterAttendance(appointment.status));
    attendanceFormSlot.hidden = !allowed;
    if (allowed) attendanceFormSlot.dataset.appointmentId = appointment.id;
    else delete attendanceFormSlot.dataset.appointmentId;
  }

  async function refreshClients() {
    clients = await listClients({ client });
    replaceOptions(clientSelect, clients, 'Selecione o cliente');
    return clients;
  }

  async function loadLookups() {
    const [staff, procedureRows] = await Promise.all([listStaffDirectory({ client }), listEligibleProcedures({ client, professionalUserId:profile.user_id })]);
    staffRows = staff;
    staffMap = new Map(staff.map((item) => [item.user_id, item.display_name]));
    procedures = procedureRows;
    replaceOptions(procedureSelect, procedures, 'Selecione o procedimento');
    if (agendaProfessionalField) agendaProfessionalField.hidden = !manager;
    if (manager && agendaProfessional) replaceOptions(agendaProfessional, staffRows, 'Todas as profissionais', 'user_id', 'display_name');
    if (manager && professionalSelect && professionalField) {
      professionalField.hidden = false;
      replaceOptions(professionalSelect, staffRows, 'Selecione a profissional', 'user_id', 'display_name');
      professionalSelect.value = profile.user_id;
      if (scopeText) scopeText.textContent = 'Você pode gerir as agendas da equipe. Ficha clínica e financeiro continuam restritos à profissional responsável.';
    }
    await refreshClients();
  }

  async function refreshEligibleProcedures() {
    const version=++eligibilityVersion;procedureSelect.disabled=true;
    try {
      const professionalUserId=manager ? professionalSelect?.value : profile.user_id;
      const rows=professionalUserId ? await listEligibleProcedures({client,professionalUserId}) : [];
      if(version!==eligibilityVersion)return;
      procedures=rows;replaceOptions(procedureSelect,procedures,'Selecione o procedimento');
    } finally {if(version===eligibilityVersion)procedureSelect.disabled=false;}
  }
  professionalSelect?.addEventListener('change',()=>refreshEligibleProcedures().catch(error=>setStatus(el('collaboratorAppointmentStatus'),error.message,'error')));

  async function loadAppointments(range) {
    const rows = await (manager
      ? listAdminAppointments({ client, ...range, origin: originFilter?.value || 'all' })
      : listOwnAppointments({ client, userId: profile.user_id, ...range, origin: originFilter?.value || 'all' }));
    return filterCollaboratorAppointments(rows, profile, agendaProfessional?.value);
  }

  async function refresh({canApply=()=>true,quiet=false}={}) {
    const version = ++refreshVersion;
    if(!quiet)setStatus(agendaStatus, manager ? 'Carregando agenda da equipe…' : 'Carregando sua agenda…');
    const { day: todayRange, next: nextRange } = collaboratorAgendaRanges(agendaDate?.value || undefined);
    try {
      const [todayAppointments, nextAppointments] = await Promise.all([loadAppointments(todayRange), loadAppointments(nextRange)]);
      if (version !== refreshVersion || !canApply()) return null;
      appointments = new Map([...todayAppointments, ...nextAppointments].map((item) => [item.id, item]));
      todayList.innerHTML = renderCollaboratorAppointments(todayAppointments, manager ? staffMap : new Map());
      nextList.innerHTML = renderCollaboratorAppointments(nextAppointments, manager ? staffMap : new Map());
      setStatus(agendaStatus, `${todayAppointments.length} atendimento(s) no dia selecionado.`, 'success');
      return { todayAppointments, nextAppointments };
    } catch (error) {
      if (version !== refreshVersion || !canApply()) return null;
      todayList.innerHTML = '<div class="bcg-empty">Não foi possível carregar a agenda.</div>';
      nextList.innerHTML = '<div class="bcg-empty">Não foi possível carregar os próximos atendimentos.</div>';
      setStatus(agendaStatus, error?.message || 'Erro ao carregar agenda.', 'error');
      throw error;
    }
  }

  async function openAppointment(appointmentId) {
    const version=++openingVersion;detail.hidden=true;syncAttendanceForm(null);
    const appointment = appointments.get(appointmentId);
    if (!appointment) throw new Error('Atendimento não encontrado na agenda carregada.');
    const eligible=await listEligibleProcedures({client,professionalUserId:appointment.colaboradora_user_id});
    if(version!==openingVersion)return null;
    currentAppointmentId = appointment.id;
    detail.dataset.appointmentId = appointment.id;
    detailContent.innerHTML = renderAppointmentDetail(appointment, eligible, clients);
    syncAttendanceForm(appointment);
    detail.hidden = false;
    if (!canOpenClinicalAppointment(appointment)) {
      historyTimeline.innerHTML = '<div class="bcg-empty">Vincule esta reserva a um cadastro oficial para liberar o fluxo clínico da profissional responsável.</div>';
    } else if (!isOwnClinicalAppointment(profile, appointment)) {
      historyTimeline.innerHTML = '<div class="bcg-empty">Gestão administrativa da agenda. Histórico clínico, ficha e financeiro permanecem restritos à profissional responsável.</div>';
    } else {
      historyTimeline.innerHTML = '<div class="bcg-empty">Carregando histórico da cliente…</div>';
      try {
        const history = await listAuthorizedHistory({ client, clienteId: appointment.cliente_id });
        if(version!==openingVersion)return null;
        historyTimeline.innerHTML = renderAuthorizedHistory(history, staffMap);
      } catch (error) {
        if(version!==openingVersion)return null;
        historyTimeline.innerHTML = '<div class="bcg-empty">Não foi possível carregar o histórico da cliente.</div>';
        setStatus(agendaStatus, error?.message || 'Erro ao carregar histórico.', 'error');
      }
    }
    if(version!==openingVersion)return null;
    detail.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    return appointment;
  }

  function closeDetail() {
    openingVersion++;
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
      await createAppointment({ client, ...ownAppointmentPayload(profile, {
        colaboradoraUserId: manager ? professionalSelect?.value : profile.user_id,
        clienteId: clientSelect.value,
        procedimentoId: procedureSelect.value,
        inicioIso: clinicLocalDateTimeToIso(start),
        fimIso: end ? clinicLocalDateTimeToIso(end) : null,
        observacao: el('collaboratorAppointmentNote').value,
      }) });
      appointmentForm.reset();
      if (manager && professionalSelect) professionalSelect.value = profile.user_id;
      await refreshEligibleProcedures();
      setStatus(statusEl, 'Agendamento criado.', 'success');
      await refresh();
    } catch (error) { setStatus(statusEl, error?.message || 'Não foi possível criar o agendamento.', 'error'); }
    finally { if (submit) submit.disabled = false; }
  });

  async function handleListClick(event) {
    const button = event.target.closest?.('[data-open-appointment]');
    if (!button) return;
    try { await openAppointment(button.dataset.openAppointment); }
    catch (error) { setStatus(agendaStatus, error?.message || 'Não foi possível abrir o atendimento.', 'error'); }
  }
  todayList.addEventListener('click', handleListClick);
  nextList.addEventListener('click', handleListClick);
  closeButton?.addEventListener('click', closeDetail);

  detail.addEventListener('submit', async (event) => {
    const linkForm = event.target.closest?.('[data-public-booking-link]');
    if (linkForm) {
      event.preventDefault();
      const data = new FormData(linkForm);
      const statusEl = linkForm.querySelector('[data-public-booking-link-status]');
      const submit = linkForm.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const id = linkForm.dataset.appointmentId;
        await linkPendingPublicBooking({ client, appointmentId: id, clienteId: data.get('cliente_id') });
        await refreshClients(); await refresh(); await openAppointment(id);
        setStatus(agendaStatus, 'Reserva vinculada ao cadastro oficial.', 'success');
      } catch (error) { setStatus(statusEl, error?.message || 'Não foi possível vincular o cadastro.', 'error'); if (submit) submit.disabled = false; }
      return;
    }
    const form = event.target.closest?.('[data-own-appointment-edit]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const statusEl = form.querySelector('[data-own-appointment-status]');
    try {
      const start = data.get('inicio'); const end = data.get('fim');
      await updateAppointment({ client, appointmentId: form.dataset.appointmentId, procedimentoId: data.get('procedimento_id'), inicioIso: clinicLocalDateTimeToIso(start), fimIso: end ? clinicLocalDateTimeToIso(end) : null, observacao: data.get('observacao') });
      setStatus(statusEl, 'Horário atualizado.', 'success');
      const id = form.dataset.appointmentId; await refresh(); await openAppointment(id);
    } catch (error) { setStatus(statusEl, error?.message || 'Não foi possível atualizar o horário.', 'error'); }
  });

  detail.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-collab-status]');
    if (!button || !currentAppointmentId) return;
    button.disabled = true;
    try { await setAppointmentStatus({ client, appointmentId: currentAppointmentId, status: button.dataset.collabStatus }); closeDetail(); await refresh(); }
    catch (error) { setStatus(agendaStatus, error?.message || 'Não foi possível atualizar o atendimento.', 'error'); button.disabled = false; }
  });

  originFilter?.addEventListener('change', () => { closeDetail(); refresh().catch(() => {}); });
  agendaDate?.addEventListener('change', () => { closeDetail(); refresh().catch(() => {}); });
  agendaProfessional?.addEventListener('change', () => { closeDetail(); refresh().catch(() => {}); });
  syncAttendanceForm(null);
  await loadLookups();
  await refresh();
  const procedurePanel = await initProcedurePanel({ client, profile, root });
  const schedulePanel = manager
    ? await initAdminSchedule({ client, profile, root, staffProvider: async () => staffRows })
    : await initCollaboratorSchedule({ client, profile, root });

  return {
    refresh, refreshClients, openAppointment, closeDetail, procedurePanel, schedulePanel,
    getCurrentAppointment: () => {
      const appointment = appointments.get(currentAppointmentId) || null;
      return appointment && isOwnClinicalAppointment(profile, appointment) ? appointment : null;
    },
  };
}
