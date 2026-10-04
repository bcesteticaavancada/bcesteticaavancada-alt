import { createInitialState, loadDraft, saveDraft, serializeForm } from './state.js';
import { validateStep } from './validation.js';
import { getVisibleModuleKeys } from './conditional.js';
import { buildReviewSections } from './review.js';
import { createSignaturePad } from './signature.js';
import { FORM_VERSION } from './config.js';
import { downloadPdf, filenameForCode, sharePdf } from './api.js';
import { createSubmissionGate, finalizePreAnamnese } from './finalize.js';
import { formatCpf } from './cpf.js';

export function advanceStep(current, total) {
  return Math.min(total, current + 1);
}

export function retreatStep(current) {
  return Math.max(1, current - 1);
}

export function mergeStateValues(state, values) {
  return { step: state?.step || 1, values: { ...values } };
}

export function maskCpfValue(value) {
  return formatCpf(value);
}

export function signatureStepErrors(signaturePad) {
  return signaturePad?.isValid?.() === true ? {} : { signature: 'Faça uma rubrica válida antes de continuar.' };
}

export function buildSubmissionSuccessView(result) {
  const publicCode = String(result?.publicCode || '').trim();
  return {
    publicCode,
    filename: filenameForCode(publicCode),
    pdfUrl: String(result?.pdfUrl || ''),
    pdfExpiresAt: String(result?.pdfExpiresAt || ''),
    message: `Ficha ${publicCode} enviada com segurança.`,
  };
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

function ensureCpfIdentityControls(form) {
  const step1 = form?.querySelector?.('#step1');
  const grid = step1?.querySelector?.('.grid');
  if (!step1 || !grid) return;

  if (!step1.querySelector('#cpf')) {
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = '<label for="cpf">CPF *</label><input id="cpf" name="cpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00">';
    const birthField = step1.querySelector('#nascimento')?.closest?.('.field');
    grid.insertBefore(field, birthField || grid.children[1] || null);
  }

  if (!step1.querySelector('#dataAuthorization')) {
    const authorization = document.createElement('div');
    authorization.className = 'field full';
    authorization.innerHTML = '<div class="check"><input id="dataAuthorization" type="checkbox"><label for="dataAuthorization"><span class="box"></span><span>Declaro estar ciente e autorizo o tratamento dos dados informados nesta pré-anamnese, incluindo CPF, exclusivamente para identificação, preparação e continuidade do atendimento na BC Estética.</span></label></div>';
    grid.insertAdjacentElement('afterend', authorization);
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

function installHoneypot(form) {
  if (form.querySelector('[name="website"]')) return;
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.position = 'absolute';
  wrap.style.left = '-10000px';
  wrap.style.width = '1px';
  wrap.style.height = '1px';
  wrap.style.overflow = 'hidden';
  const label = document.createElement('label');
  label.textContent = 'Website';
  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'website';
  input.tabIndex = -1;
  input.autocomplete = 'off';
  label.appendChild(input);
  wrap.appendChild(label);
  form.appendChild(wrap);
}

function initializePreAnamnese() {
  const form = document.getElementById('preAnamneseForm');
  if (!form) return;
  ensureCpfIdentityControls(form);
  installHoneypot(form);

  const steps = Array.from(form.querySelectorAll('.step[data-step]'));
  const total = steps.length || 8;
  const stage = document.getElementById('stage');
  const track = document.getElementById('track');
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const formError = document.getElementById('formError');
  const review = document.getElementById('reviewSummary');
  const signatureMount = document.getElementById('signatureMount');
  const finalizeButton = document.getElementById('finalizeButton');
  const submitStatus = document.getElementById('submitStatus');
  const successPanel = document.querySelector('#step8 .success-panel');
  let signaturePad = null;
  let submissionSucceeded = false;
  const runFinalize = createSubmissionGate();

  if (signatureMount) {
    signatureMount.className = 'signature-wrap';
    signatureMount.innerHTML = '<div class="signature-copy"><strong>Rubrica de confirmação da pré-anamnese</strong><p>Faça sua rubrica no campo abaixo usando o dedo. Esta rubrica confirma o preenchimento desta pré-anamnese. A assinatura formal e os termos específicos do procedimento serão realizados presencialmente.</p></div><label for="signatureCanvas">Rubrica *</label><canvas id="signatureCanvas" class="signature-canvas" aria-label="Área para rubrica de confirmação"></canvas><div class="signature-actions"><button id="clearSignature" class="btn secondary small" type="button">Limpar e refazer</button></div><div class="signature-identity"><p><strong>Nome:</strong> <span id="rubricName">—</span></p><p><strong>CPF:</strong> <span id="rubricCpf">—</span></p><p>Data e hora oficiais serão registradas pelo servidor no envio.</p></div>';
    const signatureCanvas = document.getElementById('signatureCanvas');
    if (signatureCanvas) {
      signaturePad = createSignaturePad(signatureCanvas);
      document.getElementById('clearSignature')?.addEventListener('click', () => signaturePad.clear());
      window.addEventListener('resize', () => signaturePad.resize(), { passive: true });
      window.addEventListener('orientationchange', () => requestAnimationFrame(() => signaturePad.resize()), { passive: true });
    }
  }

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
    if (back) back.style.visibility = state.step === 1 || submissionSucceeded ? 'hidden' : 'visible';
    if (next) next.style.display = state.step === total ? 'none' : '';
    if (finalizeButton) finalizeButton.disabled = state.step !== total || submissionSucceeded;
    if (state.step === 6) renderReview();
    if (state.step === 7 && signaturePad) {
      const rubricName = document.getElementById('rubricName');
      const rubricCpf = document.getElementById('rubricCpf');
      if (rubricName) rubricName.textContent = state.values?.nome || '—';
      if (rubricCpf) rubricCpf.textContent = formatCpf(state.values?.cpf || '') || '—';
      requestAnimationFrame(() => signaturePad.resize());
    }
    if (state.step === total && !submissionSucceeded && successPanel) {
      const intro = successPanel.querySelector('p:not(.status-message)');
      if (intro) intro.textContent = 'Confira e finalize sua ficha. Após o envio, o PDF oficial da BC ficará disponível para baixar ou compartilhar.';
    }
    renderConditionals();
    showErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSubmissionSuccess(result) {
    const view = buildSubmissionSuccessView(result);
    submissionSucceeded = true;
    if (finalizeButton) finalizeButton.disabled = true;
    if (back) back.style.visibility = 'hidden';
    if (submitStatus) submitStatus.textContent = view.message;
    if (!successPanel) return;
    const intro = successPanel.querySelector('p:not(.status-message)');
    if (intro) intro.textContent = 'Sua pré-anamnese foi recebida. Guarde o código abaixo e baixe o documento agora.';
    let code = successPanel.querySelector('.submission-code');
    if (!code) {
      code = document.createElement('div');
      code.className = 'submission-code id';
      const actions = successPanel.querySelector('.actions');
      successPanel.insertBefore(code, actions || submitStatus || null);
    }
    code.textContent = view.publicCode;
    const actions = successPanel.querySelector('.actions');
    if (actions) {
      actions.innerHTML = '';
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'btn primary small';
      download.textContent = 'BAIXAR PDF';
      download.addEventListener('click', async () => {
        try {
          download.disabled = true;
          await downloadPdf(view.pdfUrl, view.filename);
        } catch (error) {
          if (submitStatus) submitStatus.textContent = error?.message || 'Não foi possível baixar o PDF.';
        } finally {
          download.disabled = false;
        }
      });
      const share = document.createElement('button');
      share.type = 'button';
      share.className = 'btn secondary small';
      share.textContent = 'COMPARTILHAR PDF';
      share.addEventListener('click', async () => {
        try {
          share.disabled = true;
          const shared = await sharePdf(view.pdfUrl, view.filename);
          if (!shared) await downloadPdf(view.pdfUrl, view.filename);
        } catch (error) {
          if (submitStatus) submitStatus.textContent = error?.message || 'Não foi possível compartilhar o PDF.';
        } finally {
          share.disabled = false;
        }
      });
      actions.append(download, share);
    }
  }

  form.addEventListener('input', (event) => {
    if (event?.target?.id === 'cpf') event.target.value = maskCpfValue(event.target.value);
    syncState();
    renderConditionals();
  });
  form.addEventListener('change', () => {
    syncState();
    renderConditionals();
  });

  back?.addEventListener('click', () => {
    if (submissionSucceeded) return;
    syncState();
    state.step = retreatStep(state.step);
    saveDraft(window.localStorage, state);
    renderStep();
  });

  next?.addEventListener('click', () => {
    syncState();
    const check = validateStep(`step${state.step}`, state);
    const signatureErrors = state.step === 7 ? signatureStepErrors(signaturePad) : {};
    const errors = { ...check.errors, ...signatureErrors };
    if (Object.keys(errors).length) {
      showErrors(errors);
      const first = Object.keys(errors)[0];
      document.getElementById(first)?.focus?.();
      return;
    }
    state.step = advanceStep(state.step, total);
    saveDraft(window.localStorage, state);
    renderStep();
  });

  finalizeButton?.addEventListener('click', () => {
    runFinalize(async () => {
      syncState();
      if (!signaturePad || signaturePad.isValid?.() !== true) {
        state.step = 7;
        saveDraft(window.localStorage, state);
        renderStep();
        showErrors({ signature: 'Faça uma rubrica válida antes de finalizar.' });
        return;
      }
      finalizeButton.disabled = true;
      if (submitStatus) submitStatus.textContent = 'Enviando sua ficha com segurança e preparando o PDF...';
      try {
        const result = await finalizePreAnamnese({
          state,
          signaturePad,
          storage: window.localStorage,
          sourceVersion: FORM_VERSION,
        });
        renderSubmissionSuccess(result);
      } catch (error) {
        const details = error?.details || {};
        showErrors(details);
        if (submitStatus) submitStatus.textContent = error?.message || 'Não foi possível concluir agora. Seus dados continuam salvos para tentar novamente.';
        finalizeButton.disabled = false;
      }
    });
  });

  renderStep();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializePreAnamnese, { once: true });
}
