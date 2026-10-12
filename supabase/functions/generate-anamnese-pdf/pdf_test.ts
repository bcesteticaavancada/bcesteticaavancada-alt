import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildAnamnesePdf } from './pdf.ts';

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
