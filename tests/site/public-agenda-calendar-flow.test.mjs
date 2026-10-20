import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import * as calendar from '../../agenda/js/calendar.js';
import { initPublicAgenda } from '../../agenda/js/main.js';
import { createPublicAgendaApi, PublicAgendaError } from '../../agenda/js/api.js';

const html = readFileSync(new URL('../../agenda/index.html', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settled() { for (let i = 0; i < 8; i++) await tick(); }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture(overrides = {}) {
  const { document, window } = parseHTML(html);
  const opened = [];
  window.open = url => opened.push(url);
  window.matchMedia = () => ({ matches: false });
  const panel = document.querySelector('[data-booking-panel]');
  // Linkedom supplies real DOM/selectors/events; only native dialog APIs need a shim.
  if (panel) {
    Object.defineProperty(panel, 'open', { get: () => panel.hasAttribute('open') });
    panel.showModal = panel.show = () => panel.setAttribute('open', '');
    panel.close = () => { panel.removeAttribute('open'); panel.dispatchEvent(new window.Event('close')); };
  }
  const calls = [];
  const api = {
    async getCatalog() { return { procedures: [{ id: 'p1', name: 'Pele', durationMinutes: 60 }, { id: 'p2', name: 'Massagem', durationMinutes: 60 }] }; },
    async getOverview({ month }) { calls.push(['overview', month]); return { month, days: [{ date: `${month}-20`, available: true }, { date: `${month}-21`, available: true }] }; },
    async getProfessionals(procedureId) { calls.push(['professionals', procedureId]); return { professionals: [{ id: 'a', name: 'Alice' }, { id: 'm', name: 'Mel' }] }; },
    async getSlots(args) { calls.push(['slots', args]); return { slots: ['09:00', '18:00'] }; },
    async book(args) { calls.push(['book', args]); return { booking: { id: 'booking', date: args.date, time: args.time, procedureName: 'Pele', professionalName: 'Alice' } }; },
    ...overrides,
  };
  const app = initPublicAgenda({ root: document, api, today: '2026-10-17' });
  const find = selector => document.querySelector(selector);
  async function click(selector) { const node = find(selector); assert.ok(node, `Missing control ${selector}`); node.click(); await settled(); }
  async function change(selector, value) {
    const node = find(selector); assert.ok(node, `Missing control ${selector}`);
    for (const option of node.querySelectorAll('option')) option.selected = false;
    node.querySelector(`option[value="${value}"]`).selected = true;
    node.dispatchEvent(new window.Event('change')); await settled();
  }
  async function selectDate() { await app.ready; await settled(); await click('[data-date="2026-10-20"]'); }
  async function chooseSlot() { await selectDate(); await change('[data-procedure]', 'p1'); await change('[data-professional]', 'a'); await click('[data-slot="18:00"]'); }
  return { document, window, app, api, find, calls, opened, click, change, selectDate, chooseSlot };
}

test('month navigation rolls December into January and bounds requests to twelve future months', () => {
  assert.equal(typeof calendar.shiftMonth, 'function');
  assert.equal(calendar.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(calendar.shiftMonth('2027-01', -1), '2026-12');
  assert.deepEqual(calendar.publicMonthBounds('2026-10-17'), { min: '2026-10', max: '2027-10' });
});

test('calendar preserves leap-day placement, marks today and disables expired availability', () => {
  const cells = calendar.buildMonthCells('2028-02', [{ date: '2028-02-29', available: true }, { date: '2028-02-01', available: true }], '2028-02-20');
  assert.equal(cells.filter(Boolean).length, 29);
  assert.equal(cells.find(c => c?.day === 1).disabled, true);
  assert.equal(cells.find(c => c?.day === 20).isToday, true);
  assert.equal(cells.find(c => c?.day === 29).available, true);
});

test('public overview sends only the displayed month before a procedure has been selected', async () => {
  const sent = [];
  const api = createPublicAgendaApi({ fetchImpl: async (_, request) => { sent.push(JSON.parse(request.body)); return new Response(JSON.stringify({ month: '2026-11', days: [] })); } });
  assert.equal(typeof api.getOverview, 'function');
  await api.getOverview({ month: '2026-11' });
  assert.deepEqual(sent, [{ action: 'overview', month: '2026-11' }]);
});

test('client sees a calendar before choosing procedure and opens options by tapping a free day', async () => {
  const f = fixture(); await f.app.ready; await settled();
  assert.deepEqual(f.calls[0], ['overview', '2026-10']);
  assert.ok(f.find('[data-date="2026-10-20"]'));
  await f.click('[data-date="2026-10-20"]');
  assert.equal(f.find('[data-booking-panel]').open, true);
  assert.match(f.find('[data-selected-date]').textContent, /20.*outubro/i);
  assert.equal(f.find('[data-procedure]').disabled, false);
});

test('switching month clears the previous day and closes its booking options', async () => {
  const f = fixture(); await f.selectDate(); await f.click('[data-month-next]');
  assert.equal(f.app.state.month, '2026-11');
  assert.equal(f.app.state.selectedDate, null);
  assert.equal(f.find('[data-booking-panel]').open, false);
  assert.ok(f.find('[data-date="2026-11-20"]'));
  await f.click('[data-month-today]');
  assert.equal(f.app.state.month, '2026-10');
  assert.equal(f.find('[data-month-prev]').disabled, true);
});

for (const staleError of [false, true]) test(`late ${staleError ? 'error' : 'response'} cannot replace the latest displayed month`, async () => {
  const old = deferred();
  const f = fixture({ async getOverview({ month }) { if (month === '2026-11') return old.promise; return { month, days: [{ date: `${month}-20`, available: true }] }; } });
  await f.app.ready; await settled(); await f.click('[data-month-next]'); await f.click('[data-month-next]');
  if (staleError) old.reject(new Error('OLD ERROR')); else old.resolve({ month: '2026-11', days: [] });
  await settled();
  assert.equal(f.app.state.month, '2026-12');
  assert.ok(f.find('[data-date="2026-12-20"]'));
  assert.doesNotMatch(f.find('[data-calendar-status]').textContent, /OLD ERROR/);
});

test('procedure choices show only professionals with actual slots on the chosen date', async () => {
  const f = fixture({ async getSlots({ professionalId }) { return { slots: professionalId === 'a' ? ['13:00'] : [] }; } });
  await f.selectDate(); await f.change('[data-procedure]', 'p1');
  assert.deepEqual([...f.find('[data-professional]').querySelectorAll('option')].map(x => x.value).filter(Boolean), ['a']);
  assert.ok(f.find('[data-slot="13:00"]'));
  assert.equal(f.find('[data-slot="18:00"]'), null);
});

test('stale procedure availability cannot overwrite a newer selection', async () => {
  const old = deferred();
  const f = fixture({ async getProfessionals(id) { if (id === 'p1') return old.promise; return { professionals: [{ id: 'm', name: 'Mel' }] }; } });
  await f.selectDate(); await f.change('[data-procedure]', 'p1'); await f.change('[data-procedure]', 'p2');
  old.resolve({ professionals: [{ id: 'a', name: 'Alice' }] }); await settled();
  assert.equal(f.app.state.selectedProcedure, 'p2');
  assert.equal(f.find('[data-professional]').value, 'm');
  assert.doesNotMatch(f.find('[data-professional]').innerHTML, /Alice/);
});

test('confirmation submits the selected day once and opens WhatsApp only after success', async () => {
  const pending = deferred(); let bookings = 0, payload;
  const f = fixture({ async book(args) { bookings++; payload = args; return pending.promise; } });
  await f.chooseSlot();
  f.find('[name="name"]').value = 'Cliente Fictícia'; f.find('[name="phone"]').value = '(31) 99999-0000';
  const submit = () => f.find('[data-booking-form]').dispatchEvent(new f.window.Event('submit', { cancelable: true }));
  submit(); submit(); await settled();
  assert.equal(bookings, 1); assert.equal(f.opened.length, 0); assert.equal(f.find('[data-submit]').disabled, true);
  assert.equal(payload.date, '2026-10-20'); assert.equal(payload.time, '18:00'); assert.equal(payload.professionalId, 'a');
  pending.resolve({ booking: { id: 'b', date: payload.date, time: payload.time, procedureName: 'Pele', professionalName: 'Alice' } }); await settled();
  assert.equal(f.find('[data-booking-success]').hidden, false);
  assert.equal(f.find('[data-success-date]').textContent, '20/10/2026'); assert.equal(f.opened.length, 1);
});

test('a slot conflict clears the obsolete choice and refreshes the day without showing success', async () => {
  let conflict = false;
  const f = fixture({ async getSlots() { return { slots: conflict ? ['09:00'] : ['09:00', '18:00'] }; }, async book() { conflict = true; throw new PublicAgendaError('Horário reservado', 409); } });
  await f.chooseSlot(); f.find('[name="name"]').value = 'Cliente Fictícia'; f.find('[name="phone"]').value = '(31) 99999-0000';
  f.find('[data-booking-form]').dispatchEvent(new f.window.Event('submit', { cancelable: true })); await settled();
  assert.equal(f.app.state.selectedSlot, null);
  assert.equal(f.find('[data-slot="18:00"]'), null);
  assert.equal(f.find('[data-booking-success]').hidden, true); assert.equal(f.opened.length, 0);
});

test('a failed initial catalog stays recoverable when a day is opened later', async () => {
  let failed = true;
  const f = fixture({ async getCatalog() { if (failed) throw new Error('Catálogo indisponível'); return { procedures: [{ id: 'p1', name: 'Pele', durationMinutes: 60 }] }; } });
  await f.selectDate();
  assert.equal(f.find('[data-details-retry]').hidden, false);
  assert.match(f.find('[data-status]').textContent, /Catálogo indisponível/);
  failed = false; await f.click('[data-details-retry]');
  assert.equal(f.find('[data-procedure]').disabled, false);
  assert.equal(f.find('[data-details-retry]').hidden, true);
});

test('background availability preserves contact fields and selected slot until it becomes occupied',async()=>{
 const f=fixture();await f.chooseSlot();f.find('[name="name"]').value='Pessoa fictícia';
 await f.app.refreshAvailability();assert.equal(f.app.state.selectedSlot,'18:00');assert.equal(f.find('[name="name"]').value,'Pessoa fictícia');
 f.api.getSlots=async()=>({slots:['09:00']});await f.app.refreshAvailability();
 assert.equal(f.app.state.selectedSlot,null);assert.equal(f.find('[data-submit]').disabled,true);assert.equal(f.find('[name="name"]').value,'Pessoa fictícia');f.app.stop();
});

test('pending booking can be recovered after reload without choosing an available slot',async()=>{
 let recovered=0;const f=fixture({hasPendingBooking:()=>true,async recoverPending(){recovered++;return {booking:{id:'old-booking',procedureName:'Pele',professionalName:'Alice',date:'2026-10-20',time:'18:00'}};},async getSlots(){return {slots:[]};}});
 await f.app.ready;await settled();
 const button=[...f.document.querySelectorAll('button')].find(b=>b.textContent==='Recuperar tentativa anterior');assert.ok(button);button.click();await settled();
 assert.equal(recovered,1);assert.equal(f.find('[data-booking-success]').hidden,false);assert.equal(f.calls.filter(([name])=>name==='book').length,0);f.app.stop();
});
test('HTTP 500 preserves uncertain selection for recovery instead of polling it away',async()=>{
 const f=fixture({async book(){throw new PublicAgendaError('Resultado incerto',500);}});await f.chooseSlot();f.find('[name="name"]').value='Pessoa fictícia';f.find('[name="phone"]').value='31900000000';
 f.find('[data-booking-form]').dispatchEvent(new f.window.Event('submit',{bubbles:true,cancelable:true}));await settled();
 assert.equal(f.app.state.uncertain,true);f.api.getSlots=async()=>({slots:[]});await f.app.refreshAvailability();assert.equal(f.app.state.selectedSlot,'18:00');f.app.stop();
});
