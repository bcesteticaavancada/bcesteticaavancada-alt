import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const approved = [
  'https://bcesteticaavancada.github.io',
  'https://www.bcesteticaavancada.com.br',
  'https://bcesteticaavancada.com.br',
];
const edgeFunctions = [
  'public-agenda',
  'submit-pre-anamnese',
  'generate-anamnese-pdf',
  'generate-clinical-pdf',
];

function file(path) {
  return readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
}

function originBlock(source, declaration) {
  const expression = new RegExp('const\\s+' + declaration + '\\s*=\\s*(?:new Set\\()?\\[\\s*([\\s\\S]*?)\\]\\)?;');
  const match = source.match(expression);
  assert.ok(match, 'Lista explícita de origens não encontrada: ' + declaration);
  return match[1];
}

test('Agenda mantém domínio legado e ambos os endereços próprios sem curinga', () => {
  const content = originBlock(file('agendamento/js/config.js'), 'OFFICIAL_SITE_ORIGINS');
  for (const origin of approved) assert.ok(content.includes("'" + origin + "'"), origin);
  assert.doesNotMatch(content, /['"]\*['"]/);
});

for (const name of edgeFunctions) {
  test('Edge Function ' + name + ' aceita origens exatas e preserva legado', () => {
    const source = file('supabase/functions/' + name + '/index.ts');
    const content = originBlock(source, 'ALLOWED_ORIGINS');
    for (const origin of approved) assert.ok(content.includes("'" + origin + "'"), origin);
    assert.doesNotMatch(content, /['"]\*['"]/);
    assert.match(source, /ALLOWED_ORIGINS\.has\(origin\)/);
    assert.match(source, /'Vary'\s*:\s*'Origin'/);
    assert.doesNotMatch(source, /'Access-Control-Allow-Origin'\s*:\s*['"]\*['"]/);
  });
}
