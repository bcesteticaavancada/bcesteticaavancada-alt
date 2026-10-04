import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmissionSuccessView } from '../../agendamento/js/main.js';

test('buildSubmissionSuccessView prepares public code, filename and temporary PDF actions', () => {
  const view = buildSubmissionSuccessView({ publicCode: 'BC-20261003-ABCDE', pdfUrl: 'https://signed.example/pdf', pdfExpiresAt: '2026-10-03T20:10:00Z' });
  assert.deepEqual(view, {
    publicCode: 'BC-20261003-ABCDE',
    filename: 'BC-20261003-ABCDE.pdf',
    pdfUrl: 'https://signed.example/pdf',
    pdfExpiresAt: '2026-10-03T20:10:00Z',
    message: 'Ficha BC-20261003-ABCDE enviada com segurança.'
  });
});


test('main rubric UI uses confirmation terminology and the approved in-person signature notice', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../../agendamento/js/main.js', import.meta.url), 'utf8');
  assert.match(source, /Rubrica de confirmação da pré-anamnese/);
  assert.match(source, /Faça sua rubrica no campo abaixo usando o dedo/);
  assert.match(source, /assinatura formal e os termos específicos do procedimento serão realizados presencialmente/i);
  assert.match(source, /Data\/hora oficial registrada no envio/);
  assert.match(source, /Limpar e refazer/);
});
