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
  let busy = false, connected = false;
  const selected = { clinical: null, client: null };
  function message(value) { status.textContent = value; }
  function render() {
    buttons[0].disabled = busy;
    buttons[1].disabled = buttons[2].disabled = busy || !connected;
    buttons[3].disabled = busy || !selected.clinical || !selected.client;
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
  async function run(work) {
    if (busy) return;
    busy = true; render();
    try { await work(); }
    catch { message('Não foi possível concluir. Confira sua entrada no BC Gestão e tente novamente.'); }
    finally { busy = false; render(); }
  }
  async function init() {
    await run(async () => {
      try { await session(); }
      catch { message('Entre no BC Gestão com a conta indicada antes de continuar.'); return; }
      const result = await api('status');
      connected = result.connected === true;
      if (returnStatus === 'cancelled' || returnStatus === 'failed') {
        message(returnStatus === 'cancelled' ? 'Autorização cancelada. Toque em Continuar com Google para tentar novamente.' :
          'Não foi possível concluir esta autorização. Toque em Continuar com Google para tentar novamente.');
        return;
      }
      if (result.folders_ready === true && connected) message('Autorização validada para as duas pastas. Configuração concluída, sem envio de arquivos por esta tela.');
      else if (connected) message('Conta Google autorizada. Agora selecione cada uma das duas pastas.');
      else message('Comece autorizando sua conta Google para conectar as pastas do backup.');
    });
  }
  async function start() {
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
      message('Autorização validada para as duas pastas. Configuração concluída, sem envio de arquivos por esta tela.');
    });
  }
  buttons[0].addEventListener('click', start);
  buttons[1].addEventListener('click', () => choose('clinical'));
  buttons[2].addEventListener('click', () => choose('client'));
  buttons[3].addEventListener('click', confirm);
  render();
  return { init, start, choose, confirm };
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
        .setSelectFolderEnabled(true).setFileIds(config.expectedId);
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
