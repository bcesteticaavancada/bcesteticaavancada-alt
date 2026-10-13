import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildClinicalPdf } from './pdf.ts';

const document = {
  document_code: 'BC-DOC-TESTE',
  document_version: 1,
  profissional_nome: 'Profissional Teste',
  profissional_profissao: 'Biomédica Esteta',
  profissional_conselho: 'CRBM',
  profissional_registro: '00000',
};
const client = {
  nome: 'Cliente Teste',
  cpf: '00000000000',
  data_nascimento: '1990-01-01',
  telefone: '(31) 00000-0000',
};
const signatures = [
  { signer_kind: 'paciente', signer_name: 'Cliente Teste', signed_at: '2026-10-12T20:00:00-03:00' },
  { signer_kind: 'profissional', signer_name: 'Profissional Teste', signer_profissao: 'Biomédica Esteta', signer_conselho: 'CRBM', signer_registro: '00000', signed_at: '2026-10-12T20:05:00-03:00' },
];

Deno.test('gera PDF institucional válido para consentimento de procedimento', async () => {
  const bytes = await buildClinicalPdf({
    document: { ...document, document_type: 'consentimento_procedimento' },
    client,
    signatures,
    consent: {
      consent_class: 'injetavel',
      procedure_name_snapshot: 'Botox full face',
      supplement_snapshot: 'Complemento clínico específico.',
      component_keys: [],
    },
    consentTemplate: {
      version: 1,
      title: 'TCLE E AUTORIZAÇÃO PARA PROCEDIMENTO INJETÁVEL / INVASIVO',
      body: 'Texto institucional do consentimento.',
    },
  });
  assert(bytes.length > 1000);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});

Deno.test('gera PDF institucional válido para ficha final de atendimento', async () => {
  const bytes = await buildClinicalPdf({
    document: { ...document, document_type: 'treatment_record' },
    client,
    signatures: signatures.filter((item) => item.signer_kind === 'profissional'),
    treatmentVersion: {
      version: 2,
      correction_mode: 'same_day',
      created_at: '2026-10-12T20:30:00-03:00',
      snapshot: {
        treatment: {
          treatment_date: '2026-10-12',
          objetivo: 'Melhora global da pele',
          regiao: 'Face',
          avaliacao_profissional: 'Registro clínico de teste',
          specific_data: { objetivo_sessao: 'Hidratação', area_regiao: 'Face' },
          resposta_imediata: 'Sem intercorrências imediatas registradas.',
          orientacoes: 'Orientações individualizadas registradas.',
          retorno: 'Retorno conforme avaliação.',
          anamnese_id: 'anamnese-ref',
          consent_document_id: 'consent-ref',
        },
        procedure_version: { nome: 'Skinbooster', version: 1, classe_documental: 'injetavel' },
        components: [],
      },
    },
  });
  assert(bytes.length > 1000);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});
