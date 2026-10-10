import {
  listClients,
  getClient,
  createClient,
  updateClient,
  setClientActive,
  listClientHistory,
} from './clientes-api.js';
import { listStaffDirectory } from './agenda-api.js';
import { formatClinicDateTime } from './agenda-format.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function field(label, value) {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  return `<div class="bcg-history-field"><span>${escapeHtml(label)}</span><p>${escapeHtml(clean)}</p></div>`;
}

export function renderClientsList(clients = [], canArchive = false) {
  if (!clients.length) return '<div class="bcg-empty">Nenhum cliente encontrado.</div>';
  return `<div class="bcg-client-list">${clients.map((client) => {
    const status = client.ativo === false ? '<span class="bcg-chip bcg-status-cancelado">Arquivado</span>' : '';
    const adminHint = canArchive && client.ativo === false ? '<span class="bcg-muted">Disponível para reativação</span>' : '';
    return `<article class="bcg-client-card" data-client-id="${escapeHtml(client.id)}">
      <div><strong>${escapeHtml(client.nome || 'Cliente')}</strong><span>${escapeHtml(client.telefone || '')}</span>${adminHint}</div>
      ${status}
      <button type="button" class="bcg-small-button" data-open-client="${escapeHtml(client.id)}">Abrir cliente</button>
    </article>`;
  }).join('')}</div>`;
}

export function renderClientEditor(client, canArchive = false) {
  if (!client?.id) return '<div class="bcg-empty">Selecione um cliente para abrir a ficha.</div>';
  const active = client.ativo !== false;
  const archiveAction = canArchive
    ? `<button type="button" class="bcg-small-button" data-toggle-client="${active ? 'false' : 'true'}">${active ? 'Arquivar cliente' : 'Reativar cliente'}</button>`
    : '';
  return `<form class="bcg-form bcg-form-grid" data-client-edit-form data-client-id="${escapeHtml(client.id)}">
    <label>Nome<input class="bcg-input" name="nome" value="${escapeHtml(client.nome || '')}" required></label>
    <label>Telefone<input class="bcg-input" name="telefone" value="${escapeHtml(client.telefone || '')}" required></label>
    <label>E-mail <span class="bcg-optional">opcional</span><input class="bcg-input" name="email" type="email" value="${escapeHtml(client.email || '')}"></label>
    <div class="bcg-form-actions bcg-field-wide">
      <button class="bcg-button" type="submit">Salvar alterações</button>
      ${archiveAction}
      <span class="bcg-status" data-client-edit-status role="status" aria-live="polite"></span>
    </div>
  </form>`;
}

