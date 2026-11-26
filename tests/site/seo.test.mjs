import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const canonical = 'https://www.bcesteticaavancada.com.br/';

test('Home exposes canonical and Open Graph metadata without changing visible content', () => {
  assert.match(home, new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(home, /property="og:type" content="website"/);
  assert.match(home, /property="og:title"/);
  assert.match(home, /property="og:description"/);
  assert.match(home, /property="og:url" content="https:\/\/www\.bcesteticaavancada\.com\.br\/"/);
  assert.match(home, /property="og:image"/);
});

test('Home publishes LocalBusiness structured data with official clinic facts', () => {
  assert.match(home, /application\/ld\+json/);
  assert.match(home, /"@type"\s*:\s*"LocalBusiness"/);
  assert.match(home, /"telephone"\s*:\s*"\+5531995184110"/);
  assert.match(home, /"streetAddress"\s*:\s*"Rua Gávea, 358 — Loja 02 — 2º andar"/);
  assert.match(home, /"addressLocality"\s*:\s*"Belo Horizonte"/);
});

test('Robots and sitemap cover public destinations and the campaign area', () => {
  const robotsUrl = new URL('../../robots.txt', import.meta.url);
  const sitemapUrl = new URL('../../sitemap.xml', import.meta.url);
  assert.equal(existsSync(robotsUrl), true);
  assert.equal(existsSync(sitemapUrl), true);
  const robots = readFileSync(robotsUrl, 'utf8');
  const sitemap = readFileSync(sitemapUrl, 'utf8');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/www\.bcesteticaavancada\.com\.br\/sitemap\.xml/);
  const paths = ['', 'clinica/', 'equipe/', 'mel/', 'procedimentos/', 'resultados/', 'protocolos/', 'ambiente/', 'valores/', 'agendamento/', 'contato/', 'campanhas/', 'campanhas/aniversario-1-ano/', 'diamond/', 'agenda/', 'nfc/'];
  assert.equal((sitemap.match(/<url>/g) || []).length, paths.length);
  for (const path of paths) {
    assert.match(sitemap, new RegExp(`<loc>${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
  }
});

test('every sitemap URL has a single self-referencing canonical, exists and is indexable', () => {
  const sitemap = readFileSync(new URL('../../sitemap.xml', import.meta.url), 'utf8');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(new Set(locations).size, locations.length);
  for (const location of locations) {
    assert.ok(location.startsWith(canonical), location);
    const path = new URL(location).pathname.slice(1);
    const html = readFileSync(new URL('../../' + path + 'index.html', import.meta.url), 'utf8');
    const tags = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)];
    assert.equal(tags.length, 1, location);
    assert.ok(tags[0][0].includes('href="' + location + '"'), location);
    assert.doesNotMatch(html, /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i, location);
  }
});

test('sitemap excludes authenticated and operational routes; robots permits noindex discovery', () => {
  const sitemap = readFileSync(new URL('../../sitemap.xml', import.meta.url), 'utf8');
  const robots = readFileSync(new URL('../../robots.txt', import.meta.url), 'utf8');
  assert.doesNotMatch(sitemap, /<loc>[^<]*\/(?:gestao|admin|backup|instalar)\//);
  assert.doesNotMatch(robots, /^Disallow:\s*\/(?:gestao|admin)/mi);
  for (const path of ['admin/', 'gestao/', 'gestao/login/', 'gestao/anamnese-remota/', 'gestao/maya-beta/']) {
    assert.match(readFileSync(new URL('../../' + path + 'index.html', import.meta.url), 'utf8'), /name=["']robots["'][^>]*noindex/i, path);
  }
});

test('public links favor official domain and discovery of the digital card and team', () => {
  const script = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /https:\/\/bcesteticaavancada\.github\.io\//);
  assert.match(home, /href="nfc\/"/);
  const clinic = readFileSync(new URL('../../clinica/index.html', import.meta.url), 'utf8');
  assert.match(clinic, /href="\.\.\/equipe\/"/);
  assert.match(clinic, /href="\.\.\/ambiente\/"/);
  assert.equal(readFileSync(new URL('../../CNAME', import.meta.url), 'utf8').trim(), 'www.bcesteticaavancada.com.br');
});

test('IndexNow verification file exists at root and contains only the public key', () => {
  const key = '344fc1cd179648fe8495ce927331cad2';
  assert.equal(readFileSync(new URL('../../' + key + '.txt', import.meta.url), 'utf8').trim(), key);
});

test('todas as páginas do sitemap são alcançáveis da home por links HTML e têm metadados coerentes', async () => {
  const {parseHTML}=await import('linkedom');
  const xml=readFileSync(new URL('../../sitemap.xml', import.meta.url),'utf8');
  const pages=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(hit=>hit[1]);
  const edges=new Map(), titles=new Set(), descriptions=new Set();
  for(const page of pages){
    const file=new URL('../../'+new URL(page).pathname.slice(1)+'index.html',import.meta.url);
    const {document}=parseHTML(readFileSync(file,'utf8'));
    assert.equal(document.querySelector('meta[property="og:url"]').content,page);
    assert.equal(document.querySelectorAll('h1').length,1,page);
    assert.equal(document.querySelectorAll('img:not([alt])').length,0,page);
    titles.add(document.title);descriptions.add(document.querySelector('meta[name="description"]').content);
    edges.set(page,[...document.querySelectorAll('a[href]')].map(a=>new URL(a.getAttribute('href'),page).href.split(/[?#]/)[0]).filter(u=>pages.includes(u)));
  }
  assert.equal(titles.size,pages.length);assert.equal(descriptions.size,pages.length);
  const seen=new Set([canonical]);
  for(const page of seen)for(const target of edges.get(page))seen.add(target);
  assert.deepEqual([...seen].sort(),pages.sort());
});
