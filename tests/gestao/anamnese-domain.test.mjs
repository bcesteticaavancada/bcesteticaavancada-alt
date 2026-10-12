import test from 'node:test';
import assert from 'node:assert/strict';

async function loadDomain() {
  try {
    return await import('../../gestao/js/anamnese-domain.js');
  } catch (error) {
    assert.fail(`anamnese-domain.js deve existir: ${error?.code || error}`);
  }
}

test('status finalizada permanece vigente antes de 12 meses e vence após valid_until', async () => {
  const { deriveEffectiveAnamneseStatus, isAnamneseCurrent } = await loadDomain();
  const record = { status: 'finalizada', valid_until: '2027-10-11T15:00:00.000Z' };
  assert.equal(deriveEffectiveAnamneseStatus(record, new Date('2027-10-11T14:59:59.000Z')), 'finalizada');
  assert.equal(isAnamneseCurrent(record, new Date('2027-10-11T14:59:59.000Z')), true);
  assert.equal(deriveEffectiveAnamneseStatus(record, new Date('2027-10-11T15:00:01.000Z')), 'vencida');
  assert.equal(isAnamneseCurrent(record, new Date('2027-10-11T15:00:01.000Z')), false);
});

test('validação exige declarações obrigatórias e respostas visíveis', async () => {
  const { validateAnamneseAnswers } = await loadDomain();
  const template = {
    sections: [{ questions: [
      { key: 'condicao_saude_importante', required: true },
      { key: 'condicao_saude_detalhes', required: true, showWhen: { key: 'condicao_saude_importante', equals: 'sim' } },
      { key: 'declaracao_veracidade', required: true },
      { key: 'declaracao_dados', required: true },
    ] }],
  };
  const result = validateAnamneseAnswers({
    template,
    answers: { condicao_saude_importante: 'sim', declaracao_veracidade: true, declaracao_dados: true },
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, ['condicao_saude_detalhes']);
});

test('resumo clínico não inventa diagnóstico ou liberação', async () => {
  const { buildAnamneseSummary } = await loadDomain();
  const template = { sections: [{ id: 'saude', title: 'Saúde', questions: [{ key: 'alergias_conhecidas', label: 'Alergias' }] }] };
  const sections = buildAnamneseSummary({ template, answers: { alergias_conhecidas: 'sim' } });
  const serialized = JSON.stringify(sections).toLowerCase();
  for (const forbidden of ['liberado', 'contraindicado', 'diagnóstico automático', 'procedimento seguro']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
