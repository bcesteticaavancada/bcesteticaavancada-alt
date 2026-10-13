import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const auth = await readFile(new URL('../../gestao/js/auth.js', import.meta.url),'utf8');
const shell = await readFile(new URL('../../gestao/js/shell.js', import.meta.url),'utf8');

test('auth inicializa recursos de procedimentos somente após perfil válido', () => {
  assert.match(auth,/bootstrapRoleFeatures/);
  assert.match(auth,/import\(['"]\.\/procedure-panel\.js['"]\)/);
  assert.match(auth,/await\s+bootstrapRoleFeatures\s*\(\s*\{\s*client\s*,\s*profile\s*\}\s*\)/);
});

test('shell usa delegação/consulta dinâmica para novas abas autenticadas', () => {
  assert.match(shell,/closest\(\s*['"]\[data-nav\]\[data-area-target\]['"]\s*\)/);
  assert.match(shell,/querySelectorAll\(\s*['"]\[data-area-panel\]['"]\s*\)/);
});