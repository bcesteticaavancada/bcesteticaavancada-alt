import {
  listAdminAppointments,
  listAdminClients,
  createClient,
  listActiveProcedures,
  createProcedure,
  listActiveCollaborators,
  createAppointment,
  setAppointmentStatus,
} from './agenda-api.js';
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
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateRangeFromInput(value) {
  const clean = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error('Data da agenda inválida.');
  return clinicDayRange(new Date(`${clean}T12:00:00Z`));
}

function option(label, value) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function replaceOptions(select, items, labelFor, valueFor, emptyText) {
  if (!select) return;
  select.replaceChildren(option(emptyText, ''));
  for (const item of items) select.append(option(labelFor(item), valueFor(item)));
}

function statusClass(status) {
  return ['agendado', 'atendido', 'cancelado', 'faltou'].includes(status)
    ? `bcg-status-${status}`
    : '';
}

export function renderAdminAppointments(appointments = [], staffMap = new Map()) {
  if (!appointments.length) {
    return '<div class="bcg-empty">Nenhum atendimento encontrado para esta data.</div>';
  }

  return `<div class="bcg-agenda-list">${appointments.map((appointment) => {
    const clientName = appointment.clientes?.nome || 'Cliente';
    const procedureName = appointment.procedimentos?.nome || 'Procedimento';
    const staffName = staffMap.get(appointment.colaboradora_user_id) || 'Profissional';
    const status = appointment.status || 'agendado';
    const disabled = status === 'atendido' ? ' disabled' : '';
    return `
      <article class="bcg-appointment-card" data-appointment-id="${escapeHtml(appointment.id)}">
        <div class="bcg-appointment-time">${escapeHtml(formatClinicDateTime(appointment.inicio).split(' ')[1] || formatClinicDateTime(appointment.inicio))}</div>
        <div class="bcg-appointment-main">
          <strong>${escapeHtml(clientName)}</strong>
          <span>${escapeHtml(procedureName)} • ${escapeHtml(staffName)}</span>
        </div>
        <span class="bcg-chip ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
        <div class="bcg-actions">
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
  const agendaList = el('adminAgendaList');
  const agendaStatus = el('adminAgendaStatus');
  const clientForm = el('clientForm');
  const procedureForm = el('procedureForm');
  const appointmentForm = el('appointmentForm');
  const clientSelect = el('appointmentClient');
  const collaboratorSelect = el('appointmentCollaborator');
  const procedureSelect = el('appointmentProcedure');
  const clientsList = el('clientsList');
  const proceduresList = el('proceduresList');

  if (!agendaDate || !agendaList || !clientForm || !procedureForm || !appointmentForm) {
    throw new Error('Estrutura da agenda administrativa incompleta.');
  }

  let clients = [];
  let procedures = [];
  let collaborators = [];

  async function refreshClients() {
    clients = await listAdminClients({ client, search: '' });
    replaceOptions(clientSelect, clients, (item) => item.nome, (item) => item.id, 'Selecione o cliente');
    if (clientsList) clientsList.innerHTML = renderSimpleList(
      clients,
      (item) => `${item.nome} • ${item.telefone}`,
      'Nenhum cliente cadastrado ainda.',
    );
  }

  async function refreshProcedures() {
    procedures = await listActiveProcedures({ client });
    replaceOptions(procedureSelect, procedures, (item) => item.nome, (item) => item.id, 'Selecione o procedimento');
    if (proceduresList) proceduresList.innerHTML = renderSimpleList(
      procedures,
      (item) => item.duracao_padrao ? `${item.nome} • ${item.duracao_padrao} min` : item.nome,
      'Nenhum procedimento ativo cadastrado.',
    );
  }

  async function refreshCollaborators() {
    collaborators = await listActiveCollaborators({ client });
    replaceOptions(collaboratorSelect, collaborators, (item) => item.display_name, (item) => item.user_id, 'Selecione a profissional');
  }

  async function refreshAgenda() {
    setMessage(agendaStatus, 'Carregando agenda…');
    agendaList.innerHTML = '<div class="bcg-empty">Carregando agenda…</div>';
    try {
      const range = dateRangeFromInput(agendaDate.value);
      const appointments = await listAdminAppointments({ client, ...range });
      const staffMap = new Map(collaborators.map((item) => [item.user_id, item.display_name]));
      agendaList.innerHTML = renderAdminAppointments(appointments, staffMap);
      setMessage(agendaStatus, `${appointments.length} atendimento(s) nesta data.`, 'success');
    } catch (error) {
      agendaList.innerHTML = '<div class="bcg-empty">Não foi possível carregar a agenda.</div>';
      setMessage(agendaStatus, error?.message || 'Erro ao carregar agenda.', 'error');
    }
  }

  agendaDate.value = agendaDate.value || clinicDateValue();

  await Promise.all([refreshClients(), refreshProcedures(), refreshCollaborators()]);
  await refreshAgenda();

  agendaDate.addEventListener('change', refreshAgenda);

  clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await withSubmitState(clientForm, el('clientFormStatus'), () => createClient({
        client,
        nome: el('clientNome').value,
        telefone: el('clientTelefone').value,
        email: el('clientEmail').value,
        createdBy: profile.user_id,
      }));
      clientForm.reset();
      await refreshClients();
    } catch {
      // Mantém os campos preenchidos em caso de erro.
    }
  });

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
    } catch {
      // Mantém os campos preenchidos em caso de erro.
    }
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
        createdBy: profile.user_id,
      }));
      appointmentForm.reset();
      await refreshAgenda();
    } catch {
      // Mantém os campos preenchidos em caso de erro.
    }
  });

  agendaList.addEventListener('click', async (event) => {
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
}
