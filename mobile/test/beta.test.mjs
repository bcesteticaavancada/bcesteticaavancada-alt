import { strict as assert } from 'node:assert';
import { access, readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createPublicAgendaApi } from '../dist/agenda/js/api.js';
import { createDemoAgendaFetch, readDemoBookings } from '../dist/demo-agenda.js';

const dist = new URL('../dist/', import.meta.url);
const localOrigin = 'https://localhost';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test('a agenda de teste salva e recupera o horário sem gravar nome ou WhatsApp', async () => {
  const storage = memoryStorage();
  const fetchImpl = createDemoAgendaFetch({ storage, today: '2026-11-09' });
  const api = createPublicAgendaApi({ fetchImpl, storage: memoryStorage() });
  const details = { procedureId: 'avaliacao', professionalId: 'facial', date: '2026-11-10' };
  const payload = { ...details, time: '09:00', name: 'Pessoa de teste', phone: '31900000000' };

  assert.ok((await api.getOverview({ month: '2026-11' })).days.some(day => day.date === details.date && day.available));
  assert.ok((await api.getSlots(details)).slots.includes(payload.time));
  const { booking } = await api.book(payload);
  assert.deepEqual((await api.book(payload)).booking, booking);
  assert.deepEqual((await api.recoverPending()).booking, booking);
  assert.deepEqual(readDemoBookings(storage), [booking]);
  assert.ok(!Object.hasOwn(booking, 'name') && !Object.hasOwn(booking, 'phone'));
  assert.ok(!(await api.getSlots(details)).slots.includes(payload.time));

  const secondSession = createPublicAgendaApi({ fetchImpl, storage: memoryStorage() });
  await assert.rejects(secondSession.book(payload), { status: 409 });
});

test('o pacote contém as telas públicas com links compatíveis com o servidor local do app', async () => {
  const entries = await readdir(dist, { recursive: true });
  assert.ok(!entries.some(path => /^(admin|agendamento|gestao|supabase)\//.test(path)));
  assert.ok(!entries.some(path => /\.mp4$/.test(path)));
  assert.doesNotMatch(await readFile(new URL('assets/js/bc-public-config.js', dist), 'utf8'), /supabase\.co/i);

  for (const path of entries.filter(path => path.endsWith('.html'))) {
    const html = await readFile(new URL(path, dist), 'utf8');
    const { document } = parseHTML(html);
    assert.match(html, /connect-src 'self'; form-action 'none'/);
    for (const anchor of document.querySelectorAll('a[href]')) {
      const target = new URL(anchor.getAttribute('href'), `${localOrigin}/${path}`);
      if (target.origin !== localOrigin || target.pathname === '/') continue;
      assert.match(target.pathname, /\.[^/]+$/, `Link sem arquivo em ${path}: ${target.pathname}`);
      await access(new URL(target.pathname.slice(1), dist));
    }
  }
});
