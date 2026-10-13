import test from 'node:test';
import assert from 'node:assert/strict';

async function loadSchema() {
  try { return await import('../../gestao/js/anamnese-schema.js'); }
  catch (error) { assert.fail(`anamnese-schema.js deve existir: ${error?.code || error}`); }
}

function questionByKey(template, key) {
  return template.sections.flatMap((section) => section.questions).find((question) => question.key === key);
}

function values(options = []) {
  return options.map((option) => option.value);
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

test('toda pergunta de escolha declara explicitamente as próprias opções', async () => {
  const { ANAMNESE_TEMPLATE_V1 } = await loadSchema();
  const choices = ANAMNESE_TEMPLATE_V1.sections.flatMap((section) => section.questions).filter((question) => question.type === 'choice');
  assert.ok(choices.length > 0);
  for (const question of choices) {
    assert.ok(Array.isArray(question.options) && question.options.length >= 2, `${question.key} precisa declarar opções explícitas`);
  }
});

test('perguntas realmente binárias usam somente Sim e Não', async () => {
  const { ANAMNESE_TEMPLATE_V1, choiceOptionsForQuestion } = await loadSchema();
  const binaryKeys = [
    'historico_estetico_realizou',
    'exposicao_solar_recente',
    'acompanhamento_medico',
    'medicamentos_continuos',
    'suplementos',
    'reacao_alergica_procedimento',
    'herpes_historico',
    'cicatrizacao_alterada_queloide',
    'cirurgias_procedimentos_recentes',
    'tabagismo_nicotina',
    'alcool',
  ];
  for (const key of binaryKeys) {
    const question = questionByKey(ANAMNESE_TEMPLATE_V1, key);
    assert.ok(question, `pergunta ${key} deve existir`);
    assert.deepEqual(values(choiceOptionsForQuestion(question)), ['sim', 'nao'], `${key} não deve herdar respostas sem sentido`);
  }
});

test('tipo de pele usa opções próprias e não o conjunto binário genérico', async () => {
  const { ANAMNESE_TEMPLATE_V1, choiceOptionsForQuestion } = await loadSchema();
  assert.equal(typeof choiceOptionsForQuestion, 'function');
  const pele = questionByKey(ANAMNESE_TEMPLATE_V1, 'pele_tipo');
  assert.ok(pele, 'pergunta pele_tipo deve existir');
  assert.deepEqual(choiceOptionsForQuestion(pele), [
    { value: 'seca', label: 'Seca' },
    { value: 'oleosa', label: 'Oleosa' },
    { value: 'mista', label: 'Mista' },
    { value: 'sensivel', label: 'Sensível' },
    { value: 'normal', label: 'Normal' },
    { value: 'nao_sei', label: 'Não sei' },
  ]);
  assert.equal(choiceOptionsForQuestion(pele).some((option) => ['sim', 'nao', 'nao_se_aplica'].includes(option.value)), false);
});

test('momento da exposição solar usa somente faixas de tempo', async () => {
  const { ANAMNESE_TEMPLATE_V1, choiceOptionsForQuestion } = await loadSchema();
  const exposicao = questionByKey(ANAMNESE_TEMPLATE_V1, 'exposicao_solar_faixa');
  assert.ok(exposicao, 'pergunta exposicao_solar_faixa deve existir');
  assert.deepEqual(choiceOptionsForQuestion(exposicao), [
    { value: 'ultimos_7_dias', label: 'Últimos 7 dias' },
    { value: '8_15_dias', label: '8–15 dias' },
    { value: '16_30_dias', label: '16–30 dias' },
    { value: 'mais_de_30_dias', label: 'Mais de 30 dias' },
  ]);
  assert.equal(choiceOptionsForQuestion(exposicao).some((option) => ['sim', 'nao', 'nao_sei', 'prefiro_conversar', 'nao_se_aplica'].includes(option.value)), false);
});

test('fotoproteção, saúde, gestação e amamentação usam conjuntos próprios', async () => {
  const { ANAMNESE_TEMPLATE_V1, choiceOptionsForQuestion } = await loadSchema();
  const expected = {
    usa_fotoprotecao: ['sim', 'nao', 'as_vezes'],
    condicao_saude_importante: ['sim', 'nao', 'prefiro_conversar'],
    hiperpigmentacao_pos_inflamatoria: ['sim', 'nao', 'nao_sei'],
    tratamento_dermatologico_recente: ['sim', 'nao', 'nao_sei'],
    alergias_conhecidas: ['sim', 'nao', 'nao_sei'],
    gestacao_possibilidade: ['sim', 'nao', 'prefiro_nao_informar', 'nao_se_aplica'],
    amamentacao: ['sim', 'nao', 'nao_se_aplica'],
  };
  for (const [key, optionValues] of Object.entries(expected)) {
    const question = questionByKey(ANAMNESE_TEMPLATE_V1, key);
    assert.ok(question, `pergunta ${key} deve existir`);
    assert.deepEqual(values(choiceOptionsForQuestion(question)), optionValues, `${key} precisa manter respostas coerentes com a pergunta`);
  }
});

test('copy do template não decide indicação ou contraindicação', async () => {
  const { ANAMNESE_TEMPLATE_V1 } = await loadSchema();
  const text = JSON.stringify(ANAMNESE_TEMPLATE_V1).toLowerCase();
  for (const forbidden of ['procedimento liberado','procedimento contraindicado','diagnóstico automático']) {
    assert.equal(text.includes(forbidden), false);
  }
});