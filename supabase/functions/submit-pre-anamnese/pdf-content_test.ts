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
    objetivos: ['Qualidade da pele'],
    objetivoTexto: 'Quero melhorar textura e viço.',
    histEst: 'Não',
    pele: 'Mista',
    gest: 'Não se aplica',
    alergia: 'Não',
    nic: 'Não',
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
  assertEquals(fieldSpan('whatsapp', '(31) 99999-9999'), 2);
  assertEquals(fieldSpan('email', 'pessoa@example.com'), 2);
  assertEquals(fieldSpan('observacoes', 'Texto curto'), 3);
  assertEquals(fieldSpan('expectativa', 'Texto curto'), 3);
  assertEquals(fieldSpan('resultadoEsp', 'Texto curto'), 3);
  assertEquals(fieldSpan('campoLivre', 'x'.repeat(240)), 3);
});

Deno.test('buildPdfSections groups patient data and answers into named sections', () => {
  const sections = buildPdfSections(baseInput);
  assertEquals(sections[0].title, 'Identificação');
  assertEquals(sections[1].title, 'Objetivo da avaliação');
  assertStringIncludes(JSON.stringify(sections), 'Nome completo');
  assertStringIncludes(JSON.stringify(sections), 'Peeling Coreano');
});

Deno.test('structured summary contains only declared facts and no automatic clinical conclusion', () => {
  const summary = buildStructuredSummary(baseInput);
  const text = JSON.stringify(summary).toLowerCase();
  assertStringIncludes(text, 'qualidade da pele');
  assertStringIncludes(text, 'quero melhorar textura e viço');
  for (const forbidden of ['diagnóstico', 'contraindicado', 'contraindicação', 'indicado', 'indicação automática']) {
    if (text.includes(forbidden)) throw new Error(`summary must not contain ${forbidden}`);
  }
  if (text.includes('observações: -')) throw new Error('empty categories must be omitted from the summary');
});
