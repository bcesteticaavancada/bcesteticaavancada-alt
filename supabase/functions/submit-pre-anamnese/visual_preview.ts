import { generatePreAnamnesePdf } from './pdf.ts';

const logo = await Deno.readFile('./assets/logo-oficial/logo-bc-estetica-sem-fundo.png');

const pdf = await generatePreAnamnesePdf({
  publicCode: 'BC-20261004-VISUAL',
  createdAt: '2026-10-04T18:20:00Z',
  rubricConfirmedAt: '2026-10-04T18:20:00Z',
  patient: {
    name: 'Cliente Demonstração BC Estética',
    cpf: '52998224725',
    birthDate: '1990-01-02',
    age: 36,
    phone: '(31) 99999-9999',
    email: 'demonstracao@example.com',
  },
  procedure: 'Cryo Lift, Papada Off, Hollywood Peel e Bioestimulador',
  answers: {
    objetivo: 'Melhorar contorno, textura e qualidade da pele com planejamento individualizado.',
    histEst: 'Já realizou procedimentos estéticos anteriormente, sem intercorrências relatadas.',
    expectativa: 'Resultado natural, elegante e progressivo, respeitando as características individuais.',
    observacoes: 'Texto de demonstração para validar composição, margens, quebras de linha, acentuação e paginação. '.repeat(18),
  },
  consents: { truthful: true, dataProcessing: true, dataAuthorization: true },
  signaturePngBytes: logo,
  logoPngBytes: logo,
});

await Deno.writeFile('/tmp/BC_Pre_Anamnese_Visual.pdf', pdf);
