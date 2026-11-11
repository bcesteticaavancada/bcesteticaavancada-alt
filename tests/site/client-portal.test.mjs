import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { initClientPortal } from '../../cliente/portal.js';
import { createClientPortalHandler } from '../../supabase/functions/client-portal/handler.mjs';

const token = 'a'.repeat(64);
const origin = 'https://www.bcesteticaavancada.com.br';
const startsAt = '2026-12-10T13:30:00.000Z';
const schedule = { appointments: [{ starts_at: startsAt }] };
const portalHtml = await readFile(new URL('../../cliente/index.html', import.meta.url), 'utf8');

function makeRequest({ method = 'POST', requestOrigin = origin, body = { token } } = {}) {
  return new Request('https://functions.example.invalid/client-portal', {
    method,
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

test('a função só entrega a data e a hora e impede cache da resposta', async () => {
  const handle = createClientPortalHandler({
    getSchedule: async (value) => {
      assert.equal(value, token);
      return {
        customer_name: 'Cliente Fictícia',
        appointments: [{ starts_at: startsAt, observations: 'Dado interno' }],
      };
    },
  });
  const response = await handle(makeRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(await response.json(), schedule);
});

test('origem externa, método incorreto e corpos inválidos não chegam ao banco', async () => {
  let queries = 0;
  const handle = createClientPortalHandler({ getSchedule: async () => { queries += 1; } });
  for (const [options, status] of [
    [{ method: 'OPTIONS' }, 204],
    [{ method: 'GET' }, 405],
    [{ requestOrigin: 'https://outra-origem.example.invalid' }, 403],
    [{ body: { token: 'a' } }, 404],
    [{ body: { token, cliente_id: 'ficticio' } }, 404],
    [{ body: { token: 'a'.repeat(500) } }, 404],
  ]) {
    const response = await handle(makeRequest(options));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(queries, 0);
});

test('um link inexistente recebe a mesma resposta de um token inválido', async () => {
  const handle = createClientPortalHandler({ getSchedule: async () => null });
  const unknown = await handle(makeRequest());
  const malformed = await handle(makeRequest({ body: {} }));
  assert.equal(unknown.status, 404);
  assert.equal(await unknown.text(), await malformed.text());
});

function openPortal(hash, fetchImpl) {
  const { document } = parseHTML(portalHtml);
  const view = new EventTarget();
  let address = '/cliente/' + hash;
  view.location = { hash, pathname: '/cliente/', search: '' };
  view.history = { replaceState: (_state, _title, path) => { address = path; } };
  const ready = initClientPortal({ root: document, view, fetchImpl });
  return { document, view, ready, address };
}

test('a página pública sem link só oferece o contato', async () => {
  let queries = 0;
  const { document, ready } = openPortal('', async () => { queries += 1; });
  await ready;
  assert.equal(queries, 0);
  assert.match(document.querySelector('[data-portal-contact]').href, /^https:\/\/wa\.me\//);
  assert.equal(document.querySelector('[data-portal-appointments]').hidden, true);
});

test('a página limpa o fragmento e encerra a consulta ao sair', async () => {
  const { document, ready, address, view } = openPortal('#acesso=' + token, async (url, options) => {
    assert.doesNotMatch(url, new RegExp(token));
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(JSON.parse(options.body), { token });
    return Response.json(schedule);
  });
  assert.equal(address, '/cliente/');
  await ready;
  const list = document.querySelector('[data-portal-appointments]');
  assert.equal(list.hidden, false);
  assert.match(list.textContent, /10:30/);
  view.dispatchEvent(new Event('pagehide'));
  assert.equal(list.hidden, true);
  assert.equal(list.childElementCount, 0);
});

test('uma resposta atrasada não restaura horários depois de encerrar o acesso', async () => {
  let finishRequest;
  const { document, ready } = openPortal('#acesso=' + token, () => new Promise((resolve) => {
    finishRequest = resolve;
  }));
  document.querySelector('[data-portal-exit]').click();
  finishRequest(Response.json(schedule));
  await ready;
  assert.equal(document.querySelector('[data-portal-appointments]').childElementCount, 0);
  assert.match(document.querySelector('[data-portal-message]').textContent, /Acesso encerrado/);
});

test('a página aceita outro link aberto na mesma aba e substitui os horários anteriores', async () => {
  const nextToken = 'b'.repeat(64);
  const requests = [];
  const { document, ready, view } = openPortal('#acesso=' + token, async (_url, options) => {
    const { token: requestedToken } = JSON.parse(options.body);
    requests.push(requestedToken);
    return Response.json(requestedToken === token ? schedule : { appointments: [] });
  });
  await ready;
  const list = document.querySelector('[data-portal-appointments]');
  assert.equal(list.childElementCount, 1);
  view.location.hash = '#acesso=' + nextToken;
  view.dispatchEvent(new Event('hashchange'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requests, [token, nextToken]);
  assert.equal(list.childElementCount, 0);
  assert.match(document.querySelector('[data-portal-message]').textContent, /sem horários/);
});
