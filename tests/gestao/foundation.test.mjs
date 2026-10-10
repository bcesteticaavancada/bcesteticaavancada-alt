import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'gestao/login/index.html',
  'gestao/admin/index.html',
  'gestao/colaborador/index.html',
  'gestao/assets/gestao.css',
  'gestao/js/routes.js',
  'gestao/js/config.js',
  'gestao/js/supabase-client.js',
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('BC Gestão foundation files exist', () => {
  for (const rel of requiredFiles) {
    assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  }
});

test('all role pages carry BC Gestão brand and responsive viewport', () => {
  for (const rel of ['gestao/login/index.html', 'gestao/admin/index.html', 'gestao/colaborador/index.html']) {
    const full = path.join(root, rel);
    assert.ok(fs.existsSync(full), `missing ${rel}`);
    const html = fs.readFileSync(full, 'utf8');
    assert.match(html, /BC Gestão/);
    assert.match(html, /<meta\s+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i);
  }
});

test('gestao remains isolated and contains no privileged secret markers', () => {
  for (const file of walk(path.join(root, 'gestao'))) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /service_role/i, `privileged key marker found in ${file}`);
    assert.doesNotMatch(text, /(?:\.\.\/)+admin\/admin\.(?:js|css)/, `legacy admin dependency found in ${file}`);
  }
});
