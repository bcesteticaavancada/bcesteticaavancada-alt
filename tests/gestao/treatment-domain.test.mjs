import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TREATMENT_STATES,
  deriveTreatmentGate,
  normalizeTreatmentDraft,
  validateTreatmentDraft,
} from '../../gestao/js/treatment-domain.js';

test('estados do atendimento seguem o fluxo 6C aprovado', () => {
  assert.deepEqual(TREATMENT_STATES, ['rascunho','pronto_para_iniciar','em_atendimento','finalizado']);
});

test('gate informa todos os motivos pendentes sem diagnóstico automático', () => {
  const gate = deriveTreatmentGate({
    requiresAnamnese: true,
    anamnese: null,
    healthConfirmation: null,
    alertsReviewed: false,
    permission: false,
    consent: null,
    specificModule: false,
  });
  assert.equal(gate.ready, false);
  assert.deepEqual(gate.reasons, [
    'anamnese_invalida',
    'saude_nao_confirmada',
    'alertas_nao_revisados',
    'profissional_nao_autorizada',
    'consentimento_pendente',
    'modulo_especifico_incompleto',
  ]);
});

test('anamnese pode ser dispensada pela ficha-mãe sem liberar os demais gates', () => {
  const gate = deriveTreatmentGate({
    requiresAnamnese: false,
    anamnese: null,
    healthConfirmation: { confirmed_at: '2026-10-12T12:00:00Z', changed: true },
    alertsReviewed: true,
    permission: true,
    consent: { status: 'finalizado' },
    specificModule: true,
  });
  assert.deepEqual(gate, { ready: true, reasons: [] });
});

test('mudança de saúde registrada não é tratada como contraindicação automática', () => {
  const gate = deriveTreatmentGate({
    requiresAnamnese: true,
    anamnese: { status:'finalizada', valid_until:'2026-12-01T00:00:00Z' },
    healthConfirmation: { confirmed_at:'2026-10-12T12:00:00Z', changed:true, details:'Mudança informada' },
    alertsReviewed: true,
    permission: true,
    consent: { status:'finalizado' },
    specificModule: true,
    now: new Date('2026-10-12T13:00:00Z'),
  });
  assert.equal(gate.ready, true);
});

test('normaliza apenas campos clínicos 6C e preço final', () => {
  const value = normalizeTreatmentDraft({
    queixa_dia:'  sensibilidade ', objetivo:' glow ', avaliacao_profissional:' íntegra ', regiao:' face ',
    resposta_imediata:' boa ', intercorrencias_ato:' ', orientacoes:' hidratar ', retorno:' 30 dias ',
    evolucao:' ', feedback:' satisfeita ', observacoes:' ok ', final_price:'1.390,00',
    specific_data:{ objetivo_sessao:' glow ' }, technical_data:{ observacao:' sem parâmetros 6D ' },
    hacker:'NUNCA',
  });
  assert.equal(value.queixa_dia,'sensibilidade');
  assert.equal(value.objetivo,'glow');
  assert.equal(value.final_price,1390);
  assert.equal(value.hacker, undefined);
  assert.deepEqual(value.specific_data,{ objetivo_sessao:' glow ' });
});

test('validação exige região/objetivo e preço final somente quando a partir de', () => {
  const invalid = validateTreatmentDraft({ objetivo:'', regiao:'', price_mode:'starting_at', final_price:null });
  assert.equal(invalid.valid,false);
  assert.ok(invalid.errors.objetivo);
  assert.ok(invalid.errors.regiao);
  assert.ok(invalid.errors.final_price);

  const fixed = validateTreatmentDraft({ objetivo:'Rejuvenescimento', regiao:'Face', price_mode:'fixed', base_price:990 });
  assert.equal(fixed.valid,true);
  assert.equal(fixed.value.final_price,990);
});
