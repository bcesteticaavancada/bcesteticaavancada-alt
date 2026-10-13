import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildAnamnesePdf } from './pdf.ts';

function jpegWithExifOrientation(orientation: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01,
    0x03, 0x00,
    0x01, 0x00, 0x00, 0x00,
    orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0xff, 0xd9,
  ]);
}

Deno.test('lê orientação EXIF de JPEG tirado no celular', async () => {
  const module = await import('./pdf.ts');
  assert('readJpegExifOrientation' in module, 'pdf.ts deve expor leitura de orientação EXIF');
  const readOrientation = (module as unknown as { readJpegExifOrientation: (bytes: Uint8Array) => number }).readJpegExifOrientation;
  assertEquals(readOrientation(jpegWithExifOrientation(6)), 6);
  assertEquals(readOrientation(jpegWithExifOrientation(8)), 8);
});

Deno.test('posiciona foto EXIF 6 em pé dentro da área reservada', async () => {
  const module = await import('./pdf.ts');
  assert('photoDrawPlacement' in module, 'pdf.ts deve expor cálculo de posicionamento orientado');
  const placement = (module as unknown as {
    photoDrawPlacement: (input: Record<string, number>) => {
      rotation: number;
      visibleWidth: number;
      visibleHeight: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }).photoDrawPlacement({
    imageWidth: 4000,
    imageHeight: 3000,
    orientation: 6,
    boxX: 437,
    boxY: 500,
    boxWidth: 110,
    boxHeight: 130,
  });

  assertEquals(placement.rotation, -90);
  assert(Math.abs(placement.visibleWidth - 97.5) < 0.01);
  assert(Math.abs(placement.visibleHeight - 130) < 0.01);
  assert(placement.x >= 437);
  assert(placement.y <= 630);
});

Deno.test('gera PDF institucional válido com snapshot mínimo', async () => {
  const bytes = await buildAnamnesePdf({
    document: {
      document_code: 'BC-ANM-TESTE',
      document_version: 1,
      profissional_nome: 'Profissional Teste',
      profissional_profissao: 'Biomédica Esteta',
      profissional_conselho: 'CRBM',
      profissional_registro: '00000',
    },
    client: {
      nome: 'Cliente Teste',
      cpf: '00000000000',
      data_nascimento: '1990-01-01',
      telefone: '(31) 00000-0000',
    },
    anamnese: {
      version: 1,
      reviewed_at: '2026-10-12T12:00:00-03:00',
      finalized_at: '2026-10-12T12:10:00-03:00',
    },
    answers: [
      { question_key: 'queixa_principal', answer_json: 'Teste clínico' },
      { question_key: 'declaracao_veracidade', answer_json: true },
      { question_key: 'declaracao_dados', answer_json: true },
    ],
    signatures: [
      { signer_kind: 'paciente', signer_name: 'Cliente Teste', signed_at: '2026-10-12T12:05:00-03:00' },
      { signer_kind: 'profissional', signer_name: 'Profissional Teste', signer_profissao: 'Biomédica Esteta', signer_conselho: 'CRBM', signer_registro: '00000', signed_at: '2026-10-12T12:10:00-03:00' },
    ],
  });

  assert(bytes.length > 1000);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});
