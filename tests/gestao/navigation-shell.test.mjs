import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const admin = readFileSync(new URL('../../gestao/admin/index.html', import.meta.url), 'utf8');
const colaborador = readFileSync(new URL('../../gestao/colaborador/index.html', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../gestao/js/shell.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../gestao/assets/navigation.css', import.meta.url), 'utf8');

test('admin usa menu hamburguer no topo e navega por areas sem sidebar fixa', () => {
  assert.match(admin, /id="menuToggle"/);
  assert.match(admin, /class="[^"]*bcg-menu-drawer/);
  assert.doesNotMatch(admin, /class="bcg-sidebar"/);
  for (const area of ['agenda', 'clientes', 'financeiro', 'procedimentos', 'auditoria']) {
    assert.match(admin, new RegExp(`data-area-target="${area}"`));
    assert.match(admin, new RegExp(`data-area-panel[^>]*id="${area}"|id="${area}"[^>]*data-area-panel`));
  }
  assert.doesNotMatch(admin, /href="#dashboard"/);
});

test('colaboradora usa o mesmo menu por areas', () => {
  assert.match(colaborador, /id="menuToggle"/);
  assert.match(colaborador, /class="[^"]*bcg-menu-drawer/);
  assert.doesNotMatch(colaborador, /class="bcg-sidebar"/);
  for (const area of ['agenda', 'clientes', 'financeiro']) {
    assert.match(colaborador, new RegExp(`data-area-target="${area}"`));
    assert.match(colaborador, new RegExp(`data-area-panel[^>]*id="${area}"|id="${area}"[^>]*data-area-panel`));
  }
});

test('cabecalho usa BC Gestao e mensagem de boas-vindas dinamica por papel', () => {
  assert.match(admin, /<h1>BC Gestão<\/h1>/);
  assert.match(admin, /Bem-vinda,\s*<strong[^>]*>Administradora<\/strong>\s*<strong id="profileName">/);
  assert.match(admin, /Sinta-se em casa\./);
  assert.match(colaborador, /<h1>BC Gestão<\/h1>/);
  assert.match(colaborador, /Bem-vinda,\s*<strong[^>]*>Colaboradora<\/strong>\s*<strong id="profileName">/);
  assert.match(colaborador, /Sinta-se em casa\./);
});

test('shell controla abertura do menu e exibe somente a area selecionada', () => {
  assert.match(shell, /menuToggle/);
  assert.match(shell, /data-area-target/);
  assert.match(shell, /data-area-panel/);
  assert.match(shell, /\.hidden\s*=/);
  assert.match(shell, /aria-expanded/);
});

test('css possui drawer sobreposto em vez de coluna permanente', () => {
  assert.match(css, /\.bcg-menu-toggle/);
  assert.match(css, /\.bcg-menu-drawer/);
  assert.match(css, /\.bcg-menu-backdrop/);
  assert.match(css, /\.bcg-dashboard-shell\{[^}]*display:block/);
});
