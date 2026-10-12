import test from 'node:test';
import assert from 'node:assert/strict';

async function loadSchema() {
  try { return await import('../../gestao/js/anamnese-schema.js'); }
  catch (error) { assert.fail(`anamnese-schema.js deve existir: ${error?.code || error}`); }
}

test('template geral v1 contém os blocos clínicos aprovados e IDs estáveis', async () => {
  const { ANAMNESE_TEMPLATE_V1 } = await loadSchema();
  assert.equal(ANAMNESE_TEMPLATE_V1.key, 'bc-geral');
  assert.equal(ANAMNESE_TEMPLATE_V1.version, 1);
  const keys = ANAMNESE_TEMPLATE_V1.sections.flatMap((s) => s.questions.map((q) => q.key));
  for (const key of ['queixa_principal','objetivos_esteticos','condicao_saude_importante','medicamentos_continuos','alergias_conhecidas','herpes_historico','cicatrizacao_alterada_queloide','gestacao_possibilidade','amamentacao','declaracao_veracidade','declaracao_dados']) {
    assert.ok(keys.includes(key), `faltando pergunta ${key}`);
  }
});

test('perguntas condicionais só aparecem quando a resposta gatilho exige detalhe', async () => {
  const { ANAMNESE_TEMPLATE_V1, getVisibleQuestions } = await loadSchema();
  const noDetails = getVisibleQuestions({ template: ANAMNESE_TEMPLATE_V1, answers: { alergias_conhecidas: 'nao' } });
  const withDetails = getVisibleQuestions({ template: ANAMNESE_TEMPLATE_V1, answers: { alergias_conhecidas: 'sim' } });
  assert.equal(noDetails.some((q) => q.key === 'alergias_detalhes'), false);
  assert.equal(withDetails.some((q) => q.key === 'alergias_detalhes'), true);
});

test('copy do template não decide indicação ou contraindicação', async () => {
  const { ANAMNESE_TEMPLATE_V1 } = await loadSchema();
  const text = JSON.stringify(ANAMNESE_TEMPLATE_V1).toLowerCase();
  for (const forbidden of ['procedimento liberado','procedimento contraindicado','diagnóstico automático']) {
    assert.equal(text.includes(forbidden), false);
  }
});
