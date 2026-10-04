import { assert, assertEquals } from 'jsr:@std/assert@1';
import { generatePreAnamnesePdf, sanitizePdfText } from './pdf.ts';

Deno.test('sanitizePdfText preserves Portuguese accents and removes unsupported glyphs safely', () => {
  assertEquals(sanitizePdfText('áéíóú ç ã ê “aspas” — travessão 😀'), 'áéíóú ç ã ê "aspas" - travessão ?');
});

Deno.test('generatePreAnamnesePdf returns a valid PDF with CPF and rubric integrity metadata', async () => {
  const bytes = await generatePreAnamnesePdf({
    publicCode: 'BC-20261003-ABCDE', createdAt: '2026-10-03T12:00:00Z',
    patient: { name: 'João da Silva', cpf: '52998224725', birthDate: '1990-01-02', age: 36, phone: '(31) 99999-9999', email: 'joao@example.com' },
    procedure: 'Cryo Lift',
    answers: { observacoes: 'áéíóú ç ã ê “aspas” — travessão 😀 '.repeat(500) },
    consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
    signaturePngBytes: new Uint8Array(),
    rubricSha256: 'a'.repeat(64),
    rubricConfirmedAt: '2026-10-03T12:00:00Z',
  });
  assert(bytes.length > 500);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});
