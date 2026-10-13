const conditional = (key, equals = 'sim') => ({ key, equals });

const q = (key, label, options = {}) => ({ key, label, ...options });

const YES_NO_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];

const YES_NO_NOT_SURE_OPTIONS = [
  ...YES_NO_OPTIONS,
  { value: 'nao_sei', label: 'Não sei' },
];

const YES_NO_PREFER_TALK_OPTIONS = [
  ...YES_NO_OPTIONS,
  { value: 'prefiro_conversar', label: 'Prefiro conversar pessoalmente' },
];

const LEGACY_OPTION_LABELS = {
  sim: 'Sim',
  nao: 'Não',
  nao_sei: 'Não sei',
  prefiro_conversar: 'Prefiro conversar pessoalmente',
  prefiro_nao_informar: 'Prefiro não informar',
  nao_se_aplica: 'Não se aplica',
  as_vezes: 'Às vezes',
};

export function choiceOptionsForQuestion(question = {}) {
  return Array.isArray(question.options) && question.options.length ? question.options : [];
}

export function choiceLabelForQuestion(question = {}, value = '') {
  return choiceOptionsForQuestion(question).find((option) => option.value === value)?.label || LEGACY_OPTION_LABELS[value] || value;
}

export const ANAMNESE_TEMPLATE_V1 = {
  key: 'bc-geral',
  version: 1,
  title: 'Anamnese Geral — BC Estética',
  sections: [
    { id: 'objetivos', title: 'Objetivos e histórico estético', questions: [
      q('queixa_principal', 'Qual é sua principal queixa ou motivo da avaliação?', { type: 'textarea', required: true }),
      q('objetivos_esteticos', 'Quais são seus objetivos estéticos?', { type: 'multiselect', required: true }),
      q('objetivo_detalhes', 'Conte um pouco mais sobre seus objetivos.', { type: 'textarea' }),
      q('historico_estetico_realizou', 'Já realizou procedimentos estéticos?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('historico_estetico_detalhes', 'Quais procedimentos e quando?', { type: 'textarea', showWhen: conditional('historico_estetico_realizou') }),
      q('historico_estetico_reacao', 'Houve reação, complicação ou algo importante na recuperação?', { type: 'textarea', showWhen: conditional('historico_estetico_realizou') }),
    ] },
    { id: 'pele', title: 'Pele e exposição solar', questions: [
      q('pele_tipo', 'Como você considera sua pele?', {
        type: 'choice',
        required: true,
        options: [
          { value: 'seca', label: 'Seca' },
          { value: 'oleosa', label: 'Oleosa' },
          { value: 'mista', label: 'Mista' },
          { value: 'sensivel', label: 'Sensível' },
          { value: 'normal', label: 'Normal' },
          { value: 'nao_sei', label: 'Não sei' },
        ],
      }),
      q('pele_condicoes_atuais', 'Existe alguma condição atual da pele que gostaria de informar?', { type: 'multiselect' }),
      q('pele_condicoes_detalhes', 'Detalhe as condições atuais da pele.', { type: 'textarea', showWhen: { key: 'pele_condicoes_atuais', truthy: true } }),
      q('hiperpigmentacao_pos_inflamatoria', 'Já apresentou manchas após inflamações ou procedimentos?', { type: 'choice', options: YES_NO_NOT_SURE_OPTIONS }),
      q('exposicao_solar_recente', 'Teve exposição solar intensa recentemente?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('exposicao_solar_faixa', 'Quando ocorreu a exposição mais recente?', {
        type: 'choice',
        showWhen: conditional('exposicao_solar_recente'),
        options: [
          { value: 'ultimos_7_dias', label: 'Últimos 7 dias' },
          { value: '8_15_dias', label: '8–15 dias' },
          { value: '16_30_dias', label: '16–30 dias' },
          { value: 'mais_de_30_dias', label: 'Mais de 30 dias' },
        ],
      }),
      q('usa_fotoprotecao', 'Usa protetor solar/fotoproteção?', {
        type: 'choice',
        required: true,
        options: [
          ...YES_NO_OPTIONS,
          { value: 'as_vezes', label: 'Às vezes' },
        ],
      }),
    ] },
    { id: 'saude', title: 'Saúde e acompanhamento', questions: [
      q('condicao_saude_importante', 'Possui ou já teve condição de saúde importante?', { type: 'choice', required: true, options: YES_NO_PREFER_TALK_OPTIONS }),
      q('condicao_saude_detalhes', 'Descreva a condição de saúde informada.', { type: 'textarea', required: true, showWhen: conditional('condicao_saude_importante') }),
      q('acompanhamento_medico', 'Está em acompanhamento médico atualmente?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('acompanhamento_medico_detalhes', 'Informe o acompanhamento médico.', { type: 'textarea', showWhen: conditional('acompanhamento_medico') }),
      q('condicoes_relevantes', 'Há alguma destas condições a informar?', { type: 'multiselect' }),
      q('condicoes_relevantes_detalhes', 'Detalhe o que considerar importante.', { type: 'textarea', showWhen: { key: 'condicoes_relevantes', truthy: true } }),
      q('medicamentos_continuos', 'Faz uso contínuo de medicamentos?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('medicamentos_detalhes', 'Informe nome, dose se souber e motivo.', { type: 'textarea', showWhen: conditional('medicamentos_continuos') }),
      q('suplementos', 'Usa suplementos regularmente?', { type: 'choice', options: YES_NO_OPTIONS }),
      q('suplementos_detalhes', 'Quais suplementos?', { type: 'textarea', showWhen: conditional('suplementos') }),
      q('tratamento_dermatologico_recente', 'Usa ou usou recentemente medicamento/tratamento dermatológico?', { type: 'choice', options: YES_NO_NOT_SURE_OPTIONS }),
      q('tratamento_dermatologico_detalhes', 'Informe qual tratamento e quando.', { type: 'textarea', showWhen: conditional('tratamento_dermatologico_recente') }),
    ] },
    { id: 'alergias', title: 'Alergias, reações e cicatrização', questions: [
      q('alergias_conhecidas', 'Possui alergia conhecida?', { type: 'choice', required: true, options: YES_NO_NOT_SURE_OPTIONS }),
      q('alergias_detalhes', 'Quais alergias?', { type: 'textarea', required: true, showWhen: conditional('alergias_conhecidas') }),
      q('reacao_alergica_procedimento', 'Já teve reação alérgica durante procedimento estético?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('reacao_alergica_detalhes', 'Descreva a reação.', { type: 'textarea', showWhen: conditional('reacao_alergica_procedimento') }),
      q('herpes_historico', 'Tem histórico de herpes?', { type: 'choice', options: YES_NO_OPTIONS }),
      q('herpes_regiao', 'Em qual região?', { type: 'text', showWhen: conditional('herpes_historico') }),
      q('herpes_ultimo_episodio', 'Quando ocorreu o último episódio, se souber?', { type: 'text', showWhen: conditional('herpes_historico') }),
      q('cicatrizacao_alterada_queloide', 'Já apresentou cicatrização alterada ou queloide?', { type: 'choice', options: YES_NO_OPTIONS }),
      q('cicatrizacao_detalhes', 'Detalhe a cicatrização informada.', { type: 'textarea', showWhen: conditional('cicatrizacao_alterada_queloide') }),
    ] },
    { id: 'cirurgias', title: 'Cirurgias e procedimentos recentes', questions: [
      q('cirurgias_procedimentos_recentes', 'Realizou cirurgia ou procedimento médico recentemente?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('cirurgias_recentes_detalhes', 'Informe qual, quando, recuperação e eventual orientação médica.', { type: 'textarea', showWhen: conditional('cirurgias_procedimentos_recentes') }),
    ] },
    { id: 'habitos', title: 'Hábitos e momento atual', questions: [
      q('tabagismo_nicotina', 'Fuma ou utiliza produtos com nicotina?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('tabagismo_detalhes', 'Informe frequência e há quanto tempo.', { type: 'textarea', showWhen: conditional('tabagismo_nicotina') }),
      q('alcool', 'Consome bebidas alcoólicas?', { type: 'choice', required: true, options: YES_NO_OPTIONS }),
      q('alcool_frequencia', 'Com qual frequência?', { type: 'text', showWhen: conditional('alcool') }),
      q('alcool_observacao', 'Observação sobre o consumo, se desejar.', { type: 'textarea', showWhen: conditional('alcool') }),
      q('gestacao_possibilidade', 'Existe possibilidade de gestação?', {
        type: 'choice',
        required: true,
        options: [
          ...YES_NO_OPTIONS,
          { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
          { value: 'nao_se_aplica', label: 'Não se aplica' },
        ],
      }),
      q('amamentacao', 'Está amamentando?', {
        type: 'choice',
        required: true,
        options: [
          ...YES_NO_OPTIONS,
          { value: 'nao_se_aplica', label: 'Não se aplica' },
        ],
      }),
    ] },
    { id: 'expectativas', title: 'Expectativas e observações', questions: [
      q('expectativas', 'O que você espera alcançar com o cuidado estético?', { type: 'textarea', required: true }),
      q('resultado_especifico', 'Existe algum resultado específico que gostaria de conversar com a profissional?', { type: 'textarea' }),
      q('observacoes_finais', 'Existe algo mais que gostaria de nos contar?', { type: 'textarea' }),
    ] },
    { id: 'declaracoes', title: 'Declarações', questions: [
      q('declaracao_veracidade', 'Declaro que as informações prestadas são verdadeiras conforme meu conhecimento e estão atualizadas.', { type: 'checkbox', required: true }),
      q('declaracao_dados', 'Autorizo o tratamento destas informações para finalidade de atendimento e registro clínico da BC Estética.', { type: 'checkbox', required: true }),
    ] },
  ],
};

function answerHasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function isQuestionVisible(question, answers = {}) {
  const rule = question?.showWhen;
  if (!rule) return true;
  const value = answers[rule.key];
  if (Object.prototype.hasOwnProperty.call(rule, 'equals')) return value === rule.equals;
  if (rule.truthy) return answerHasValue(value) && value !== 'nao' && value !== false;
  return true;
}

export function getVisibleQuestions({ answers = {}, template = ANAMNESE_TEMPLATE_V1 } = {}) {
  return (template?.sections || []).flatMap((section) => section.questions || []).filter((question) => isQuestionVisible(question, answers));
}