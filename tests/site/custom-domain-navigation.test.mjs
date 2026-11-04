import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const source = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const bases = [
  'https://www.bcesteticaavancada.com.br/',
  'https://bcesteticaavancada.com.br/',
  'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/',
];
const sections = ['clinica/', 'equipe/', 'mel/', 'procedimentos/', 'resultados/',
  'protocolos/', 'ambiente/', 'valores/', 'agendamento/', 'contato/', 'agenda/'];

for (const base of bases) {
  test(`public navigation and footer stay in the installed base: ${base}`, () => {
    for (const route of sections) {
      const { document, window } = parseHTML(readFileSync(new URL('../../' + route + 'index.html', import.meta.url), 'utf8'));
      const location = new URL(route, base);
      Object.defineProperty(window, 'location', { value: location, configurable: true });
      document.querySelectorAll('a[href]').forEach(link => {
        link.setAttribute('href', new URL(link.getAttribute('href'), location).href);
      });
      vm.runInNewContext(source, { document, window, URL });
      const pre = [...document.querySelectorAll('footer a')].find(link => link.textContent.includes('Pré-avaliação'));
      assert.ok(pre, route + ': pre-anamnese link missing');
      assert.equal(pre.href, base + 'agendamento/', route + ': footer leaves this installation');
      const menu = [...document.querySelectorAll('.drawer-nav a')].map(link => link.href);
      for (const destination of ['', ...sections, 'gestao/login/', 'instalar/']) {
        assert.ok(menu.includes(base + destination), route + ': missing ' + destination);
      }
      for (const resource of document.querySelectorAll('script[src], link[rel="stylesheet"], link[rel="manifest"]')) {
        const resolved = new URL(resource.getAttribute('src') || resource.getAttribute('href'), location);
        if (resolved.origin !== location.origin) continue;
        assert.ok(resolved.href.startsWith(base), route + ': resource escaped base: ' + resolved.href);
        assert.ok(existsSync(new URL('../../' + resolved.href.slice(base.length).split('?')[0], import.meta.url)), resolved.href);
      }
    }
  });
}
