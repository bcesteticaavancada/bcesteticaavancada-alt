import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfDownloadFilename } from '../../supabase/functions/submit-pre-anamnese/download-filename.js';

test('gera nome BC-Ficha com data de Belo Horizonte, primeiro nome e último sobrenome', () => {
  assert.equal(
    buildPdfDownloadFilename('Vitória da Cunha', '2026-11-10T15:30:00.000Z'),
    'BC-Ficha2026-11-10Vitória-Cunha.pdf',
  );
});

test('usa a data local de Belo Horizonte quando UTC já virou o dia', () => {
  assert.equal(
    buildPdfDownloadFilename('Fernando Victor Barbosa de Faria', '2026-11-11T01:30:00.000Z'),
    'BC-Ficha2026-11-10Fernando-Faria.pdf',
  );
});

test('normaliza espaços e caracteres inseguros sem alterar o padrão', () => {
  assert.equal(
    buildPdfDownloadFilename('  Ana   Clara / Souza  ', '2026-10-08T12:00:00.000Z'),
    'BC-Ficha2026-10-08Ana-Souza.pdf',
  );
});
