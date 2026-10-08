import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmissionSuccessView } from '../../agendamento/js/main.js';

test('buildSubmissionSuccessView prepares public code, patient filename and temporary PDF actions', () => {
  const view = buildSubmissionSuccessView(
    {
      publicCode: 'BC-20261110-ABCDE',
      createdAt: '2026-11-10T15:30:00.000Z',
      pdfUrl: 'https://signed.example/pdf',
      pdfExpiresAt: '2026-11-10T20:10:00Z'
    },
    'Vitória da Cunha'
  );
  assert.deepEqual(view, {
    publicCode: 'BC-20261110-ABCDE',
    filename: 'BC-Ficha2026-11-10Vitória-Cunha.pdf',
    pdfUrl: 'https://signed.example/pdf',
    pdfExpiresAt: '2026-11-10T20:10:00Z',
    message: 'Ficha BC-20261110-ABCDE enviada com segurança.'
  });
});
