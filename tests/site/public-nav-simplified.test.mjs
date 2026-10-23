import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const base = 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/';

function page(filename) {
  const html = readFileSync(new URL('../../' + filename, import.meta.url), 'utf8');
  const { document, window } = parseHTML(html);
  const location = new URL(filename, base);
  Object.defineProperty(window, 'location', { value: location, configurable: true });
  // LinkeDOM doesn't resolve .href as a browser does; mirror that browser behavior.
  document.querySelectorAll('a[href]').forEach(a => {
    const raw = a.getAttribute('href');
    if (raw && !raw.startsWith('#') && !/^(?:mailto:|tel:|javascript:)/i.test(raw)) {
      a.setAttribute('href', new URL(raw, location).href);
    }
  });
  const originalPaths = [...document.querySelectorAll('.drawer-nav > a')].map(a => new URL(a.href).pathname);
  vm.runInNewContext(source, { document, window, URL });
  return { document, originalPaths };
}

test('menu público agrupa destinos sem remover páginas antigas', () => {
  for (const route of ['index.html', 'agenda/index.html', 'protocolos/index.html', 'equipe/index.html']) {
    const { document, originalPaths } = page(route);
    const nav = document.querySelector('.drawer-nav');
    assert.equal(nav.dataset.bcSimplified, 'true', route);
    assert.equal(nav.querySelectorAll('.bc-drawer-group').length, 2, route);
    const titles = [...nav.querySelectorAll('.bc-drawer-group > summary')].map(el => el.textContent);
    assert.deepEqual(titles, ['Tratamentos', 'Equipe e Clínica'], route);
    const newPaths = [...nav.querySelectorAll('a[href]')].map(a => new URL(a.href).pathname);
    for (const original of originalPaths) assert.ok(newPaths.includes(original), original + ' desapareceu em ' + route);
    assert.equal(newPaths.filter(path => path.endsWith('/agenda/')).length, 1, route);
    assert.ok(newPaths.some(path => path.endsWith('/agendamento/')), route);
    assert.ok(newPaths.some(path => path.endsWith('/gestao/login/')), route);
  }
});

test('links de agenda são canônicos e seções da página atual abrem no menu', () => {
  const appointment = page('agenda/index.html').document;
  const link = appointment.querySelector('[data-bc-agendar-link="true"]');
  assert.ok(link);
  assert.equal(new URL(link.href).pathname, '/bcesteticaavancada-alt/agenda/');
  const protocol = page('protocolos/index.html').document;
  assert.equal(protocol.querySelector('.bc-drawer-group').open, true);
  const team = page('equipe/index.html').document;
  assert.equal([...team.querySelectorAll('.bc-drawer-group')][1].open, true);
});