export function renderClientHistory(history = [], staffMap = new Map()) {
  if (!history.length) return '<div class="bcg-empty">Nenhum atendimento registrado para este cliente.</div>';
  return `<div class="bcg-history-timeline">${history.map((entry) => {
    const professional = staffMap.get(entry.colaboradora_user_id) || 'Profissional';
    const procedure = entry.procedimentos?.nome || 'Procedimento';
    return `<article class="bcg-history-entry">
      <header><div><strong>${escapeHtml(procedure)}</strong><span>${escapeHtml(professional)}</span></div><time>${escapeHtml(formatClinicDateTime(entry.data_atendimento))}</time></header>
      <div class="bcg-history-grid">
        ${field('Queixa / objetivo', entry.queixa_objetivo)}
        ${field('Observações', entry.observacoes)}
        ${field('Reações', entry.reacoes)}
        ${field('Intercorrências', entry.intercorrencias)}
        ${field('Feedback da cliente', entry.feedback_cliente)}
        ${field('Orientações', entry.orientacoes)}
        ${field('Próxima sessão', entry.recomendacao_proxima_sessao)}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function setStatus(element, message, kind = '') {
  if (!element) return;
  element.textContent = message || '';
  if (!element.dataset) element.dataset = {};
  element.dataset.kind = kind;
}

export async function runFormSubmit({ form, statusEl, action, resetOnSuccess = false }) {
  const submit = form?.querySelector?.('[type="submit"]');
  if (form?.dataset?.submitting === 'true') return null;
  if (form?.dataset) form.dataset.submitting = 'true';
  if (submit) submit.disabled = true;
  setStatus(statusEl, 'Salvando…');
  try {
    const result = await action();
    if (resetOnSuccess) form?.reset?.();
    setStatus(statusEl, 'Salvo com sucesso.', 'success');
    return result;
  } catch (error) {
    setStatus(statusEl, error?.message || 'Não foi possível concluir a operação.', 'error');
    throw error;
  } finally {
    if (submit) submit.disabled = false;
    if (form?.dataset) delete form.dataset.submitting;
  }
}

export async function notifyClientsChanged(callback) {
  if (typeof callback !== 'function') return;
  await callback();
}

export async function initClientesPanel({
  client,
  profile,
  root = document,
  canArchive = false,
  onClientsChanged = null,
}) {
  if (!client || !profile?.user_id || !root) throw new Error('Contexto de clientes inválido.');
  const el = (id) => root.getElementById(id);
  const search = el('clientsSearch');
  const list = el('clientsList');
  const createForm = el('clientCreateForm');
  const editor = el('clientEditor');
  const timeline = el('clientHistoryTimeline');
  const createStatus = el('clientCreateStatus');
  if (!search || !list || !createForm || !editor || !timeline) {
    throw new Error('Estrutura do painel de clientes incompleta.');
  }

  let staffMap = new Map();
  let currentClientId = null;

  async function refreshClients() {
    const clients = await listClients({
      client,
      search: search.value,
      includeArchived: canArchive,
    });
    list.innerHTML = renderClientsList(clients, canArchive);
    return clients;
  }

  async function openClient(clienteId) {
    currentClientId = clienteId;
    editor.innerHTML = '<div class="bcg-empty">Carregando ficha…</div>';
    timeline.innerHTML = '<div class="bcg-empty">Carregando histórico…</div>';
    const [record, history] = await Promise.all([
      getClient({ client, clienteId }),
      listClientHistory({ client, clienteId }),
    ]);
    editor.innerHTML = renderClientEditor(record, canArchive);
    timeline.innerHTML = renderClientHistory(history, staffMap);
    return record;
  }

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(createForm);
    try {
      const id = await runFormSubmit({
        form: createForm,
        statusEl: createStatus,
        resetOnSuccess: true,
        action: () => createClient({
          client,
          nome: data.get('nome'),
          telefone: data.get('telefone'),
          email: data.get('email'),
        }),
      });
      if (id) {
        await refreshClients();
        await notifyClientsChanged(onClientsChanged);
        await openClient(id);
      }
    } catch {
      // Campos permanecem preenchidos em falha.
    }
  });

  search.addEventListener('input', () => {
    refreshClients().catch(() => {
      list.innerHTML = '<div class="bcg-empty">Não foi possível carregar os clientes.</div>';
    });
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-open-client]');
    if (!button) return;
    openClient(button.dataset.openClient).catch(() => {
      editor.innerHTML = '<div class="bcg-empty">Não foi possível abrir o cliente.</div>';
    });
  });

  editor.addEventListener('submit', async (event) => {
    const form = event.target.closest?.('[data-client-edit-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const statusEl = form.querySelector('[data-client-edit-status]');
    try {
      await runFormSubmit({
        form,
        statusEl,
        action: () => updateClient({
          client,
          clienteId: form.dataset.clientId,
          nome: data.get('nome'),
          telefone: data.get('telefone'),
          email: data.get('email'),
        }),
      });
      await refreshClients();
      await notifyClientsChanged(onClientsChanged);
      await openClient(form.dataset.clientId);
    } catch {
      // Editor mantém valores em falha.
    }
  });

  editor.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-toggle-client]');
    if (!button || !canArchive || !currentClientId) return;
    button.disabled = true;
    try {
      await setClientActive({
        client,
        clienteId: currentClientId,
        active: button.dataset.toggleClient === 'true',
      });
      await refreshClients();
      await notifyClientsChanged(onClientsChanged);
      await openClient(currentClientId);
    } finally {
      button.disabled = false;
    }
  });

  const staff = await listStaffDirectory({ client });
  staffMap = new Map(staff.map((item) => [item.user_id, item.display_name]));
  await refreshClients();

  return {
    refreshClients,
    openClient,
    getCurrentClientId: () => currentClientId,
  };
}
