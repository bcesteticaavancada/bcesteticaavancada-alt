import {
  listClients,
  getClient,
  createClientV2,
  updateClientV2,
  setClientActive,
  listClientHistory,
  findPotentialDuplicates,
} from './clientes-api.js?v=20261018-basic';
import { listStaffDirectory } from './agenda-api.js';
import { calculateAge, formatCpf, isMinor, normalizeCpf } from './clientes-domain.js?v=20261018-basic';
import {
  renderClientCadastroForm,
  renderClientFolder,
  renderClientTimeline,
} from './clientes-folder.js?v=20261018-basic';
import {
  uploadClientIdPhoto,
  listClientIdPhotos,
  getClientIdPhotoUrl,
  setCurrentClientIdPhoto,
} from './clientes-photo-api.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clientAgeLabel(client) {
  const age = calculateAge(client?.data_nascimento);
  return age === null ? '' : `${age} anos`;
}

export function renderClientsList(clients = [], canArchive = false) {
  if (!clients.length) return '<div class="bcg-empty">Nenhum cliente encontrado.</div>';
  return `<div class="bcg-client-list">${clients.map((client) => {
    const status = client.ativo === false ? '<span class="bcg-chip bcg-status-cancelado">Arquivado</span>' : '';
    const adminHint = canArchive && client.ativo === false ? '<span class="bcg-muted">Disponível para reativação</span>' : '';
    const age = clientAgeLabel(client);
    const identity = [client.cpf ? formatCpf(client.cpf) : '', client.telefone || '', age].filter(Boolean).join(' • ');
    return `<article class="bcg-client-card" data-client-id="${escapeHtml(client.id)}">
      <div><strong>${escapeHtml(client.nome || 'Cliente')}</strong><span>${escapeHtml(identity)}</span>${adminHint}</div>
      ${status}
      <button type="button" class="bcg-small-button" data-open-client="${escapeHtml(client.id)}">Abrir prontuário</button>
    </article>`;
  }).join('')}</div>`;
}

export function renderClientEditor(client, canArchive = false) {
  return renderClientCadastroForm(client, canArchive);
}

export function renderClientHistory(history = [], staffMap = new Map()) {
  return renderClientTimeline(history, staffMap);
}

function setStatus(element, message, kind = '') {
  if (!element) return;
  element.textContent = message || '';
  if (!element.dataset) element.dataset = {};
  element.dataset.kind = kind;
}

function formValue(data, name) {
  return String(data.get(name) ?? '').trim();
}

function buildCreatePayload(form) {
  const data = new FormData(form);
  return {
    nome: formValue(data, 'nome'),
    cpf: formValue(data, 'cpf'),
    data_nascimento: formValue(data, 'data_nascimento'),
    telefone: formValue(data, 'telefone'),
    email: formValue(data, 'email'),
    responsavel_nome: formValue(data, 'responsavel_nome'),
    responsavel_cpf: formValue(data, 'responsavel_cpf'),
    responsavel_parentesco: formValue(data, 'responsavel_parentesco'),
    responsavel_telefone: formValue(data, 'responsavel_telefone'),
  };
}

function buildEditPayload(form) {
  const data = new FormData(form);
  return {
    nome: formValue(data, 'nome'),
    cpf: formValue(data, 'cpf'),
    data_nascimento: formValue(data, 'data_nascimento'),
    telefone: formValue(data, 'telefone'),
    email: formValue(data, 'email'),
    cep: formValue(data, 'cep'),
    logradouro: formValue(data, 'logradouro'),
    numero: formValue(data, 'numero'),
    complemento: formValue(data, 'complemento'),
    bairro: formValue(data, 'bairro'),
    cidade: formValue(data, 'cidade'),
    uf: formValue(data, 'uf').toUpperCase(),
    responsavel_nome: formValue(data, 'responsavel_nome'),
    responsavel_cpf: formValue(data, 'responsavel_cpf'),
    responsavel_parentesco: formValue(data, 'responsavel_parentesco'),
    responsavel_telefone: formValue(data, 'responsavel_telefone'),
  };
}

