import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../index.html', import.meta.url);
const cssUrl = new URL('../../styles.css', import.meta.url);
const scriptUrl = new URL('../../script.js', import.meta.url);

async function homeHtml() {
  return readFile(htmlUrl, 'utf8');
}

function extractMeta(html, propertyOrName) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((item) => {
    const prop = item.match(/\bproperty=["']([^"']+)["']/i)?.[1];
    const name = item.match(/\bname=["']([^"']+)["']/i)?.[1];
    return prop === propertyOrName || name === propertyOrName;
  });
  return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
}

function extractJsonLd(html) {
  const match = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'LocalBusiness JSON-LD must exist');
  return JSON.parse(match[1]);
}

test('home SEO head is explicit, local and share-ready', async () => {
  const html = await homeHtml();
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  assert.equal(title, 'BC Estética Avançada | Beleza, Ciência e Cuidado em BH');
  assert.ok(title.length >= 30 && title.length <= 65);
  assert.match(html, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/bcesteticaavancada\.github\.io\/bcesteticaavancada-alt\/["']\s*\/?\s*>/i);
  assert.equal(extractMeta(html, 'og:title'), title);
  assert.ok(extractMeta(html, 'og:description').length >= 60);
  assert.equal(extractMeta(html, 'og:url'), 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/');
  assert.equal(extractMeta(html, 'og:image'), 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/assets/01-mel-perfil.jpg');
});

test('home remains presentation-only with one hero and no internal-page sections', async () => {
  const html = await homeHtml();
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  assert.equal((main.match(/<section\b/gi) || []).length, 1);
  assert.match(main, /<section\b[^>]*class=["'][^"']*home-hero[^"']*["']/i);
  assert.doesNotMatch(main, /id=["'](?:metodo-bc|pilares|tratamentos|midia-bc|ambiente|especialistas|faq|cta-final)["']/i);
  assert.doesNotMatch(main, /<video\b/i);
  assert.doesNotMatch(main, /data-video-src=/i);
});

test('home LocalBusiness schema matches official clinic data', async () => {
  const html = await homeHtml();
  const schema = extractJsonLd(html);
  assert.equal(schema['@type'], 'LocalBusiness');
  assert.equal(schema.name, 'BC Estética Avançada');
  assert.equal(String(schema.telephone).replace(/\D/g, ''), '5531995184110');
  assert.match(schema.address?.streetAddress || '', /Rua Gávea, 358/);
  assert.equal(schema.address?.addressLocality, 'Belo Horizonte');
  assert.equal(schema.address?.addressRegion, 'MG');
  assert.ok(Array.isArray(schema.openingHoursSpecification));
  assert.ok(schema.openingHoursSpecification.length > 0);
});

test('home keeps one visible brand image and Mel as background presentation', async () => {
  const html = await homeHtml();
  const images = html.match(/<img\b[^>]*>/gi) || [];
  assert.equal(images.length, 1, 'home must keep a single visible logo image');
  assert.match(images[0], /\balt=["']BC Estética Avançada["']/i);
  assert.match(html, /assets\/logo-oficial\/bc-logo-estetica-avancada-flutuante\.webp/);
  assert.doesNotMatch(html, /<img\b[^>]*01-mel-perfil\.jpg/i);
});

test('home CSS stays fluid and interaction script remains external', async () => {
  const [html, css, script] = await Promise.all([
    homeHtml(),
    readFile(cssUrl, 'utf8'),
    readFile(scriptUrl, 'utf8'),
  ]);
  assert.match(css, /overflow-x:\s*hidden/i);
  assert.match(css, /01-mel-perfil\.jpg/i);
  assert.match(html, /<script\s+src=["']script\.js["']><\/script>/i);
  assert.ok(script.includes('window.BCMenuReady=true'));
});

test('home simple footer is protected from rich-footer replacement', async () => {
  const [html, script] = await Promise.all([homeHtml(), readFile(scriptUrl, 'utf8')]);
  assert.match(html, /<footer\b[^>]*data-bc-footer=["']home["']/i);
  assert.match(script, /footer\[data-bc-footer=["']home["']\]/i);
});
