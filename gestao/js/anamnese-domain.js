import { getVisibleQuestions } from './anamnese-schema.js';

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function deriveEffectiveAnamneseStatus(record, now = new Date()) {
  if (!record?.status) return 'nao_iniciada';
  if (record.status === 'finalizada' && record.valid_until) {
    const limit = new Date(record.valid_until);
    if (!Number.isNaN(limit.getTime()) && now.getTime() > limit.getTime()) return 'vencida';
  }
  return record.status;
}

export function isAnamneseCurrent(record, now = new Date()) {
  return deriveEffectiveAnamneseStatus(record, now) === 'finalizada';
}

export function sanitizeAnamneseAnswers(answers = {}, template) {
  const sanitized = { ...(answers || {}) };
  const questions = (template?.sections || []).flatMap((section) => section.questions || []);
  for (const question of questions) {
    if (question.showWhen && !getVisibleQuestions({ answers: sanitized, template: { sections: [{ questions: [question] }] } }).length) {
      sanitized[question.key] = null;
    }
  }
  return sanitized;
}

export function validateAnamneseAnswers({ answers = {}, template }) {
  const cleanAnswers = sanitizeAnamneseAnswers(answers, template);
  const missing = getVisibleQuestions({ answers: cleanAnswers, template })
    .filter((question) => question.required && !hasValue(cleanAnswers[question.key]))
    .map((question) => question.key);
  return { valid: missing.length === 0, missing };
}

export function buildAnamneseSummary({ answers = {}, template }) {
  const cleanAnswers = sanitizeAnamneseAnswers(answers, template);
  return (template?.sections || []).map((section) => ({
    id: section.id,
    title: section.title,
    items: (section.questions || [])
      .filter((question) => getVisibleQuestions({ answers: cleanAnswers, template: { sections: [{ questions: [question] }] } }).length > 0)
      .filter((question) => hasValue(cleanAnswers[question.key]))
      .map((question) => ({ key: question.key, label: question.label, value: cleanAnswers[question.key] })),
  })).filter((section) => section.items.length > 0);
}