export function updateGuardianState(form, { edit = false } = {}) {
  const birth = form?.querySelector?.('[name="data_nascimento"]');
  const agePreview = edit
    ? form?.querySelector?.('[data-client-edit-age]')
    : form?.querySelector?.('#clientAgePreview') || form?.ownerDocument?.getElementById?.('clientAgePreview');
  const guardian = edit
    ? form?.querySelector?.('[data-client-edit-guardian]')
    : form?.querySelector?.('#clientGuardianFields') || form?.ownerDocument?.getElementById?.('clientGuardianFields');
  if (!birth || !guardian) return;
  const age = calculateAge(birth.value);
  if (agePreview) agePreview.textContent = age === null ? 'Idade calculada automaticamente' : `${age} anos`;
  const minor = isMinor(birth.value);
  const hasGuardianData = [...guardian.querySelectorAll('input,select')].some((input) => input.value?.trim());
  guardian.hidden = !minor && !hasGuardianData;
  guardian.querySelectorAll?.('input,select')?.forEach?.((input) => {
    input.required = false;
  });
}

function renderDuplicateChoice(statusEl, candidates, { exactCpf = false } = {}) {
  if (!statusEl || !candidates?.length) return;
  const candidate = candidates[0];
  const label = exactCpf
    ? 'CPF já cadastrado na BC Estética.'
    : 'Encontramos um cadastro com o mesmo nome e telefone. Confira antes de cadastrar novamente.';
  statusEl.dataset.kind = 'warning';
  statusEl.innerHTML = `${escapeHtml(label)} <button type="button" class="bcg-small-button" data-open-duplicate="${escapeHtml(candidate.id)}">Abrir prontuário existente</button>${exactCpf ? '' : ' <button type="button" class="bcg-small-button" data-confirm-duplicate>Cadastrar mesmo assim</button>'}`;
}

