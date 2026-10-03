import { createInitialState, loadDraft, saveDraft, serializeForm } from './state.js';
import { validateStep } from './validation.js';
import { getVisibleModuleKeys } from './conditional.js';
import { buildReviewSections } from './review.js';

export function advanceStep(current, total) {
  return Math.min(total, current + 1);
}

export function retreatStep(current) {
  return Math.max(1, current - 1);
}

export function mergeStateValues(state, values) {
  return { step: state?.step || 1, values: { ...values } };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function setFormValues(form, values) {
  for (const element of Array.from(form.elements)) {
    const key = element.name || element.id;
    if (!key || !(key in values)) continue;
    const value = values[key];
    if (element.type === 'radio') {
      element.checked = value === element.value;
    } else if (element.type === 'checkbox') {
      if (element.name) element.checked = Array.isArray(value) && value.includes(element.value);
      else element.checked = value === true;
    } else {
      element.value = value ?? '';
    }
  }
}

function buildReviewHtml(state) {
  return buildReviewSections(state).map((section) => `
    <article class="card">
      <h3>${escapeHtml(section.title)}</h3>
      ${section.rows.map((row) => `<p><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</p>`).join('')}
    </article>
  `).join('');
}

function initializePreAnamnese() {
  const form = document.getElementById('preAnamneseForm');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.step[data-step]'));
  const total = steps.length || 8;
  const stage = document.getElementById('stage');
  const track = document.getElementById('track');
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const formError = document.getElementById('formError');
  const review = document.getElementById('reviewSummary');

  let state = loadDraft(window.localStorage);
  if (!state || !Number.isInteger(state.step)) state = createInitialState();
  state.step = Math.min(Math.max(state.step, 1), total);
  setFormValues(form, state.values || {});

  function syncState() {
    state = mergeStateValues(state, serializeForm(form));
    saveDraft(window.localStorage, state);
    return state;
  }

  function setHidden(id, hidden) {
    const node = document.getElementById(id);
    if (node) node.hidden = hidden;
  }

  function renderConditionals() {
    const v = state.values || {};
    setHidden('histBox', v.histEst !== 'Sim');
    setHidden('alcoolBox', v.alcool !== 'Sim');
    setHidden('nicBox', v.nic !== 'Sim');
    setHidden('recentBox', v.recente !== 'Sim');
    setHidden('outroProcWrap', !(Array.isArray(v.procedimentos) && v.procedimentos.includes('Outro')));

    const visible = new Set(getVisibleModuleKeys(state));
    for (const module of form.querySelectorAll('[data-module]')) {
      module.hidden = !visible.has(module.dataset.module);
    }
  }

  function renderReview() {
    if (review) review.innerHTML = buildReviewHtml(state);
  }

  function showErrors(errors) {
    if (!formError) return;
    const messages = Object.values(errors || {});
    formError.textContent = messages[0] || '';
    formError.classList.toggle('show', messages.length > 0);
  }

  function renderStep() {
    for (const section of steps) {
      section.classList.toggle('active', Number(section.dataset.step) === state.step);
    }
    if (stage) stage.textContent = `Etapa ${state.step} de ${total}`;
    if (track) track.style.width = `${(state.step / total) * 100}%`;
    if (back) back.style.visibility = state.step === 1 ? 'hidden' : 'visible';
    if (next) next.style.display = state.step === total ? 'none' : '';
    if (state.step === 6) renderReview();
    renderConditionals();
    showErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('input', () => {
    syncState();
    renderConditionals();
  });
  form.addEventListener('change', () => {
    syncState();
    renderConditionals();
  });

  back?.addEventListener('click', () => {
    syncState();
    state.step = retreatStep(state.step);
    saveDraft(window.localStorage, state);
    renderStep();
  });

  next?.addEventListener('click', () => {
    syncState();
    const check = validateStep(`step${state.step}`, state);
    if (!check.valid) {
      showErrors(check.errors);
      const first = Object.keys(check.errors)[0];
      document.getElementById(first)?.focus?.();
      return;
    }
    state.step = advanceStep(state.step, total);
    saveDraft(window.localStorage, state);
    renderStep();
  });

  renderStep();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializePreAnamnese, { once: true });
}
