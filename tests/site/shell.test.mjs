import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

const sectionPages = [
  '../../clinica/index.html',
  '../../equipe/index.html',
  '../../mel/index.html',
  '../../procedimentos/index.html',
  '../../resultados/index.html',
  '../../protocolos/index.html',
  '../../ambiente/index.html',
  '../../valores/index.html',
  '../../agendamento/index.html',
  '../../contato/index.html',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

function block(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.notEqual(a, -1, `missing start marker: ${start}`);
  assert.notEqual(b, -1, `missing end marker: ${end}`);
  return source.slice(a, b);
}

test('home keeps the static 11-link drawer shell', () => {
  const nav = block(home, '<nav class="drawer-nav"', '</nav>');
  assert.equal((nav.match(/<a\b/g) || []).length, 11);
  assert.match(home, /class="menu-toggle"[^>]*id="menuToggle"/);
  assert.ok(home.indexOf('class="brand"') < home.indexOf('class="header-cta"'));
  assert.match(styles, /\.menu-toggle\s*\{[^}]*justify-self\s*:\s*end/s);
});

test('shared menu script injects BC Gestão between Agendamento and Contato', () => {
  assert.match(script, /function\s+ensureBCGestaoMenuLink\s*\(/);
  assert.match(script, /textContent\s*=\s*["']BC Gestão["']/);
  assert.match(script, /new URL\(["']\.\.\/gestao\/login\/["']\s*,\s*contactLink\.href\)/);
  assert.match(script, /nav\.insertBefore\(link\s*,\s*contactLink\)/);
  assert.match(script, /ensureBCGestaoMenuLink\(\)/);
});

test('all public section drawers keep the same static shell and shared script', () => {
  for (const page of sectionPages) {
    const nav = block(page, '<nav class="drawer-nav"', '</nav>');
    assert.equal((nav.match(/<a\b/g) || []).length, 11);
    assert.match(page, /<script\s+src="\.\.\/script\.js"><\/script>/);
  }
});

test('home remains presentation-only with one logo and Mel background', () => {
  assert.equal((home.match(/bc-logo-estetica-avancada-flutuante\.webp/g) || []).length, 1);
  assert.match(styles, /\.home-hero\s*\{[\s\S]*?assets\/01-mel-perfil\.jpg/);
  assert.doesNotMatch(home, /procedure-grid-bc|result-grid|alice-profile|team-profile/);
});

test('home simple footer is protected from global rich-footer replacement', () => {
  assert.match(home, /<footer[^>]*data-bc-footer="home"/);
  assert.match(script, /footer\[data-bc-footer=["']home["']\]/);
  assert.match(script, /if\(document\.querySelector\('footer\[data-bc-footer="home"\]'\)\)return;/);
});