async function loadPhotoPresentation(client, clienteId) {
  const photos = await listClientIdPhotos({ client, clienteId });
  const photoHistory = await Promise.all(photos.map(async (photo) => {
    try {
      return { ...photo, url: await getClientIdPhotoUrl({ client, storagePath: photo.storage_path }) };
    } catch {
      return { ...photo, url: '' };
    }
  }));
  const current = photoHistory.find((photo) => photo.atual) || null;
  return {
    photoHistory,
    currentPhotoId: current?.id || null,
    photoUrl: current?.url || '',
  };
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
    editor.innerHTML = '<div class="bcg-empty">Carregando pasta…</div>';
    timeline.innerHTML = '';
    const legacyHistoryPanel = timeline.closest?.('.bcg-detail-history');
    if (legacyHistoryPanel) legacyHistoryPanel.hidden = true;
    const [record, history, photos] = await Promise.all([
      getClient({ client, clienteId }),
      listClientHistory({ client, clienteId }),
      loadPhotoPresentation(client, clienteId),
    ]);
    const folderClient = { ...record, foto_identificacao_id: photos.currentPhotoId };
    editor.innerHTML = renderClientFolder({
      client: folderClient,
      history,
      staffMap,
      canArchive,
      photoUrl: photos.photoUrl,
      photoHistory: photos.photoHistory,
    });
    return folderClient;
  }

  updateGuardianState(createForm);
  createForm.querySelector?.('[name="data_nascimento"]')?.addEventListener?.('change', () => updateGuardianState(createForm));
  createForm.querySelector?.('[name="data_nascimento"]')?.addEventListener?.('input', () => updateGuardianState(createForm));

  createForm.addEventListener('click', (event) => {
    const openButton = event.target.closest?.('[data-open-duplicate]');
    if (openButton) {
      openClient(openButton.dataset.openDuplicate).catch(() => setStatus(createStatus, 'Não foi possível abrir o prontuário.', 'error'));
      return;
    }
    const confirmButton = event.target.closest?.('[data-confirm-duplicate]');
    if (confirmButton) {
      createForm.dataset.duplicateConfirmed = 'true';
      createForm.requestSubmit?.();
    }
  });

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = buildCreatePayload(createForm);
    try {
      const candidates = await findPotentialDuplicates({
        client,
        cpf: payload.cpf,
        nome: payload.nome,
        dataNascimento: payload.data_nascimento,
        telefone: payload.telefone,
      });
      const cpf = normalizeCpf(payload.cpf);
      const exact = candidates.filter((item) => cpf && normalizeCpf(item.cpf) === cpf);
      if (exact.length) {
        renderDuplicateChoice(createStatus, exact, { exactCpf: true });
        return;
      }
      if (candidates.length && createForm.dataset.duplicateConfirmed !== 'true') {
        renderDuplicateChoice(createStatus, candidates);
        return;
      }

      delete createForm.dataset.duplicateConfirmed;
      const id = await runFormSubmit({
        form: createForm,
        statusEl: createStatus,
        resetOnSuccess: true,
        action: () => createClientV2({ client, payload }),
      });
      updateGuardianState(createForm);
      if (id) {
        await refreshClients();
        await notifyClientsChanged(onClientsChanged);
        await openClient(id);
      }
    } catch (error) {
      if (/cpf.+cadastrad/i.test(error?.message || '')) {
        try {
          const candidates = await findPotentialDuplicates({
            client,
            cpf: payload.cpf,
            nome: payload.nome,
            dataNascimento: payload.data_nascimento,
            telefone: payload.telefone,
          });
          if (candidates.length) renderDuplicateChoice(createStatus, candidates, { exactCpf: true });
        } catch {
          setStatus(createStatus, error?.message || 'CPF já cadastrado.', 'error');
        }
      } else {
        setStatus(createStatus, error?.message || 'Não foi possível cadastrar a cliente.', 'error');
      }
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
      editor.innerHTML = '<div class="bcg-empty">Não foi possível abrir a cliente.</div>';
    });
  });

  editor.addEventListener('click', async (event) => {
    const tab = event.target.closest?.('[data-folder-tab]');
    if (tab) {
      const folder = tab.closest?.('[data-client-folder]');
      folder?.querySelectorAll?.('[data-folder-tab]')?.forEach?.((item) => item.classList.toggle('is-active', item === tab));
      folder?.querySelectorAll?.('[data-folder-panel]')?.forEach?.((panel) => {
        panel.hidden = panel.dataset.folderPanel !== tab.dataset.folderTab;
      });
      return;
    }

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

  editor.addEventListener('change', async (event) => {
    const input = event.target.closest?.('[data-client-photo-input]');
    if (!input || !currentClientId || !input.files?.[0]) return;
    const folder = input.closest?.('[data-client-folder]');
    const statusEl = folder?.querySelector?.('[data-client-photo-status]');
    input.disabled = true;
    setStatus(statusEl, 'Enviando foto…');
    try {
      const { fotoId } = await uploadClientIdPhoto({
        client,
        clienteId: currentClientId,
        file: input.files[0],
      });
      await setCurrentClientIdPhoto({ client, clienteId: currentClientId, fotoId });
      await openClient(currentClientId);
    } catch (error) {
      setStatus(statusEl, error?.message || 'Não foi possível atualizar a foto.', 'error');
    } finally {
      input.disabled = false;
      input.value = '';
    }
  });

  editor.addEventListener('input', (event) => {
    if (event.target?.name !== 'data_nascimento') return;
    const form = event.target.closest?.('[data-client-edit-form]');
    updateGuardianState(form, { edit: true });
  });

  editor.addEventListener('submit', async (event) => {
    const form = event.target.closest?.('[data-client-edit-form]');
    if (!form) return;
    event.preventDefault();
    const statusEl = form.querySelector('[data-client-edit-status]');
    try {
      await runFormSubmit({
        form,
        statusEl,
        action: () => updateClientV2({
          client,
          clienteId: form.dataset.clientId,
          payload: buildEditPayload(form),
        }),
      });
      await refreshClients();
      await notifyClientsChanged(onClientsChanged);
      await openClient(form.dataset.clientId);
    } catch {
      // Editor mantém valores em falha.
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
