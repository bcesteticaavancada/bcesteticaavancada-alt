import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { clinicToday } from '../agenda/js/calendar.js';
const base = process.cwd();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const requested = new URL(req.url, 'http://localhost');
    const route = decodeURIComponent(requested.pathname);
    // Simulate a CDN/browser retaining the old unversioned release assets.
    if (['/agenda/js/main.js', '/agenda/js/api.js', '/agenda/js/calendar.js', '/agenda/agenda.css'].includes(route) && !requested.search) {
      res.setHeader('Content-Type', route.endsWith('.css') ? 'text/css' : 'text/javascript');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.end(route.endsWith('.css') ? '/* Legacy stylesheet */' : 'throw new Error("Legacy cached agenda module requested");');
      return;
    }
    const file = path.resolve(base, `.${route.endsWith('/') ? route + 'index.html' : route}`);
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
await mkdir('test-results/agenda', { recursive: true });
try {
  for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch();
    try {
      for (const [pagePath, device, width, height] of [
        ['/agenda/', 'phone', 390, 844], ['/agenda/', 'small-phone', 320, 740], ['/agenda/', 'tablet', 768, 1024], ['/agenda/', 'tablet-landscape', 1024, 768], ['/agenda/', 'desktop', 1440, 1000],
        ['/', 'home-phone', 320, 740], ['/', 'home-tablet', 768, 1024], ['/', 'home-desktop', 1440, 1000],
        ['/agendamento/', 'booking-phone', 320, 740], ['/agendamento/', 'booking-tablet', 768, 1024], ['/agendamento/', 'booking-desktop', 1440, 1000],
      ]) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.addInitScript(() => { window.open = () => null; });
        await page.route('https://www.google.com/maps**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Mapa de teste</title>' }));
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let bookingCount = 0;
        await page.route('**/functions/v1/public-agenda', async route => {
          const body = route.request().postDataJSON();
          const month = body.month || clinicToday().slice(0, 7);
          // Each month has a future valid date without touching the hosted database.
          const date = month === clinicToday().slice(0, 7) ? clinicToday() : `${month}-20`;
          const responses = {
            catalog: { procedures: [{ id: 'p1', name: 'Limpeza de pele', durationMinutes: 90 }] },
            overview: { month, days: [{ date, available: true }] },
            professionals: { professionals: [{ id: 'alice', name: 'Alice' }] },
            slots: { slots: ['09:00', '13:00', '17:30'] },
            book: { booking: { id: 'fictitious-test', date: body.date, time: body.time, procedureName: 'Limpeza de pele', professionalName: 'Alice' } },
          };
          if (body.action === 'book') bookingCount++;
          await route.fulfill({ json: responses[body.action] });
        });
        await page.goto(`${url}${pagePath}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.agenda-calendar__day.is-available').first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${engine}/${device}: page overflows`);
        await page.screenshot({ path: `test-results/agenda/${engine}-${device}-calendar.png`, fullPage: true });
        await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
        await page.locator('.agenda-calendar__day.is-available').first().click();
        const panel = page.locator('[data-booking-panel]');
        assert.equal(await panel.isVisible(), true);
        if (width < 1100) assert.equal(await panel.evaluate(node => node.matches(':modal')), true);
        if (device === 'home-desktop') {
          assert.equal(await page.locator('.home-editorial').evaluate(node => getComputedStyle(node).overflow), 'clip');
        }
        if (width >= 1100) {
          await page.setViewportSize({ width: 768, height: 1024 });
          await page.waitForFunction(() => document.querySelector('[data-booking-panel]').matches(':modal'));
          await page.setViewportSize({ width, height });
          await page.waitForFunction(() => !document.querySelector('[data-booking-panel]').matches(':modal'));
        }
        await page.locator('[data-procedure]').selectOption('p1');
        await page.locator('[data-slot="17:30"]').click();
        await page.locator('[name="name"]').fill('Cliente Fictícia');
        await page.locator('[name="phone"]').fill('(31) 99999-0000');
        await page.locator('[data-submit]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/agenda/${engine}-${device}-booking.png`, fullPage: true });
        assert.equal(await panel.evaluate(node => node.scrollWidth > node.clientWidth), false, `${engine}/${device}: panel overflows`);
        await page.locator('[data-submit]').click();
        await page.locator('[data-booking-success]:not([hidden])').waitFor();
        assert.equal(bookingCount, 1);
        await page.getByRole('button', { name: 'Fechar opções de agendamento' }).click();
        assert.equal(await panel.isVisible(), false);
        if (pagePath === '/agendamento/') {
          assert.equal(await page.locator('#preAnamneseForm .step').count(), 8);
          assert.equal(await page.locator('#step1').isVisible(), true);
          await page.evaluate(() => {
            localStorage.setItem('bc.preAnamnese.draft.v1', JSON.stringify({step:5,values:{nome:'Legado fictício'}}));
            sessionStorage.setItem('bc.preAnamnese.draft.v1', JSON.stringify({ step: 2, values: {}, expiresAt:Date.now()+30*60*1000 }));
          });
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator('#step2.active').waitFor();
          assert.equal(await page.evaluate(()=>localStorage.getItem('bc.preAnamnese.draft.v1')),null);
          await page.locator('#back').click();
          await page.locator('#step1.active').waitFor();
          await page.waitForFunction(() => { const top = document.querySelector('.shell').getBoundingClientRect().top; return top >= 80 && top <= 150; });
          assert.equal(await page.locator('#stage').textContent(), 'Etapa 1 de 8');
        }
        assert.deepEqual(errors, [], `${engine}/${device}: runtime errors`);
        console.log(`PASS ${engine}/${device} ${width}x${height}: calendar, future month, native dialog, slots, confirmation, no overflow`);
        await context.close();
      }
    } finally { await browser.close(); }
  }
} finally { server.close(); }
