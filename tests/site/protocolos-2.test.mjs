import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const page = new URL('../../protocolos/index.html', import.meta.url);
const html = readFileSync(page, 'utf8');
const css = readFileSync(new URL('../../protocolos/protocolos.css', import.meta.url), 'utf8');
const familyIds = ['toxina-botulinica', 'limpeza-renovacao', 'hidratacao-qualidade',
  'colageno-textura', 'harmonizacao-facial', 'tecnologias-firmeza', 'contorno-corporal',
  'massagens-bem-estar', 'capilar-sobrancelhas', 'cuidados-especificos'];
const links = [...html.matchAll(/<a[^>]*data-protocol-video="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)];

function article(id) {
  const match = html.match(new RegExp(`<article[^>]*id="${id}"[\\s\\S]*?<\\/article>`));
  assert.ok(match, `missing family ${id}`);
  return match[0];
}

test('Protocolos preserves canonical, navigation, scheduling and the reference catalogue', () => {
  assert.match(html, /rel="canonical" href="https:\/\/www\.bcesteticaavancada\.com\.br\/protocolos\/"/);
  assert.match(html, /href="\.\.\/agendamento\/"[^>]*>Agendar/);
  assert.match(html, /https:\/\/wa\.me\/5531995184110/);
  assert.equal(existsSync(new URL('../../docs/catalogo-procedimentos-em-espera.md', import.meta.url)), true);
});

test('the showcase contains one native player and five available videos in sequence', () => {
  assert.equal((html.match(/<video\b/g) || []).length, 1);
  assert.deepEqual(links.map((match) => match[1]), [
    'botox', 'bioestimulador', 'black-peel', 'despigmentacao', 'microagulhamento',
  ]);
  assert.doesNotMatch(html, /data-video-state="pending"/);
  assert.match(html, /<video[^>]*controls[^>]*playsinline[^>]*preload="none"/);
  assert.doesNotMatch(html, /<video[^>]*(?:autoplay|\bloop\b)/);
});

test('every selectable video has an existing MP4 and poster, including a direct link without JavaScript', () => {
  assert.equal(links.length, 5);
  for (const [tag, slug] of links) {
    const src = tag.match(/href="([^"]+)"/)?.[1];
    const poster = tag.match(/data-poster="([^"]+)"/)?.[1];
    assert.ok(src?.endsWith('.mp4'), slug);
    assert.ok(poster?.endsWith('.webp'), slug);
    assert.equal(existsSync(new URL(src, page)), true, src);
    assert.equal(existsSync(new URL(poster, page)), true, poster);
    assert.match(tag, /data-video-state="ready"/);
    assert.match(tag, /<strong>[^<]+<\/strong>/);
  }
  assert.match(html, /<source src="\.\.\/assets\/procedimentos\/botox\.mp4"/);
});

test('visitors can choose videos, navigate both directions, and receive playback status', () => {
  assert.match(html, /aria-label="Escolher vídeo de procedimento"/);
  assert.match(html, /data-video-previous[^>]*aria-label="Vídeo anterior"/);
  assert.match(html, /data-video-next[^>]*aria-label="Próximo vídeo"/);
  assert.match(html, /data-video-status[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /type="module" src="protocolos\.js\?v=/);
});

test('all six objective links still point to content in the document', () => {
  for (const id of ['rosto', 'pele', 'colageno', 'corpo', 'capilar', 'bem-estar']) {
    assert.match(html, new RegExp(`href="#${id}"`));
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('all ten treatment families keep their details and accessible native expansion', () => {
  for (const id of familyIds) {
    const card = article(id);
    assert.match(card, /<details name="protocol-family">/);
    assert.match(card, /<summary>Saiba mais<\/summary>/);
    assert.match(card, /<img[^>]*loading="lazy"/);
  }
  assert.match(css, /\.protocol-family-grid[^}]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /\.protocol-family-grid[^}]*grid-template-columns:minmax\(0,1fr\)/);
});

test('the catalogue still includes all authorial protocols and prudent clinical distinctions', () => {
  for (const title of ['Fort Hair', 'Fort Hair Plus', 'Fort Brow', 'Sculpt Cryo', 'Reset Glow', 'Monaco Glow', 'Skin Reset', 'Face Reset']) {
    assert.ok(html.includes(title), title);
  }
  assert.match(html, /Não é o mesmo procedimento que Skinbooster/);
  assert.match(html, /mecanismos e indicações diferentes/);
  assert.doesNotMatch(html, /\b(garante|sem risco|resultado certo|definitivo)\b/i);
  assert.doesNotMatch(html, /R\$\s*\d/);
});

test('small-screen media preserves full frames and keyboard and motion accessibility', () => {
  assert.match(css, /object-fit:contain/);
  assert.match(css, /scroll-snap-type/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.protocol-player-controls\[hidden\]\{display:none\}/);
  const main = html.match(/<main[\s\S]*?<\/main>/)[0];
  for (const [tag] of main.matchAll(/<img\b[^>]*>/g)) assert.match(tag, /\balt="[^"]*"/);
});

test('all page images refer to existing assets and the semantic SEO copy is retained', () => {
  for (const [, src] of html.matchAll(/<img[^>]*src="([^"]+)"/g)) {
    assert.equal(existsSync(new URL(src, page)), true, src);
  }
  for (const term of ['toxina botulínica', 'bioestimulador', 'faciais', 'corporais', 'Belo Horizonte', 'avaliação']) {
    assert.match(html, new RegExp(term, 'i'));
  }
});
