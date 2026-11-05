import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../nfc/index.html', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../../sitemap.xml', import.meta.url), 'utf8');
const canonical = 'https://www.bcesteticaavancada.com.br/nfc/';

test('cartão NFC tem rota oficial própria e preserva ação de compartilhar', () => {
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
  assert.ok(html.includes(`<meta property="og:url" content="${canonical}"`));
  assert.ok(html.includes(`var url="${canonical}";`), 'compartilhamento aponta para o cartão novo');
  assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), 'sitemap lista o cartão novo');
  assert.ok(!html.includes('bcesteticaavancada.github.io'), 'novo cartão não depende de URLs do domínio antigo');
});

test('identidade do cartão e links externos preservados', () => {
  for (const route of [
    'https://wa.me/5531995184110',
    'https://instagram.com/bc.esteticaavancada',
    'https://share.google/yo2CtPzELbkQdylnG',
    'https://maps.app.goo.gl/Y4HiJwusAV2AdJb98',
    'https://www.bcesteticaavancada.com.br/',
  ]) assert.ok(html.includes(route), `link existente preservado: ${route}`);
  for (const asset of [
    '../../assets/bc-estetica-equipe-hero-luxo-dourado.webp',
    '../../assets/logo-oficial/bc-logo-estetica-avancada-flutuante.webp',
  ]) assert.ok(existsSync(new URL(asset, import.meta.url)), `recurso visual existe: ${asset}`);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('cartão NFC mantém metadados sociais na nova origem', () => {
  assert.ok(html.includes('https://www.bcesteticaavancada.com.br/assets/bc-estetica-equipe-hero-luxo-dourado.webp'));
  assert.ok(html.includes('https://www.bcesteticaavancada.com.br/assets/logo-oficial/bc-logo-estetica-avancada-flutuante.webp'));
});
