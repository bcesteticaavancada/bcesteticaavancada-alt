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
