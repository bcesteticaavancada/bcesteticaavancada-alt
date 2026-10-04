import { assert, assertEquals } from 'jsr:@std/assert@1';
import { fitImageWithinBox, formatCpfForPdf, generatePreAnamnesePdf, sanitizePdfText } from './pdf.ts';

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const ONE_PIXEL_PNG = base64Bytes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');

Deno.test('sanitizePdfText preserves Portuguese accents and removes unsupported glyphs safely', () => {
  assertEquals(sanitizePdfText('áéíóú ç ã ê “aspas” — travessão 😀'), 'áéíóú ç ã ê "aspas" - travessão ?');
});

Deno.test('formatCpfForPdf formats exactly eleven digits and preserves legacy fallback', () => {
  assertEquals(formatCpfForPdf('52998224725'), '529.982.247-25');
  assertEquals(formatCpfForPdf('529.982.247-25'), '529.982.247-25');
  assertEquals(formatCpfForPdf(''), '-');
  assertEquals(formatCpfForPdf(null), '-');
});

Deno.test('fitImageWithinBox preserves aspect ratio without exceeding the box', () => {
  assertEquals(fitImageWithinBox(1000, 500, 260, 90), { width: 180, height: 90 });
  assertEquals(fitImageWithinBox(500, 1000, 260, 90), { width: 45, height: 90 });
  assertEquals(fitImageWithinBox(118, 62, 118, 62), { width: 118, height: 62 });
});

Deno.test('generatePreAnamnesePdf accepts CPF, official rubric time, logo, rubric and long text', async () => {
  const bytes = await generatePreAnamnesePdf({
    publicCode: 'BC-20261004-ABCDE',
    createdAt: '2026-10-04T12:00:00Z',
    rubricConfirmedAt: '2026-10-04T12:00:00Z',
    patient: {
      name: 'João da Silva',
      cpf: '52998224725',
      birthDate: '1990-01-02',
      age: 36,
      phone: '(31) 99999-9999',
      email: 'joao@example.com',
    },
    procedure: 'Cryo Lift, Papada Off, Hollywood Peel, Bioestimulador e um procedimento com descrição longa para validar quebra de linha editorial no documento',
    answers: { observacoes: 'áéíóú ç ã ê “aspas” — travessão 😀 '.repeat(500) },
    consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
    signaturePngBytes: ONE_PIXEL_PNG,
    logoPngBytes: ONE_PIXEL_PNG,
  });

  assert(bytes.length > 1000);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');

  const { PDFDocument } = await import('npm:pdf-lib@1.17.1');
  const document = await PDFDocument.load(bytes);
  assert(document.getPageCount() >= 2);
});
