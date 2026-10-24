import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createDriveSetup } from '../../gestao/configurar-drive/setup.js';

const CLINICAL = '1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y';
const CLIENT = '1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N';
function fixture(options = {}) {
  const { document } = parseHTML(`<main><p id="setupStatus" role="status"></p>
    <button id="authorizeDrive"></button><button id="pickClinical"></button><button id="pickClient"></button>
    <p id="clinicalStatus"></p><p id="clientStatus"></p><button id="confirmFolders"></button></main>`);
  let logged = true, selected = CLINICAL, ready = false, fail = false;
  const submitted = [], requests = [], pickers = [];
  const auth = { getSession: async () => ({ data: { session: logged ? {
    access_token: 'fake-bc-session', user: { email: 'decolarbh@gmail.com' },
  } : null }, error: null }) };
  const controller = createDriveSetup({ root: document, auth, returnStatus: options.returnStatus,
    submit: data => submitted.push(data),
    pick: async data => { pickers.push(data); return selected; },
    fetcher: async (url, init) => {
      requests.push({ url, init });
      const body = JSON.parse(init.body);
      assert.equal(init.headers.Authorization, 'Bearer fake-bc-session');
      if (fail) return Response.json({ error: 'folder_not_private' }, { status: 400 });
      if (body.action === 'status') return Response.json({ connected: true, folders_ready: options.previouslyReady === true });
      if (body.action === 'picker') return Response.json({ access_token: 'fake-short-lived-token', expires_in: 3599,
        developer_key: 'public-picker-key', app_id: '530925228983' });
      if (body.action === 'confirm') { ready = true; return Response.json({ connected: true, folders_ready: true }); }
      throw new Error('Unexpected action');
    },
  });
  return { document, controller, submitted, requests, pickers, getReady: () => ready,
    logOut: () => { logged = false; }, select: value => { selected = value; }, fail: () => { fail = true; } };
}

test('configuration does not submit or request Google tokens without a BC session', async () => {
  const f = fixture(); f.logOut(); await f.controller.start();
  assert.equal(f.submitted.length, 0); assert.equal(f.requests.length, 0);
  assert.match(f.document.querySelector('#setupStatus').textContent, /entre|login/i);
});

test('authorization uses native POST body and keeps session out of the URL', async () => {
  const f = fixture(); await f.controller.start();
  assert.equal(f.submitted.length, 1);
  assert.equal(f.submitted[0].action, 'https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/drive-oauth-start');
  assert.equal(f.submitted[0].session, 'fake-bc-session');
  assert(!f.submitted[0].action.includes('fake-bc-session'));
});

test('wrong Picker folder and cancelled selection do not enable confirmation', async () => {
  const f = fixture(); await f.controller.init();
  f.select('foreign-folder'); await f.controller.choose('clinical');
  assert.equal(f.document.querySelector('#confirmFolders').disabled, true);
  assert.match(f.document.querySelector('#setupStatus').textContent, /pasta indicada/i);
  f.select(null); await f.controller.choose('client');
  assert.equal(f.document.querySelector('#confirmFolders').disabled, true);
  assert.equal(f.getReady(), false);
});

test('only explicit two-folder selection and server confirmation show readiness', async () => {
  const f = fixture(); await f.controller.init();
  await f.controller.choose('clinical'); f.select(CLIENT); await f.controller.choose('client');
  assert.equal(f.getReady(), false);
  await f.controller.confirm();
  assert.equal(f.getReady(), true);
  const payload = JSON.parse(f.requests.find(x => JSON.parse(x.init.body).action === 'confirm').init.body);
  assert.deepEqual(payload, { action: 'confirm', clinical: CLINICAL, client: CLIENT });
  assert.match(f.document.querySelector('#setupStatus').textContent, /sem envio/i);
  assert(!f.document.body.textContent.includes('fake-short-lived-token'));
  assert(!f.document.body.textContent.includes('fake-bc-session'));
});

test('failed server verification never displays successful folder authorization', async () => {
  const f = fixture(); await f.controller.init();
  await f.controller.choose('clinical'); f.select(CLIENT); await f.controller.choose('client');
  f.fail(); await f.controller.confirm();
  assert.equal(f.getReady(), false);
  assert.match(f.document.querySelector('#setupStatus').textContent, /não foi possível/i);
});

test('cancelled or failed reauthorization is reported even when an older connection is ready', async () => {
  for (const returnStatus of ['cancelled', 'failed']) {
    const f = fixture({ returnStatus, previouslyReady: true });
    await f.controller.init();
    const message = f.document.querySelector('#setupStatus').textContent;
    assert.match(message, /cancelada|não foi possível/i);
    assert(!message.includes('Autorização validada'));
  }
});
