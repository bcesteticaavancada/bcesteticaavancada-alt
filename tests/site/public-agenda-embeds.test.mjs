import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { initPublicAgenda } from '../../agenda/js/main.js';

const source = parseHTML(readFileSync(new URL('../../agenda/index.html', import.meta.url), 'utf8')).document;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settled() { for (let i = 0; i < 8; i++) await tick(); }

for (const path of ['index.html', 'agendamento/index.html']) {
  test(`${path}: embeds the complete monthly calendar and booking controls`, () => {
    const { document } = parseHTML(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
    assert.ok(document.querySelector('[data-public-agenda]'), 'missing inline calendar');
    assert.equal(document.querySelectorAll('[data-calendar]').length, 1);
    assert.equal(document.querySelector('.agenda-workspace').outerHTML, source.querySelector('.agenda-workspace').outerHTML);
    const base = new URL(path, 'https://example.test/bc/');
    const modules = [...document.querySelectorAll('script[type="module"][src]')].map(node => new URL(node.getAttribute('src'), base));
    assert.ok(modules.some(url => url.pathname === '/bc/agenda/js/main.js' && url.search));
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map(node => new URL(node.getAttribute('href'), base));
    assert.ok(styles.some(url => url.pathname === '/bc/agenda/agenda.css' && url.search));
    assert.equal(document.querySelectorAll('h1').length, 1);
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate IDs can break calendar or clinical form controls');
    if (path === 'index.html') {
      assert.ok(document.querySelector('main').lastElementChild.matches('[data-public-agenda]'), 'calendar must be the last block before the footer');
      assert.ok(document.querySelector('main').nextElementSibling.matches('footer'));
      assert.equal(document.querySelector('[data-home-agenda-start]'), null);
    } else {
      assert.ok(document.querySelector('#preAnamneseForm'));
      assert.equal(document.querySelectorAll('#preAnamneseForm .step').length, 8);
      assert.ok(document.querySelector('main').firstElementChild.matches('[data-public-agenda]'));
    }
  });

  test(`${path}: month navigation and day selection use the existing booking flow`, async () => {
    const { document, window } = parseHTML(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
    assert.ok(document.querySelector('[data-calendar]'), 'missing monthly calendar');
    window.matchMedia = () => ({ matches: false });
    const panel = document.querySelector('[data-booking-panel]');
    Object.defineProperty(panel, 'open', { get: () => panel.hasAttribute('open') });
    panel.showModal = panel.show = () => panel.setAttribute('open', '');
    panel.close = () => { panel.removeAttribute('open'); panel.dispatchEvent(new window.Event('close')); };
    const months = [];
    const app = initPublicAgenda({ root: document, today: '2026-10-17', api: {
      async getCatalog() { return { procedures: [{ id: 'p1', name: 'Procedimento fictício', durationMinutes: 60 }] }; },
      async getOverview({ month }) { months.push(month); return { month, days: [{ date: `${month}-20`, available: true }] }; },
      async getProfessionals() { return { professionals: [{ id: 'a1', name: 'Profissional fictícia' }] }; },
      async getSlots() { return { slots: ['09:00', '18:00'] }; },
      async book() { assert.fail('navigation must not create a booking'); },
    } });
    await app.ready;
    assert.deepEqual(months, ['2026-10']);
    document.querySelector('[data-month-next]').click();
    await settled();
    assert.equal(app.state.month, '2026-11');
    document.querySelector('[data-date="2026-11-20"]').click();
    await settled();
    assert.equal(panel.open, true);
    assert.equal(app.state.selectedDate, '2026-11-20');
    const select = document.querySelector('[data-procedure]');
    for (const option of select.querySelectorAll('option')) option.selected = false;
    select.querySelector('[value="p1"]').selected = true;
    select.dispatchEvent(new window.Event('change'));
    await settled();
    assert.ok(document.querySelector('[data-slot="18:00"]'));
    assert.equal(document.querySelector('[data-submit]').disabled, true, 'a slot must be selected before confirmation');
    document.querySelector('[data-booking-close]').click();
    assert.equal(panel.open, false);
    if (path.startsWith('agendamento')) assert.ok(document.querySelector('#preAnamneseForm'));
  });
}
