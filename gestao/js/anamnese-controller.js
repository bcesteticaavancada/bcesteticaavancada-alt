import {
  beginAnamnese,
  createRemoteLink,
  getAnamneseForEdit,
  getAnamneseState,
  listAnamneseVersions,
  markAnamneseReviewed,
  revokeRemoteLink,
  saveAnamneseAnswers,
  submitAnamneseForReview,
} from './anamnese-api.js';
import { listClinicalAlerts } from './clinical-alerts-api.js';
import {
  finalizeAnamneseDocument,
  generateAnamnesePdf,
  getClinicalDocumentUrl,
  listClinicalDocuments,
  listClinicalSignatures,
  registerClinicalSignature,
  uploadClinicalSignature,
} from './clinical-documents-api.js';
import { ANAMNESE_TEMPLATE_V1, getVisibleQuestions } from './anamnese-schema.js';
import { sanitizeAnamneseAnswers } from './anamnese-domain.js';
import {
  buildRemoteAnamneseUrl,
  renderAnamneseReview,
  renderAnamneseWizard,
} from './anamnese-panel.js';
import { createSignaturePad, sha256Blob } from './signature-pad.js';
import { isMinor } from './clientes-domain.js';

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function setStatus(root, message, kind = '') {
  let el = root.querySelector?.('[data-anamnese-status]');
  if (!el) {
    el = root.ownerDocument?.createElement?.('p');
    if (el) {
      el.className = 'bcg-status';
      el.dataset.anamneseStatus = '';
      root.prepend?.(el);
    }
  }
  if (el) { el.textContent = message || ''; el.dataset.kind = kind; }
}

export async function loadClientClinicalBundle({ client, clienteId }) {
  const [state, versions, alerts, documents] = await Promise.all([
    getAnamneseState({ client, clienteId }),
    listAnamneseVersions({ client, clienteId }),
    listClinicalAlerts({ client, clienteId, activeOnly: true }),
    listClinicalDocuments({ client, clienteId }),
  ]);
  return { state, versions: versions || [], alerts: alerts || [], documents: documents || [] };
}

function collectStepAnswers(form, step, answers) {
  const section = ANAMNESE_TEMPLATE_V1.sections[step];
  if (!section) return answers;
  const visible = new Set(getVisibleQuestions({ answers, template: { sections: [section] } }).map((q) => q.key));
  for (const question of section.questions.filter((q) => visible.has(q.key))) {
    const field = form.elements?.[question.key];
    if (!field) continue;
    if (question.type === 'checkbox') answers[question.key] = Boolean(field.checked);
    else if (question.type === 'multiselect') answers[question.key] = String(field.value || '').split(',').map((v) => v.trim()).filter(Boolean);
    else answers[question.key] = String(field.value || '').trim();
  }
  return answers;
}

function remoteBasePath() {
  const url = new URL('../anamnese-remota/', window.location.href);
  return url.pathname;
}

function renderSignatureStage({ clientRecord, document, existing = [] }) {
  const minor = isMinor(clientRecord?.data_nascimento);
  const subjectKind = minor ? 'responsavel' : 'paciente';
  const subjectDone = existing.some((item) => item.signer_kind === subjectKind);
  const professionalDone = existing.some((item) => item.signer_kind === 'profissional');
  const subjectName = minor ? (clientRecord?.responsavel_nome || 'Responsável legal') : (clientRecord?.nome || 'Cliente');
  return `<div class="bcg-signature-stage" data-signature-stage data-document-id="${escapeHtml(document.id)}" data-subject-kind="${subjectKind}">
    <p class="bcg-eyebrow">ASSINATURAS</p><h3>Confirmação da Anamnese Geral</h3><p>As assinaturas confirmam as informações registradas e sua revisão. Não representam diagnóstico, indicação automática ou garantia de resultado.</p>
    <div class="bcg-signature-grid">
      <section><strong>${escapeHtml(subjectName)}</strong>${subjectDone ? '<p class="bcg-status" data-kind="success">Assinatura já registrada.</p>' : '<canvas data-signature-canvas="subject" aria-label="Assinatura da cliente ou responsável"></canvas><button type="button" class="bcg-small-button" data-signature-clear="subject">Limpar</button>'}</section>
      <section><strong>Profissional responsável</strong>${professionalDone ? '<p class="bcg-status" data-kind="success">Assinatura profissional já registrada.</p>' : '<canvas data-signature-canvas="professional" aria-label="Assinatura da profissional"></canvas><button type="button" class="bcg-small-button" data-signature-clear="professional">Limpar</button>'}</section>
    </div>
    <div class="bcg-form-actions"><button type="button" class="bcg-button" data-signature-submit>Registrar assinaturas e finalizar</button><span class="bcg-status" data-signature-status></span></div>
  </div>`;
}

