const API = 'https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-oauth-';
const ACCOUNT = 'decolarbh@gmail.com';
const DESTINATIONS = Object.freeze({
  clinical: { id: '1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y', name: '01_Anamneses_e_Documentos_Clinicos' },
  client: { id: '1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N', name: '02_Arquivos_de_Clientes' },
});

export function createDriveSetup({ root, auth, fetcher = fetch, pick = pickFolder, submit = submitForm, returnStatus = '' }) {
  const find = id => root.querySelector('#' + id);
  const status = find('setupStatus');
  const buttons = [find('authorizeDrive'), find('pickClinical'), find('pickClient'), find('confirmFolders')];
  const centralButton = find('pickCentral'), centralStatus = find('centralStatus');
  let busy = false, connected = false, authorizationAvailable = true, verifiedRoot = '';
  const selected = { clinical: null, client: null };
  function message(value) { status.textContent = value; }
  function render() {
    buttons[0].disabled = busy || !authorizationAvailable;
    buttons[1].disabled = buttons[2].disabled = busy || !connected;
    buttons[3].disabled = busy || !selected.clinical || !selected.client;
    if (centralButton) centralButton.disabled = busy || !connected;
    find('clinicalStatus').textContent = selected.clinical ? 'Pasta selecionada.' : 'Aguardando seleção.';
    find('clientStatus').textContent = selected.client ? 'Pasta selecionada.' : 'Aguardando seleção.';
  }
  async function session() {
    const { data, error } = await auth.getSession();
    const value = data?.session;
    if (error || !value?.access_token || value.user?.email?.toLowerCase() !== ACCOUNT) throw new Error('session');
    return value.access_token;
  }
  async function api(action, payload = {}) {
    const token = await session();
    const response = await fetcher(API + 'setup', {
      method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!response.ok) throw new Error('server');
    return await response.json();
  }
  async function run(work, onFailure = () => message('Não foi possível concluir. Confira sua entrada no BC Gestão e tente novamente.')) {
    if (busy) return;
    busy = true; render();
    try { await work(); }
    catch { onFailure(); }
    finally { busy = false; render(); }
  }
  async function init() {
    await run(async () => {
      try { await session(); }
      catch { message('Entre no BC Gestão com a conta indicada antes de continuar.'); return; }
      const result = await api('status');
      connected = result.connected === true;
      authorizationAvailable = result.authorization_available !== false;
      if (returnStatus === 'cancelled' || returnStatus === 'failed') {
        const outcome = returnStatus === 'cancelled' ? 'Autorização cancelada.' : 'Não foi possível concluir esta autorização.';
        message(outcome + (authorizationAvailable ? ' Toque em Continuar com Google para tentar novamente.' :
          ' A reconexão aguarda liberação. Você pode continuar conferindo as pastas.'));
        return;
      }
      if (!authorizationAvailable && connected) message('Consulta e seleção disponíveis. A reconexão da conta aguarda liberação, sem alterar a configuração do backup.');
      else if (result.folders_ready === true && connected) message('Autorização validada para as duas pastas. Etapa de teste, sem envio de arquivos.');
      else if (connected) message('Conta Google autorizada. Agora selecione cada uma das duas pastas.');
      else message('Comece autorizando sua conta Google. Nenhum arquivo será enviado.');
    });
  }
  async function start() {
    if (!authorizationAvailable) {
      message('A reconexão da conta aguarda liberação. Você pode continuar conferindo as pastas.');
      return;
    }
    await run(async () => {
      let token;
      try { token = await session(); }
      catch { message('Faça login no BC Gestão com a conta indicada antes de continuar.'); return; }
      submit({ action: API + 'start', session: token });
    });
  }
  async function choose(role) {
    if (!connected || !Object.hasOwn(DESTINATIONS, role)) return;
    await run(async () => {
      const config = await api('picker');
      try {
        const result = await pick({ accessToken: config.access_token, developerKey: config.developer_key,
          appId: config.app_id, expectedId: DESTINATIONS[role].id, title: DESTINATIONS[role].name });
        if (result === null) { message('Seleção cancelada. Você pode tentar novamente.'); return; }
        if (result !== DESTINATIONS[role].id) {
          selected[role] = null; message('Selecione somente a pasta indicada para esta etapa.'); return;
        }
        selected[role] = result;
        message(selected.clinical && selected.client ? 'As duas pastas foram selecionadas. Toque em Confirmar pastas.' : 'Selecione agora a outra pasta.');
      } finally { config.access_token = ''; }
    });
  }
  async function confirm() {
    if (!selected.clinical || !selected.client) return;
    await run(async () => {
      const result = await api('confirm', { clinical: selected.clinical, client: selected.client });
      if (result.connected !== true || result.folders_ready !== true) throw new Error('server');
      message('Autorização validada para as duas pastas. Etapa de teste, sem envio de arquivos.');
    });
  }
  async function chooseCentral(role = find('centralRole')?.value) {
    if (!connected || !centralStatus) return;
    if (role !== 'root' && !verifiedRoot) {
      centralStatus.textContent = 'Selecione e confira primeiro a pasta central.'; return;
    }
    await run(async () => {
      centralStatus.textContent = 'Conferindo a seleção…';
      const catalogue = await api('central');
      const destination = Object.hasOwn(catalogue.destinations || {}, role) ? catalogue.destinations[role] : null;
      if (!destination || typeof catalogue.root_id !== 'string') throw new Error('folder');
      if (role !== 'root' && catalogue.root_id !== verifiedRoot) {
        verifiedRoot = ''; centralStatus.textContent = 'A pasta central mudou. Selecione e confira a central novamente.'; return;
      }
      const config = await api('picker');
      try {
        const result = await pick({ accessToken: config.access_token, developerKey: config.developer_key,
          appId: config.app_id, expectedId: role === 'root' ? catalogue.root_id : undefined,
          parentId: role === 'root' ? undefined : catalogue.root_id, title: destination.name });
        if (result === null) { centralStatus.textContent = 'Seleção cancelada. Você pode tentar novamente.'; return; }
        const checked = await api('inspect', { role, folder: result });
        if (checked.verified !== true || checked.role !== role || checked.backup_enabled !== false) throw new Error('folder');
        if (role === 'root') verifiedRoot = catalogue.root_id;
        centralStatus.textContent = 'Pasta verificada: ' + destination.name + '. Esta conferência não ativa novos backups nem envia arquivos.';
      } finally { config.access_token = ''; }
    }, () => { centralStatus.textContent = 'Não foi possível conferir esta pasta. Selecione a pasta indicada e confira se ela está privada.'; });
  }
  buttons[0].addEventListener('click', start);
  buttons[1].addEventListener('click', () => choose('clinical'));
  buttons[2].addEventListener('click', () => choose('client'));
  buttons[3].addEventListener('click', confirm);
  centralButton?.addEventListener('click', () => chooseCentral());
  render();
  return { init, start, choose, confirm, chooseCentral };
}

function submitForm({ action, session }) {
  const form = document.createElement('form');
  form.method = 'POST'; form.action = action;
  const field = document.createElement('input');
  field.type = 'hidden'; field.name = 'session'; field.value = session;
  form.append(field); document.body.append(form);
  try { form.submit(); } finally { field.value = ''; form.remove(); }
}

let pickerLoader;
async function loadPicker() {
  if (!pickerLoader) pickerLoader = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('picker')), 20000);
    function load() {
      globalThis.gapi.load('picker', { callback: () => { clearTimeout(timer); resolve(); },
        onerror: () => { clearTimeout(timer); reject(new Error('picker')); } });
    }
    if (globalThis.gapi) { load(); return; }
    const script = document.createElement('script'); script.src = 'https://apis.google.com/js/api.js';
    script.onload = load;
    script.onerror = () => { clearTimeout(timer); reject(new Error('picker')); };
    document.head.append(script);
  }).catch(error => { pickerLoader = null; throw error; });
  await pickerLoader;
}
async function pickFolder(config) {
  await loadPicker();
  return await new Promise((resolve, reject) => {
    try {
      const p = globalThis.google.picker;
      const view = new p.DocsView(p.ViewId.FOLDERS).setIncludeFolders(true)
        .setSelectFolderEnabled(true);
      if (config.expectedId) view.setFileIds(config.expectedId);
      if (config.parentId) view.setParent(config.parentId);
      const picker = new p.PickerBuilder().addView(view).setOAuthToken(config.accessToken)
        .setDeveloperKey(config.developerKey).setAppId(config.appId)
        .setOrigin(globalThis.location.origin).setTitle(config.title)
        .setCallback(data => {
          if (data.action === p.Action.PICKED || data.action === p.Action.CANCEL) {
            picker.setVisible(false); config.accessToken = '';
            resolve(data.action === p.Action.PICKED ? data.docs?.[0]?.id : null);
          }
        }).build();
      picker.setVisible(true);
    } catch { config.accessToken = ''; reject(new Error('picker')); }
  });
}
