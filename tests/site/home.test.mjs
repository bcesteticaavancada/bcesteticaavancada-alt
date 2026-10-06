import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../index.html', import.meta.url);
const cssUrl = new URL('../../styles.css', import.meta.url);
const homeCssUrl = new URL('../../home-redesign.css', import.meta.url);
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
  assert.equal(title, 'BC Estética Avançada | Belo Horizonte');
  assert.ok(title.length >= 30 && title.length <= 60);
  assert.match(html, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/bcesteticaavancada\.github\.io\/bcesteticaavancada-alt\/["']\s*\/?\s*>/i);
  assert.equal(extractMeta(html, 'og:title'), 'BC Estética Avançada | Belo Horizonte');
  assert.ok(extractMeta(html, 'og:description').length >= 60);
  assert.equal(extractMeta(html, 'og:url'), 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/');
  assert.equal(extractMeta(html, 'og:image'), 'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/assets/02-equipe-bc-estetica.jpg');
});

test('home exposes one H1 and the approved editorial landmarks', async () => {
  const html = await homeHtml();
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  for (const id of ['metodo-bc', 'pilares', 'tratamentos', 'midia-bc', 'ambiente', 'especialistas', 'avaliacao', 'faq', 'cta-final']) {
    assert.match(html, new RegExp(`id=["']${id}["']`, 'i'), `missing section #${id}`);
  }
});

test('home LocalBusiness schema matches visible clinic data', async () => {
  const html = await homeHtml();
  const schema = extractJsonLd(html);
  assert.equal(schema['@type'], 'LocalBusiness');
  assert.equal(schema.name, 'BC Estética Avançada');
  assert.equal(schema.telephone, '+55 31 99518-4110');
  assert.equal(schema.address?.streetAddress, 'Rua Gávea, 358, Loja 02, 2º andar');
  assert.equal(schema.address?.addressLocality, 'Belo Horizonte');
  assert.equal(schema.address?.addressRegion, 'MG');
  assert.ok(Array.isArray(schema.openingHoursSpecification));
  assert.ok(schema.openingHoursSpecification.length > 0);
});

test('every home image has an alt attribute and real BC images are referenced', async () => {
  const html = await homeHtml();
  const images = html.match(/<img\b[^>]*>/gi) || [];
  assert.ok(images.length >= 5, 'expected a richer real-image editorial home');
  for (const image of images) {
    assert.match(image, /\balt=["'][^"']*["']/i, `image is missing alt: ${image}`);
  }
  assert.match(html, /assets\/02-equipe-bc-estetica\.jpg/);
  assert.match(html, /assets\/03-recepcao-bc-estetica\.jpg/);
  assert.match(html, /assets\/05-sala-procedimentos\.jpg/);
});

test('home CSS stays fluid and the interaction script remains external', async () => {
  const [html, css, homeCss, script] = await Promise.all([
    homeHtml(),
    readFile(cssUrl, 'utf8'),
    readFile(homeCssUrl, 'utf8'),
    readFile(scriptUrl, 'utf8'),
  ]);
  assert.match(css, /overflow-x:\s*hidden/i);
  assert.match(homeCss, /@media\(max-width:800px\)/i);
  assert.match(html, /<script\s+src=["']script\.js["']><\/script>/i);
  assert.ok(script.includes('window.BCMenuReady=true'));
});

test('home exposes four lazy procedure video cards and one reusable dialog', async () => {
  const html = await homeHtml();
  const cards = html.match(/<(?:button|article)\b[^>]*data-video-src=["'][^"']+\.mp4["'][^>]*>/gi) || [];
  assert.equal(cards.length, 4, 'expected four procedure video cards');
  for (const card of cards) {
    assert.match(card, /data-video-title=["'][^"']+["']/i);
  }
  assert.equal(/\bautoplay\b/i.test(html), false, 'initial HTML must not autoplay video');
  assert.equal(/<video\b[^>]*\bsrc=["'][^"']+/i.test(html), false, 'initial video element must not eagerly load media');
  assert.match(html, /<dialog\b[^>]*id=["']bcVideoDialog["']/i);
  assert.match(html, /<video\b[^>]*id=["']bcVideoPlayer["'][^>]*preload=["']none["']/i);
});

test('video controller resolves encoded media only after interaction and restores focus', async () => {
  const script = await readFile(scriptUrl, 'utf8');
  assert.match(script, /window\.BCVideoReady/);
  assert.match(script, /\.replace\([^\n]+\.txt/);
  assert.match(script, /fetch\(src/);
  assert.match(script, /response\.text\(\)/);
  assert.match(script, /\.pause\(\)/);
  assert.match(script, /removeAttribute\(["']src["']\)/);
  assert.match(script, /\.load\(\)/);
  assert.match(script, /\.focus\(\)/);
});