async function savePad({ client, documentId, signerKind, pad }) {
  if (!pad?.isValid()) throw new Error('Faça uma assinatura completa antes de continuar.');
  const blob = await pad.toBlob();
  const sha256 = await sha256Blob(blob);
  const storagePath = await uploadClinicalSignature({ client, documentId, signerKind, file: blob });
  await registerClinicalSignature({ client, documentId, signerKind, storagePath, sha256 });
}

export function initAnamneseController({ client, root, getClientRecord, getClinicalBundle, refresh }) {
  if (!client || !root) throw new Error('Contexto da anamnese inválido.');
  let draft = null;
  let pads = null;

  function panel() {
    return root.querySelector?.('[data-folder-panel="anamnese"]') || root;
  }

  async function startWizard(anamneseId, mode) {
    const data = await getAnamneseForEdit({ client, anamneseId });
    draft = { id: anamneseId, answers: sanitizeAnamneseAnswers({ ...(data.answers || {}) }, ANAMNESE_TEMPLATE_V1), step: 0, mode };
    panel().innerHTML = renderAnamneseWizard({ answers: draft.answers, step: draft.step });
  }

  function renderCurrentStep() {
    panel().innerHTML = renderAnamneseWizard({ answers: draft.answers, step: draft.step });
  }

  function renderReview() {
    const professionalReview = draft.mode === 'review';
    panel().innerHTML = `${renderAnamneseReview({ answers: draft.answers })}<div class="bcg-form-actions"><button type="button" class="bcg-small-button" data-anamnese-review-back>Voltar e revisar</button><button type="button" class="bcg-button" data-anamnese-review-confirm>${professionalReview ? 'Confirmar revisão profissional' : 'Enviar para revisão profissional'}</button></div><p class="bcg-status" data-anamnese-status></p>`;
  }

  async function startSignatures(anamneseId) {
    const bundle = getClinicalBundle?.() || {};
    const document = (bundle.documents || []).find((item) => item.source_id === anamneseId && item.status === 'aguardando_assinaturas');
    if (!document) throw new Error('Documento aguardando assinaturas não encontrado.');
    const existing = await listClinicalSignatures({ client, documentId: document.id });
    panel().innerHTML = renderSignatureStage({ clientRecord: getClientRecord?.(), document, existing });
    pads = {};
    const subjectCanvas = panel().querySelector?.('[data-signature-canvas="subject"]');
    const professionalCanvas = panel().querySelector?.('[data-signature-canvas="professional"]');
    if (subjectCanvas) pads.subject = createSignaturePad(subjectCanvas);
    if (professionalCanvas) pads.professional = createSignaturePad(professionalCanvas);
    pads.document = document;
    pads.existing = existing;
  }

  root.addEventListener('click', async (event) => {
    const action = event.target.closest?.('[data-anamnese-action]');
    if (action) {
      try {
        if (action.dataset.anamneseAction === 'begin') {
          await beginAnamnese({ client, clienteId: getClientRecord?.().id, source: 'presencial' });
          await refresh?.();
        } else if (action.dataset.anamneseAction === 'edit') {
          await startWizard(action.dataset.anamneseId, 'edit');
        } else if (action.dataset.anamneseAction === 'review') {
          await startWizard(action.dataset.anamneseId, 'review');
        } else if (action.dataset.anamneseAction === 'sign') {
          await startSignatures(action.dataset.anamneseId);
        } else if (action.dataset.anamneseAction === 'remote-link') {
          const result = await createRemoteLink({ client, anamneseId: action.dataset.anamneseId });
          const url = buildRemoteAnamneseUrl({ origin: window.location.origin, basePath: remoteBasePath(), token: result.token });
          const host = panel().querySelector?.('[data-anamnese-panel]') || panel();
          host.insertAdjacentHTML('afterbegin', `<div class="bcg-anamnese-link-box" data-remote-link-id="${escapeHtml(result.link_id || '')}"><strong>Link temporário — válido por 72h</strong><input class="bcg-input" readonly value="${escapeHtml(url)}"><div class="bcg-form-actions"><button type="button" class="bcg-small-button" data-copy-remote-link>Copiar link</button><button type="button" class="bcg-small-button" data-revoke-remote-link="${escapeHtml(result.link_id || '')}">Revogar</button></div></div>`);
        }
      } catch (error) { setStatus(panel(), error?.message || 'Não foi possível concluir a ação.', 'error'); }
      return;
    }

    const back = event.target.closest?.('[data-anamnese-nav="back"]');
    if (back && draft) { draft.step = Math.max(0, draft.step - 1); renderCurrentStep(); return; }

    if (event.target.closest?.('[data-anamnese-review-back]') && draft) {
      draft.step = ANAMNESE_TEMPLATE_V1.sections.length - 1; renderCurrentStep(); return;
    }

    if (event.target.closest?.('[data-anamnese-review-confirm]') && draft) {
      try {
        setStatus(panel(), 'Salvando revisão…');
        draft.answers = sanitizeAnamneseAnswers(draft.answers, ANAMNESE_TEMPLATE_V1);
        await saveAnamneseAnswers({ client, anamneseId: draft.id, answers: draft.answers });
        if (draft.mode === 'review') await markAnamneseReviewed({ client, anamneseId: draft.id });
        else await submitAnamneseForReview({ client, anamneseId: draft.id });
        draft = null;
        await refresh?.();
      } catch (error) { setStatus(panel(), error?.message || 'Não foi possível avançar a anamnese.', 'error'); }
      return;
    }

    const copy = event.target.closest?.('[data-copy-remote-link]');
    if (copy) {
      const input = copy.closest?.('.bcg-anamnese-link-box')?.querySelector?.('input');
      if (input?.value) {
        await navigator.clipboard?.writeText?.(input.value);
        copy.textContent = 'Link copiado';
      }
      return;
    }

    const revoke = event.target.closest?.('[data-revoke-remote-link]');
    if (revoke?.dataset.revokeRemoteLink) {
      try { await revokeRemoteLink({ client, linkId: revoke.dataset.revokeRemoteLink }); revoke.closest?.('.bcg-anamnese-link-box')?.remove?.(); }
      catch (error) { setStatus(panel(), error?.message || 'Não foi possível revogar o link.', 'error'); }
      return;
    }

    const clear = event.target.closest?.('[data-signature-clear]');
    if (clear && pads) { pads[clear.dataset.signatureClear]?.clear?.(); return; }

    const submitSignature = event.target.closest?.('[data-signature-submit]');
    if (submitSignature && pads?.document) {
      const status = panel().querySelector?.('[data-signature-status]');
      submitSignature.disabled = true;
      if (status) status.textContent = 'Registrando assinaturas…';
      try {
        const clientRecord = getClientRecord?.();
        const subjectKind = isMinor(clientRecord?.data_nascimento) ? 'responsavel' : 'paciente';
        const existingKinds = new Set((pads.existing || []).map((item) => item.signer_kind));
        if (!existingKinds.has(subjectKind)) await savePad({ client, documentId: pads.document.id, signerKind: subjectKind, pad: pads.subject });
        if (!existingKinds.has('profissional')) await savePad({ client, documentId: pads.document.id, signerKind: 'profissional', pad: pads.professional });
        await finalizeAnamneseDocument({ client, documentId: pads.document.id });
        if (status) status.textContent = 'Assinaturas registradas. Gerando PDF…';
        try { await generateAnamnesePdf({ client, documentId: pads.document.id }); }
        catch { /* estado pronto/erro fica preservado para retry do PDF */ }
        pads = null;
        await refresh?.();
      } catch (error) {
        if (status) { status.textContent = error?.message || 'Não foi possível concluir as assinaturas.'; status.dataset.kind = 'error'; }
      } finally { submitSignature.disabled = false; }
      return;
    }

    const download = event.target.closest?.('[data-download-clinical-document]');
    if (download) {
      const bundle = getClinicalBundle?.() || {};
      const doc = (bundle.documents || []).find((item) => item.id === download.dataset.downloadClinicalDocument);
      if (!doc?.storage_path) return;
      try {
        const url = await getClinicalDocumentUrl({ client, storagePath: doc.storage_path });
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      } catch (error) { setStatus(panel(), error?.message || 'Não foi possível abrir o PDF.', 'error'); }
    }
  });

  root.addEventListener('submit', async (event) => {
    const form = event.target.closest?.('[data-anamnese-step-form]');
    if (!form || !draft) return;
    event.preventDefault();
    collectStepAnswers(form, draft.step, draft.answers);
    draft.answers = sanitizeAnamneseAnswers(draft.answers, ANAMNESE_TEMPLATE_V1);
    try {
      await saveAnamneseAnswers({ client, anamneseId: draft.id, answers: draft.answers });
      if (draft.step < ANAMNESE_TEMPLATE_V1.sections.length - 1) { draft.step += 1; renderCurrentStep(); }
      else renderReview();
    } catch (error) { setStatus(panel(), error?.message || 'Não foi possível salvar esta etapa.', 'error'); }
  });

  return { startWizard, startSignatures };
}