import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const canonical = 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/';

test('Home exposes canonical and Open Graph metadata without changing visible content', () => {
  assert.match(home, new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(home, /property="og:type" content="website"/);
  assert.match(home, /property="og:title"/);
  assert.match(home, /property="og:description"/);
  assert.match(home, /property="og:url" content="https:\/\/bcesteticaavancada\.github\.io\/bcesteticaavancada-alt\/"/);
  assert.match(home, /property="og:image"/);
});

test('Home publishes LocalBusiness structured data with official clinic facts', () => {
  assert.match(home, /application\/ld\+json/);
  assert.match(home, /"@type"\s*:\s*"LocalBusiness"/);
  assert.match(home, /"telephone"\s*:\s*"\+5531995184110"/);
  assert.match(home, /"streetAddress"\s*:\s*"Rua Gávea, 358 — Loja 02 — 2º andar"/);
  assert.match(home, /"addressLocality"\s*:\s*"Belo Horizonte"/);
});

test('Robots and sitemap cover the official GitHub Pages site', () => {
  const robotsUrl = new URL('../../robots.txt', import.meta.url);
  const sitemapUrl = new URL('../../sitemap.xml', import.meta.url);
  assert.equal(existsSync(robotsUrl), true);
  assert.equal(existsSync(sitemapUrl), true);
  const robots = readFileSync(robotsUrl, 'utf8');
  const sitemap = readFileSync(sitemapUrl, 'utf8');
  assert.match(robots, /Sitemap: https:\/\/bcesteticaavancada\.github\.io\/bcesteticaavancada-alt\/sitemap\.xml/);
  for (const path of ['', 'clinica/', 'equipe/', 'mel/', 'procedimentos/', 'resultados/', 'protocolos/', 'ambiente/', 'valores/', 'agendamento/', 'contato/']) {
    assert.match(sitemap, new RegExp(`<loc>${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
  }
});
