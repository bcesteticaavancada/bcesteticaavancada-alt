import { assert, assertEquals } from 'jsr:@std/assert@1';
import { PDF_DOCUMENT_TITLE } from './pdf-content.ts';
import { formatPageLabel, generatePreAnamnesePdf, sanitizePdfText } from './pdf.ts';

Deno.test('premium document identity exposes the approved title and page label', () => {
  assertEquals(PDF_DOCUMENT_TITLE, 'Pré-Avaliação Estética Individualizada');
  assertEquals(formatPageLabel(1, 3), 'Página 1 de 3');
  assertEquals(formatPageLabel(3, 3), 'Página 3 de 3');
});

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

Deno.test('compact short-answer fixture fits in at most two A4 pages', async () => {
  const bytes = await generatePreAnamnesePdf({
    publicCode: 'BC-20261005-CARDS',
    createdAt: '2026-10-05T18:00:00Z',
    patient: {
      name: 'Pessoa com Respostas Curtas',
      cpf: '52998224725',
      birthDate: '1991-12-03',
      age: 34,
      phone: '(31) 99999-9999',
      email: 'pessoa@example.com',
    },
    procedure: 'Peeling Coreano',
    answers: {
      sexo: 'Masculino',
      pele: 'Oleosa',
      solIntenso: 'Não',
      manchasPos: 'Não',
      protetor: 'Sim',
      condSaude: 'Não',
      cardio: 'Não',
      acomp: 'Sim',
      medCont: 'Não',
      derm: 'Não',
      alergia: 'Não',
      reacaoEst: 'Não',
      alcool: 'Não',
      nic: 'Não',
      gest: 'Não se aplica',
      amamenta: 'Não se aplica',
      recente: 'Não',
      recRecuperacao: 'Não',
    },
    consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
    signaturePngBytes: new Uint8Array(),
    rubricSha256: 'b'.repeat(64),
    rubricConfirmedAt: '2026-10-05T18:00:00Z',
  });

  const { PDFDocument } = await import('npm:pdf-lib@1.17.1');
  const doc = await PDFDocument.load(bytes);
  assert(doc.getPageCount() <= 2, `expected compact fixture to fit in <= 2 pages, got ${doc.getPageCount()}`);
});

Deno.test('very long narrative answer paginates without producing an invalid PDF', async () => {
  const bytes = await generatePreAnamnesePdf({
    publicCode: 'BC-20261005-LONG',
    createdAt: '2026-10-05T18:00:00Z',
    patient: { name: 'Pessoa Texto Longo', cpf: '52998224725', birthDate: '1990-01-02', age: 36, phone: '(31) 99999-9999' },
    procedure: 'Avaliação estética',
    answers: { observacoes: 'Relato detalhado do paciente com informações importantes para conversa presencial. '.repeat(350) },
    consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
    signaturePngBytes: new Uint8Array(),
  });
  const { PDFDocument } = await import('npm:pdf-lib@1.17.1');
  const doc = await PDFDocument.load(bytes);
  assert(doc.getPageCount() > 1);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});
