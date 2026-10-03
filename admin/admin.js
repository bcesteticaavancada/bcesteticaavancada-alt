import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../agendamento/js/config.js';

const SESSION_KEY = 'bc.admin.session.v1';
const ALLOWED_STATUS = new Set(['recebida', 'em_avaliacao', 'avaliada']);
const defaultConfig = { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };

function cleanConfig(config = defaultConfig) {
  return {
    url: String(config?.url || '').replace(/\/+$/, ''),
    key: String(config?.key || ''),
  };
}

function headers(session, config = defaultConfig, extra = {}) {
  const cfg = cleanConfig(config);
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${session.accessToken}`,
    Accept: 'application/json',
    ...extra,
  };
}

async function jsonResponse(response, fallback) {
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || fallback || `Falha HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function startOfLocalDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  return new Date(`${date}T00:00:00-03:00`).toISOString();
}

function endOfLocalDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  return new Date(`${date}T23:59:59.999-03:00`).toISOString();
}

export function buildListUrl(filters = {}, config = defaultConfig) {
  const cfg = cleanConfig(config);
  const params = new URLSearchParams();
  params.set('select', 'id,public_code,created_at,status,patient_name,patient_email,patient_phone,procedure,pdf_path');
  params.set('order', 'created_at.desc');
  params.set('limit', '100');
  const publicCode = String(filters.publicCode || '').trim();
  const patientName = String(filters.patientName || '').trim();
  if (publicCode) params.set('public_code', `ilike.*${publicCode}*`);
  if (patientName) params.set('patient_name', `ilike.*${patientName}*`);
  const from = startOfLocalDate(filters.from);
  const to = endOfLocalDate(filters.to);
  if (from) params.set('created_at', `gte.${from}`);
  if (to) params.append('created_at', `lte.${to}`);
  return `${cfg.url}/rest/v1/pre_anamneses?${params.toString()}`;
}

export async function signIn(email, password, fetchImpl = fetch, config = defaultConfig, now = Date.now) {
  const cfg = cleanConfig(config);
  const response = await fetchImpl(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cfg.key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') }),
  });
  const data = await jsonResponse(response, 'Não foi possível entrar.');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Number(now()) + Number(data.expires_in || 3600) * 1000,
    user: { id: data.user?.id, email: data.user?.email || String(email || '').trim() },
  };
}

export async function refreshSession(session, fetchImpl = fetch, config = defaultConfig, now = Date.now) {
  if (!session?.refreshToken) throw new Error('Sessão expirada. Entre novamente.');
  const cfg = cleanConfig(config);
  const response = await fetchImpl(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: cfg.key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  const data = await jsonResponse(response, 'Sua sessão expirou. Entre novamente.');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || session.refreshToken,
    expiresAt: Number(now()) + Number(data.expires_in || 3600) * 1000,
    user: { id: data.user?.id || session.user?.id, email: data.user?.email || session.user?.email || '' },
  };
}

export async function authorizeAdmin(session, fetchImpl = fetch, config = defaultConfig) {
  if (!session?.user?.id) throw new Error('Sessão inválida.');
  const cfg = cleanConfig(config);
  const params = new URLSearchParams({ select: 'user_id,display_name,role,active', user_id: `eq.${session.user.id}`, active: 'eq.true', limit: '1' });
  const response = await fetchImpl(`${cfg.url}/rest/v1/admin_users?${params}`, { headers: headers(session, cfg) });
  const rows = await jsonResponse(response, 'Não foi possível verificar a autorização.');
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Seu usuário não está autorizado para a área interna da BC.');
  return rows[0];
}

export async function loadPreAnamneses(session, filters = {}, fetchImpl = fetch, config = defaultConfig) {
  const response = await fetchImpl(buildListUrl(filters, config), { headers: headers(session, config) });
  const rows = await jsonResponse(response, 'Não foi possível carregar as fichas.');
  return Array.isArray(rows) ? rows : [];
}

export async function loadPreAnamnese(session, id, fetchImpl = fetch, config = defaultConfig) {
  const cfg = cleanConfig(config);
  const params = new URLSearchParams({ select: '*', id: `eq.${String(id || '')}`, limit: '1' });
  const response = await fetchImpl(`${cfg.url}/rest/v1/pre_anamneses?${params}`, { headers: headers(session, cfg) });
  const rows = await jsonResponse(response, 'Não foi possível abrir a ficha.');
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Ficha não encontrada.');
  return rows[0];
}

