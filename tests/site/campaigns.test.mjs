import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { safeGroupInvite, activateVipLinks } from '../../campanhas/vip.js';
import { VIP_GROUP_INVITE_URL } from '../../campanhas/vip-config.js';

const origin = 'https://www.bcesteticaavancada.com.br/';
const pages = ['campanhas/index.html', 'campanhas/aniversario-1-ano/index.html', 'diamond/index.html'];
const invite = 'https://chat.whatsapp.com/ExemploFicticioGrupo123';
const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

test('convites vazios, scripts e domínios falsos não ativam a entrada no grupo', () => {
  for (const input of ['', null, 'javascript:alert(1)', 'http://chat.whatsapp.com/abc',
    'https://chat.whatsapp.com.evil.example/abc', 'https://evil.example/?chat.whatsapp.com',
    'https://user:password@chat.whatsapp.com/abc', 'https://chat.whatsapp.com:444/abc',
    'https://chat.whatsapp.com/', 'https://chat.whatsapp.com/a/b',
    'https://chat.whatsapp.com/abc#script', '<script>alert(1)</script>']) {
    assert.equal(safeGroupInvite(input), null, String(input));
    const { document } = parseHTML(read(pages[1]));
    assert.equal(activateVipLinks(document, input), 0);
    assert.equal(document.querySelectorAll('[data-vip-link]').length, 0);
    for (const button of document.querySelectorAll('[data-vip-join]')) assert(button.hasAttribute('disabled'));
  }
});

test('um convite válido ativa os dois pontos de entrada sem inserir HTML', () => {
  for (const file of pages) {
    const { document } = parseHTML(read(file));
    const count = document.querySelectorAll('[data-vip-join], [data-vip-link]').length;
    assert(count > 0);
    assert.equal(activateVipLinks(document, invite), count);
    for (const link of document.querySelectorAll('[data-vip-link]')) {
      assert.equal(link.getAttribute('href'), invite);
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      assert(document.getElementById(link.getAttribute('aria-describedby')));
      assert.match(link.textContent, /(?:Entrar no Grupo|Receber meu convite) Diamond/);
    }
    assert.equal(document.querySelectorAll('[data-vip-pending]:not([hidden])').length, 0);
    assert.equal(activateVipLinks(document, invite), 0, 'a segunda inicialização não duplica links');
  }
});

test('as páginas oferecem atendimento real e destinos locais válidos mesmo sem JavaScript', () => {
  for (const file of pages) {
    const { document } = parseHTML(read(file));
    assert.equal(document.querySelectorAll('h1').length, 1);
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(document.querySelector('link[rel="canonical"]').href, origin + file.replace('index.html', ''));
    for (const el of document.querySelectorAll('a[href],img[src],script[src],link[rel="stylesheet"]')) {
      const raw = el.getAttribute('href') || el.getAttribute('src');
      if (raw.startsWith('#') || /^[a-z]+:/i.test(raw)) continue;
      const target = new URL(raw, new URL('../../' + file, import.meta.url));
      assert(existsSync(target.pathname.endsWith('/') ? new URL('index.html', target) : target), raw + ' em ' + file);
    }
    const contacts = [...document.querySelectorAll('a[href^="https://wa.me/5531995184110?text="]')];
    if (file.startsWith('campanhas/')) assert(contacts.length > 0);
    for (const link of contacts) assert.match(new URL(link.href).searchParams.get('text'), /Super Aniversário de 1 Ano/);
    assert.match(document.getElementById('vip-privacy').textContent, /número.*visível/);
    assert.match(document.querySelector('main').textContent, /100 participantes/);
    for (const link of document.querySelectorAll('[data-vip-link]')) {
      assert.equal(link.getAttribute('href'), safeGroupInvite(VIP_GROUP_INVITE_URL));
    }
    assert.doesNotMatch(document.querySelector('main').textContent, /\bVIP\b|promoç/i);
    assert.doesNotMatch(document.querySelector('main').textContent, /Black Friday|R\$|\d+%|últimas vagas/i);
  }
});

test('o menu ganha Campanhas uma única vez e preserva os destinos existentes', () => {
  for (const file of ['index.html', 'agenda/index.html', ...pages.filter(p => p.startsWith('campanhas/'))]) {
    const { document, window } = parseHTML(read(file));
    const location = new URL(file, origin);
    Object.defineProperty(window, 'location', { value: location, configurable: true });
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (!href.startsWith('#') && !/^(mailto:|tel:)/i.test(href)) a.setAttribute('href', new URL(href, location).href);
    }
    vm.runInNewContext(read('script.js'), { document, window, URL });
    assert.equal(document.querySelectorAll('.drawer-nav [data-bc-campaigns-link]').length, 1, file);
    assert.equal(document.querySelectorAll('.bc-drawer-group').length, 2, file);
    assert.equal(new URL(document.querySelector('[data-bc-campaigns-link]').href).pathname, '/campanhas/');
    if (file.startsWith('campanhas/')) assert.equal(document.querySelectorAll('footer').length, 1, file);
  }
});
