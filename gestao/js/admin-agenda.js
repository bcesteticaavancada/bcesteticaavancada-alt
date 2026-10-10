import {
  listAdminAppointments,
  listActiveProcedures,
  createProcedure,
  listStaffDirectory,
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
} from './agenda-api.js';
import { listClients } from './clientes-api.js';
import {
  CLINIC_TIME_ZONE,
  clinicDayRange,
  clinicLocalDateTimeToIso,
  formatClinicDateTime,
  statusLabel,
} from './agenda-format.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clinicDateValue(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localInputValue(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CLINIC_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(iso))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function dateRangeFromInput(value) {
  const clean = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error('Data da agenda inválida.');
  return clinicDayRange(new Date(`${clean}T12:00:00Z`));
}

function statusClass(status) {
  return ['agendado', 'atendido', 'cancelado', 'faltou'].includes(status)
    ? `bcg-status-${status}` : '';
}

export function renderProfessionalOptions(staff = [], { includeAll = false, selected = '' } = {}) {
  const options = [];
  if (includeAll) options.push(`<option value=""${selected === '' ? ' selected' : ''}>Todas</option>`);
  else options.push('<option value="">Selecione a profissional</option>');
  for (const item of staff) {
    const isSelected = String(item.user_id) === String(selected);
    options.push(`<option value="${escapeHtml(item.user_id)}"${isSelected ? ' selected' : ''}>${escapeHtml(item.display_name || 'Profissional')}</option>`);
  }
  return options.join('');
}

function renderNamedOptions(items = [], selected = '', empty = 'Selecione') {
  return `<option value="">${escapeHtml(empty)}</option>${items.map((item) => `<option value="${escapeHtml(item.id)}"${String(item.id) === String(selected) ? ' selected' : ''}>${escapeHtml(item.nome)}</option>`).join('')}`;
}

export function filterAdminAppointments(appointments = [], professionalId = '') {
  const id = String(professionalId ?? '').trim();
  return id ? appointments.filter((item) => String(item.colaboradora_user_id) === id) : appointments;
}

export function renderAdminAppointments(appointments = [], staffMap = new Map()) {
  if (!appointments.length) return '<div class="bcg-empty">Nenhum atendimento encontrado para esta data.</div>';
  return `<div class="bcg-agenda-list">${appointments.map((appointment) => {
    const clientName = appointment.clientes?.nome || 'Cliente';
    const procedureName = appointment.procedimentos?.nome || 'Procedimento';
    const staffName = staffMap.get(appointment.colaboradora_user_id) || 'Profissional';
    const status = appointment.status || 'agendado';
    const disabled = status === 'atendido' ? ' disabled' : '';
    return `<article class="bcg-appointment-card" data-appointment-id="${escapeHtml(appointment.id)}">
      <div class="bcg-appointment-time">${escapeHtml((formatClinicDateTime(appointment.inicio).match(/\b\d{2}:\d{2}\b/) || [formatClinicDateTime(appointment.inicio)])[0])}</div>
      <div class="bcg-appointment-main"><strong>${escapeHtml(clientName)}</strong><span>${escapeHtml(procedureName)} • ${escapeHtml(staffName)}</span></div>
      <span class="bcg-chip ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
      <div class="bcg-actions">
        <button type="button" class="bcg-small-button" data-admin-edit="${escapeHtml(appointment.id)}"${disabled}>Editar</button>
        <button type="button" class="bcg-small-button" data-admin-status="agendado"${disabled}>Agendado</button>
        <button type="button" class="bcg-small-button" data-admin-status="atendido"${disabled}>Atendido</button>
        <button type="button" class="bcg-small-button" data-admin-status="faltou"${disabled}>Faltou</button>
        <button type="button" class="bcg-small-button" data-admin-status="cancelado"${disabled}>Cancelar</button>
      </div>
    </article>`;
  }).join('')}</div>`;
}