export async function updateStatus(session, id, status, fetchImpl = fetch, config = defaultConfig) {
  if (!ALLOWED_STATUS.has(status)) throw new Error('Status inválido.');
  const cfg = cleanConfig(config);
  const params = new URLSearchParams({ id: `eq.${String(id || '')}` });
  const response = await fetchImpl(`${cfg.url}/rest/v1/pre_anamneses?${params}`, {
    method: 'PATCH',
    headers: headers(session, cfg, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ status }),
  });
  const rows = await jsonResponse(response, 'Não foi possível atualizar o status.');
  return Array.isArray(rows) ? rows[0] : rows;
}

function encodeStoragePath(path) {
  return String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

export async function getPdfSignedUrl(session, path, fetchImpl = fetch, config = defaultConfig) {
  if (!path) throw new Error('Esta ficha ainda não possui PDF disponível.');
  const cfg = cleanConfig(config);
  const objectPath = encodeStoragePath(path);
  const response = await fetchImpl(`${cfg.url}/storage/v1/object/sign/pre-anamnese-pdfs/${objectPath}`, {
    method: 'POST',
    headers: headers(session, cfg, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn: 600 }),
  });
  const data = await jsonResponse(response, 'Não foi possível liberar o PDF.');
  const signed = data?.signedURL || data?.signedUrl || data?.signed_url;
  if (!signed) throw new Error('O Supabase não retornou o link temporário do PDF.');
  return /^https?:\/\//.test(signed) ? signed : `${cfg.url}${signed.startsWith('/') ? '' : '/'}${signed}`;
}

