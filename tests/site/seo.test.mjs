import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const canonical = 'https://www.bcesteticaavancada.com.br/';

test('Home exposes canonical and Open Graph metadata without changing visible content', () => {
  assert.match(home, new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(home, /property="og:type" content="website"/);
  assert.match(home, /property="og:title"/);
  assert.match(home, /property="og:description"/);
  const { document } = parseHTML(home);
  assert.equal(document.querySelector('meta[property="og:url"]').content, canonical);
  assert.equal(document.querySelector('meta[property="og:image"]').content, canonical + 'assets/01-mel-perfil.jpg');
  assert.match(home, /property="og:image"/);
});

test('Home publishes LocalBusiness structured data with official clinic facts', () => {
  assert.match(home, /application\/ld\+json/);
  assert.match(home, /"@type"\s*:\s*"LocalBusiness"/);
  assert.match(home, /"telephone"\s*:\s*"\+5531995184110"/);
  assert.match(home, /"streetAddress"\s*:\s*"Rua Gávea, 358 — Loja 02 — 2º andar"/);
  assert.match(home, /"addressLocality"\s*:\s*"Belo Horizonte"/);
  const { document } = parseHTML(home);
  const business = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  assert.equal(business.url, canonical);
  assert.equal(business.image, canonical + 'assets/01-mel-perfil.jpg');
});

test('Robots and sitemap retain public destinations and include the native agenda at the custom root', () => {
  const robotsUrl = new URL('../../robots.txt', import.meta.url);
  const sitemapUrl = new URL('../../sitemap.xml', import.meta.url);
  assert.equal(existsSync(robotsUrl), true);
  assert.equal(existsSync(sitemapUrl), true);
  const robots = readFileSync(robotsUrl, 'utf8');
  const sitemap = readFileSync(sitemapUrl, 'utf8');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.ok(robots.includes('Sitemap: ' + canonical + 'sitemap.xml'));
  const paths = ['', 'clinica/', 'equipe/', 'mel/', 'procedimentos/', 'resultados/', 'protocolos/', 'ambiente/', 'valores/', 'agendamento/', 'contato/', 'agenda/'];
  assert.equal((sitemap.match(/<url>/g) || []).length, paths.length);
  for (const path of paths) {
    assert.match(sitemap, new RegExp(`<loc>${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
  }
});

test('every public page declares one canonical URL at its matching custom-domain route', () => {
  for (const route of ['', 'clinica/', 'equipe/', 'mel/', 'procedimentos/', 'resultados/', 'protocolos/',
    'ambiente/', 'valores/', 'agendamento/', 'contato/', 'agenda/', 'instalar/', 'backup/', 'backup/privacidade/', 'backup/termos/']) {
    const html = readFileSync(new URL('../../' + route + 'index.html', import.meta.url), 'utf8');
    const { document } = parseHTML(html);
    const links = document.querySelectorAll('link[rel="canonical"]');
    assert.equal(links.length, 1, route);
    assert.equal(links[0].href, canonical + route, route);
  }
});
