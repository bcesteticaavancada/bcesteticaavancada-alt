import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../agendamento/js/config.js';

const ALLOWED_STATUSES = new Set(['recebida', 'em_avaliacao', 'avaliada']);

export function isAuthorizedAdmin(user, adminRow) {
  return Boolean(user && adminRow && adminRow.user_id === user.id && adminRow.active === true && adminRow.role === 'admin');
}

export function normalizeAdminFilters(filters = {}) {
  return {
    publicCode: String(filters.publicCode ?? '').trim(),
    patientName: String(filters.patientName ?? '').trim(),
    from: String(filters.from ?? '').trim(),
    to: String(filters.to ?? '').trim(),
  };
}

export function sanitizeStatus(status) {
  if (!ALLOWED_STATUSES.has(status)) throw new Error('Status inválido.');
  return status;
}

export function formatAdminCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return '—';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function buildAdminQueryDescriptor(filters = {}) {
  const clean = normalizeAdminFilters(filters);
  return {
    orderBy: 'created_at',
    ascending: false,
    publicCode: clean.publicCode,
    patientName: clean.patientName,
    fromIso: clean.from ? `${clean.from}T00:00:00.000Z` : '',
    toIso: clean.to ? `${clean.to}T23:59:59.999Z` : '',
  };
}

export async function loadPreAnamneses(client, filters = {}) {
  const d = buildAdminQueryDescriptor(filters);
  let query = client
    .from('pre_anamneses')
    .select('id,public_code,created_at,status,patient_name,patient_phone,procedure,pdf_path')
    .order(d.orderBy, { ascending: d.ascending })
    .limit(100);
  if (d.publicCode) query = query.eq('public_code', d.publicCode);
  if (d.patientName) query = query.ilike('patient_name', `%${d.patientName}%`);
  if (d.fromIso) query = query.gte('created_at', d.fromIso);
  if (d.toIso) query = query.lte('created_at', d.toIso);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function loadPreAnamnese(client, id) {
  const { data, error } = await client.from('pre_anamneses').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updateStatus(client, id, status) {
  const safe = sanitizeStatus(status);
  const { data, error } = await client.from('pre_anamneses').update({ status: safe }).eq('id', id).select('id,status,updated_at').single();
  if (error) throw error;
  return data;
}

export async function getPdfSignedUrl(client, path, expiresIn = 600) {
  if (!path) throw new Error('PDF ainda não disponível.');
  const { data, error } = await client.storage.from('pre-anamnese-pdfs').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

function qs(id) { return document.getElementById(id); }
function setText(el, value) { if (el) el.textContent = value ?? ''; }
function show(el, visible) { if (el) el.hidden = !visible; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }

function renderList(rows, onOpen) {
  const body = qs('listBody');
  body.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    const values = [row.public_code, row.patient_name, row.procedure, formatDate(row.created_at), row.status];
    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value || '—';
      tr.appendChild(td);
    }
    const action = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'link-btn'; btn.textContent = 'Abrir';
    btn.addEventListener('click', () => onOpen(row.id));
    action.appendChild(btn); tr.appendChild(action); body.appendChild(tr);
  }
  qs('emptyState').hidden = rows.length !== 0;
}

function renderDetail(record, client) {
  show(qs('detailPanel'), true);
  setText(qs('detailCode'), record.public_code);
  setText(qs('detailName'), record.patient_name);
  setText(qs('detailMeta'), `${record.procedure || '—'} • ${formatDate(record.created_at)}`);
  setText(qs('detailCpf'), formatAdminCpf(record.patient_cpf));
  setText(qs('detailPhone'), record.patient_phone || '—');
  setText(qs('detailEmail'), record.patient_email || '—');
  setText(qs('detailAnswers'), JSON.stringify(record.answers ?? {}, null, 2));
  setText(qs('detailConsents'), JSON.stringify(record.consents ?? {}, null, 2));
  const status = qs('detailStatus'); status.value = record.status;
  status.onchange = async () => { await updateStatus(client, record.id, status.value); };
  const pdfBtn = qs('downloadPdf');
  pdfBtn.disabled = !record.pdf_path;
  pdfBtn.onclick = async () => {
    try { window.open(await getPdfSignedUrl(client, record.pdf_path), '_blank', 'noopener'); }
    catch (error) { setText(qs('adminMessage'), error.message || 'Não foi possível abrir o PDF.'); }
  };
}

async function boot() {
  if (typeof window === 'undefined' || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const loginView = qs('loginView');
  const adminView = qs('adminView');
  const deniedView = qs('deniedView');

  async function refreshSession() {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) { show(loginView, true); show(adminView, false); show(deniedView, false); return; }
    const { data: adminRow, error } = await client.from('admin_users').select('user_id,display_name,role,active').eq('user_id', session.user.id).maybeSingle();
    if (error || !isAuthorizedAdmin(session.user, adminRow)) {
      show(loginView, false); show(adminView, false); show(deniedView, true); return;
    }
    show(loginView, false); show(deniedView, false); show(adminView, true);
    setText(qs('adminName'), adminRow.display_name || session.user.email || 'Administradora');
    await refreshList();
  }

  async function refreshList() {
    try {
      setText(qs('adminMessage'), '');
      const rows = await loadPreAnamneses(client, {
        publicCode: qs('filterCode').value,
        patientName: qs('filterName').value,
        from: qs('filterFrom').value,
        to: qs('filterTo').value,
      });
      renderList(rows, async id => renderDetail(await loadPreAnamnese(client, id), client));
    } catch (error) { setText(qs('adminMessage'), error.message || 'Falha ao carregar fichas.'); }
  }

  qs('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    setText(qs('loginError'), '');
    const email = qs('loginEmail').value.trim();
    const password = qs('loginPassword').value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { setText(qs('loginError'), 'E-mail ou senha inválidos.'); return; }
    qs('loginPassword').value = '';
    await refreshSession();
  });
  qs('logoutBtn').addEventListener('click', async () => { await client.auth.signOut(); await refreshSession(); });
  qs('deniedLogout').addEventListener('click', async () => { await client.auth.signOut(); await refreshSession(); });
  qs('filterForm').addEventListener('submit', async event => { event.preventDefault(); await refreshList(); });
  qs('clearFilters').addEventListener('click', async () => { qs('filterForm').reset(); await refreshList(); });
  qs('closeDetail').addEventListener('click', () => show(qs('detailPanel'), false));
  client.auth.onAuthStateChange(() => queueMicrotask(refreshSession));
  await refreshSession();
}

if (typeof document !== 'undefined') boot();
