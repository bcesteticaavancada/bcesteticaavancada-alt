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
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(base, `.${route.endsWith('/') ? route + 'index.html' : route}`);
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/agenda/`;
await mkdir('test-results/agenda', { recursive: true });
try {
  for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch();
    try {
      for (const [device, width, height] of [['phone', 390, 844], ['small-phone', 320, 740], ['tablet', 768, 1024], ['tablet-landscape', 1024, 768], ['desktop', 1440, 1000]]) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.addInitScript(() => { window.open = () => null; });
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
        await page.goto(url);
        await page.locator('.agenda-calendar__day.is-available').first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${engine}/${device}: page overflows`);
        await page.screenshot({ path: `test-results/agenda/${engine}-${device}-calendar.png`, fullPage: true });
        await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
        await page.locator('.agenda-calendar__day.is-available').first().click();
        const panel = page.locator('[data-booking-panel]');
        assert.equal(await panel.isVisible(), true);
        if (width < 1100) assert.equal(await panel.evaluate(node => node.matches(':modal')), true);
        if (device === 'desktop') {
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
        assert.deepEqual(errors, [], `${engine}/${device}: runtime errors`);
        console.log(`PASS ${engine}/${device} ${width}x${height}: calendar, future month, native dialog, slots, confirmation, no overflow`);
        await context.close();
      }
    } finally { await browser.close(); }
  }
} finally { server.close(); }
