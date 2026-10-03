import { assert, assertEquals } from 'jsr:@std/assert@1';
import { generatePreAnamnesePdf, sanitizePdfText } from './pdf.ts';

Deno.test('sanitizePdfText preserves Portuguese accents and removes unsupported glyphs safely', () => {
  assertEquals(sanitizePdfText('áéíóú ç ã ê “aspas” — travessão 😀'), 'áéíóú ç ã ê "aspas" - travessão ?');
});

Deno.test('generatePreAnamnesePdf returns a valid PDF and accepts long observation', async () => {
  const bytes = await generatePreAnamnesePdf({
    publicCode: 'BC-20261003-ABCDE', createdAt: '2026-10-03T12:00:00Z',
    patient: { name: 'João da Silva', birthDate: '1990-01-02', age: 36, phone: '(31) 99999-9999', email: 'joao@example.com' },
    procedure: 'Cryo Lift',
    answers: { observacoes: 'áéíóú ç ã ê “aspas” — travessão 😀 '.repeat(500) },
    consents: { truthful: true, dataProcessing: true },
    signaturePngBytes: new Uint8Array(),
  });
  assert(bytes.length > 500);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});
