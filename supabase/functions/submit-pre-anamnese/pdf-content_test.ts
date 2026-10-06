import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  buildPdfSections,
  buildStructuredSummary,
  displayValue,
  fieldSpan,
} from './pdf-content.ts';

const baseInput = {
  patient: {
    name: 'Pessoa Teste',
    cpf: '52998224725',
    birthDate: '1990-01-02',
    age: 36,
    phone: '(31) 99999-9999',
    email: 'pessoa@example.com',
  },
  procedure: 'Peeling Coreano',
  answers: {
    sexo: 'Feminino',
    objetivos: ['Qualidade da pele'],
    objetivoTexto: 'Quero melhorar textura e viço.',
    histEst: 'Não',
    histQual: 'Limpeza de pele há seis meses.',
    pele: 'Mista',
    condSaude: 'Sim',
    saudeDesc: 'Hipotireoidismo em acompanhamento regular.',
    medCont: 'Sim',
    medDesc: 'Levotiroxina em uso contínuo.',
    gest: 'Não se aplica',
    alergia: 'Não',
    nic: 'Não',
    mPeelAnt: 'Sim',
    mPeelReac: 'Não',
    observacoes: '',
  },
  consents: {
    truthful: true,
    dataProcessing: true,
    dataAuthorization: true,
  },
};

Deno.test('displayValue normalizes empty values without inventing content', () => {
  assertEquals(displayValue(null), '-');
  assertEquals(displayValue(undefined), '-');
  assertEquals(displayValue(''), '-');
  assertEquals(displayValue(true), 'Sim');
  assertEquals(displayValue(false), 'Não');
});

Deno.test('fieldSpan uses compact spans for short data and full width for narrative data', () => {
  assertEquals(fieldSpan('cpf', '529.982.247-25'), 1);
  assertEquals(fieldSpan('idade', 36), 1);
  assertEquals(fieldSpan('gest', 'Não se aplica'), 1);
  assertEquals(fieldSpan('alergia', 'Não'), 1);
  assertEquals(fieldSpan('nic', 'Não'), 1);
  assertEquals(fieldSpan('condSaude', 'Sim'), 1);
  assertEquals(fieldSpan('recente', 'Não'), 1);
  assertEquals(fieldSpan('mPeelAnt', 'Sim'), 1);
  assertEquals(fieldSpan('mPeelReac', 'Não'), 1);
  assertEquals(fieldSpan('whatsapp', '(31) 99999-9999'), 2);
  assertEquals(fieldSpan('email', 'pessoa@example.com'), 2);
  assertEquals(fieldSpan('observacoes', 'Texto curto'), 3);
  assertEquals(fieldSpan('expectativa', 'Texto curto'), 3);
  assertEquals(fieldSpan('resultadoEsp', 'Texto curto'), 3);
  assertEquals(fieldSpan('campoLivre', 'x'.repeat(240)), 3);
});

Deno.test('buildPdfSections keeps sex inside identification instead of a generic trailing section', () => {
  const sections = buildPdfSections(baseInput);
  assertEquals(sections[0].title, 'Identificação');
  assertEquals(sections[1].title, 'Objetivo da avaliação');
  assertStringIncludes(JSON.stringify(sections), 'Nome completo');
  assertStringIncludes(JSON.stringify(sections), 'Peeling Coreano');
  const identificationKeys = sections[0].fields.map((field) => field.key);
  assertEquals(identificationKeys.includes('sexo'), true);
  const generic = sections.find((section) => section.title === 'Outras informações declaradas');
  assertEquals(generic?.fields.some((field) => field.key === 'sexo') ?? false, false);
});

Deno.test('structured summary contains only declared facts and packs medium summary facts horizontally', () => {
  const summary = buildStructuredSummary(baseInput);
  const text = JSON.stringify(summary).toLowerCase();
  assertStringIncludes(text, 'qualidade da pele');
  assertStringIncludes(text, 'quero melhorar textura e viço');
  for (const forbidden of ['diagnóstico', 'contraindicado', 'contraindicação', 'indicado', 'indicação automática']) {
    if (text.includes(forbidden)) throw new Error(`summary must not contain ${forbidden}`);
  }
  if (text.includes('observações: -')) throw new Error('empty categories must be omitted from the summary');
  assertEquals(summary.fields.map((field) => [field.key, field.span]), [
    ['summaryObjetivos', 2],
    ['summaryHistorico', 1],
    ['summaryObjetivoTexto', 3],
    ['summarySaude', 1],
    ['summaryAlergias', 1],
    ['summaryMedicamentos', 2],
  ]);
});