export async function logout(session, fetchImpl = fetch, config = defaultConfig) {
  if (!session?.accessToken) return;
  const cfg = cleanConfig(config);
  try {
    await fetchImpl(`${cfg.url}/auth/v1/logout`, { method: 'POST', headers: headers(session, cfg) });
  } catch { /* local logout remains valid */ }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function statusLabel(value) {
  return ({ recebida: 'Recebida', em_avaliacao: 'Em avaliação', avaliada: 'Avaliada' })[value] || value || '-';
}

function initializeAdmin() {
  const loginCard = document.getElementById('loginCard');
  if (!loginCard) return;
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const dashboard = document.getElementById('dashboard');
  const adminName = document.getElementById('adminName');
  const logoutButton = document.getElementById('logoutButton');
  const filtersForm = document.getElementById('filtersForm');
  const rowsMount = document.getElementById('rowsMount');
  const emptyState = document.getElementById('emptyState');
  const detail = document.getElementById('detail');
  const detailBody = document.getElementById('detailBody');
  const closeDetail = document.getElementById('closeDetail');
  let session = null;
  let admin = null;
  let activeRow = null;

  function setMessage(node, message = '', isError = false) {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', isError && Boolean(message));
  }

  function saveSession(value) {
    session = value;
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  async function readySession() {
    if (!session) throw new Error('Faça login novamente.');
    if (Number(session.expiresAt || 0) - Date.now() < 60_000) {
      saveSession(await refreshSession(session));
    }
    return session;
  }

  function setLoggedIn(value) {
    loginCard.hidden = value;
    dashboard.hidden = !value;
  }

  function renderRows(rows) {
    rowsMount.textContent = '';
    emptyState.hidden = rows.length > 0;
    for (const row of rows) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'record-card';
      const top = document.createElement('span');
      top.className = 'record-top';
      const code = document.createElement('strong');
      code.textContent = row.public_code;
      const badge = document.createElement('span');
      badge.className = `status status-${row.status}`;
      badge.textContent = statusLabel(row.status);
      top.append(code, badge);
      const name = document.createElement('span');
      name.className = 'record-name';
      name.textContent = row.patient_name || '-';
      const meta = document.createElement('span');
      meta.className = 'record-meta';
      meta.textContent = `${formatDate(row.created_at)} • ${row.procedure || '-'}`;
      card.append(top, name, meta);
      card.addEventListener('click', () => openDetail(row.id));
      rowsMount.appendChild(card);
    }
  }

  async function reloadRows() {
    try {
      const current = await readySession();
      const data = new FormData(filtersForm);
      const rows = await loadPreAnamneses(current, {
        publicCode: data.get('publicCode'), patientName: data.get('patientName'), from: data.get('from'), to: data.get('to'),
      });
      renderRows(rows);
    } catch (error) {
      setMessage(document.getElementById('dashboardMessage'), error.message, true);
    }
  }

  function addDetailLine(container, label, value) {
    const item = document.createElement('div');
    item.className = 'detail-line';
    const key = document.createElement('strong');
    key.textContent = label;
    const val = document.createElement('span');
    val.textContent = value == null || value === '' ? '-' : String(value);
    item.append(key, val);
    container.appendChild(item);
  }

  async function openDetail(id) {
    try {
      activeRow = await loadPreAnamnese(await readySession(), id);
      detailBody.textContent = '';
      addDetailLine(detailBody, 'Código', activeRow.public_code);
      addDetailLine(detailBody, 'Data', formatDate(activeRow.created_at));
      addDetailLine(detailBody, 'Nome', activeRow.patient_name);
      addDetailLine(detailBody, 'WhatsApp', activeRow.patient_phone);
      addDetailLine(detailBody, 'E-mail', activeRow.patient_email);
      addDetailLine(detailBody, 'Procedimento', activeRow.procedure);
      const answers = document.createElement('details');
      answers.open = true;
      const summary = document.createElement('summary');
      summary.textContent = 'Respostas completas';
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(activeRow.answers || {}, null, 2);
      answers.append(summary, pre);
      detailBody.appendChild(answers);
      const statusSelect = document.getElementById('detailStatus');
      statusSelect.value = activeRow.status;
      detail.hidden = false;
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setMessage(document.getElementById('dashboardMessage'), error.message, true);
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(loginError, 'Entrando...');
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = new FormData(loginForm);
      const candidate = await signIn(data.get('email'), data.get('password'));
      const authorized = await authorizeAdmin(candidate);
      saveSession(candidate);
      admin = authorized;
      if (adminName) adminName.textContent = admin.display_name || candidate.user.email || 'Equipe BC';
      loginForm.reset();
      setLoggedIn(true);
      setMessage(loginError, '');
      await reloadRows();
    } catch (error) {
      saveSession(null);
      setMessage(loginError, error.message, true);
    } finally {
      submit.disabled = false;
    }
  });

  filtersForm.addEventListener('submit', (event) => { event.preventDefault(); reloadRows(); });
  document.getElementById('clearFilters')?.addEventListener('click', () => { filtersForm.reset(); reloadRows(); });
  closeDetail?.addEventListener('click', () => { detail.hidden = true; activeRow = null; });
  document.getElementById('saveStatus')?.addEventListener('click', async () => {
    if (!activeRow) return;
    try {
      const status = document.getElementById('detailStatus').value;
      activeRow = await updateStatus(await readySession(), activeRow.id, status);
      setMessage(document.getElementById('detailMessage'), 'Status atualizado.');
      await reloadRows();
    } catch (error) {
      setMessage(document.getElementById('detailMessage'), error.message, true);
    }
  });
  document.getElementById('openPdf')?.addEventListener('click', async () => {
    if (!activeRow) return;
    try {
      const url = await getPdfSignedUrl(await readySession(), activeRow.pdf_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(document.getElementById('detailMessage'), error.message, true);
    }
  });
  logoutButton?.addEventListener('click', async () => {
    await logout(session);
    saveSession(null);
    setLoggedIn(false);
    rowsMount.textContent = '';
    detail.hidden = true;
  });

  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (stored?.accessToken && stored?.user?.id) {
      session = stored;
      readySession().then(authorizeAdmin).then((authorized) => {
        admin = authorized;
        if (adminName) adminName.textContent = admin.display_name || session.user.email || 'Equipe BC';
        setLoggedIn(true);
        reloadRows();
      }).catch(() => { saveSession(null); setLoggedIn(false); });
    } else setLoggedIn(false);
  } catch {
    saveSession(null);
    setLoggedIn(false);
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initializeAdmin, { once: true });