function renderSimpleList(items, textFor, emptyText) {
  if (!items.length) return `<div class="bcg-empty">${escapeHtml(emptyText)}</div>`;
  return `<div class="bcg-compact-list">${items.map((item) => `<div>${escapeHtml(textFor(item))}</div>`).join('')}</div>`;
}

function setMessage(element, message, kind = '') {
  if (!element) return;
  element.textContent = message || '';
  element.dataset.kind = kind;
}

async function withSubmitState(form, statusEl, action) {
  const submit = form?.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  setMessage(statusEl, 'Salvando…');
  try {
    const result = await action();
    setMessage(statusEl, 'Salvo com sucesso.', 'success');
    return result;
  } catch (error) {
    setMessage(statusEl, error?.message || 'Não foi possível concluir a operação.', 'error');
    throw error;
  } finally {
    if (submit) submit.disabled = false;
  }
}

export async function initAdminAgenda({ client, profile, root = document }) {
  if (!client || !profile?.user_id || !root) throw new Error('Contexto administrativo inválido.');
  const el = (id) => root.getElementById(id);
  const agendaDate = el('adminAgendaDate');
  const professionalFilter = el('adminAgendaProfessionalFilter');
  const agendaList = el('adminAgendaList');
  const agendaStatus = el('adminAgendaStatus');
  const procedureForm = el('procedureForm');
  const appointmentForm = el('appointmentForm');
  const clientSelect = el('appointmentClient');
  const collaboratorSelect = el('appointmentCollaborator');
  const procedureSelect = el('appointmentProcedure');
  const proceduresList = el('proceduresList');
  const editForm = el('adminAppointmentEditForm');
  const editProfessional = el('adminEditProfessional');
  const editProcedure = el('adminEditProcedure');
  const editStart = el('adminEditStart');
  const editEnd = el('adminEditEnd');
  const editNote = el('adminEditNote');

  if (!agendaDate || !professionalFilter || !agendaList || !procedureForm || !appointmentForm || !editForm) {
    throw new Error('Estrutura da agenda administrativa incompleta.');
  }

  let clients = [];
  let procedures = [];
  let staff = [];
  let allAppointments = [];
  let appointmentMap = new Map();

  async function refreshClients() {
    clients = await listClients({ client });
    clientSelect.innerHTML = renderNamedOptions(clients, '', 'Selecione o cliente');
    return clients;
  }

  async function refreshProcedures() {
    procedures = await listActiveProcedures({ client });
    procedureSelect.innerHTML = renderNamedOptions(procedures, '', 'Selecione o procedimento');
    editProcedure.innerHTML = renderNamedOptions(procedures, '', 'Selecione o procedimento');
    if (proceduresList) proceduresList.innerHTML = renderSimpleList(
      procedures,
      (item) => item.duracao_padrao ? `${item.nome} • ${item.duracao_padrao} min` : item.nome,
      'Nenhum procedimento ativo cadastrado.',
    );
    return procedures;
  }

  async function refreshCollaborators() {
    const priorFilter = professionalFilter.value;
    staff = await listStaffDirectory({ client });
    collaboratorSelect.innerHTML = renderProfessionalOptions(staff);
    professionalFilter.innerHTML = renderProfessionalOptions(staff, { includeAll: true, selected: priorFilter });
    return staff;
  }

  function staffMap() {
    return new Map(staff.map((item) => [item.user_id, item.display_name]));
  }

  function renderCurrentAgenda() {
    const filtered = filterAdminAppointments(allAppointments, professionalFilter.value);
    agendaList.innerHTML = renderAdminAppointments(filtered, staffMap());
    setMessage(agendaStatus, `${filtered.length} atendimento(s) nesta visão.`, 'success');
    return filtered;
  }

  async function refreshAgenda() {
    setMessage(agendaStatus, 'Carregando agenda…');
    agendaList.innerHTML = '<div class="bcg-empty">Carregando agenda…</div>';
    try {
      allAppointments = await listAdminAppointments({ client, ...dateRangeFromInput(agendaDate.value) });
      appointmentMap = new Map(allAppointments.map((item) => [item.id, item]));
      return renderCurrentAgenda();
    } catch (error) {
      agendaList.innerHTML = '<div class="bcg-empty">Não foi possível carregar a agenda.</div>';
      setMessage(agendaStatus, error?.message || 'Erro ao carregar agenda.', 'error');
      throw error;
    }
  }

  function openEdit(appointmentId) {
    const appointment = appointmentMap.get(appointmentId);
    if (!appointment) throw new Error('Agendamento não encontrado.');
    editForm.dataset.appointmentId = appointment.id;
    editProfessional.textContent = staffMap().get(appointment.colaboradora_user_id) || 'Profissional';
    editProcedure.innerHTML = renderNamedOptions(procedures, appointment.procedimento_id, 'Selecione o procedimento');
    editStart.value = localInputValue(appointment.inicio);
    editEnd.value = localInputValue(appointment.fim);
    editNote.value = appointment.observacao_administrativa || '';
    editForm.hidden = false;
    editForm.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    return appointment;
  }

  agendaDate.value = agendaDate.value || clinicDateValue();
  await Promise.all([refreshClients(), refreshProcedures(), refreshCollaborators()]);
  await refreshAgenda();

  agendaDate.addEventListener('change', refreshAgenda);
  professionalFilter.addEventListener('change', renderCurrentAgenda);

  procedureForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await withSubmitState(procedureForm, el('procedureFormStatus'), () => createProcedure({
        client,
        nome: el('procedureNome').value,
        duracaoPadrao: el('procedureDuration').value,
        createdBy: profile.user_id,
      }));
      procedureForm.reset();
      await refreshProcedures();
    } catch {}
  });

  appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const startValue = el('appointmentStart').value;
    const endValue = el('appointmentEnd').value;
    try {
      await withSubmitState(appointmentForm, el('appointmentFormStatus'), () => createAppointment({
        client,
        clienteId: clientSelect.value,
        colaboradoraUserId: collaboratorSelect.value,
        procedimentoId: procedureSelect.value,
        inicioIso: clinicLocalDateTimeToIso(startValue),
        fimIso: endValue ? clinicLocalDateTimeToIso(endValue) : null,
        observacao: el('appointmentNote').value,
      }));
      appointmentForm.reset();
      await refreshAgenda();
    } catch {}
  });

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const startValue = editStart.value;
    const endValue = editEnd.value;
    try {
      await withSubmitState(editForm, el('adminAppointmentEditStatus'), () => updateAppointment({
        client,
        appointmentId: editForm.dataset.appointmentId,
        procedimentoId: editProcedure.value,
        inicioIso: clinicLocalDateTimeToIso(startValue),
        fimIso: endValue ? clinicLocalDateTimeToIso(endValue) : null,
        observacao: editNote.value,
      }));
      editForm.hidden = true;
      await refreshAgenda();
    } catch {}
  });

  el('adminAppointmentEditCancel')?.addEventListener('click', () => { editForm.hidden = true; });

  agendaList.addEventListener('click', async (event) => {
    const editButton = event.target.closest?.('[data-admin-edit]');
    if (editButton) {
      try { openEdit(editButton.dataset.adminEdit); }
      catch (error) { setMessage(agendaStatus, error?.message || 'Não foi possível editar.', 'error'); }
      return;
    }
    const button = event.target.closest?.('[data-admin-status]');
    if (!button) return;
    const card = button.closest('[data-appointment-id]');
    const appointmentId = card?.dataset?.appointmentId;
    if (!appointmentId) return;
    button.disabled = true;
    try {
      await setAppointmentStatus({ client, appointmentId, status: button.dataset.adminStatus });
      await refreshAgenda();
    } catch (error) {
      setMessage(agendaStatus, error?.message || 'Não foi possível atualizar o status.', 'error');
      button.disabled = false;
    }
  });

  return {
    refreshAgenda,
    refreshClients,
    refreshCollaborators,
    getStaffMap: staffMap,
    showMyAgenda: () => {
      professionalFilter.value = profile.user_id;
      return renderCurrentAgenda();
    },
  };
}
