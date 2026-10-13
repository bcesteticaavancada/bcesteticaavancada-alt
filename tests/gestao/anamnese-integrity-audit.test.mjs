import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ANAMNESE_TEMPLATE_V1,
  choiceOptionsForQuestion,
} from '../../gestao/js/anamnese-schema.js';
import { sanitizeAnamneseAnswers } from '../../gestao/js/anamnese-domain.js';

const questions = ANAMNESE_TEMPLATE_V1.sections.flatMap((section) => section.questions || []);
const byKey = new Map(questions.map((question) => [question.key, question]));

test('IDs de seções e chaves de perguntas são únicos', () => {
  const sectionIds = ANAMNESE_TEMPLATE_V1.sections.map((section) => section.id);
  const questionKeys = questions.map((question) => question.key);
  assert.equal(new Set(sectionIds).size, sectionIds.length, 'IDs de seção não podem repetir');
  assert.equal(new Set(questionKeys).size, questionKeys.length, 'Chaves de pergunta não podem repetir');
});

test('toda regra condicional aponta para pergunta existente e valor possível', () => {
  for (const question of questions.filter((item) => item.showWhen)) {
    const trigger = byKey.get(question.showWhen.key);
    assert.ok(trigger, `${question.key} aponta para gatilho inexistente ${question.showWhen.key}`);
    if (Object.hasOwn(question.showWhen, 'equals') && trigger.type === 'choice') {
      const allowed = choiceOptionsForQuestion(trigger).map((option) => option.value);
      assert.ok(allowed.includes(question.showWhen.equals), `${question.key} usa gatilho impossível ${question.showWhen.equals}`);
    }
  }
});

test('opções de seleção têm valor/rótulo válidos, únicos e nunca caem em Sim/Não por omissão', () => {
  for (const question of questions.filter((item) => item.type === 'choice')) {
    const options = choiceOptionsForQuestion(question);
    assert.ok(options.length >= 2, `${question.key} precisa de opções explícitas`);
    const values = options.map((option) => String(option.value || '').trim());
    const labels = options.map((option) => String(option.label || '').trim());
    assert.ok(values.every(Boolean), `${question.key} possui valor de opção vazio`);
    assert.ok(labels.every(Boolean), `${question.key} possui rótulo de opção vazio`);
    assert.equal(new Set(values).size, values.length, `${question.key} possui valores duplicados`);
  }
  assert.deepEqual(choiceOptionsForQuestion({ type: 'choice', key: 'campo_sem_configuracao' }), [], 'choice sem opções não pode virar Sim/Não silenciosamente');
});

test('respostas de campos condicionais ocultos são anuladas antes de salvar', () => {
  const answers = sanitizeAnamneseAnswers({
    exposicao_solar_recente: 'nao',
    exposicao_solar_faixa: 'ultimos_7_dias',
    alergias_conhecidas: 'nao',
    alergias_detalhes: 'Alergia antiga que não deveria persistir',
    pele_tipo: 'oleosa',
  }, ANAMNESE_TEMPLATE_V1);

  assert.equal(answers.exposicao_solar_faixa, null);
  assert.equal(answers.alergias_detalhes, null);
  assert.equal(answers.exposicao_solar_recente, 'nao');
  assert.equal(answers.pele_tipo, 'oleosa');
});

test('PDF institucional traduz códigos de escolha para rótulos humanos', async () => {
  const source = await readFile(new URL('../../supabase/functions/generate-anamnese-pdf/pdf.ts', import.meta.url), 'utf8');
  assert.match(source, /displayAnswerValue|answerLabel|CHOICE_LABELS/);
  for (const label of ['Sensível', 'Últimos 7 dias', 'Não sei', 'Às vezes', 'Prefiro não informar']) {
    assert.match(source, new RegExp(label));
  }
});
