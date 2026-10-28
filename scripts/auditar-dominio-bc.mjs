#!/usr/bin/env node
/**
 * Auditoria de referências ao endereço legado da BC Estética.
 * Somente leitura. Não faz requisições, não altera arquivos e não lê segredos.
 * Uso: node scripts/auditar-dominio-bc.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirs = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'assets', 'docs', 'vendor', 'coverage', '.cache']);
const textFile = /\.(?:html?|mjs|cjs|js|jsx|ts|tsx|css|json|webmanifest|xml|txt|ya?ml)$/i;
const legacy = /(?:https?:\/\/bcesteticaavancada\.github\.io(?:\/bcesteticaavancada-alt)?|\/bcesteticaavancada-alt\/)/g;
const results = [];

function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) scan(absolute);
      continue;
    }
    if (!entry.isFile() || !textFile.test(entry.name) || statSync(absolute).size > 1024 * 1024) continue;
    const path = relative(root, absolute).replaceAll('\\', '/');
    const content = readFileSync(absolute, 'utf8');
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      legacy.lastIndex = 0;
      if (!legacy.test(line)) continue;
      results.push({path, line: index + 1, type: path.startsWith('tests/') ? 'teste' : path.startsWith('scripts/') ? 'operacional' : 'aplicacao', excerpt: line.trim().slice(0, 180)});
    }
  }
}

scan(root);
results.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
const summary = {
  total: results.length,
  arquivos: new Set(results.map(item => item.path)).size,
  aplicacao: results.filter(item => item.type === 'aplicacao').length,
  operacional: results.filter(item => item.type === 'operacional').length,
  testes: results.filter(item => item.type === 'teste').length,
};
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({summary, references: results}, null, 2) + '\n');
} else {
  process.stdout.write('BC — referências ao domínio/caminho antigo: ' + summary.total + ' ocorrências em ' + summary.arquivos + ' arquivos\n');
  process.stdout.write('Aplicação: ' + summary.aplicacao + '; Operacional: ' + summary.operacional + '; Testes: ' + summary.testes + '\n');
  for (const item of results) process.stdout.write(item.type.padEnd(12) + ' ' + item.path + ':' + item.line + '  ' + item.excerpt + '\n');
}
